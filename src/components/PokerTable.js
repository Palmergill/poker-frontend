// src/components/PokerTable.js
//
// Main React component for the poker table interface.
// This component handles:
// - Real-time game state display via WebSocket
// - Player action interface (bet, call, fold, etc.)
// - Visual representation of poker table, cards, and chips
// - Betting display positioned near player cards
// - Game flow management and user interactions

import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gameService, botService } from "../services/apiService";
import Spinner from "./Spinner";
import BotConfigModal from "./BotConfigModal";
import "./PokerTable.css";

/**
 * Main poker table component for displaying and interacting with poker games.
 * 
 * Key Features:
 * - Real-time game updates via WebSocket connection
 * - Interactive betting interface with sliders and buttons
 * - Visual display of player positions, cards, and chip stacks
 * - Individual player bet displays positioned near their cards
 * - Game state management (pot, current bet, player turn)
 * - Action history tracking and hand result displays
 */
const PokerTable = ({ onConnectionStatusChange }) => {
  // URL parameter for game ID and navigation
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Utility function to format currency amounts without unnecessary decimals
  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return num % 1 === 0 ? `$${num}` : `$${num.toFixed(2)}`;
  };

  // Utility function to format currency amounts in abbreviated form for mobile
  const formatCurrencyAbbr = (amount) => {
    const num = parseFloat(amount) || 0;
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`;
    } else {
      return num % 1 === 0 ? `$${num}` : `$${num.toFixed(2)}`;
    }
  };

  // Utility function to abbreviate player names for mobile display
  const abbreviateName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].length > 8 ? parts[0].substring(0, 8) : parts[0];
    }
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0];
    return `${firstName} ${lastInitial}.`;
  };

  // Utility function to detect mobile devices
  const isMobile = () => {
    return window.innerWidth <= 768;
  };

  // Utility functions for bot handling
  const isBot = (player) => {
    return player.player.is_bot === true;
  };

  const getBotDisplayName = (player) => {
    if (!isBot(player)) return player.player.user.username;
    return `🤖 ${player.player.user.username}`;
  };

  const getBotConfig = (player) => {
    return player.player.bot_config;
  };

  
  
  // Core game state
  const [game, setGame] = useState(null);                                    // Current game data from API
  const [loading, setLoading] = useState(true);                             // Loading state for initial fetch
  const [error, setError] = useState(null);                                 // Error state for display
  
  // User interface state
  const [message, setMessage] = useState(null);                             // Temporary popup messages
  const [messageType, setMessageType] = useState("error");                  // Message type: "error", "success", "info"
  const [showHandResults, setShowHandResults] = useState(false);            // Show hand results popup
  const [currentHandResult, setCurrentHandResult] = useState(null);         // Current hand result data
  
  // Betting action system state
  const [preAction, setPreAction] = useState(null);                         // Pre-selected action (call/fold ahead of turn)
  const [preActionAmount, setPreActionAmount] = useState(0);                // Pre-selected bet amount
  const [betAmount, setBetAmount] = useState(0);                            // Current bet input amount
  const [showBettingInterface, setShowBettingInterface] = useState(false);  // Show/hide betting controls
  const [betSliderValue, setBetSliderValue] = useState(0);                  // Bet slider position
  const [userModifiedSlider, setUserModifiedSlider] = useState(false);      // Track if user manually set slider
  const [lastBetAmount, setLastBetAmount] = useState(0);                    // Previous bet amount for quick re-bet
  
  // Connection and dialog state
  const [, setConnectionStatus] = useState("disconnected"); // WebSocket connection status
  const [buyInAmount, setBuyInAmount] = useState(0);                        // Buy-in amount for re-entry
  const [showBuyInDialog, setShowBuyInDialog] = useState(false);            // Show buy-in dialog
  const [startingGame, setStartingGame] = useState(false);                  // Loading state for start game button
  const [refreshingGame, setRefreshingGame] = useState(false);              // Loading state for refresh button
  const [takingAction, setTakingAction] = useState(false);                  // Loading state for betting actions
  const [cashingOut, setCashingOut] = useState(false);                     // Loading state for cash out button
  
  // Bot management state
  const [showBotModal, setShowBotModal] = useState(false);                  // Show bot configuration modal
  const [addingBot] = useState(false);                        // Loading state for adding bot
  
  // React refs for managing connections and timeouts
  const socketRef = useRef(null);                                           // WebSocket connection reference
  const reconnectTimeoutRef = useRef(null);                                 // Reconnection timeout reference
  const messageTimeoutRef = useRef(null);                                   // Message timeout reference

  // Get current user information from localStorage
  const getCurrentUserInfo = () => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        return user;
      }
      return null;
    } catch (e) {
      return null;
    }
  };


  // Process game state to detect new actions
  const processGameActions = (newGameState, oldGameState) => {
    if (!newGameState || !oldGameState) return;
    
    // Look for new actions in the current hand
    // TODO: Handle new actions if needed
    
    // Track player joins/leaves
    if (newGameState.players && oldGameState.players) {
      const newPlayerCount = newGameState.players.length;
      const oldPlayerCount = oldGameState.players.length;
      
      if (newPlayerCount > oldPlayerCount) {
        // TODO: Handle new players joining
      } else if (newPlayerCount < oldPlayerCount) {
        // TODO: Handle players leaving
      }
    }
  };

  useEffect(() => {
    // Fetch initial game data and hand history
    const fetchGame = async () => {
      try {
        const response = await gameService.getGame(id);
        setGame(response.data);
        
        // Fetch hand history for this game
        try {
          const historyResponse = await gameService.getHandHistory(id);
          
          if (historyResponse.data && historyResponse.data.hand_history) {
            // Transform backend format to frontend format
            const formattedHistory = historyResponse.data.hand_history.map(hand => {
              const winnerInfo = hand.winner_info;
              const potAmount = winnerInfo?.pot_amount || parseFloat(hand.pot_amount) || 0;
              
              return {
                timestamp: new Date(hand.completed_at).getTime(),
                winners: winnerInfo?.winners || [],
                potAmount: potAmount,
                type: winnerInfo?.type || 'Unknown',
                handNumber: hand.hand_number
              };
            });
          }
        } catch (historyErr) {
          // Don't show error to user, hand history is not critical
        }
        
        setLoading(false);

        // Connect to WebSocket after getting initial game state with small delay
        setTimeout(() => {
          connectWebSocket(response.data.id);
        }, 100); // Small delay to ensure state is set
      } catch (err) {
        if (err.response?.status === 404) {
          showMessage("Game not found. Redirecting to tables...", "info");
          setTimeout(() => {
            navigate("/tables");
          }, 2000);
        } else {
          showMessage("Failed to load game", "error");
        }
        setLoading(false);
      }
    };

    fetchGame();

    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, [id, navigate]);

  // Initialize bet slider when component mounts or game state changes
  useEffect(() => {
    if (game && game.table && game.players) {
      const currentUser = getCurrentUserInfo();
      if (!currentUser) return;
      
      // Find current player without calling findCurrentPlayer function
      let currentPlayer = null;
      if (currentUser.id) {
        currentPlayer = game.players.find(
          (p) => p.player.user.id === currentUser.id
        );
      }
      if (!currentPlayer && currentUser.username) {
        currentPlayer = game.players.find(
          (p) => p.player.user.username === currentUser.username
        );
      }
      
      if (currentPlayer) {
        const currentBet = parseFloat(game.current_bet || 0);
        const minBet = parseFloat(game.table.big_blind || 0);
        const minRaise = Math.max(currentBet * 2, currentBet + minBet);
        const initialValue = currentBet === 0 ? minBet : minRaise;
        
        // Only reset slider if user hasn't manually modified it
        if (!userModifiedSlider) {
          setBetSliderValue(initialValue);
          setBetAmount(initialValue);
        }
      }
    }
  }, [game?.current_bet, game?.table?.big_blind, game?.players, userModifiedSlider]);

  // Auto-submit pre-action when it becomes player's turn
  useEffect(() => {
    if (!game || !game.players) return;
    
    const currentUser = getCurrentUserInfo();
    if (!currentUser) return;
    
    // Find current player without calling findCurrentPlayer function
    let currentPlayer = null;
    if (currentUser.id) {
      currentPlayer = game.players.find(
        (p) => p.player.user.id === currentUser.id
      );
    }
    if (!currentPlayer && currentUser.username) {
      currentPlayer = game.players.find(
        (p) => p.player.user.username === currentUser.username
      );
    }
    
    // Check if it's player's turn without calling isPlayerTurn function
    const isMyTurn = currentPlayer &&
      game.current_player &&
      game.current_player.id === currentPlayer.player.id;
    
    if (isMyTurn && preAction && currentPlayer && !currentPlayer.cashed_out) {
      const executePreAction = async () => {
        try {
          // Fix NaN issues with proper validation
          const currentBet = parseFloat(game.current_bet || 0) || 0;
          const playerBet = parseFloat(currentPlayer.current_bet || 0) || 0;
          const canCheck = currentBet === playerBet;
          const minBet = parseFloat(game.table?.big_blind || 0) || 0;
          const minRaise = Math.max(currentBet * 2, currentBet + minBet);
          
          // Validate pre-action is still valid
          if (preAction === 'CHECK_FOLD') {
            if (canCheck) {
              await handleAction('CHECK');
            } else {
              await handleAction('FOLD');
            }
          } else if (preAction === 'CALL' && !canCheck) {
            await handleAction('CALL');
          } else if (preAction === 'CHECK' && canCheck) {
            await handleAction('CHECK');
          } else if (preAction === 'FOLD') {
            await handleAction('FOLD');
          } else if (preAction === 'BET' && currentBet === 0 && preActionAmount >= minBet) {
            await handleAction('BET', preActionAmount);
          } else if (preAction === 'RAISE' && currentBet > 0 && preActionAmount >= minRaise) {
            await handleAction('RAISE', preActionAmount);
          }
          // Clear pre-action after execution
          setPreAction(null);
          setPreActionAmount(0);
        } catch (error) {
          console.error('Failed to execute pre-action:', error);
        }
      };

      // Small delay to ensure UI updates
      setTimeout(executePreAction, 100);
    }
  }, [game?.current_player, preAction, preActionAmount, game?.current_bet, game?.table?.big_blind, game?.players]);

  // Poll for game updates every 3 seconds as backup to WebSocket
  useEffect(() => {
    if (!game) return; // Don't poll until we have initial game data
    
    const pollInterval = setInterval(async () => {
      try {
        // Fetch updated game data
        const response = await gameService.getGame(id);
        const updatedGame = response.data;
        setGame(updatedGame);
        
        // Check if we need to restore hand results popup after browser refresh
        // This happens when game phase is WAITING_FOR_PLAYERS but we don't have a popup showing
        if (updatedGame.phase === 'WAITING_FOR_PLAYERS' && 
            updatedGame.winner_info && 
            !showHandResults) {
          
          // Check if current player is already ready - if so, don't restore popup
          const currentUserInfo = getCurrentUserInfo();
          const currentPlayerGame = updatedGame.players?.find(player => 
            currentUserInfo && (
              currentUserInfo.id === player.player.user.id || 
              currentUserInfo.username === player.player.user.username
            )
          );
          const currentPlayerIsReady = currentPlayerGame?.ready_for_next_hand || false;
          const currentPlayerIsCashedOut = currentPlayerGame?.cashed_out || false;
          
          if (!currentPlayerIsReady && !currentPlayerIsCashedOut) {
            
            // Handle winner_info which comes from API as already parsed object
            let winnerInfo;
            if (typeof updatedGame.winner_info === 'string') {
              try {
                winnerInfo = JSON.parse(updatedGame.winner_info);
              } catch (e) {
                console.warn('Failed to parse winner_info as JSON:', e);
                winnerInfo = {};
              }
            } else {
              // Already an object
              winnerInfo = updatedGame.winner_info || {};
            }
            
            const restoredHandResult = {
              timestamp: Date.now(),
              winners: winnerInfo.winners || [],
              potAmount: winnerInfo.pot_amount || 0,
              type: winnerInfo.type || 'Unknown',
              handNumber: updatedGame.hand_count || 1,
              allPlayers: updatedGame.players || []
            };
            
            setCurrentHandResult(restoredHandResult);
            setShowHandResults(true);
          } else {
          }
        }
      } catch (err) {
        // Silently fail polling errors to avoid spam
        console.warn('Polling update failed:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [id, game, showHandResults]);

  // Display temporary popup messages to user
  const showMessage = (text, type = "error", duration = 3000) => {
    // Clear any existing timeout
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    
    setMessage(text);
    setMessageType(type);
    
    // Auto-hide after duration
    messageTimeoutRef.current = setTimeout(() => {
      setMessage(null);
    }, duration);
  };

  // Connect to WebSocket for real-time game updates
  const connectWebSocket = (gameId) => {
    // Check if WebSocket is supported
    if (!gameService.isWebSocketSupported()) {
      showMessage("Real-time updates not supported in this browser", "error");
      return;
    }

    setConnectionStatus("connecting");
    if (onConnectionStatusChange) onConnectionStatusChange("connecting");

    socketRef.current = gameService.connectToGameSocket(
      gameId,
      // onMessage
      (data) => {
        // Check if this is a game summary notification (all players cashed out)
        if (data.type === 'game_summary_available') {
          
          // Show a notification that the game has ended
          showMessage("Game completed! All players have cashed out. Redirecting to summary...", "info");
          
          // Redirect to game summary page after a brief delay
          setTimeout(() => {
            navigate(`/games/${gameId}/summary`);
          }, 2000);
          
          return;
        }
        
        // Handle regular game updates
        // Preserve any existing card data that might have been loaded from API
        setGame(currentGame => {
          if (!currentGame) {
            return data;
          }
          
          // Merge the update with existing game state, preserving player cards if they exist
          const updatedGame = { ...data };
          
          // If the incoming data has players with empty cards, but current game has cards, keep the existing cards
          if (updatedGame.players && currentGame.players) {
            updatedGame.players = updatedGame.players.map(newPlayer => {
              const existingPlayer = currentGame.players.find(p => p.id === newPlayer.id);
              
              // If existing player has cards but new player doesn't, keep existing cards
              if (existingPlayer && existingPlayer.cards && 
                  (!newPlayer.cards || 
                   (Array.isArray(newPlayer.cards) && newPlayer.cards.length === 0) ||
                   (newPlayer.cards.cards && newPlayer.cards.cards.length === 0))) {
                
                return { ...newPlayer, cards: existingPlayer.cards };
              }
              
              return newPlayer;
            });
          }
          
          // Check for hand completion and update history
          // Check if winner_info is present (hand just completed) or if hand_count increased (new hand started)
          const handJustCompleted = updatedGame.winner_info && (!currentGame.winner_info || 
              JSON.stringify(updatedGame.winner_info) !== JSON.stringify(currentGame.winner_info));
          
          const newHandStarted = updatedGame.hand_count > (currentGame.hand_count || 0);
          
          // If new hand started but we have winner_info from previous hand, show popup
          if ((handJustCompleted || newHandStarted) && updatedGame.winner_info) {
            
            // Check if current player is already ready - if so, don't show popup
            const currentUserInfo = getCurrentUserInfo();
            const currentPlayerGame = updatedGame.players?.find(player => 
              currentUserInfo && (
                currentUserInfo.id === player.player.user.id || 
                currentUserInfo.username === player.player.user.username
              )
            );
            const currentPlayerIsReady = currentPlayerGame?.ready_for_next_hand || false;
            const currentPlayerIsCashedOut = currentPlayerGame?.cashed_out || false;
            
            const winnerInfo = updatedGame.winner_info;
            
            const newHistoryEntry = {
              timestamp: Date.now(),
              winners: winnerInfo.winners || [],
              potAmount: winnerInfo.pot_amount || 0,
              type: winnerInfo.type || 'Unknown',
              handNumber: updatedGame.hand_count || currentGame.hand_count || 0,
              allPlayers: updatedGame.players || [] // Store all players for money change tracking
            };
            
            // Only show popup if we don't already have one showing for this hand AND current player is not ready AND not cashed out
            // Special handling for split pots - always show if multiple winners
            const isSplitPot = newHistoryEntry.winners && newHistoryEntry.winners.length > 1;
            const shouldShowPopup = (!showHandResults || (currentHandResult && currentHandResult.handNumber !== newHistoryEntry.handNumber)) && !currentPlayerIsReady && !currentPlayerIsCashedOut;
            
            if (shouldShowPopup || (isSplitPot && !showHandResults)) {
              setCurrentHandResult(newHistoryEntry);
              setShowHandResults(true);
            } else {
              if (currentPlayerIsReady) {
              } else if (currentPlayerIsCashedOut) {
              } else {
              }
            }
          }
          
          // Check if the game is finished and all players have cashed out
          if (updatedGame.status === 'FINISHED' && updatedGame.players) {
            const allPlayersCashedOut = updatedGame.players.every(player => player.cashed_out);
            const hasPlayers = updatedGame.players.length > 0;
            
            if (allPlayersCashedOut && hasPlayers) {
              showMessage("Game completed! All players have cashed out. Redirecting to summary...", "info");
              
              setTimeout(() => {
                navigate(`/games/${gameId}/summary`);
              }, 2000);
            }
          }
          
          // Process actions for recent actions tracking
          processGameActions(updatedGame, currentGame);
          
          return updatedGame;
        });
        
        setConnectionStatus("connected");
        if (onConnectionStatusChange) onConnectionStatusChange("connected");
        setError(null); // Clear any previous errors
        setMessage(null); // Clear any popup messages
      },
      // onError
      (errorMessage) => {
        setConnectionStatus("error");
        if (onConnectionStatusChange) onConnectionStatusChange("error");
        
        // Don't attempt to reconnect if game not found
        if (errorMessage === "Game not found") {
          showMessage("Game no longer exists. Redirecting to tables...", "info");
          setTimeout(() => {
            navigate("/tables");
          }, 2000);
          return;
        }
        
        showMessage(`Connection error: ${errorMessage}`, "error");

        // Try to reconnect after 3 seconds for other errors
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          // Only reconnect if we still have the game ID (component not unmounted)
          if (gameId && id === gameId) {
            connectWebSocket(gameId);
          }
        }, 3000);
      },
      // onClose
      (event) => {
        setConnectionStatus("disconnected");
        if (onConnectionStatusChange) onConnectionStatusChange("disconnected");

        // Don't reconnect for: normal closure, auth failure, permission denied, or game not found
        if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003 && event.code !== 4004) {

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            // Only reconnect if we still have the game ID (component not unmounted)
            if (gameId && id === gameId) {
              connectWebSocket(gameId);
            }
          }, 3000);
        } else if (event.code === 4004) {
          // Game not found - redirect to tables
          showMessage("Game no longer exists. Redirecting to tables...", "info");
          setTimeout(() => {
            navigate("/tables");
          }, 2000);
        }
      }
    );

    if (!socketRef.current) {
      setConnectionStatus("error");
      showMessage("Failed to create WebSocket connection", "error");
    }
  };

  // Start the poker game
  const handleStartGame = async () => {
    setStartingGame(true);
    try {
      await gameService.startGame(id);
      // Game state will be updated via WebSocket
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to start game", "error");
    } finally {
      setStartingGame(false);
    }
  };

  // Leave the poker table completely (only works if already cashed out)
  const handleLeaveTable = async () => {
    const currentPlayer = findCurrentPlayer();
    if (!currentPlayer) {
      showMessage("You are not at this table", "error");
      return;
    }

    // Can only leave if already cashed out
    if (!currentPlayer.cashed_out) {
      showMessage("You must cash out before leaving the table", "error");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to leave the table? You will take your remaining $${currentPlayer.stack} chips with you.`
    );
    
    if (!confirmed) {
      return;
    }

    try {
      const response = await gameService.leaveGame(id);
      showMessage(`🚪 Left table with $${response.data.left_with}!`, "success", 2000);
      setTimeout(() => {
        navigate("/tables");
      }, 2000);
    } catch (err) {
      showMessage(err.response?.data?.error || "Failed to leave table", "error");
      
      // Even if the backend call fails, still navigate away after showing error
      setTimeout(() => {
        navigate("/tables");
      }, 2000);
    }
  };

  // Refresh game state from server
  const handleRefreshGame = async () => {
    setRefreshingGame(true);
    try {
      const response = await gameService.resetGameState(id);
      setGame(response.data.game);
      showMessage("✅ Game state refreshed successfully", "success");
    } catch (err) {
      showMessage(
        `Failed to refresh game: ${err.response?.data?.error || err.message}`,
        "error"
      );
    } finally {
      setRefreshingGame(false);
    }
  };

  // Handle player poker actions (fold, call, bet, raise, check)
  const handleAction = async (actionTypeParam, amountParam = null) => {
    setTakingAction(true);
    
    try {
      // Validate action type
      if (!['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'].includes(actionTypeParam)) {
        showMessage("Invalid action type", "error");
        setTakingAction(false);
        return;
      }

      const amountToUse = amountParam !== null ? amountParam : betAmount;
      
      // Validate amount for betting actions
      if ((actionTypeParam === 'BET' || actionTypeParam === 'RAISE') && 
          (isNaN(amountToUse) || amountToUse < 0)) {
        showMessage("Invalid bet amount", "error");
        setTakingAction(false);
        return;
      }
      
      // Store bet amount for "Previous Bet" feature
      if ((actionTypeParam === 'BET' || actionTypeParam === 'RAISE') && amountToUse > 0) {
        setLastBetAmount(amountToUse);
      }
      
      // Add a small delay to ensure spinner is visible
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await gameService.takeAction(id, actionTypeParam, amountToUse);
      
      // Clear any pre-actions and close betting interface
      setPreAction(null);
      setPreActionAmount(0);
      setShowBettingInterface(false);
      setUserModifiedSlider(false); // Reset slider modification flag
      
      // Game state will be updated via WebSocket
      setError(null); // Clear any previous errors
      setMessage(null); // Clear any popup messages
    } catch (err) {
      console.error('handleAction error:', err);
      showMessage(
        `${err.response?.data?.error || err.message}`,
        "error"
      );
    } finally {
      setTakingAction(false);
    }
  };

  // Handle player ready for next hand
  const handlePlayerReady = async () => {
    try {
      await gameService.setPlayerReady(id);
      setShowHandResults(false);
      setCurrentHandResult(null);
      showMessage("✅ You're ready for the next hand!", "success", 2000);
    } catch (err) {
      showMessage(`Failed to set ready status: ${err.response?.data?.error || err.message}`, "error");
    }
  };

  // Handle cash out from active play (stay at table but become inactive)
  const handleCashOut = async () => {
    const currentPlayer = findCurrentPlayer();
    if (!currentPlayer) {
      showMessage("You are not at this table", "error");
      return;
    }

    if (currentPlayer.cashed_out) {
      showMessage("You have already cashed out", "error");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cash out? You will stay at the table as a spectator and can buy back in later or leave completely."
    );
    
    if (!confirmed) {
      return;
    }

    setCashingOut(true);
    try {
      await gameService.cashOut(id);
      setShowHandResults(false);
      setCurrentHandResult(null);
      showMessage("💰 Cashed out successfully! You can now buy back in or leave the table.", "success", 3000);
    } catch (err) {
      showMessage(`Failed to cash out: ${err.response?.data?.error || err.message}`, "error");
    } finally {
      setCashingOut(false);
    }
  };

  // Handle buy back in after cashing out
  const handleBuyBackIn = async () => {
    const currentPlayer = findCurrentPlayer();
    if (!currentPlayer) {
      showMessage("You are not at this table", "error");
      return;
    }

    if (!currentPlayer.cashed_out) {
      showMessage("You have not cashed out, so you cannot buy back in", "error");
      return;
    }

    if (!buyInAmount || buyInAmount <= 0) {
      showMessage("Please enter a valid buy-in amount", "error");
      return;
    }

    // Validate buy-in amount against table limits
    const table = game.table;
    if (!table) {
      showMessage("Table information not available. Cannot buy back in to a finished game.", "error");
      return;
    }
    if (buyInAmount < table.min_buy_in) {
      showMessage(`Buy-in must be at least $${table.min_buy_in}`, "error");
      return;
    }
    if (buyInAmount > table.max_buy_in) {
      showMessage(`Buy-in cannot exceed $${table.max_buy_in}`, "error");
      return;
    }

    try {
      const response = await gameService.buyBackIn(id, buyInAmount);
      setShowBuyInDialog(false);
      setBuyInAmount(0);
      showMessage(
        `✅ Bought back in with $${response.data.buy_in_amount}! Total stack: $${response.data.total_stack}`,
        "success",
        3000
      );
    } catch (err) {
      showMessage(`Failed to buy back in: ${err.response?.data?.error || err.message}`, "error");
    }
  };

  // Bot management functions
  const handleBotAdded = (botData) => {
    showMessage(`✅ Bot ${botData.bot_name} added to the table!`, "success", 3000);
    // Game state will be updated via WebSocket, no need to manually refresh
  };

  const handleRemoveBot = async (botId, botName) => {
    if (!game.table) return;
    
    const confirmed = window.confirm(`Are you sure you want to remove bot ${botName}?`);
    if (!confirmed) return;

    try {
      await botService.removeBotFromTable(game.table.id, botId);
      showMessage(`✅ Bot ${botName} removed from the table`, "success", 3000);
      // Game state will be updated via WebSocket
    } catch (err) {
      console.error('Error removing bot:', err);
      showMessage(
        `Failed to remove bot: ${err.response?.data?.error || err.message}`,
        "error"
      );
    }
  };

  const getBotPlayers = () => {
    if (!game.players) return [];
    return game.players.filter(player => isBot(player));
  };

  const canAddBot = () => {
    if (!game.table) return false;
    const currentPlayerCount = game.players ? game.players.length : 0;
    return currentPlayerCount < game.table.max_players && game.status === 'WAITING';
  };

  if (loading) {
    return <div className="loading">Loading game...</div>;
  }

  if (!game && !loading) {
    return <div className="error">Game not found</div>;
  }

  // Find the current player in the game
  const findCurrentPlayer = () => {
    if (!game.players) return null;

    const currentUser = getCurrentUserInfo();
    if (!currentUser) return null;

    if (currentUser.id) {
      const playerById = game.players.find(
        (p) => p.player.user.id === currentUser.id
      );
      if (playerById) return playerById;
    }

    if (currentUser.username) {
      const playerByUsername = game.players.find(
        (p) => p.player.user.username === currentUser.username
      );
      if (playerByUsername) return playerByUsername;
    }

    return null;
  };

  // Check if it's the current player's turn
  const isPlayerTurn = () => {
    const currentPlayer = findCurrentPlayer();
    return (
      currentPlayer &&
      game.current_player &&
      game.current_player.id === currentPlayer.player.id
    );
  };

  // Render hand end action buttons (Ready for Next Hand / Cash Out)
  const renderHandEndButtons = () => {
    const currentPlayer = findCurrentPlayer();
    if (!currentPlayer) return null;

    return (
      <div className="poker-action-area hand-end-actions">
        <div className="hand-end-info">
          <div className="pot-won">Pot: {formatCurrency(currentHandResult?.potAmount || 0)}</div>
          
          {/* Display winner information prominently */}
          {currentHandResult?.winners && currentHandResult.winners.length > 0 && (
            <div className="winner-announcement">
              {currentHandResult.winners.length === 1 ? (
                <div className="single-winner">
                  <div className="winner-text">🏆 Winner: <span className="winner-name">{currentHandResult.winners[0].player_name}</span></div>
                  {currentHandResult.winners[0].hand_name && (
                    <div className="winning-hand-type">with {currentHandResult.winners[0].hand_name}</div>
                  )}
                </div>
              ) : (
                <div className="split-pot">
                  <div className="split-pot-text">🤝 Split Pot ({currentHandResult.winners.length} winners)</div>
                  <div className="split-winners">
                    {currentHandResult.winners.map((winner, index) => (
                      <div key={index} className="split-winner">
                        <span className="winner-name">{winner.player_name}</span>
                        {winner.hand_name && <span className="winner-hand"> ({winner.hand_name})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="hand-end-buttons">
          <button 
            className="ready-btn primary-action"
            onClick={handlePlayerReady}
          >
            ✅ Ready for Next Hand
          </button>
          <button 
            className="cash-out-btn secondary-action"
            onClick={handleCashOut}
            disabled={cashingOut}
          >
            {cashingOut && <Spinner size="small" />}
            {cashingOut ? "Cashing Out..." : "💰 Cash Out"}
          </button>
        </div>
        
        {/* Show readiness status */}
        {game && game.players && (
          <div className="readiness-status">
            <div className="status-header">Player Status:</div>
            <div className="players-ready-grid">
              {game.players.map(player => {
                const isReady = player.ready_for_next_hand || false;
                const isCurrentUser = getCurrentUserInfo() && 
                  (getCurrentUserInfo().id === player.player.user.id || 
                   getCurrentUserInfo().username === player.player.user.username);
                
                return (
                  <div key={player.id} className={`player-ready-item ${isReady ? 'ready' : 'not-ready'} ${isCurrentUser ? 'current-user' : ''}`}>
                    <span className={`player-name ${isBot(player) ? 'bot-player' : ''}`}>
                      {getBotDisplayName(player)}
                    </span>
                    <span className="ready-icon">{isReady ? '✅' : '⏳'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Mobile-specific waiting phase player status display
  const renderMobileWaitingStatus = () => {
    if (game.phase !== "WAITING_FOR_PLAYERS") return null;
    
    const currentUserInfo = getCurrentUserInfo();
    const currentPlayerGame = game.players?.find(player => 
      currentUserInfo && (
        currentUserInfo.id === player.player.user.id || 
        currentUserInfo.username === player.player.user.username
      )
    );
    const currentPlayerIsReady = currentPlayerGame?.ready_for_next_hand || false;
    
    // Only show if current player is ready (has clicked "Ready for Next Hand")
    if (!currentPlayerIsReady) return null;

    return (
      <div className="mobile-waiting-status">
        <div className="waiting-header">Waiting for Players</div>
        <div className="waiting-players-grid">
          {game.players.map(player => {
            const isReady = player.ready_for_next_hand || false;
            const isCurrentUser = currentUserInfo && 
              (currentUserInfo.id === player.player.user.id || 
               currentUserInfo.username === player.player.user.username);
            
            return (
              <div key={player.id} className={`waiting-player-item ${isReady ? 'ready' : 'waiting'} ${isCurrentUser ? 'current-user' : ''}`}>
                <span className={`waiting-player-name ${isBot(player) ? 'bot-player' : ''}`}>
                  {isBot(player) ? `🤖 ${abbreviateName(player.player.user.username)}` : abbreviateName(player.player.user.username)}
                </span>
                <span className="waiting-status-icon">{isReady ? '✅' : '🕐'}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Enhanced action system with pre-actions and smart betting
  const renderActionButtons = () => {
    // Show mobile waiting status if in waiting phase and user is ready (mobile only)
    if (game.phase === "WAITING_FOR_PLAYERS" && isMobile()) {
      const currentUserInfo = getCurrentUserInfo();
      const currentPlayerGame = game.players?.find(player => 
        currentUserInfo && (
          currentUserInfo.id === player.player.user.id || 
          currentUserInfo.username === player.player.user.username
        )
      );
      const currentPlayerIsReady = currentPlayerGame?.ready_for_next_hand || false;
      
      if (currentPlayerIsReady) {
        return renderMobileWaitingStatus();
      }
    }
    
    // Show hand end buttons if hand just completed
    if (currentHandResult && showHandResults) {
      return renderHandEndButtons();
    }

    if (!game || game.status !== "PLAYING") {
      return null;
    }

    const currentPlayer = findCurrentPlayer();
    if (!currentPlayer || currentPlayer.cashed_out) {
      return null;
    }
    
    // Check if player has folded (not active but not cashed out)
    const isFolded = !currentPlayer.is_active && !currentPlayer.cashed_out;
    
    // Get current user info for balance display
    const currentUserInfo = getCurrentUserInfo();

    const isMyTurn = isPlayerTurn();
    // Fix NaN issues with proper fallbacks and validation
    const currentBet = parseFloat(game.current_bet || 0) || 0;
    const playerBet = parseFloat(currentPlayer.current_bet || 0) || 0;
    const playerStack = parseFloat(currentPlayer.stack || 0) || 0;
    const callAmount = Math.max(0, currentBet - playerBet);
    const canCheck = currentBet === playerBet;
    const minBet = parseFloat(game.table?.big_blind || 0) || 0;
    const minRaise = Math.max(currentBet * 2, currentBet + minBet);
    const pot = parseFloat(game.pot || 0) || 0;
    

    // Auto-submit pre-action logic moved to component level useEffect

    const getActionButtonClass = (action) => {
      let baseClass = 'action-btn';
      if (preAction === action) baseClass += ' pre-selected';
      if (!isMyTurn) baseClass += ' pre-action-mode';
      return baseClass;
    };

    const handlePreAction = (action, amount = 0) => {
      if (isMyTurn) {
        // Execute immediately if it's player's turn
        handleAction(action, amount);
      } else {
        // Set as pre-action
        setPreAction(action);
        setPreActionAmount(amount);
      }
    };

    // If player has folded, show simplified interface
    if (isFolded) {
      return (
        <div className="enhanced-action-controls folded-player">
          {/* Player Balance Info */}
          <div className="player-balance-info">
            <div className="balance-display">
              <span className="balance-label">Your Balance:</span>
              <span className="balance-amount">{formatCurrencyAbbr(currentPlayer.stack || 0)}</span>
            </div>
            
            {currentUserInfo && (
              <div className="player-name-display">
                {abbreviateName(currentUserInfo.username)}
              </div>
            )}
          </div>
          
          {/* Folded status indicator */}
          <div className="turn-indicator">
            <span className="folded-status">🗂️ You have folded</span>
          </div>

          {/* Only show cash out button */}
          <div className="action-buttons-row">
            <button 
              className="cash-out-btn"
              onClick={handleCashOut}
              disabled={cashingOut}
              title="Cash out and become a spectator"
            >
              {cashingOut && <Spinner size="small" />}
              {cashingOut ? "Cashing Out..." : "💰 Cash Out"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="enhanced-action-controls">
        {/* Player Balance Info */}
        <div className="player-balance-info">
          <div className="balance-display">
            <span className="balance-label">Your Balance:</span>
            <span className="balance-amount">{formatCurrencyAbbr(currentPlayer.stack || 0)}</span>
          </div>
          
          {/* Current User's Hole Cards */}
          <div className="user-hole-cards">
            {(() => {
              // Get current user's cards
              let playerCards = [];
              if (currentPlayer.cards) {
                if (Array.isArray(currentPlayer.cards)) {
                  playerCards = currentPlayer.cards;
                } else if (currentPlayer.cards.cards) {
                  playerCards = currentPlayer.cards.cards;
                }
              }
              
              if (!playerCards || playerCards.length === 0) {
                return (
                  <div className="no-cards-message">
                    Waiting for cards...
                  </div>
                );
              }
              
              return playerCards.map((card, cardIndex) => {
                const rank = card.slice(0, -1);
                const suit = card.slice(-1);
                const suitSymbols = { S: "♠", H: "♥", D: "♦", C: "♣" };
                
                return (
                  <div
                    key={cardIndex}
                    className="user-hole-card"
                    data-suit={suit}
                  >
                    <div className="card-rank">{rank}</div>
                    <div className="card-suit">{suitSymbols[suit]}</div>
                  </div>
                );
              });
            })()}
          </div>
          
          {currentUserInfo && (
            <div className="player-name-display">
              {abbreviateName(currentUserInfo.username)}
            </div>
          )}
        </div>
        
        {/* Turn indicator */}
        <div className="turn-indicator">
          {isMyTurn ? (
            <span className="my-turn">🎯 Your Turn</span>
          ) : (
            <span className="waiting-turn">
              {preAction ? `⏳ Queued: ${preAction}${preActionAmount > 0 ? ` $${preActionAmount}` : ''}` : '⏳ Waiting for your turn'}
            </span>
          )}
        </div>

        {/* Always visible action buttons */}
        <div className="action-buttons-row">
          {/* Fold Button */}
          <button
            className={getActionButtonClass('FOLD')}
            onClick={() => handlePreAction('FOLD')}
            disabled={takingAction}
          >
            {takingAction && <Spinner size="small" />}
            {preAction === 'FOLD' ? '✅ ' : ''}Fold
          </button>

          {/* Check/Call Button */}
          {canCheck ? (
            <button
              className={getActionButtonClass('CHECK')}
              onClick={() => handlePreAction('CHECK')}
              disabled={takingAction}
            >
              {takingAction && <Spinner size="small" />}
              {preAction === 'CHECK' ? '✅ ' : ''}Check
            </button>
          ) : (
            <button
              className={getActionButtonClass('CALL')}
              onClick={() => {
                handlePreAction('CALL');
              }}
              disabled={takingAction || callAmount > playerStack}
            >
              {takingAction && <Spinner size="small" />}
              {preAction === 'CALL' ? '✅ ' : ''}Call {formatCurrency(callAmount)}
            </button>
          )}

          {/* Smart Check/Fold Button */}
          {!isMyTurn && currentBet === 0 && (
            <button
              className={getActionButtonClass('CHECK_FOLD')}
              onClick={() => handlePreAction('CHECK_FOLD')}
              disabled={takingAction}
              title="Will check if no bet is made, or fold if someone bets"
            >
              {takingAction && <Spinner size="small" />}
              {preAction === 'CHECK_FOLD' ? '✅ ' : ''}Check/Fold
            </button>
          )}

          {/* Bet/Raise Toggle */}
          <button
            className="betting-toggle-btn"
            onClick={() => setShowBettingInterface(!showBettingInterface)}
            disabled={takingAction}
          >
            {currentBet === 0 ? '💰 Bet' : '⬆️ Raise'}
          </button>

        </div>

        {/* Enhanced Betting Interface */}
        {showBettingInterface && (
          <div className="betting-interface">
            {/* Quick Bet Options */}
            <div className="quick-bet-section">
              <h4>Quick Bets</h4>
              <div className="quick-bet-buttons">
                {/* Minimum Bet/Raise */}
                {currentBet === 0 ? (
                  <button
                    className="quick-bet-btn"
                    onClick={() => {
                      setBetAmount(minBet);
                      setBetSliderValue(minBet);
                      handlePreAction('BET', minBet);
                    }}
                    disabled={takingAction || minBet > playerStack}
                  >
                    {takingAction && <Spinner size="small" />}
                    Min Bet {formatCurrency(minBet)}
                  </button>
                ) : (
                  <button
                    className="quick-bet-btn"
                    onClick={() => {
                      setBetAmount(minRaise);
                      setBetSliderValue(minRaise);
                      handlePreAction('RAISE', minRaise);
                    }}
                    disabled={takingAction || minRaise > playerStack + playerBet}
                  >
                    {takingAction && <Spinner size="small" />}
                    Min Raise {formatCurrency(minRaise)}
                  </button>
                )}

                {/* Pot Fraction Bets */}
                {[0.25, 0.5, 0.75, 1].map(fraction => {
                  const potBet = currentBet === 0 
                    ? Math.max(pot * fraction, minBet)
                    : Math.max(currentBet + pot * fraction, minRaise);
                  const isValidBet = !isNaN(potBet) && potBet > 0 && potBet <= (currentBet === 0 ? playerStack : playerStack + playerBet);
                  
                  return (
                    <button
                      key={fraction}
                      className="quick-bet-btn"
                      onClick={() => {
                        if (isValidBet) {
                          setBetAmount(potBet);
                          setBetSliderValue(potBet);
                          handlePreAction(currentBet === 0 ? 'BET' : 'RAISE', potBet);
                        }
                      }}
                      disabled={takingAction || !isValidBet}
                      title={`${fraction * 100}% of pot ($${(pot * fraction).toFixed(2)})`}
                    >
                      {takingAction && <Spinner size="small" />}
                      {fraction === 1 ? 'Pot' : `${fraction * 100}%`} {isNaN(potBet) ? '$0' : formatCurrency(potBet)}
                    </button>
                  );
                })}

                {/* All-in */}
                <button
                  className="quick-bet-btn all-in-btn"
                  onClick={() => {
                    if (playerStack > 0) {
                      const allInAmount = currentBet === 0 ? playerStack : playerStack + playerBet;
                      setBetAmount(allInAmount);
                      setBetSliderValue(allInAmount);
                      handlePreAction(currentBet === 0 ? 'BET' : 'RAISE', allInAmount);
                    }
                  }}
                  disabled={takingAction}
                >
                  {takingAction && <Spinner size="small" />}
                  All-In {formatCurrency(currentBet === 0 ? playerStack : playerStack + playerBet)}
                </button>

                {/* Previous Bet */}
                {lastBetAmount > 0 && (
                  <button
                    className="quick-bet-btn"
                    onClick={() => {
                      setBetAmount(lastBetAmount);
                      setBetSliderValue(lastBetAmount);
                      handlePreAction(currentBet === 0 ? 'BET' : 'RAISE', lastBetAmount);
                    }}
                    disabled={takingAction || lastBetAmount > (currentBet === 0 ? playerStack : playerStack + playerBet)}
                  >
                    {takingAction && <Spinner size="small" />}
                    Previous {formatCurrency(lastBetAmount)}
                  </button>
                )}
              </div>
            </div>

            {/* Custom Bet Slider */}
            <div className="custom-bet-section">
              <h4>Custom Amount</h4>
              <div className="bet-slider-container">
                <div className="slider-info">
                  <span>Min: {formatCurrency(currentBet === 0 ? minBet : minRaise)}</span>
                  <span className="current-bet-display">
                    {formatCurrency(betSliderValue)} 
                    {pot > 0 && (
                      <small>({((betSliderValue / pot) * 100).toFixed(0)}% of pot)</small>
                    )}
                  </span>
                  <span>Max: {formatCurrency(currentBet === 0 ? playerStack : playerStack + playerBet)}</span>
                </div>
                
                <input
                  type="range"
                  className="bet-slider"
                  min={currentBet === 0 ? minBet : minRaise}
                  max={currentBet === 0 ? playerStack : playerStack + playerBet}
                  step={Math.max(minBet / 4, 0.25)}
                  value={betSliderValue}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setBetSliderValue(value);
                    setBetAmount(value);
                    setUserModifiedSlider(true);
                  }}
                />
                
                <div className="slider-controls">
                  <button
                    className="slider-adjust-btn"
                    onClick={() => {
                      const newValue = Math.max(
                        betSliderValue - minBet,
                        currentBet === 0 ? minBet : minRaise
                      );
                      setBetSliderValue(newValue);
                      setBetAmount(newValue);
                      setUserModifiedSlider(true);
                    }}
                  >
                    -{formatCurrency(minBet)}
                  </button>
                  
                  <input
                    type="number"
                    className="bet-input"
                    min={currentBet === 0 ? minBet : minRaise}
                    max={currentBet === 0 ? playerStack : playerStack + playerBet}
                    step="0.25"
                    value={betSliderValue}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      setBetSliderValue(value);
                      setBetAmount(value);
                      setUserModifiedSlider(true);
                    }}
                  />
                  
                  <button
                    className="slider-adjust-btn"
                    onClick={() => {
                      const newValue = Math.min(
                        betSliderValue + minBet,
                        currentBet === 0 ? playerStack : playerStack + playerBet
                      );
                      setBetSliderValue(newValue);
                      setBetAmount(newValue);
                      setUserModifiedSlider(true);
                    }}
                  >
                    +{formatCurrency(minBet)}
                  </button>
                </div>
                
                <button
                  className="execute-bet-btn"
                  onClick={() => {
                    if (betSliderValue >= (currentBet === 0 ? minBet : minRaise)) {
                      handlePreAction(currentBet === 0 ? 'BET' : 'RAISE', betSliderValue);
                      setLastBetAmount(betSliderValue);
                    }
                  }}
                  disabled={takingAction || betSliderValue < (currentBet === 0 ? minBet : minRaise) || 
                           betSliderValue > (currentBet === 0 ? playerStack : playerStack + playerBet)}
                >
                  {takingAction && <Spinner size="small" />}
                  {currentBet === 0 ? 'Bet' : 'Raise to'} {formatCurrency(betSliderValue)}
                  {preAction === (currentBet === 0 ? 'BET' : 'RAISE') && preActionAmount === betSliderValue ? ' ✅' : ''}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render player circles outside the table
  // Helper function to calculate fixed player positions
  const calculatePlayerPosition = (players, currentPlayerId, targetPlayerId) => {
    const totalPlayers = players.length;
    
    // Find current user's index and target player index
    const currentUserIndex = players.findIndex(p => p.id === currentPlayerId);
    const targetPlayerIndex = players.findIndex(p => p.id === targetPlayerId);
    
    if (currentUserIndex === -1 || targetPlayerIndex === -1) {
      return { position: 'top', index: 0 };
    }
    
    // Calculate relative position (current user is excluded from opponent positions)
    let relativeIndex = (targetPlayerIndex - currentUserIndex + totalPlayers) % totalPlayers;
    if (relativeIndex === 0) relativeIndex = totalPlayers; // Current user gets max index
    
    // Fixed positioning based on opponent count (excluding current user)
    const opponentCount = totalPlayers - 1;
    
    let position, positionIndex;
    
    switch (opponentCount) {
      case 1: // 2 players total
        position = 'top';
        positionIndex = 0;
        break;
        
      case 2: // 3 players total
        if (relativeIndex === 1) {
          position = 'left';
          positionIndex = 0;
        } else {
          position = 'right';
          positionIndex = 0;
        }
        break;
        
      case 3: // 4 players total
        if (relativeIndex === 1) {
          position = 'left';
          positionIndex = 0;
        } else if (relativeIndex === 2) {
          position = 'top';
          positionIndex = 0;
        } else {
          position = 'right';
          positionIndex = 0;
        }
        break;
        
      case 4: // 5 players total
        if (relativeIndex === 1) {
          position = 'left';
          positionIndex = 0;
        } else if (relativeIndex === 2) {
          position = 'top';
          positionIndex = 0;
        } else if (relativeIndex === 3) {
          position = 'top';
          positionIndex = 1;
        } else {
          position = 'right';
          positionIndex = 0;
        }
        break;
        
      case 5: // 6 players total
        if (relativeIndex === 1) {
          position = 'left';
          positionIndex = 0;
        } else if (relativeIndex === 2) {
          position = 'top';
          positionIndex = 0;
        } else if (relativeIndex === 3) {
          position = 'top';
          positionIndex = 1;
        } else if (relativeIndex === 4) {
          position = 'top';
          positionIndex = 2;
        } else {
          position = 'right';
          positionIndex = 0;
        }
        break;
        
      case 6: // 7 players total
        if (relativeIndex === 1) {
          position = 'left';
          positionIndex = 0;
        } else if (relativeIndex === 2) {
          position = 'left';
          positionIndex = 1;
        } else if (relativeIndex === 3) {
          position = 'top';
          positionIndex = 0;
        } else if (relativeIndex === 4) {
          position = 'top';
          positionIndex = 1;
        } else if (relativeIndex === 5) {
          position = 'top';
          positionIndex = 2;
        } else {
          position = 'right';
          positionIndex = 0;
        }
        break;
        
      case 7: // 8 players total
        if (relativeIndex === 1) {
          position = 'left';
          positionIndex = 0;
        } else if (relativeIndex === 2) {
          position = 'left';
          positionIndex = 1;
        } else if (relativeIndex === 3) {
          position = 'top';
          positionIndex = 0;
        } else if (relativeIndex === 4) {
          position = 'top';
          positionIndex = 1;
        } else if (relativeIndex === 5) {
          position = 'top';
          positionIndex = 2;
        } else if (relativeIndex === 6) {
          position = 'right';
          positionIndex = 0;
        } else {
          position = 'right';
          positionIndex = 1;
        }
        break;
        
      default:
        position = 'top';
        positionIndex = 0;
    }
    
    return { position, positionIndex };
  };

  // Helper function to check if a player is a winner
  const isWinningPlayer = (player) => {
    if (!currentHandResult || !currentHandResult.winners) return false;
    return currentHandResult.winners.some(winner => 
      winner.player_name === player.player.user.username
    );
  };

  const renderPlayerNames = () => {
    if (!game.players || game.players.length === 0) {
      return null;
    }

    const currentUser = getCurrentUserInfo();
    let currentUserId = null;
    
    // Find current user ID
    if (currentUser) {
      const currentPlayer = game.players.find(p => {
        return (currentUser.id && p.player.user.id === currentUser.id) ||
               (currentUser.username && p.player.user.username === currentUser.username);
      });
      if (currentPlayer) {
        currentUserId = currentPlayer.id;
      }
    }

    return game.players
      .filter((player) => {
        // Always filter out the current user from player names
        if (currentUser) {
          const isCurrentUserById = currentUser.id && player.player.user.id === currentUser.id;
          const isCurrentUserByUsername = currentUser.username && player.player.user.username === currentUser.username;
          
          if (isCurrentUserById || isCurrentUserByUsername) {
            return false;
          }
        }
        return true;
      })
      .map((player) => {
      const isDealer = player.seat_position === game.dealer_position;
      const isTurn = game.current_player && game.current_player.id === player.player.id;
      const playerStatus = player.cashed_out ? 'cashed-out' : (player.is_active ? 'active' : 'inactive');
      const isWinner = isWinningPlayer(player);

      // Calculate position for player name (same logic as circles)
      const { position, positionIndex } = calculatePlayerPosition(game.players, currentUserId, player.id);
      
      let nameStyle = {};
      const spacing = 120; // Distance between players in same position
      
      switch (position) {
        case 'top':
          nameStyle = {
            position: "absolute",
            left: `calc(50% + ${(positionIndex - 1) * spacing}px)`,
            top: "55px",
            transform: "translateX(-50%)",
          };
          break;
          
        case 'left':
          nameStyle = {
            position: "absolute",
            left: "10px",
            top: `calc(50% + ${(positionIndex - 0.5) * spacing}px)`,
            transform: "translateY(-50%)",
          };
          break;
          
        case 'right':
          nameStyle = {
            position: "absolute",
            right: "10px",
            top: `calc(50% + ${(positionIndex - 0.5) * spacing}px)`,
            transform: "translateY(-50%)",
          };
          break;
          
        default:
          nameStyle = {
            position: "absolute",
            left: "50%",
            top: "55px",
            transform: "translateX(-50%)",
          };
      }

      // Status text
      let statusText = '';
      if (player.cashed_out) {
        statusText = 'Out';
      } else if (!player.is_active) {
        statusText = 'Folded';
      } else if (isTurn) {
        statusText = 'Turn';
      }

      return (
        <div
          key={`player-name-${player.id}`}
          className={`player-name-display ${playerStatus} ${isTurn ? "active-turn" : ""} ${isWinner ? "winner" : ""}`}
          style={nameStyle}
        >
          <div className={`player-name-text ${isBot(player) ? 'bot-player' : ''}`}>
            {isBot(player) ? `🤖 ${abbreviateName(player.player.user.username)}` : abbreviateName(player.player.user.username)}
            {isDealer && <span className="name-dealer-indicator">D</span>}
          </div>
          <div className="player-name-stack">
            {formatCurrencyAbbr(player.stack)}
            {player.cashed_out && <span className="stack-note"> (Out)</span>}
          </div>
          {player.current_bet > 0 && (
            <div className="player-name-bet">
              Bet: {formatCurrencyAbbr(player.current_bet)}
            </div>
          )}
          {statusText && (
            <div className="player-name-status">
              {statusText}
            </div>
          )}
          {isWinner && currentHandResult && (
            <div className="player-name-winner-info">
              {(() => {
                const winnerData = currentHandResult.winners.find(w => w.player_name === player.player.user.username);
                return winnerData && (
                  <>
                    <div className="winner-amount">+{formatCurrency(winnerData.winning_amount)}</div>
                    {winnerData.hand_name && <div className="winner-hand">{winnerData.hand_name}</div>}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      );
    });
  };

  // Render player cards on the table surface
  /**
   * Renders player cards and bet displays positioned around the poker table.
   * 
   * This function handles the complex positioning logic for displaying:
   * - Player hole cards positioned near the table edge
   * - Individual player bet amounts positioned near their cards
   * - Proper rotation and spacing based on player seat position
   * 
   * Key Features:
   * - Cards are filtered to exclude current user (shown separately)
   * - Bet displays positioned with consistent spacing from cards
   * - Different positioning logic for top, left, right positions
   * - Cards rotated to face the player (180deg for top, 90/-90deg for sides)
   * 
   * Positioning Strategy:
   * - Cards positioned close to table edge (20px from edge)
   * - Bets positioned with fixed 10px gap from cards
   * - Left/right sides use rotated card dimensions for calculations
   * - Consistent visual spacing maintained across all positions
   */
  const renderPlayerCards = () => {
    if (!game.players || game.players.length === 0) {
      return null;
    }

    const currentUser = getCurrentUserInfo();
    let currentUserId = null;
    
    // Find current user ID to filter them out of the table display
    // Current user's cards are shown separately in their hand area
    if (currentUser) {
      const currentPlayer = game.players.find(p => {
        return (currentUser.id && p.player.user.id === currentUser.id) ||
               (currentUser.username && p.player.user.username === currentUser.username);
      });
      if (currentPlayer) {
        currentUserId = currentPlayer.id;
      }
    }

    return game.players
      .filter((player) => {
        // Always filter out the current user from table cards display
        // During WAITING status, current user should appear at bottom
        // During PLAYING status, current user should appear in action panel
        if (currentUser) {
          if (currentUser.id && player.player.user.id === currentUser.id) {
            return false;
          } else if (
            currentUser.username &&
            player.player.user.username === currentUser.username
          ) {
            return false;
          }
        }
        return true;
      })
      .map((player) => {
      let isCurrentUser = false;
      if (currentUser) {
        if (currentUser.id && player.player.user.id === currentUser.id) {
          isCurrentUser = true;
        } else if (
          currentUser.username &&
          player.player.user.username === currentUser.username
        ) {
          isCurrentUser = true;
        }
      }
      
      // Handle new card data structure
      let playerCards = [];
      if (player.cards) {
        if (Array.isArray(player.cards)) {
          // Old format - array of card strings
          playerCards = player.cards;
        } else if (player.cards.cards) {
          // New format - object with cards array and owner info
          playerCards = player.cards.cards;
        }
      }

      // Only show cards if player has them
      if (!playerCards || playerCards.length === 0) {
        return null;
      }

      // Hide cards completely for folded players (unless they're the current user or it's showdown/waiting phase)
      if (!player.is_active && !isCurrentUser && game.phase !== "SHOWDOWN" && game.phase !== "WAITING_FOR_PLAYERS") {
        return null;
      }

      // Calculate fixed position for cards to match player circles
      const { position, positionIndex } = calculatePlayerPosition(game.players, currentUserId, player.id);
      
      // Position cards closer to table edge than player circles
      const spacing = 120; // Same spacing as player circles
      const cardWidth = 39;                                   // Same as community cards
      const cardHeight = 56;                                  // Same as community cards
      const betDistance = 10;                                 // Fixed gap between bet and cards
      
      // Create a single wrapper that contains both cards and bet
      let wrapperStyle = {};
      let cardStyle = {};
      let betStyle = {};
      
      switch (position) {
        case 'top':
          // Position wrapper at card location
          wrapperStyle = {
            position: "absolute",
            left: `calc(50% + ${(positionIndex - 1) * spacing}px)`,
            top: "20px",
            transform: "translateX(-50%)"
          };
          // Cards within wrapper
          cardStyle = {
            position: "relative",
            transform: "rotate(180deg)" // Face down toward player
          };
          // Bet below cards within wrapper
          betStyle = {
            position: "absolute",
            left: "50%",
            top: `${cardHeight + betDistance}px`,
            transform: "translateX(-50%)"
          };
          break;
          
        case 'left':
          // Position wrapper at card location
          wrapperStyle = {
            position: "absolute",
            left: "20px",
            top: `calc(50% + ${(positionIndex - 0.5) * spacing * 0.3}px)`,
            transform: "translateY(-50%)"
          };
          // Cards within wrapper
          cardStyle = {
            position: "relative",
            transform: (game.phase === "SHOWDOWN" || game.phase === "WAITING_FOR_PLAYERS") ? "rotate(0deg)" : "rotate(90deg)" // Face right toward player, but straight up during showdown
          };
          // Bet to right of cards within wrapper
          betStyle = {
            position: "absolute",
            left: `${cardWidth + betDistance}px`,
            top: "50%",
            transform: "translateY(-50%)"
          };
          break;
          
        case 'right':
          // Position wrapper at card location
          wrapperStyle = {
            position: "absolute",
            right: "20px",
            top: `calc(50% + ${(positionIndex - 0.5) * spacing * 0.3}px)`,
            transform: "translateY(-50%)"
          };
          // Cards within wrapper
          cardStyle = {
            position: "relative",
            transform: (game.phase === "SHOWDOWN" || game.phase === "WAITING_FOR_PLAYERS") ? "rotate(0deg)" : "rotate(-90deg)" // Face left toward player, but straight up during showdown
          };
          // Bet to left of cards within wrapper
          betStyle = {
            position: "absolute",
            right: `${cardWidth + betDistance}px`,
            top: "50%",
            transform: "translateY(-50%)"
          };
          break;
          
        default:
          wrapperStyle = {
            position: "absolute",
            left: "50%",
            top: "20px",
            transform: "translateX(-50%)"
          };
          cardStyle = {
            position: "relative",
            transform: (game.phase === "SHOWDOWN" || game.phase === "WAITING_FOR_PLAYERS") ? "rotate(0deg)" : "rotate(180deg)" // Face down toward player, but straight up during showdown
          };
          betStyle = {
            position: "absolute",
            left: "50%",
            top: `${cardHeight + betDistance}px`,
            transform: "translateX(-50%)"
          };
      }

      return (
        <div key={`player-area-${player.id}`} style={wrapperStyle}>
          {/* Player cards */}
          <div
            key={`cards-${player.id}`}
            className={`player-cards-on-table ${isCurrentUser ? "current-user-cards" : "other-player-cards"} ${(game.phase === "SHOWDOWN" || game.phase === "WAITING_FOR_PLAYERS") ? "showdown-mode" : ""}`}
            style={cardStyle}
          >
            {playerCards.map((card, cardIndex) => {
            // Show card fronts for current user or during showdown/waiting phases (only for active players who didn't fold)
            const showCard = isCurrentUser || ((game.phase === "SHOWDOWN" || game.phase === "WAITING_FOR_PLAYERS") && player.is_active);

            if (!showCard) {
              return (
                <div key={cardIndex} className="card hidden">
                  <div className="card-back"></div>
                </div>
              );
            }

            const rank = card.slice(0, -1);
            const suit = card.slice(-1);
            
            // Check if this card is part of the winning hand
            const isWinning = isWinningPlayerCard(card, player.player.user.username);
            

            const suitSymbols = {
              S: "♠",
              H: "♥",
              D: "♦",
              C: "♣",
            };

            return (
              <div
                key={cardIndex}
                className={`card visible ${isWinning ? "winning-card" : ""}`}
                data-suit={suit}
              >
                <div className="card-rank">{rank}</div>
                <div className="card-suit">{suitSymbols[suit]}</div>
              </div>
            );
          })}
          </div>
          
          {/* Player bet display positioned relative to cards */}
          {player.current_bet > 0 && (
            <div
              className={`player-bet-display ${isCurrentUser ? 'current-user-bet' : ''}`}
              style={betStyle}
            >
              {formatCurrency(player.current_bet)}
            </div>
          )}
        </div>
      );
    });
  };

  // Render current user's cards and bet display on table
  const renderCurrentUserTableDisplay = () => {
    if (!game || !game.players) return null;
    
    const currentUser = getCurrentUserInfo();
    if (!currentUser) return null;
    
    // Find current user in players
    const currentUserPlayer = game.players.find(player => {
      if (currentUser.id && player.player.user.id === currentUser.id) {
        return true;
      } else if (currentUser.username && player.player.user.username === currentUser.username) {
        return true;
      }
      return false;
    });
    
    if (!currentUserPlayer) return null;
    
    // Get current user's cards (face-down during play, face-up during showdown/waiting)
    let playerCards = [];
    if (currentUserPlayer.cards) {
      if (Array.isArray(currentUserPlayer.cards)) {
        playerCards = currentUserPlayer.cards;
      } else if (currentUserPlayer.cards.cards) {
        playerCards = currentUserPlayer.cards.cards;
      }
    }
    
    // Only show if player has cards and is active (not folded)
    if (!playerCards || playerCards.length === 0 || !currentUserPlayer.is_active) {
      return null;
    }
    
    // Position current user's cards at middle front (bottom center) of table
    const cardHeight = 56; // Same as community cards
    const betDistance = 20; // Reduced distance to bring bet closer to cards
    
    // Fixed position at bottom center for current user
    const cardStyle = {
      position: "absolute",
      left: "50%",
      bottom: "20px", // At the front edge of table
      transform: "translateX(-50%)",
    };
    
    const betStyle = {
      position: "absolute",
      left: "50%",
      bottom: `${20 + cardHeight + betDistance}px`, // Above the cards, toward center
      transform: "translateX(-50%)",
    };
    
    return (
      <div key={`current-user-area-${currentUserPlayer.id}`}>
        {/* Current user's bet display */}
        {currentUserPlayer.current_bet > 0 && (
          <div
            className="player-bet-display current-user-bet"
            style={betStyle}
          >
            {formatCurrency(currentUserPlayer.current_bet)}
          </div>
        )}
        
        {/* Current user's cards - face up during showdown/waiting, face down otherwise */}
        <div
          className={`player-cards-on-table current-user-cards ${(game.phase === "SHOWDOWN" || game.phase === "WAITING_FOR_PLAYERS") ? "showdown-mode" : ""}`}
          style={cardStyle}
        >
          {playerCards.map((card, cardIndex) => {
            // Show card fronts during showdown/waiting for players phase (only if current user didn't fold)
            const showCard = (game.phase === "SHOWDOWN" || game.phase === "WAITING_FOR_PLAYERS") && currentUserPlayer?.is_active;

            if (!showCard) {
              return (
                <div key={cardIndex} className="card hidden">
                  <div className="card-back"></div>
                </div>
              );
            }

            const rank = card.slice(0, -1);
            const suit = card.slice(-1);
            
            // Check if this card is part of the winning hand
            const isWinning = isWinningPlayerCard(card, currentUser.username);
            

            const suitSymbols = {
              S: "♠",
              H: "♥",
              D: "♦",
              C: "♣",
            };

            return (
              <div
                key={cardIndex}
                className={`card visible ${isWinning ? "winning-card" : ""}`}
                data-suit={suit}
              >
                <div className="card-rank">{rank}</div>
                <div className="card-suit">{suitSymbols[suit]}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render waiting user display - shows current user icon and balance at bottom center during WAITING status
  const renderWaitingUserDisplay = () => {
    // Only show during WAITING status
    if (!game || game.status !== "WAITING") {
      return null;
    }
    
    const currentUser = getCurrentUserInfo();
    if (!currentUser) {
      return null;
    }
    
    // Find current user in players to get their balance
    const currentUserPlayer = game.players.find(player => {
      if (currentUser.id && player.player.user.id === currentUser.id) {
        return true;
      } else if (currentUser.username && player.player.user.username === currentUser.username) {
        return true;
      }
      return false;
    });
    
    // Only show waiting display if user is seated at the table
    if (!currentUserPlayer) {
      return null;
    }
    
    // Position off the table, lower on screen
    const displayStyle = {
      position: "absolute",
      left: "50%",
      transform: "translateX(-50%)",
      bottom: "-10px", // Position below the table
      zIndex: 10,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    };
    
    return (
      <div
        key={`waiting-user-display-${currentUserPlayer.id}`}
        className="waiting-user-display"
        style={displayStyle}
      >
        <div className="waiting-user-avatar">
          <span className="waiting-user-initial">
            {currentUser.username.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="waiting-user-info">
          <div className="waiting-user-name">
            {abbreviateName(currentUser.username)}
          </div>
          <div className="waiting-user-balance">
            {formatCurrencyAbbr(currentUserPlayer.stack)}
          </div>
        </div>
      </div>
    );
  };

  // Render mobile player grid - replaces circular positioning on mobile
  const renderMobilePlayerGrid = () => {
    if (!game?.players) return null;
    
    const currentUser = getCurrentUserInfo();
    if (!currentUser) return null;
    
    // Filter out current user from the grid
    const otherPlayers = game.players.filter(player => {
      if (currentUser.id && player.player.user.id === currentUser.id) {
        return false;
      } else if (currentUser.username && player.player.user.username === currentUser.username) {
        return false;
      }
      return true;
    });

    if (otherPlayers.length === 0) return null;

    return (
      <div className="mobile-player-grid">
        {otherPlayers.map((player) => {
          const isDealer = player.id === game.dealer_id;
          const isTurn = game.current_turn_player_id === player.id;
          const isCashedOut = player.cashed_out;
          const isActive = player.is_active;
          
          // Status for styling
          let statusClass = '';
          let statusText = '';
          if (isCashedOut) {
            statusClass = 'cashed-out';
            statusText = 'Out';
          } else if (!isActive) {
            statusClass = 'folded';
            statusText = 'Folded';
          } else if (isTurn) {
            statusClass = 'active-turn';
            statusText = 'Turn';
          }

          // Show card indicators if player is active and game is in progress
          const hasCards = isActive && !isCashedOut && game.status === 'PLAYING';

          return (
            <div 
              key={`mobile-player-${player.id}`}
              className={`mobile-player-card ${statusClass} ${isDealer ? 'dealer' : ''}`}
            >
              {/* Player Info */}
              <div className="mobile-player-info">
                <div className={`mobile-player-name ${isBot(player) ? 'bot-player' : ''}`}>
                  {isBot(player) ? `🤖 ${abbreviateName(player.player.user.username)}` : abbreviateName(player.player.user.username)}
                  {isDealer && <span className="mobile-dealer-indicator">D</span>}
                  {/* Card indicators */}
                  {hasCards && (
                    <div className="mobile-card-indicators">
                      <div className="mobile-card"></div>
                      <div className="mobile-card"></div>
                    </div>
                  )}
                </div>
                <div className="mobile-player-stack">
                  {formatCurrencyAbbr(player.stack)}
                </div>
                {player.current_bet > 0 && (
                  <div className="mobile-player-bet">
                    Bet: {formatCurrencyAbbr(player.current_bet)}
                  </div>
                )}
                {statusText && (
                  <div className="mobile-player-status">
                    {statusText}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render temporary popup messages to user
  const renderPopupMessage = () => {
    if (!message) return null;

    const getMessageStyle = () => {
      const baseStyle = {
        position: "fixed",
        top: "120px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "20px 30px",
        borderRadius: "8px",
        fontSize: "16px",
        fontWeight: "bold",
        color: "white",
        zIndex: 2000,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        animation: "slideDown 0.3s ease-out",
        maxWidth: "400px",
        textAlign: "center",
      };

      switch (messageType) {
        case "success":
          return { ...baseStyle, backgroundColor: "#4caf50" };
        case "info":
          return { ...baseStyle, backgroundColor: "#2196f3" };
        case "error":
        default:
          return { ...baseStyle, backgroundColor: "#f44336" };
      }
    };

    return (
      <div style={getMessageStyle()}>
        {message}
      </div>
    );
  };


  // Render game information and controls
  const renderGameInfo = () => {
    const currentPlayer = findCurrentPlayer();
    const isCashedOut = currentPlayer && currentPlayer.cashed_out;
    
    // Get table name safely with fallback - handle both game data and game summary structures
    const tableName = game?.table?.name || 
                     game?.table_name || 
                     game?.game_summary?.table_name || 
                     'Unknown Table';
    
    // Debug logging to understand game structure when table is missing
    if (!game?.table?.name && !game?.table_name && !game?.game_summary?.table_name) {
      console.warn('Table name not found in game object:', {
        hasTable: !!game?.table,
        hasTableName: !!game?.table_name,
        hasGameSummary: !!game?.game_summary,
        summaryKeys: game?.game_summary ? Object.keys(game.game_summary) : 'no summary',
        tableKeys: game?.table ? Object.keys(game.table) : 'no table',
        gameKeys: game ? Object.keys(game) : 'no game'
      });
    }
    
    return (
      <div className="game-info-card">
        <h3>{tableName}</h3>
        <div className="game-status-compact">
          <div><strong>Status:</strong> {game.status}</div>
          {game.phase && <div><strong>Phase:</strong> {game.phase}</div>}
          {game.current_bet > 0 && (
            <div><strong>Current Bet:</strong> {formatCurrency(game.current_bet)}</div>
          )}
        </div>

        <div className="game-actions-compact">
          {game.status === "WAITING" && (
            <button onClick={handleStartGame} className="compact-btn" disabled={startingGame}>
              {startingGame && <Spinner size="small" />}
              {startingGame ? "Starting..." : "Start Game"}
            </button>
          )}
          {game.status === "PLAYING" && (
            <button onClick={handleRefreshGame} className="compact-btn refresh-button" disabled={refreshingGame}>
              {refreshingGame && <Spinner size="small" />}
              {refreshingGame ? "Refreshing..." : "Refresh"}
            </button>
          )}
          
          {/* Show different buttons based on player status */}
          {currentPlayer && !isCashedOut && (
            <button 
              onClick={handleCashOut} 
              className="compact-btn cash-out-btn" 
              disabled={cashingOut}
              title="Cash out and become a spectator (you can buy back in later)"
            >
              {cashingOut && <Spinner size="small" />}
              {cashingOut ? "Cashing Out..." : "💰 Cash Out"}
            </button>
          )}
          
          {currentPlayer && isCashedOut && (
            <>
              <button 
                onClick={() => setShowBuyInDialog(true)} 
                className="compact-btn buy-in-btn" 
                title="Buy back into the game"
              >
                💵 Buy Back In
              </button>
              <button 
                onClick={handleLeaveTable} 
                className="compact-btn leave-btn" 
                title="Leave the table completely with your chips"
              >
                🚪 Leave Table
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Render community cards on the table
  // Helper function to check if a community card is part of the winning hand
  const isWinningCard = (card) => {
    if (!currentHandResult || !currentHandResult.winners) return false;
    return currentHandResult.winners.some(winner => 
      winner.best_hand_cards && winner.best_hand_cards.includes(card)
    );
  };

  // Helper function to check if a player card is part of the winning hand
  const isWinningPlayerCard = (card, playerName) => {
    if (!currentHandResult || !currentHandResult.winners) return false;
    // Find the winner data for this specific player
    const winnerData = currentHandResult.winners.find(winner => winner.player_name === playerName);
    if (!winnerData || !winnerData.best_hand_cards) return false;
    
    
    return winnerData.best_hand_cards.includes(card);
  };

  const renderCommunityCards = () => {
    if (!game.community_cards || game.community_cards.length === 0) {
      return null;
    }

    return (
      <div className="community-cards">
        {game.community_cards.map((card, index) => {
          const rank = card.slice(0, -1);
          const suit = card.slice(-1);
          const isWinning = isWinningCard(card);
          

          const suitSymbols = {
            S: "♠",
            H: "♥",
            D: "♦",
            C: "♣",
          };

          return (
            <div
              key={index}
              className={`card community-card visible ${isWinning ? "winning-card" : ""}`}
              data-suit={suit}
            >
              <div className="card-rank">{rank}</div>
              <div className="card-suit">{suitSymbols[suit]}</div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render pot display
  const renderPotChips = () => {
    const pot = parseFloat(game.pot || 0);
    
    return (
      <div className="pot-display">Pot: {formatCurrency(pot)}</div>
    );
  };

  const renderShowdownCards = () => {
    const isShowdownOrWaiting = game.phase === "SHOWDOWN" || game.phase === "WAITING_FOR_PLAYERS";
    if (!isShowdownOrWaiting) return null;
    
    // Hide cards if current user is ready in waiting phase (mobile only)
    if (game.phase === "WAITING_FOR_PLAYERS" && isMobile()) {
      const currentUserInfo = getCurrentUserInfo();
      const currentPlayerGame = game.players?.find(player => 
        currentUserInfo && (
          currentUserInfo.id === player.player.user.id || 
          currentUserInfo.username === player.player.user.username
        )
      );
      const currentPlayerIsReady = currentPlayerGame?.ready_for_next_hand || false;
      if (currentPlayerIsReady) return null;
    }
    
    // Get all players who were active (didn't fold) during the hand
    const activePlayers = game.players.filter(p => p.is_active && !p.cashed_out && p.cards?.cards);
    if (activePlayers.length <= 1) return null; // Only show if there was actual showdown
    
    return (
      <div className="winner-cards-display">
        <div className="winner-cards-title">🃏 Showdown Cards</div>
        <div className="winner-cards-container">
          {activePlayers.map((player, playerIndex) => {
            // Check if this player is a winner
            const isWinner = currentHandResult?.winners?.some(w => w.player_name === player.player.user.username);
            const winnerData = currentHandResult?.winners?.find(w => w.player_name === player.player.user.username);
            
            return (
              <div key={playerIndex} className="winner-player-cards">
                <div className={`winner-name ${isBot(player) ? 'bot-player' : ''}`}>
                  {isBot(player) ? `🤖 ${player.player.user.username}` : player.player.user.username}
                  {isWinner && " 🏆"}
                </div>
                <div className="winner-cards">
                  {player.cards.cards.map((cardString, cardIndex) => {
                    const suitSymbols = { S: "♠", H: "♥", D: "♦", C: "♣" };
                    const suitColors = { H: "#e74c3c", D: "#e74c3c", S: "#2c3e50", C: "#2c3e50" };
                    
                    // Parse card string like "4D" -> rank: "4", suit: "D"
                    const suit = cardString.slice(-1);
                    const rank = cardString.slice(0, -1);
                    
                    return (
                      <div 
                        key={cardIndex} 
                        className={isWinner ? "table-winner-card" : "table-player-card"}
                        style={{ color: suitColors[suit] }}
                      >
                        <div className="table-card-rank">{rank}</div>
                        <div className="table-card-suit">{suitSymbols[suit]}</div>
                      </div>
                    );
                  })}
                </div>
                {isWinner && winnerData?.hand_name && (
                  <div className="winner-hand-name">{winnerData.hand_name}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render recent game actions/logs
  const renderGameLogs = () => {
    return null;
  };


  // Render buy back in dialog
  const renderBuyInDialog = () => {
    if (!showBuyInDialog) return null;

    const table = game.table;
    if (!table || game.status === 'FINISHED') {
      return (
        <div className="buy-in-overlay">
          <div className="buy-in-dialog">
            <div className="buy-in-header">
              <h2>❌ Cannot Buy Back In</h2>
            </div>
            <div className="buy-in-content">
              <p>
                {game.status === 'FINISHED' 
                  ? 'This game has finished. You cannot buy back in.' 
                  : 'Table information not available. Please refresh the page.'}
              </p>
              <button 
                className="buy-in-cancel-btn"
                onClick={() => setShowBuyInDialog(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="buy-in-overlay">
        <div className="buy-in-dialog">
          <div className="buy-in-header">
            <h2>💵 Buy Back In</h2>
          </div>
          
          <div className="buy-in-content">
            <p>Enter the amount you want to buy back in with:</p>
            
            <div className="buy-in-limits">
              <div>Min: ${table.min_buy_in}</div>
              <div>Max: ${table.max_buy_in}</div>
            </div>
            
            <div className="buy-in-input-group">
              <label htmlFor="buyInAmount">Amount:</label>
              <input
                id="buyInAmount"
                type="number"
                min={table.min_buy_in}
                max={table.max_buy_in}
                step="0.01"
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(parseFloat(e.target.value) || 0)}
                placeholder={`Enter amount (min: $${table.min_buy_in})`}
                autoFocus
              />
            </div>
            
            <div className="buy-in-buttons">
              <button 
                className="buy-in-confirm-btn"
                onClick={handleBuyBackIn}
                disabled={!buyInAmount || buyInAmount < table.min_buy_in || buyInAmount > table.max_buy_in}
              >
                💵 Buy In for ${buyInAmount || 0}
              </button>
              <button 
                className="buy-in-cancel-btn"
                onClick={() => {
                  setShowBuyInDialog(false);
                  setBuyInAmount(0);
                }}
              >
                Cancel
              </button>
            </div>
            
            <div className="buy-in-quick-amounts">
              <p>Quick amounts:</p>
              <div className="quick-amount-buttons">
                <button 
                  className="quick-amount-btn"
                  onClick={() => setBuyInAmount(table.min_buy_in)}
                >
                  ${table.min_buy_in}
                </button>
                <button 
                  className="quick-amount-btn"
                  onClick={() => setBuyInAmount(table.min_buy_in * 2)}
                >
                  ${table.min_buy_in * 2}
                </button>
                <button 
                  className="quick-amount-btn"
                  onClick={() => setBuyInAmount(table.max_buy_in)}
                >
                  ${table.max_buy_in}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="poker-game-container">
      {game.status === "WAITING" && renderGameInfo()}
      
      {/* Bot Management Controls - only show in waiting state */}
      {game.status === "WAITING" && (
        <div className="bot-controls">
          <h3>🤖 Bot Players</h3>
          <div className="bot-controls-buttons">
            {canAddBot() && (
              <button 
                className="add-bot-btn"
                onClick={() => setShowBotModal(true)}
                disabled={addingBot}
              >
                🤖 Add Bot
              </button>
            )}
            {getBotPlayers().map(botPlayer => {
              const botConfig = getBotConfig(botPlayer);
              return (
                <div key={botPlayer.id} className="bot-player-info">
                  <span className="bot-name">
                    🤖 {botPlayer.player.user.username}
                  </span>
                  {botConfig && (
                    <span className="bot-config-text">
                      {botService.getDifficultyDisplayName(botConfig.difficulty)} • 
                      {botService.getPlayStyleDisplayName(botConfig.play_style)}
                    </span>
                  )}
                  <button
                    className="remove-bot-btn"
                    onClick={() => handleRemoveBot(
                      botConfig?.id || botPlayer.id, 
                      botPlayer.player.user.username
                    )}
                    title="Remove bot"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            {getBotPlayers().length === 0 && (
              <p className="no-bots-message">No bots at the table</p>
            )}
          </div>
        </div>
      )}
      
      {/* Mobile Player Grid - shows above table on mobile */}
      <div className="mobile-only">
        {renderMobilePlayerGrid()}
      </div>
      
      <div className="poker-table">
        <div className="table-felt">
          {(game.phase === "SHOWDOWN" || game.phase === "WAITING_FOR_PLAYERS") ? 
            renderShowdownCards() : renderPotChips()}
          {renderCommunityCards()}
          {/* Player cards positioned on table edge */}
          {renderPlayerCards()}
          {/* Current user's cards and bet display on table */}
          {renderCurrentUserTableDisplay()}
          {/* Show "no players" message if table is empty */}
          {(!game.players || game.players.length === 0) && (
            <div className="no-players">No players at the table</div>
          )}
        </div>
        {/* Player names positioned around table - desktop only */}
        <div className="desktop-only">
          {renderPlayerNames()}
        </div>
        {/* Waiting user display - shows current user info below table during WAITING status */}
        {renderWaitingUserDisplay()}
      </div>
      
      {/* Mobile Start Game Button - visible when game info card is hidden */}
      {game.status === "WAITING" && (
        <div className="mobile-start-game-container">
          <button onClick={handleStartGame} className="mobile-start-btn" disabled={startingGame}>
            {startingGame && <Spinner size="small" />}
            {startingGame ? "Starting..." : "🎮 Start Game"}
          </button>
        </div>
      )}
      
      {renderActionButtons()}
      {renderGameLogs()}
      {renderPopupMessage()}
      {renderBuyInDialog()}
      {error && <div className="error-message">{error}</div>}
      
      {/* Bot Configuration Modal */}
      <BotConfigModal
        isOpen={showBotModal}
        onClose={() => setShowBotModal(false)}
        onBotAdded={handleBotAdded}
        tableId={game.table?.id}
        tableBuyInRange={game.table ? {
          min: game.table.min_buy_in,
          max: game.table.max_buy_in
        } : null}
      />
    </div>
  );
};

export default PokerTable;
