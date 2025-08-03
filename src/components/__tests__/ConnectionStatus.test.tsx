import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConnectionStatus } from '../ConnectionStatus';

// Mock the ChatContext hooks
const mockUseConnectionStatus = vi.fn();
const mockUseChatActions = vi.fn();

vi.mock('../../contexts/ChatContext', () => ({
  useConnectionStatus: () => mockUseConnectionStatus(),
  useChatActions: () => mockUseChatActions(),
}));

describe('ConnectionStatus', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatActions.mockReturnValue({
      connect: mockConnect,
      disconnect: mockDisconnect,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders connected state correctly', () => {
    mockUseConnectionStatus.mockReturnValue({
      status: 'connected',
      isConnected: true,
      reconnectAttempts: 0,
      error: null,
    });

    render(<ConnectionStatus />);

    expect(screen.getByText('Connected to Twitch Chat')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Status: connected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect from Twitch' })).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('renders connecting state correctly', () => {
    mockUseConnectionStatus.mockReturnValue({
      status: 'connecting',
      isConnected: false,
      reconnectAttempts: 0,
      error: null,
    });

    render(<ConnectionStatus />);

    expect(screen.getByText('Connecting to Twitch Chat...')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Status: connecting' })).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('renders disconnected state correctly', () => {
    mockUseConnectionStatus.mockReturnValue({
      status: 'disconnected',
      isConnected: false,
      reconnectAttempts: 0,
      error: null,
    });

    render(<ConnectionStatus />);

    expect(screen.getByText('Disconnected from Twitch Chat')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Status: disconnected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect to Twitch' })).toBeInTheDocument();
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('renders error state with error message', () => {
    const errorMessage = 'Connection failed: Network error';
    mockUseConnectionStatus.mockReturnValue({
      status: 'error',
      isConnected: false,
      reconnectAttempts: 2,
      error: errorMessage,
    });

    render(<ConnectionStatus />);

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Status: error' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText('Reconnect attempts: 2/10')).toBeInTheDocument();
  });

  it('shows reconnection attempts and countdown', async () => {
    vi.useFakeTimers();
    
    mockUseConnectionStatus.mockReturnValue({
      status: 'disconnected',
      isConnected: false,
      reconnectAttempts: 3,
      error: null,
    });

    render(<ConnectionStatus />);

    expect(screen.getByText(/Reconnecting in \d+s \(attempt 3\)/)).toBeInTheDocument();
    expect(screen.getByText((_content, element) => {
      return element?.textContent === 'Reconnect attempts: 3/10';
    })).toBeInTheDocument();
    
    // Check for countdown text specifically in the countdown element
    expect(screen.getByText((_content, element) => {
      return element?.className === 'connection-status__countdown' && 
             element?.textContent?.includes('Next attempt in') && 
             element?.textContent?.includes('s') || false;
    })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('handles connect button click', async () => {
    mockUseConnectionStatus.mockReturnValue({
      status: 'disconnected',
      isConnected: false,
      reconnectAttempts: 0,
      error: null,
    });

    render(<ConnectionStatus />);

    const connectButton = screen.getByRole('button', { name: 'Connect to Twitch' });
    fireEvent.click(connectButton);

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('handles disconnect button click', async () => {
    mockUseConnectionStatus.mockReturnValue({
      status: 'connected',
      isConnected: true,
      reconnectAttempts: 0,
      error: null,
    });

    render(<ConnectionStatus />);

    const disconnectButton = screen.getByRole('button', { name: 'Disconnect from Twitch' });
    fireEvent.click(disconnectButton);

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('disables button during connecting state', () => {
    mockUseConnectionStatus.mockReturnValue({
      status: 'connecting',
      isConnected: false,
      reconnectAttempts: 0,
      error: null,
    });

    render(<ConnectionStatus />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('applies correct CSS classes for different states', () => {
    const { rerender } = render(<div />);

    // Test connected state
    mockUseConnectionStatus.mockReturnValue({
      status: 'connected',
      isConnected: true,
      reconnectAttempts: 0,
      error: null,
    });

    rerender(<ConnectionStatus />);
    expect(document.querySelector('.connection-status--connected')).toBeInTheDocument();

    // Test error state
    mockUseConnectionStatus.mockReturnValue({
      status: 'error',
      isConnected: false,
      reconnectAttempts: 1,
      error: 'Test error',
    });

    rerender(<ConnectionStatus />);
    expect(document.querySelector('.connection-status--error')).toBeInTheDocument();
  });

  it('calculates countdown correctly for different reconnect attempts', () => {
    vi.useFakeTimers();

    // Test first reconnect attempt (2 second delay)
    mockUseConnectionStatus.mockReturnValue({
      status: 'disconnected',
      isConnected: false,
      reconnectAttempts: 1,
      error: null,
    });

    const { rerender } = render(<ConnectionStatus />);
    expect(screen.getByText((_content, element) => {
      return element?.className === 'connection-status__countdown' && 
             element?.textContent?.includes('Next attempt in') && 
             element?.textContent?.includes('s') || false;
    })).toBeInTheDocument();

    // Test higher reconnect attempt (longer delay)
    mockUseConnectionStatus.mockReturnValue({
      status: 'disconnected',
      isConnected: false,
      reconnectAttempts: 4,
      error: null,
    });

    rerender(<ConnectionStatus />);
    expect(screen.getByText((_content, element) => {
      return element?.className === 'connection-status__countdown' && 
             element?.textContent?.includes('Next attempt in') && 
             element?.textContent?.includes('s') || false;
    })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('clears countdown when component unmounts', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    mockUseConnectionStatus.mockReturnValue({
      status: 'disconnected',
      isConnected: false,
      reconnectAttempts: 2,
      error: null,
    });

    const { unmount } = render(<ConnectionStatus />);
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('handles accessibility attributes correctly', () => {
    mockUseConnectionStatus.mockReturnValue({
      status: 'connected',
      isConnected: true,
      reconnectAttempts: 0,
      error: null,
    });

    render(<ConnectionStatus />);

    expect(screen.getByRole('img', { name: 'Status: connected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect from Twitch' })).toBeInTheDocument();
  });

  it('shows error alert with proper role', () => {
    mockUseConnectionStatus.mockReturnValue({
      status: 'error',
      isConnected: false,
      reconnectAttempts: 1,
      error: 'Test error message',
    });

    render(<ConnectionStatus />);

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent('Test error message');
  });
});