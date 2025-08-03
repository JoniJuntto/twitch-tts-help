import React, { useState, useCallback } from 'react';
import { useTTSSettings } from '../contexts/TTSContext';
import './FilterControls.css';

/**
 * Filter Controls component for managing message filtering preferences
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export function FilterControls() {
  const { settings, updateSettings } = useTTSSettings();
  
  const [newBlockedUser, setNewBlockedUser] = useState('');
  const [minLengthInput, setMinLengthInput] = useState(settings.minMessageLength.toString());
  const [minLengthError, setMinLengthError] = useState('');

  // Handle bot filtering toggle
  const handleToggleBotFilter = useCallback(() => {
    updateSettings({ filterBots: !settings.filterBots });
  }, [settings.filterBots, updateSettings]);

  // Handle emote-only filtering toggle
  const handleToggleEmoteFilter = useCallback(() => {
    updateSettings({ skipEmoteOnly: !settings.skipEmoteOnly });
  }, [settings.skipEmoteOnly, updateSettings]);

  // Handle minimum message length change with validation
  const handleMinLengthChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setMinLengthInput(value);
    
    // Clear previous error
    setMinLengthError('');
    
    // Validate input
    const numValue = parseInt(value);
    if (isNaN(numValue)) {
      setMinLengthError('Please enter a valid number');
      return;
    }
    
    if (numValue < 1) {
      setMinLengthError('Minimum length must be at least 1');
      return;
    }
    
    if (numValue > 500) {
      setMinLengthError('Minimum length cannot exceed 500');
      return;
    }
    
    // Update settings if valid
    updateSettings({ minMessageLength: numValue });
  }, [updateSettings]);

  // Handle minimum length input blur (revert to valid value if invalid)
  const handleMinLengthBlur = useCallback(() => {
    if (minLengthError) {
      setMinLengthInput(settings.minMessageLength.toString());
      setMinLengthError('');
    }
  }, [minLengthError, settings.minMessageLength]);

  // Handle new blocked user input change
  const handleNewBlockedUserChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setNewBlockedUser(event.target.value);
  }, []);

  // Add user to blocked list
  const handleAddBlockedUser = useCallback(() => {
    const username = newBlockedUser.trim().toLowerCase();
    
    if (!username) {
      return;
    }
    
    if (settings.blockedUsers.includes(username)) {
      return; // User already blocked
    }
    
    updateSettings({
      blockedUsers: [...settings.blockedUsers, username]
    });
    
    setNewBlockedUser('');
  }, [newBlockedUser, settings.blockedUsers, updateSettings]);

  // Remove user from blocked list
  const handleRemoveBlockedUser = useCallback((username: string) => {
    updateSettings({
      blockedUsers: settings.blockedUsers.filter(user => user !== username)
    });
  }, [settings.blockedUsers, updateSettings]);

  // Handle Enter key in blocked user input
  const handleBlockedUserKeyPress = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddBlockedUser();
    }
  }, [handleAddBlockedUser]);

  return (
    <div className="filter-controls">
      <div className="filter-controls__header">
        <h3 className="filter-controls__title">Message Filters</h3>
      </div>

      <div className="filter-controls__content">
        
        {/* Bot Message Filter Toggle */}
        <div className="filter-controls__group">
          <div className="filter-controls__toggle">
            <label className="filter-controls__toggle-label">
              <input
                type="checkbox"
                checked={settings.filterBots}
                onChange={handleToggleBotFilter}
                className="filter-controls__toggle-input"
              />
              <span className="filter-controls__toggle-slider"></span>
              <span className="filter-controls__toggle-text">
                Filter bot messages
              </span>
            </label>
          </div>
          <p className="filter-controls__description">
            Skip messages from known bots and automated accounts
          </p>
        </div>

        {/* Emote-Only Filter Toggle */}
        <div className="filter-controls__group">
          <div className="filter-controls__toggle">
            <label className="filter-controls__toggle-label">
              <input
                type="checkbox"
                checked={settings.skipEmoteOnly}
                onChange={handleToggleEmoteFilter}
                className="filter-controls__toggle-input"
              />
              <span className="filter-controls__toggle-slider"></span>
              <span className="filter-controls__toggle-text">
                Skip emote-only messages
              </span>
            </label>
          </div>
          <p className="filter-controls__description">
            Skip messages that appear to contain only emotes
          </p>
        </div>

        {/* Minimum Message Length */}
        <div className="filter-controls__group">
          <label className="filter-controls__label" htmlFor="min-length-input">
            Minimum message length
          </label>
          <div className="filter-controls__input-group">
            <input
              id="min-length-input"
              type="number"
              min="1"
              max="500"
              value={minLengthInput}
              onChange={handleMinLengthChange}
              onBlur={handleMinLengthBlur}
              className={`filter-controls__input ${minLengthError ? 'filter-controls__input--error' : ''}`}
              placeholder="Enter minimum length"
            />
            <span className="filter-controls__input-suffix">characters</span>
          </div>
          {minLengthError && (
            <div className="filter-controls__error">
              <span className="filter-controls__error-icon">⚠️</span>
              <span>{minLengthError}</span>
            </div>
          )}
          <p className="filter-controls__description">
            Skip messages shorter than this length
          </p>
        </div>

        {/* Blocked Users List */}
        <div className="filter-controls__group">
          <label className="filter-controls__label" htmlFor="blocked-user-input">
            Blocked users
          </label>
          
          {/* Add new blocked user */}
          <div className="filter-controls__input-group">
            <input
              id="blocked-user-input"
              type="text"
              value={newBlockedUser}
              onChange={handleNewBlockedUserChange}
              onKeyPress={handleBlockedUserKeyPress}
              className="filter-controls__input"
              placeholder="Enter username to block"
            />
            <button
              onClick={handleAddBlockedUser}
              disabled={!newBlockedUser.trim()}
              className="filter-controls__button filter-controls__button--add"
            >
              <span className="filter-controls__button-icon">➕</span>
              Add
            </button>
          </div>
          
          {/* Blocked users list */}
          {settings.blockedUsers.length > 0 ? (
            <div className="filter-controls__blocked-list">
              {settings.blockedUsers.map((username) => (
                <div key={username} className="filter-controls__blocked-item">
                  <span className="filter-controls__blocked-username">
                    {username}
                  </span>
                  <button
                    onClick={() => handleRemoveBlockedUser(username)}
                    className="filter-controls__button filter-controls__button--remove"
                    title={`Remove ${username} from blocked list`}
                  >
                    <span className="filter-controls__button-icon">❌</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="filter-controls__empty-state">
              <span className="filter-controls__empty-icon">👥</span>
              <span>No blocked users</span>
            </div>
          )}
          
          <p className="filter-controls__description">
            Messages from these users will not be spoken
          </p>
        </div>

        {/* Filter Summary */}
        <div className="filter-controls__summary">
          <h4 className="filter-controls__summary-title">Active Filters</h4>
          <ul className="filter-controls__summary-list">
            {settings.filterBots && (
              <li className="filter-controls__summary-item">
                <span className="filter-controls__summary-icon">🤖</span>
                Bot messages filtered
              </li>
            )}
            {settings.skipEmoteOnly && (
              <li className="filter-controls__summary-item">
                <span className="filter-controls__summary-icon">😀</span>
                Emote-only messages filtered
              </li>
            )}
            <li className="filter-controls__summary-item">
              <span className="filter-controls__summary-icon">📏</span>
              Messages under {settings.minMessageLength} characters filtered
            </li>
            {settings.blockedUsers.length > 0 && (
              <li className="filter-controls__summary-item">
                <span className="filter-controls__summary-icon">🚫</span>
                {settings.blockedUsers.length} user{settings.blockedUsers.length !== 1 ? 's' : ''} blocked
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}