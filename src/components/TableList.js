// src/components/TableList.js
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { tableService, gameService, authService, botService } from "../services/apiService";

const TableList = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeGames, setActiveGames] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // {tableId, tableName}
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [joinTableId, setJoinTableId] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isAdmin = authService.isAdmin();

  useEffect(() => {
    const fetchTables = async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setIsRefreshing(true);
        }
        const response = await tableService.getTables();
        
        // Handle DRF pagination format - check if response.data has results array
        let tableData = [];
        if (response.data && Array.isArray(response.data.results)) {
          tableData = response.data.results;
        } else if (Array.isArray(response.data)) {
          tableData = response.data;
        }
        
        setTables(tableData);
        if (!isRefresh) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load tables:", err);
        setTables([]); // Set to empty array on error
        if (!isRefresh) {
          setError("Failed to load tables");
          setLoading(false);
        } else {
          console.warn("Failed to refresh tables:", err);
        }
      } finally {
        if (isRefresh) {
          setIsRefreshing(false);
        }
      }
    };

    const fetchActiveGames = async (isRefresh = false) => {
      try {
        const response = await gameService.getGames();
        
        // Handle DRF pagination format - check if response.data has results array
        let gamesData = [];
        if (response.data && Array.isArray(response.data.results)) {
          gamesData = response.data.results;
        } else if (Array.isArray(response.data)) {
          gamesData = response.data;
        }
        
        setActiveGames(gamesData);
      } catch (err) {
        console.error("Failed to load active games:", err);
        setActiveGames([]); // Set to empty array on error
        if (!isRefresh) {
          console.error("Failed to load active games:", err);
        } else {
          console.warn("Failed to refresh active games:", err);
        }
      }
    };

    const refreshData = async () => {
      await Promise.all([
        fetchTables(true),
        fetchActiveGames(true)
      ]);
    };

    // Initial load
    fetchTables();
    fetchActiveGames();
  }, []);

  if (loading) {
    return <div className="loading">Loading tables...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  const getActiveGameForTable = (tableId) => {
    return activeGames.find((game) => game.table.id === tableId);
  };

  const isCurrentUserInGame = (activeGame) => {
    if (!activeGame || !activeGame.players) return false;
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return false;
    
    
    return activeGame.players.some(gamePlayer => 
      gamePlayer.player && gamePlayer.player.user && gamePlayer.player.user.id === currentUser.id
    );
  };

  const handleDeleteClick = (table) => {
    setDeleteConfirm({ tableId: table.id, tableName: table.name });
  };

  const refreshDataAfterOperation = async () => {
    try {
      const [tablesResponse, gamesResponse] = await Promise.all([
        tableService.getTables(),
        gameService.getGames()
      ]);
      
      // Handle DRF pagination format for both responses
      let tableData = [];
      if (tablesResponse.data && Array.isArray(tablesResponse.data.results)) {
        tableData = tablesResponse.data.results;
      } else if (Array.isArray(tablesResponse.data)) {
        tableData = tablesResponse.data;
      }
      
      let gamesData = [];
      if (gamesResponse.data && Array.isArray(gamesResponse.data.results)) {
        gamesData = gamesResponse.data.results;
      } else if (Array.isArray(gamesResponse.data)) {
        gamesData = gamesResponse.data;
      }
      
      setTables(tableData);
      setActiveGames(gamesData);
    } catch (err) {
      console.warn("Failed to refresh data after operation:", err);
      // On error, ensure we still have valid arrays
      setTables([]);
      setActiveGames([]);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      setError(null);
      await tableService.deleteTable(deleteConfirm.tableId);
      setDeleteConfirm(null);
      
      // Refresh data to get updated list
      await refreshDataAfterOperation();
      
      // Show success message briefly
      setError("✅ Table deleted successfully");
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error("Failed to delete table:", err);
      setError(
        `Failed to delete table: ${err.response?.data?.error || err.message}`
      );
      setDeleteConfirm(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };


  const handleDeleteAllClick = () => {
    setDeleteAllConfirm(true);
  };

  const handleDeleteAllConfirm = async () => {
    try {
      setError(null);
      const response = await tableService.deleteAllTables();
      setDeleteAllConfirm(false);
      
      // Refresh data to get updated list
      await refreshDataAfterOperation();
      
      // Show success message
      setError(`✅ ${response.data.message}`);
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      console.error("Failed to delete all tables:", err);
      setError(
        `Failed to delete all tables: ${err.response?.data?.error || err.message}`
      );
      setDeleteAllConfirm(false);
    }
  };

  const handleDeleteAllCancel = () => {
    setDeleteAllConfirm(false);
  };

  const handleJoinTableClick = (table) => {
    setJoinTableId(table.id);
    setBuyInAmount(table.min_buy_in.toString());
  };

  const handleJoinTableConfirm = async () => {
    if (!joinTableId || !buyInAmount) return;

    try {
      setError(null);
      const response = await tableService.joinTable(joinTableId, parseFloat(buyInAmount));
      
      // Redirect to the game
      window.location.href = `/games/${response.data.id}`;
    } catch (err) {
      console.error("Failed to join table:", err);
      const errorMessage = err.response?.data?.error || err.message;
      
      // If user is already at the table, refresh data and redirect
      if (errorMessage.includes("already at this table")) {
        // Refresh the game data first
        await refreshDataAfterOperation();
        
        const activeGame = getActiveGameForTable(joinTableId);
        if (activeGame) {
          window.location.href = `/games/${activeGame.id}`;
          return;
        }
      }
      
      setError(`Failed to join table: ${errorMessage}`);
      setJoinTableId(null);
    }
  };

  const handleJoinTableCancel = () => {
    setJoinTableId(null);
    setBuyInAmount('');
  };


  return (
    <div className="table-list">
      <div className="table-list-header">
        <h2>
          Available Poker Tables
          {isRefreshing && <span className="refresh-indicator">🔄</span>}
        </h2>
        <div className="header-buttons">
          <button
            onClick={refreshDataAfterOperation}
            className="btn btn-secondary btn-sm"
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link to="/tables/create" className="btn btn-success btn-sm create-table-btn">
            Create New Table
          </Link>
          {isAdmin && tables.length > 0 && (
            <button
              onClick={handleDeleteAllClick}
              className="btn btn-danger btn-sm delete-all-btn"
            >
              Delete All Tables
            </button>
          )}
        </div>
      </div>

      {(!Array.isArray(tables) || tables.length === 0) ? (
        <div className="no-tables">
          <p>No tables available yet</p>
          <Link to="/tables/create" className="btn btn-primary btn-sm">
            Create the First Table
          </Link>
        </div>
      ) : (
        <div className="table-grid">
          {tables.map((table) => {
            const activeGame = getActiveGameForTable(table.id);
            const userInGame = activeGame ? isCurrentUserInGame(activeGame) : false;

            return (
              <div key={table.id} className="table-card">
                <h3>{table.name}</h3>
                <div className="table-info">
                  <p>
                    <strong>Blinds:</strong> ${table.small_blind}/$
                    {table.big_blind}
                  </p>
                  <p>
                    <strong>Buy-in:</strong> ${table.min_buy_in} - $
                    {table.max_buy_in}
                  </p>
                  <p>
                    <strong>Max Players:</strong> {table.max_players}
                  </p>

                  {activeGame && (
                    <p>
                      <strong>Status:</strong> {activeGame.status}
                      {activeGame.status === "PLAYING" &&
                        ` (${
                          activeGame.players.filter((p) => p.is_active).length
                        } active)`}
                    </p>
                  )}
                </div>

                <div className="table-actions">
                  {activeGame && userInGame ? (
                    // User is already in the game - only show Return to Game
                    <>
                      <Link
                        to={`/games/${activeGame.id}`}
                        className="btn btn-primary btn-sm"
                      >
                        Return to Game
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteClick(table)}
                          className="btn btn-danger btn-sm delete-table-btn"
                        >
                          Delete Table
                        </button>
                      )}
                    </>
                  ) : (
                    // User is not in the game or no active game - show Join Table
                    <>
                      <button
                        onClick={() => handleJoinTableClick(table)}
                        className="btn btn-success btn-sm join-table-btn"
                      >
                        Join Table
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteClick(table)}
                          className="btn btn-danger btn-sm delete-table-btn"
                        >
                          Delete Table
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <h3>Delete Table</h3>
            <p>
              Are you sure you want to delete the table "{deleteConfirm.tableName}"?
            </p>
            <p className="delete-warning">
              This action cannot be undone.
            </p>
            <div className="delete-modal-actions">
              <button
                onClick={handleDeleteCancel}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn btn-danger btn-sm"
              >
                Delete Table
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Delete All Tables Confirmation Modal */}
      {deleteAllConfirm && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <h3>Delete All Tables</h3>
            <p>
              Are you sure you want to delete ALL {tables.length} tables?
            </p>
            <p className="delete-warning">
              This will delete all tables, games, and kick out all players. This action cannot be undone.
            </p>
            <div className="delete-modal-actions">
              <button
                onClick={handleDeleteAllCancel}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllConfirm}
                className="btn btn-danger btn-sm"
              >
                Delete All Tables
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Table Modal */}
      {joinTableId && (
        <div className="join-modal-overlay">
          <div className="join-modal">
            <h3>Join Table</h3>
            <p>Enter your buy-in amount:</p>
            <div className="join-table-form">
              <label htmlFor="buyInAmount">Buy-in Amount ($):</label>
              <input
                type="number"
                id="buyInAmount"
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(e.target.value)}
                min={tables.find(t => t.id === joinTableId)?.min_buy_in || 0}
                max={tables.find(t => t.id === joinTableId)?.max_buy_in || 1000}
                step="0.01"
                className="form-input"
              />
              <p className="buy-in-range">
                Range: ${tables.find(t => t.id === joinTableId)?.min_buy_in} - $
                {tables.find(t => t.id === joinTableId)?.max_buy_in}
              </p>
            </div>
            <div className="join-modal-actions">
              <button
                onClick={handleJoinTableCancel}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinTableConfirm}
                className="btn btn-success btn-sm"
                disabled={!buyInAmount || parseFloat(buyInAmount) < (tables.find(t => t.id === joinTableId)?.min_buy_in || 0)}
              >
                Join Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableList;
