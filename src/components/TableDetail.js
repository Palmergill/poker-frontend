// src/components/TableDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tableService, playerService } from '../services/apiService';
import Spinner from './Spinner';

const TableDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [table, setTable] = useState(null);
  const [player, setPlayer] = useState(null);
  const [buyIn, setBuyIn] = useState('');
  const [loading, setLoading] = useState(true);
  const [joiningTable, setJoiningTable] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTableAndPlayer = async () => {
      try {
        const [tableResponse, playerResponse] = await Promise.all([
          tableService.getTable(id),
          playerService.getProfile()
        ]);
        
        setTable(tableResponse.data);
        setPlayer(playerResponse.data);
        
        // Set default buy-in to min buy-in
        setBuyIn(tableResponse.data.min_buy_in);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load table information');
        setLoading(false);
      }
    };

    fetchTableAndPlayer();
  }, [id]);

  const handleJoinTable = async () => {
    if (!buyIn || parseFloat(buyIn) < parseFloat(table.min_buy_in) || parseFloat(buyIn) > parseFloat(table.max_buy_in)) {
      setError(`Buy-in must be between $${table.min_buy_in} and $${table.max_buy_in}`);
      return;
    }

    setJoiningTable(true);
    setError(null);

    try {
      const response = await tableService.joinTable(id, buyIn);
      // Navigate to the game page
      navigate(`/games/${response.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join table');
    } finally {
      setJoiningTable(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading table details...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!table) {
    return <div className="error">Table not found</div>;
  }

  return (
    <div className="table-detail">
      <h2>{table.name}</h2>
      
      <div className="table-info-card">
        <h3>Table Information</h3>
        <div className="table-specs">
          <div className="spec-item">
            <span className="label">Small Blind:</span>
            <span className="value">${table.small_blind}</span>
          </div>
          
          <div className="spec-item">
            <span className="label">Big Blind:</span>
            <span className="value">${table.big_blind}</span>
          </div>
          
          <div className="spec-item">
            <span className="label">Min Buy-in:</span>
            <span className="value">${table.min_buy_in}</span>
          </div>
          
          <div className="spec-item">
            <span className="label">Max Buy-in:</span>
            <span className="value">${table.max_buy_in}</span>
          </div>
          
          <div className="spec-item">
            <span className="label">Max Players:</span>
            <span className="value">{table.max_players}</span>
          </div>
        </div>
      </div>
      
      {player && (
        <div className="join-table-section">
          <h3>Join This Table</h3>
          <p>Buy in for any amount within the table limits</p>
          
          <div className="buy-in-controls">
            <div className="form-group">
              <label>Buy-in Amount:</label>
              <input
                type="number"
                min={table.min_buy_in}
                max={table.max_buy_in}
                step="0.01"
                value={buyIn}
                onChange={(e) => setBuyIn(e.target.value)}
              />
            </div>
            
            <button 
              onClick={handleJoinTable}
              disabled={joiningTable || !buyIn || parseFloat(buyIn) < parseFloat(table.min_buy_in) || 
                        parseFloat(buyIn) > parseFloat(table.max_buy_in)}
            >
              {joiningTable && <Spinner size="small" />}
              {joiningTable ? 'Joining Table...' : 'Join Table'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableDetail;