import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatDisplay } from '../ChatDisplay';
import type { ChatMessage } from '../../types';

// Mock CSS import
vi.mock('../ChatDisplay.css', () => ({}));

// Mock scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ChatDisplay', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      username: 'testuser1',
      message: 'Hello world!',
      timestamp: new Date('2024-01-01T14:00:00Z'),
      isBot: false,
      badges: ['subscriber']
    },
    {
      id: '2',
      username: 'botuser',
      message: 'This is a bot message',
      timestamp: new Date('2024-01-01T14:01:00Z'),
      isBot: true,
      badges: ['moderator', 'bot']
    },
    {
      id: '3',
      username: 'vipuser',
      message: 'VIP message here',
      timestamp: new Date('2024-01-01T14:02:00Z'),
      isBot: false,
      badges: ['vip', 'premium']
    }
  ];

  it('renders chat display with messages', () => {
    render(<ChatDisplay messages={mockMessages} />);
    
    expect(screen.getByText('Chat Messages')).toBeInTheDocument();
    expect(screen.getByText('3 messages')).toBeInTheDocument();
    expect(screen.getByText('Hello world!')).toBeInTheDocument();
    expect(screen.getByText('This is a bot message')).toBeInTheDocument();
    expect(screen.getByText('VIP message here')).toBeInTheDocument();
  });

  it('displays usernames correctly', () => {
    render(<ChatDisplay messages={mockMessages} />);
    
    expect(screen.getByText('testuser1')).toBeInTheDocument();
    expect(screen.getByText('botuser')).toBeInTheDocument();
    expect(screen.getByText('vipuser')).toBeInTheDocument();
  });

  it('displays timestamps in correct format', () => {
    render(<ChatDisplay messages={mockMessages} />);
    
    // Check that timestamps are displayed (format: HH:MM:SS)
    expect(screen.getByText('16:00:00')).toBeInTheDocument();
    expect(screen.getByText('16:01:00')).toBeInTheDocument();
    expect(screen.getByText('16:02:00')).toBeInTheDocument();
  });

  it('displays badges correctly', () => {
    render(<ChatDisplay messages={mockMessages} />);
    
    expect(screen.getAllByText('subscriber')).toHaveLength(1);
    expect(screen.getByText('moderator')).toBeInTheDocument();
    expect(screen.getByText('bot')).toBeInTheDocument();
    expect(screen.getByText('vip')).toBeInTheDocument();
    expect(screen.getByText('premium')).toBeInTheDocument();
  });

  it('applies bot styling to bot messages', () => {
    render(<ChatDisplay messages={mockMessages} />);
    
    const botMessage = screen.getByText('This is a bot message').closest('.chat-message');
    expect(botMessage).toHaveClass('chat-message--bot');
  });

  it('shows empty state when no messages', () => {
    render(<ChatDisplay messages={[]} isConnected={true} />);
    
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByText('Waiting for chat activity...')).toBeInTheDocument();
    expect(screen.getByText('0 messages')).toBeInTheDocument();
  });

  it('shows disconnected state when not connected', () => {
    render(<ChatDisplay messages={[]} isConnected={false} />);
    
    expect(screen.getByText('Not connected to chat')).toBeInTheDocument();
    expect(screen.getByText('Check your connection status above')).toBeInTheDocument();
  });

  it('shows loading state when loading', () => {
    render(<ChatDisplay messages={[]} isLoading={true} />);
    
    expect(screen.getByText('Connecting to chat...')).toBeInTheDocument();
    expect(screen.getByText('Please wait while we establish connection')).toBeInTheDocument();
  });

  it('limits messages to maxMessages prop', () => {
    const manyMessages: ChatMessage[] = Array.from({ length: 150 }, (_, i) => ({
      id: `msg-${i}`,
      username: `user${i}`,
      message: `Message ${i}`,
      timestamp: new Date(),
      isBot: false,
      badges: []
    }));

    render(<ChatDisplay messages={manyMessages} maxMessages={100} />);
    
    // Should show only the last 100 messages
    expect(screen.getByText('100 messages')).toBeInTheDocument();
    expect(screen.getByText('Message 149')).toBeInTheDocument(); // Last message
    expect(screen.getByText('Message 50')).toBeInTheDocument(); // 100th from end
    expect(screen.queryByText('Message 49')).not.toBeInTheDocument(); // Should not be visible
  });

  it('handles singular message count correctly', () => {
    const singleMessage: ChatMessage[] = [mockMessages[0]];
    render(<ChatDisplay messages={singleMessage} />);
    
    expect(screen.getByText('1 message')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ChatDisplay messages={mockMessages} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('chat-display', 'custom-class');
  });

  it('handles messages with no badges', () => {
    const messageWithoutBadges: ChatMessage[] = [{
      id: '1',
      username: 'plainuser',
      message: 'No badges here',
      timestamp: new Date(),
      isBot: false,
      badges: []
    }];

    render(<ChatDisplay messages={messageWithoutBadges} />);
    
    expect(screen.getByText('plainuser')).toBeInTheDocument();
    expect(screen.getByText('No badges here')).toBeInTheDocument();
    // Should not render badges container when no badges
    expect(screen.queryByText('subscriber')).not.toBeInTheDocument();
  });

  it('handles long messages with word wrapping', () => {
    const longMessage: ChatMessage[] = [{
      id: '1',
      username: 'longuser',
      message: 'This is a very long message that should wrap properly and not break the layout even when it contains many words and characters',
      timestamp: new Date(),
      isBot: false,
      badges: []
    }];

    render(<ChatDisplay messages={longMessage} />);
    
    expect(screen.getByText(/This is a very long message/)).toBeInTheDocument();
  });
});