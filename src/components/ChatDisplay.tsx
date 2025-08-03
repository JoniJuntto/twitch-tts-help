import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import './ChatDisplay.css';

/**
 * Props for the ChatDisplay component
 * Requirements: 1.2, 5.1, 5.2, 5.3, 5.4
 */
interface ChatDisplayProps {
  messages: ChatMessage[];
  maxMessages?: number;
  autoScroll?: boolean;
  className?: string;
  isLoading?: boolean;
  isConnected?: boolean;
}

/**
 * Formats a timestamp for display
 */
function formatTimestamp(timestamp: Date): string {
  return timestamp.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Renders badges for a user
 */
function renderBadges(badges: string[]): React.ReactNode {
  if (!badges.length) return null;
  
  return (
    <span className="chat-badges">
      {badges.map((badge, index) => (
        <span key={index} className={`chat-badge chat-badge--${badge.toLowerCase()}`}>
          {badge}
        </span>
      ))}
    </span>
  );
}

/**
 * ChatDisplay component that shows real-time Twitch chat messages
 * Requirements: 1.2, 5.1, 5.2, 5.3, 5.4
 */
export function ChatDisplay({ 
  messages, 
  maxMessages = 100, 
  autoScroll = true,
  className = '',
  isLoading = false,
  isConnected = false
}: ChatDisplayProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest messages
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [messages, autoScroll]);

  // Limit messages to prevent performance issues
  const displayMessages = messages.slice(-maxMessages);

  const chatDisplayClasses = [
    'chat-display',
    className,
    isLoading && 'chat-display--loading'
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={chatDisplayClasses} 
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label="Twitch chat messages"
    >
      <div className="chat-display__header">
        <h2 className="chat-display__title">Chat Messages</h2>
        <span 
          className="chat-display__count"
          aria-label={`${displayMessages.length} ${displayMessages.length === 1 ? 'message' : 'messages'} displayed`}
        >
          {displayMessages.length} {displayMessages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>
      
      <div className="chat-display__messages" aria-live="polite">
        {isLoading ? (
          <div className="chat-display__empty">
            <div className="chat-display__empty-text">Connecting to chat...</div>
            <div className="chat-display__empty-subtext">Please wait while we establish connection</div>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="chat-display__empty">
            <div className="chat-display__empty-text">
              {isConnected ? 'No messages yet' : 'Not connected to chat'}
            </div>
            <div className="chat-display__empty-subtext">
              {isConnected 
                ? 'Waiting for chat activity...' 
                : 'Check your connection status above'
              }
            </div>
          </div>
        ) : (
          displayMessages.map((message, index) => (
            <div 
              key={message.id} 
              className={`chat-message ${message.isBot ? 'chat-message--bot' : ''} ${index === displayMessages.length - 1 ? 'chat-message--new' : ''}`}
              role="article"
              aria-label={`Message from ${message.username}`}
            >
              <div className="chat-message__header">
                <time 
                  className="chat-message__timestamp"
                  dateTime={message.timestamp.toISOString()}
                  title={message.timestamp.toLocaleString()}
                >
                  {formatTimestamp(message.timestamp)}
                </time>
                {renderBadges(message.badges)}
                <span 
                  className={`chat-message__username ${message.isBot ? 'chat-message__username--bot' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`User: ${message.username}${message.isBot ? ' (bot)' : ''}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      // Could implement user profile or mention functionality
                      console.log('User clicked:', message.username);
                    }
                  }}
                >
                  {message.username}
                </span>
              </div>
              <div 
                className="chat-message__content"
                aria-label="Message content"
              >
                {message.message}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>
      
      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {displayMessages.length > 0 && `${displayMessages.length} messages in chat`}
      </div>
    </div>
  );
}

export default ChatDisplay;