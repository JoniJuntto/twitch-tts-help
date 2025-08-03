import { useEffect, useState } from 'react';
import { useConnectionStatus, useChatActions } from '../contexts/ChatContext';
import './ConnectionStatus.css';

/**
 * Connection status indicator component
 * Shows Twitch connection state with visual indicators and error messages
 * Requirements: 1.3, 1.4
 */
export function ConnectionStatus() {
  const { status, isConnected, reconnectAttempts, error } = useConnectionStatus();
  const { connect, disconnect } = useChatActions();
  const [countdown, setCountdown] = useState<number | null>(null);

  // Calculate reconnection countdown when reconnecting
  useEffect(() => {
    if (status === 'disconnected' && reconnectAttempts > 0 && !isConnected) {
      // Calculate delay with exponential backoff: baseDelay * 2^attempts
      const baseDelay = 1000;
      const delay = Math.min(
        baseDelay * Math.pow(2, reconnectAttempts - 1),
        30000 // Max 30 seconds
      );
      
      let remainingTime = Math.ceil(delay / 1000);
      setCountdown(remainingTime);

      const interval = setInterval(() => {
        remainingTime -= 1;
        if (remainingTime <= 0) {
          setCountdown(null);
          clearInterval(interval);
        } else {
          setCountdown(remainingTime);
        }
      }, 1000);

      return () => {
        clearInterval(interval);
        setCountdown(null);
      };
    } else {
      setCountdown(null);
    }
  }, [status, reconnectAttempts, isConnected]);

  /**
   * Get status display text based on connection state
   */
  const getStatusText = (): string => {
    switch (status) {
      case 'connected':
        return 'Connected to Twitch Chat';
      case 'connecting':
        return 'Connecting to Twitch Chat...';
      case 'disconnected':
        if (reconnectAttempts > 0) {
          return countdown 
            ? `Reconnecting in ${countdown}s (attempt ${reconnectAttempts})`
            : `Reconnecting... (attempt ${reconnectAttempts})`;
        }
        return 'Disconnected from Twitch Chat';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown Status';
    }
  };

  /**
   * Get CSS class for status indicator
   */
  const getStatusClass = (): string => {
    const baseClass = 'connection-status';
    switch (status) {
      case 'connected':
        return `${baseClass} ${baseClass}--connected`;
      case 'connecting':
        return `${baseClass} ${baseClass}--connecting`;
      case 'disconnected':
        return `${baseClass} ${baseClass}--disconnected`;
      case 'error':
        return `${baseClass} ${baseClass}--error`;
      default:
        return baseClass;
    }
  };

  /**
   * Get status icon based on connection state
   */
  const getStatusIcon = (): string => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return reconnectAttempts > 0 ? '🔄' : '🔴';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  /**
   * Handle manual connection toggle
   */
  const handleConnectionToggle = async () => {
    if (isConnected) {
      disconnect();
    } else {
      await connect();
    }
  };

  return (
    <div className={getStatusClass()}>
      <div className="connection-status__indicator">
        <span className="connection-status__icon" role="img" aria-label={`Status: ${status}`}>
          {getStatusIcon()}
        </span>
        <span className="connection-status__text">
          {getStatusText()}
        </span>
      </div>

      {error && (
        <div className="connection-status__error" role="alert">
          <span className="connection-status__error-icon" role="img" aria-label="Error">
            ⚠️
          </span>
          <span className="connection-status__error-text">
            {error}
          </span>
        </div>
      )}

      {reconnectAttempts > 0 && status !== 'connected' && (
        <div className="connection-status__reconnect-info">
          <span className="connection-status__attempts">
            Reconnect attempts: {reconnectAttempts}/10
          </span>
          {countdown && (
            <span className="connection-status__countdown">
              Next attempt in {countdown}s
            </span>
          )}
        </div>
      )}

      <div className="connection-status__actions">
        <button
          className={`connection-status__button ${
            isConnected 
              ? 'connection-status__button--disconnect' 
              : 'connection-status__button--connect'
          }`}
          onClick={handleConnectionToggle}
          disabled={status === 'connecting'}
          aria-label={isConnected ? 'Disconnect from Twitch' : 'Connect to Twitch'}
        >
          {status === 'connecting' ? 'Connecting...' : (isConnected ? 'Disconnect' : 'Connect')}
        </button>
      </div>
    </div>
  );
}