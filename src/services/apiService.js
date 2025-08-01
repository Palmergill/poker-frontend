// This file contains the API service for handling authentication, player, table, and game-related requests.
// It uses axios for HTTP requests and handles token management for authentication.
// It also includes a WebSocket connection for real-time game updates.
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

// Create axios instance with auth token handling
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to attach auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token refresh if access token expires
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        const response = await axios.post(`${API_URL}/token/refresh/`, {
          refresh: refreshToken,
        });

        localStorage.setItem("accessToken", response.data.access);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails, logout
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

const authService = {
  // Authenticate user with username and password
  login: async (username, password) => {
    const response = await axios.post(`${API_URL}/token/`, {
      username,
      password,
    });
    localStorage.setItem("accessToken", response.data.access);
    localStorage.setItem("refreshToken", response.data.refresh);
    return response.data;
  },

  // Log out user by removing stored tokens
  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },

  // Check if user is currently authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem("accessToken");
  },
  
  // Check if current user has admin privileges
  isAdmin: () => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.is_superuser || user.is_staff || user.username === 'admin';
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  // Get current user information
  getCurrentUser: () => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  },
};

const playerService = {
  // Get current player's profile information
  getProfile: () => apiClient.get(`/players/me/`),
  // Get current player's match history
  getMatchHistory: () => apiClient.get(`/players/match_history/`),
};

const tableService = {
  // Get all available poker tables
  getTables: () => apiClient.get(`/tables/`),
  // Get specific table details
  getTable: (id) => apiClient.get(`/tables/${id}/`),
  // Create a new poker table
  createTable: (tableData) => apiClient.post(`/tables/`, tableData),
  // Delete a specific table
  deleteTable: (id) => apiClient.delete(`/tables/${id}/`),
  // Delete all tables (admin only)
  deleteAllTables: () => apiClient.delete(`/tables/delete_all/`),
  // Join a table with specified buy-in amount
  joinTable: (id, buyIn) =>
    apiClient.post(`/tables/${id}/join_table/`, { buy_in: buyIn }),
};

// Updated sections for src/services/apiService.js

const gameService = {
  // Get all games
  getGames: () => apiClient.get(`/games/`),
  // Get specific game details
  getGame: (id) => apiClient.get(`/games/${id}/`),
  // Start a poker game
  startGame: (id) => apiClient.post(`/games/${id}/start/`),
  // Leave a poker table completely (only works if already cashed out)
  leaveGame: (id) => apiClient.post(`/games/${id}/leave/`),
  // Take a poker action (fold, check, call, bet, raise)
  takeAction: (id, actionType, amount = 0) =>
    apiClient.post(`/games/${id}/action/`, { action_type: actionType, amount }),
  
  // Set player ready for next hand
  setPlayerReady: (id) => apiClient.post(`/games/${id}/ready/`),
  
  // Cash out from active play (stay at table but become inactive)
  // Returns: { success: boolean, message: string, game_summary_generated?: boolean }
  cashOut: (id) => apiClient.post(`/games/${id}/cash_out/`),
  
  // Buy back into the game after cashing out
  buyBackIn: (id, amount) => apiClient.post(`/games/${id}/buy_back_in/`, { amount }),
  
  // Reset game state when it gets corrupted
  resetGameState: (id) => apiClient.post(`/games/${id}/reset_game_state/`),
  
  // Admin only - delete game regardless of status
  deleteGame: (id) => apiClient.delete(`/games/${id}/`),

  // Connect to WebSocket for real-time game updates
  connectToGameSocket: (
    gameId,
    onMessageCallback,
    onErrorCallback = null,
    onCloseCallback = null
  ) => {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      console.error("No access token found for WebSocket connection");
      if (onErrorCallback) onErrorCallback("No authentication token");
      return null;
    }

    // Construct WebSocket URL
    const wsBaseUrl = process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws";
    const wsUrl = `${wsBaseUrl}/game/${gameId}/?token=${token}`;

    try {
      const socket = new WebSocket(wsUrl);

      // Handle successful WebSocket connection
      socket.onopen = (event) => {
      };

      // Handle incoming WebSocket messages
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageCallback(data);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
          if (onErrorCallback) onErrorCallback("Failed to parse message");
        }
      };

      // Handle WebSocket errors
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (onErrorCallback) onErrorCallback("WebSocket connection error");
      };

      // Handle WebSocket connection close
      socket.onclose = (event) => {

        // Handle different close codes
        switch (event.code) {
          case 4001:
            console.error("WebSocket closed: Authentication failed");
            if (onErrorCallback) onErrorCallback("Authentication failed");
            break;
          case 4003:
            console.error("WebSocket closed: Permission denied");
            if (onErrorCallback) onErrorCallback("Permission denied");
            break;
          case 4004:
            console.error("WebSocket closed: Game not found");
            if (onErrorCallback) onErrorCallback("Game not found");
            break;
          case 1006:
            console.error("WebSocket closed: Connection lost");
            if (onErrorCallback) onErrorCallback("Connection lost");
            break;
          default:
            break;
        }

        if (onCloseCallback) onCloseCallback(event);
      };

      return socket;
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      if (onErrorCallback)
        onErrorCallback("Failed to create WebSocket connection");
      return null;
    }
  },

  // Check if WebSocket is supported by the browser
  isWebSocketSupported: () => {
    return "WebSocket" in window;
  },

  // Get hand history for a specific game
  getHandHistory: (gameId) => apiClient.get(`/games/${gameId}/hand-history/`),

  // Get game summary for a completed game
  // Returns game summary with metadata, player results, and performance rankings
  // Response structure:
  // {
  //   game: {
  //     id: number,
  //     table_name: string,
  //     completion_time: string (ISO datetime),
  //     total_hands: number,
  //     status: string
  //   },
  //   player_results: [
  //     {
  //       player_id: number,
  //       player_name: string,
  //       starting_stack: number,
  //       final_stack: number,
  //       win_loss: number,
  //       status: string
  //     }
  //   ],
  //   players_by_performance: [
  //     // Same structure as player_results but sorted by win_loss (highest to lowest)
  //   ]
  // }
  getGameSummary: (id) => apiClient.get(`/games/${id}/summary/`),
};

