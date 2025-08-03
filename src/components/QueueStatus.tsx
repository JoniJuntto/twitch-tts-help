import { useTTSQueue } from '../contexts/TTSContext';
import './QueueStatus.css';

/**
 * Props for the QueueStatus component
 * Requirements: 4.1, 4.2, 4.4
 */
interface QueueStatusProps {
  className?: string;
  showControls?: boolean;
}

/**
 * Formats the current speaking message for display
 */
function formatCurrentMessage(message: string, maxLength: number = 50): string {
  if (message.length <= maxLength) {
    return message;
  }
  return message.substring(0, maxLength) + '...';
}

/**
 * QueueStatus component showing current TTS queue status
 * Requirements: 4.1, 4.2, 4.4
 */
export function QueueStatus({ 
  className = '',
  showControls = true 
}: QueueStatusProps) {
  const {
    currentItem,
    isProcessing,
    queueCount,
    isEmpty,
    actions
  } = useTTSQueue();

  const handleSkipCurrent = () => {
    actions.skipCurrent();
  };

  const handleClearQueue = () => {
    actions.clearQueue();
  };

  return (
    <div className={`queue-status ${className}`}>
      <div className="queue-status__header">
        <h3 className="queue-status__title">TTS Queue</h3>
        <div className="queue-status__count">
          <span className="queue-status__count-number">{queueCount}</span>
          <span className="queue-status__count-label">
            {queueCount === 1 ? 'message' : 'messages'}
          </span>
        </div>
      </div>

      <div className="queue-status__content">
        {/* Currently Speaking Section */}
        {currentItem ? (
          <div className="queue-status__current">
            <div className="queue-status__current-header">
              <div className="queue-status__current-indicator">
                <span className="queue-status__speaking-icon">🔊</span>
                <span className="queue-status__speaking-text">Now Speaking</span>
                {isProcessing && (
                  <div className="queue-status__speaking-animation">
                    <div className="queue-status__wave"></div>
                    <div className="queue-status__wave"></div>
                    <div className="queue-status__wave"></div>
                  </div>
                )}
              </div>
              {showControls && (
                <button
                  onClick={handleSkipCurrent}
                  className="queue-status__skip-button"
                  title="Skip current message"
                >
                  <span className="queue-status__skip-icon">⏭️</span>
                </button>
              )}
            </div>
            <div className="queue-status__current-message">
              <div className="queue-status__current-user">
                {currentItem.message.username}
              </div>
              <div className="queue-status__current-text">
                {formatCurrentMessage(currentItem.message.message)}
              </div>
            </div>
          </div>
        ) : (
          /* Empty State - No Current Message */
          <div className="queue-status__current queue-status__current--empty">
            <div className="queue-status__empty-icon">🔇</div>
            <div className="queue-status__empty-text">
              {isEmpty ? 'Queue is empty' : 'Ready to speak'}
            </div>
          </div>
        )}

        {/* Queue Count and Status */}
        <div className="queue-status__info">
          {queueCount > 0 ? (
            <div className="queue-status__pending">
              <div className="queue-status__pending-icon">⏳</div>
              <div className="queue-status__pending-text">
                {queueCount} message{queueCount !== 1 ? 's' : ''} waiting
              </div>
            </div>
          ) : (
            !currentItem && (
              <div className="queue-status__empty-state">
                <div className="queue-status__empty-state-icon">✨</div>
                <div className="queue-status__empty-state-text">
                  No messages in queue
                </div>
              </div>
            )
          )}
        </div>

        {/* Queue Controls */}
        {showControls && (queueCount > 0 || currentItem) && (
          <div className="queue-status__controls">
            <button
              onClick={handleClearQueue}
              className="queue-status__clear-button"
              title="Clear entire queue"
            >
              <span className="queue-status__clear-icon">🗑️</span>
              <span className="queue-status__clear-text">Clear Queue</span>
            </button>
          </div>
        )}

        {/* Processing Status Indicator */}
        {isProcessing && (
          <div className="queue-status__processing">
            <div className="queue-status__processing-indicator">
              <div className="queue-status__processing-spinner"></div>
              <span className="queue-status__processing-text">Processing...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QueueStatus;