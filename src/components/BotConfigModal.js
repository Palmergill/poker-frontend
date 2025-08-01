// src/components/BotConfigModal.js
import React, { useState } from 'react';
import { botService } from '../services/apiService';
import './BotConfigModal.css';

const BotConfigModal = ({ isOpen, onClose, onBotAdded, tableId, tableBuyInRange }) => {
  const [buyInAmount, setBuyInAmount] = useState(tableBuyInRange?.min || 100);
  const [difficulty, setDifficulty] = useState('BASIC');
  const [playStyle, setPlayStyle] = useState('TIGHT_AGGRESSIVE');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  const handleAddBot = async (e) => {
    e.preventDefault();
    setIsAdding(true);
    setError('');

    try {
      // Validate buy-in amount
      if (tableBuyInRange) {
        if (buyInAmount < tableBuyInRange.min || buyInAmount > tableBuyInRange.max) {
          throw new Error(`Buy-in must be between $${tableBuyInRange.min} and $${tableBuyInRange.max}`);
        }
      }

      const response = await botService.addBotToTable(tableId, buyInAmount, difficulty, playStyle);
      
      if (response.data.success) {
        onBotAdded(response.data);
        onClose();
        // Reset form
        setBuyInAmount(tableBuyInRange?.min || 100);
        setDifficulty('BASIC');
        setPlayStyle('TIGHT_AGGRESSIVE');
      }
    } catch (err) {
      console.error('Error adding bot:', err);
      setError(err.response?.data?.error || err.message || 'Failed to add bot');
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bot-modal-overlay" onClick={onClose}>
      <div className="bot-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="bot-modal-header">
          <h2>🤖 Add Bot Player</h2>
          <button className="bot-modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleAddBot} className="bot-config-form">
          {error && <div className="bot-error-message">{error}</div>}

          <div className="bot-config-section">
            <label className="bot-config-label">
              Buy-in Amount
              <div className="bot-input-container">
                <span className="bot-currency-symbol">$</span>
                <input
                  type="number"
                  value={buyInAmount}
                  onChange={(e) => setBuyInAmount(Number(e.target.value))}
                  min={tableBuyInRange?.min || 1}
                  max={tableBuyInRange?.max || 10000}
                  step="1"
                  className="bot-number-input"
                  required
                />
              </div>
              {tableBuyInRange && (
                <small className="bot-input-hint">
                  Range: ${tableBuyInRange.min} - ${tableBuyInRange.max}
                </small>
              )}
            </label>
          </div>

          <div className="bot-config-section">
            <label className="bot-config-label">
              Difficulty Level
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="bot-select"
              >
                <option value="BASIC">Basic - Simple strategy</option>
                <option value="INTERMEDIATE">Intermediate - Considers position & odds</option>
                <option value="ADVANCED">Advanced - Complex strategy with bluffing</option>
              </select>
            </label>
          </div>

          <div className="bot-config-section">
            <label className="bot-config-label">
              Play Style
              <select
                value={playStyle}
                onChange={(e) => setPlayStyle(e.target.value)}
                className="bot-select"
              >
                <option value="TIGHT_AGGRESSIVE">Tight Aggressive - Few hands, aggressive betting</option>
                <option value="TIGHT_PASSIVE">Tight Passive - Few hands, passive betting</option>
                <option value="LOOSE_AGGRESSIVE">Loose Aggressive - Many hands, aggressive betting</option>
                <option value="LOOSE_PASSIVE">Loose Passive - Many hands, passive betting</option>
              </select>
            </label>
          </div>

          <div className="bot-config-preview">
            <h4>Bot Preview</h4>
            <div className="bot-preview-card">
              <div className="bot-preview-icon">🤖</div>
              <div className="bot-preview-details">
                <div className="bot-preview-name">Bot Player</div>
                <div className="bot-preview-config">
                  {botService.getDifficultyDisplayName(difficulty)} • {botService.getPlayStyleDisplayName(playStyle)}
                </div>
                <div className="bot-preview-buyin">${buyInAmount} buy-in</div>
              </div>
            </div>
          </div>

          <div className="bot-modal-actions">
            <button type="button" className="bot-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="bot-add-btn" disabled={isAdding}>
              {isAdding ? 'Adding Bot...' : 'Add Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BotConfigModal;