const botService = {
  // Add a bot to a specific table
  addBotToTable: (tableId, buyIn, difficulty = 'BASIC', playStyle = 'TIGHT_AGGRESSIVE') =>
    apiClient.post(`/tables/${tableId}/add-bot/`, {
      buy_in: buyIn,
      difficulty: difficulty,
      play_style: playStyle
    }),
  
  // Remove a bot from a table
  removeBotFromTable: (tableId, botId) =>
    apiClient.delete(`/tables/${tableId}/remove-bot/${botId}/`),
  
  // List all available bots not currently in games
  listAvailableBots: () => apiClient.get(`/bots/`),
  
  // Create a new bot player
  createBot: (config = {}) => {
    const botConfig = {
      difficulty: config.difficulty || 'BASIC',
      play_style: config.playStyle || 'TIGHT_AGGRESSIVE',
      aggression_factor: config.aggressionFactor || 0.5,
      bluff_frequency: config.bluffFrequency || 0.1
    };
    return apiClient.post(`/bots/create/`, botConfig);
  },
  
  // Delete a bot player permanently
  deleteBotPlayer: (botId) => apiClient.delete(`/bots/${botId}/`),
  
  // Get statistics for a specific bot
  getBotStats: (botId) => apiClient.get(`/bots/${botId}/stats/`),
  
  // Bot configuration constants
  DIFFICULTIES: ['BASIC', 'INTERMEDIATE', 'ADVANCED'],
  PLAY_STYLES: ['TIGHT_PASSIVE', 'TIGHT_AGGRESSIVE', 'LOOSE_PASSIVE', 'LOOSE_AGGRESSIVE'],
  
  // Helper function to get display names for bot configurations
  getDifficultyDisplayName: (difficulty) => {
    const displayNames = {
      'BASIC': 'Basic',
      'INTERMEDIATE': 'Intermediate', 
      'ADVANCED': 'Advanced'
    };
    return displayNames[difficulty] || difficulty;
  },
  
  getPlayStyleDisplayName: (playStyle) => {
    const displayNames = {
      'TIGHT_PASSIVE': 'Tight Passive',
      'TIGHT_AGGRESSIVE': 'Tight Aggressive',
      'LOOSE_PASSIVE': 'Loose Passive',
      'LOOSE_AGGRESSIVE': 'Loose Aggressive'
    };
    return displayNames[playStyle] || playStyle;
  }
};

export { authService, playerService, tableService, gameService, botService };
