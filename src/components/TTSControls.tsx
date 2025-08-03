import React, { useState, useCallback } from 'react';
import { useTTSControls, useTTSQueue } from '../contexts/TTSContext';
import './TTSControls.css';

/**
 * TTS Controls component for managing text-to-speech settings
 * Requirements: 3.1, 3.2, 3.3, 3.4, 4.3, 5.4
 */
export function TTSControls() {
  const {
    settings,
    updateSettings,
    testSpeak,
    availableVoices,
    isSupported,
    error
  } = useTTSControls();
  
  const { actions: queueActions } = useTTSQueue();
  
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isTestSpeaking, setIsTestSpeaking] = useState(false);

  // Handle TTS enable/disable toggle
  const handleToggleEnabled = useCallback(() => {
    updateSettings({ enabled: !settings.enabled });
  }, [settings.enabled, updateSettings]);

  // Handle volume change with real-time updates
  const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(event.target.value);
    updateSettings({ volume });
  }, [updateSettings]);

  // Handle rate change with real-time updates
  const handleRateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(event.target.value);
    updateSettings({ rate });
  }, [updateSettings]);

  // Handle pitch change with real-time updates
  const handlePitchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const pitch = parseFloat(event.target.value);
    updateSettings({ pitch });
  }, [updateSettings]);

  // Handle voice selection
  const handleVoiceChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const voiceIndex = parseInt(event.target.value);
    const selectedVoice = availableVoices[voiceIndex] || null;
    updateSettings({ voice: selectedVoice });
  }, [availableVoices, updateSettings]);

  // Handle clear queue with confirmation
  const handleClearQueue = useCallback(() => {
    if (showClearConfirmation) {
      queueActions.clearQueue();
      setShowClearConfirmation(false);
    } else {
      setShowClearConfirmation(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setShowClearConfirmation(false), 3000);
    }
  }, [showClearConfirmation, queueActions]);

  // Handle test speak
  const handleTestSpeak = useCallback(async () => {
    if (isTestSpeaking) return;
    
    setIsTestSpeaking(true);
    try {
      await testSpeak('This is a test of the text to speech system.');
    } catch (error) {
      console.error('Test speak failed:', error);
    } finally {
      setIsTestSpeaking(false);
    }
  }, [isTestSpeaking, testSpeak]);

  // Cancel clear confirmation
  const handleCancelClear = useCallback(() => {
    setShowClearConfirmation(false);
  }, []);

  if (!isSupported) {
    return (
      <div className="tts-controls tts-controls--unsupported">
        <div className="tts-controls__error">
          <span className="tts-controls__error-icon">⚠️</span>
          <span>Text-to-speech is not supported in this browser</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tts-controls">
      <div className="tts-controls__header">
        <h3 className="tts-controls__title">TTS Controls</h3>
        
        {/* Enable/Disable Toggle */}
        <div className="tts-controls__toggle">
          <label className="tts-controls__toggle-label">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={handleToggleEnabled}
              className="tts-controls__toggle-input"
            />
            <span className="tts-controls__toggle-slider"></span>
            <span className="tts-controls__toggle-text">
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>

      {error && (
        <div className="tts-controls__error">
          <span className="tts-controls__error-icon">❌</span>
          <span>{error}</span>
        </div>
      )}

      <div className={`tts-controls__content ${!settings.enabled ? 'tts-controls__content--disabled' : ''}`}>
        
        {/* Voice Selection */}
        <div className="tts-controls__group">
          <label className="tts-controls__label" htmlFor="voice-select">
            Voice
          </label>
          <select
            id="voice-select"
            value={availableVoices.findIndex(voice => voice === settings.voice)}
            onChange={handleVoiceChange}
            disabled={!settings.enabled}
            className="tts-controls__select"
          >
            {availableVoices.map((voice, index) => (
              <option key={`${voice.name}-${voice.lang}`} value={index}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>

        {/* Volume Control */}
        <div className="tts-controls__group">
          <label className="tts-controls__label" htmlFor="volume-slider">
            Volume: {Math.round(settings.volume * 100)}%
          </label>
          <input
            id="volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.volume}
            onChange={handleVolumeChange}
            disabled={!settings.enabled}
            className="tts-controls__slider"
          />
        </div>

        {/* Rate Control */}
        <div className="tts-controls__group">
          <label className="tts-controls__label" htmlFor="rate-slider">
            Speed: {settings.rate.toFixed(1)}x
          </label>
          <input
            id="rate-slider"
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.rate}
            onChange={handleRateChange}
            disabled={!settings.enabled}
            className="tts-controls__slider"
          />
        </div>

        {/* Pitch Control */}
        <div className="tts-controls__group">
          <label className="tts-controls__label" htmlFor="pitch-slider">
            Pitch: {settings.pitch.toFixed(1)}
          </label>
          <input
            id="pitch-slider"
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.pitch}
            onChange={handlePitchChange}
            disabled={!settings.enabled}
            className="tts-controls__slider"
          />
        </div>

        {/* Action Buttons */}
        <div className="tts-controls__actions">
          {/* Test Speak Button */}
          <button
            onClick={handleTestSpeak}
            disabled={!settings.enabled || isTestSpeaking}
            className="tts-controls__button tts-controls__button--test"
          >
            {isTestSpeaking ? (
              <>
                <span className="tts-controls__button-spinner"></span>
                Testing...
              </>
            ) : (
              <>
                <span className="tts-controls__button-icon">🔊</span>
                Test Voice
              </>
            )}
          </button>

          {/* Clear Queue Button */}
          <div className="tts-controls__clear-queue">
            {showClearConfirmation ? (
              <div className="tts-controls__confirmation">
                <span className="tts-controls__confirmation-text">Clear queue?</span>
                <button
                  onClick={handleClearQueue}
                  className="tts-controls__button tts-controls__button--confirm"
                >
                  Yes
                </button>
                <button
                  onClick={handleCancelClear}
                  className="tts-controls__button tts-controls__button--cancel"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={handleClearQueue}
                disabled={!settings.enabled}
                className="tts-controls__button tts-controls__button--clear"
              >
                <span className="tts-controls__button-icon">🗑️</span>
                Clear Queue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}