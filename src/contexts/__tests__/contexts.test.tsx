import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppProvider, useAppContext, useAppActions, useAppStatus } from '../AppContext';
import { ChatProvider, useChatContext } from '../ChatContext';
import { TTSProvider, useTTSContext } from '../TTSContext';
import type { ChatMessage } from '../../types';

// Mock WebSocket and SpeechSynthesis APIs
global.WebSocket = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1,
}));

global.speechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn(() => []),
  speaking: false,
  pending: false,
  paused: false,
  onvoiceschanged: null,
} as any;

// Test component to access context values
function TestComponent() {
  const appContext = useAppContext();
  const appActions = useAppActions();
  const appStatus = useAppStatus();

  return (
    <div>
      <div data-testid="chat-connected">{appStatus.isConnectedToChat.toString()}</div>
      <div data-testid="tts-enabled">{appStatus.isTTSEnabled.toString()}</div>
      <div data-testid="tts-supported">{appStatus.isTTSSupported.toString()}</div>
      <div data-testid="message-count">{appStatus.messageCount}</div>
      <div data-testid="queue-count">{appStatus.queueCount}</div>
      <button 
        data-testid="enable-tts" 
        onClick={() => appActions.enableTTS()}
      >
        Enable TTS
      </button>
      <button 
        data-testid="disable-tts" 
        onClick={() => appActions.disableTTS()}
      >
        Disable TTS
      </button>
    </div>
  );
}

// Test component for chat context only
function ChatTestComponent() {
  const { state, actions } = useChatContext();

  return (
    <div>
      <div data-testid="chat-status">{state.connectionStatus}</div>
      <div data-testid="chat-messages">{state.messages.length}</div>
      <button 
        data-testid="connect-chat" 
        onClick={() => actions.connect()}
      >
        Connect
      </button>
      <button 
        data-testid="clear-messages" 
        onClick={() => actions.clearMessages()}
      >
        Clear Messages
      </button>
    </div>
  );
}

// Test component for TTS context only
function TTSTestComponent() {
  const { state, actions } = useTTSContext();

  return (
    <div>
      <div data-testid="tts-enabled">{state.settings.enabled.toString()}</div>
      <div data-testid="tts-queue-length">{state.queue.length}</div>
      <div data-testid="tts-processing">{state.isProcessing.toString()}</div>
      <button 
        data-testid="update-settings" 
        onClick={() => actions.updateSettings({ enabled: true, volume: 0.5 })}
      >
        Update Settings
      </button>
      <button 
        data-testid="clear-queue" 
        onClick={() => actions.clearQueue()}
      >
        Clear Queue
      </button>
    </div>
  );
}

describe('React Contexts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AppProvider', () => {
    it('should provide combined context values', async () => {
      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      // Check initial values
      expect(screen.getByTestId('chat-connected')).toHaveTextContent('false');
      expect(screen.getByTestId('tts-enabled')).toHaveTextContent('false');
      expect(screen.getByTestId('message-count')).toHaveTextContent('0');
      expect(screen.getByTestId('queue-count')).toHaveTextContent('0');
    });

    it('should handle TTS enable/disable actions', async () => {
      render(
        <AppProvider>
          <TestComponent />
        </AppProvider>
      );

      const enableButton = screen.getByTestId('enable-tts');
      const disableButton = screen.getByTestId('disable-tts');

      // Enable TTS
      act(() => {
        enableButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('tts-enabled')).toHaveTextContent('true');
      });

      // Disable TTS
      act(() => {
        disableButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('tts-enabled')).toHaveTextContent('false');
      });
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useChatContext must be used within a ChatProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('ChatProvider', () => {
    it('should provide chat context values', () => {
      render(
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      expect(screen.getByTestId('chat-status')).toHaveTextContent('disconnected');
      expect(screen.getByTestId('chat-messages')).toHaveTextContent('0');
    });

    it('should handle chat actions', async () => {
      render(
        <ChatProvider>
          <ChatTestComponent />
        </ChatProvider>
      );

      const connectButton = screen.getByTestId('connect-chat');
      const clearButton = screen.getByTestId('clear-messages');

      // Test connect action (status should change to connecting)
      act(() => {
        connectButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-status')).toHaveTextContent('connecting');
      });

      // Test clear messages action
      act(() => {
        clearButton.click();
      });

      expect(screen.getByTestId('chat-messages')).toHaveTextContent('0');
    });

    it('should accept custom channel and maxMessages props', () => {
      render(
        <ChatProvider channel="testchannel" maxMessages={50}>
          <ChatTestComponent />
        </ChatProvider>
      );

      // Should render without errors with custom props
      expect(screen.getByTestId('chat-status')).toHaveTextContent('disconnected');
    });
  });

  describe('TTSProvider', () => {
    it('should provide TTS context values', () => {
      render(
        <TTSProvider>
          <TTSTestComponent />
        </TTSProvider>
      );

      expect(screen.getByTestId('tts-enabled')).toHaveTextContent('false');
      expect(screen.getByTestId('tts-queue-length')).toHaveTextContent('0');
      expect(screen.getByTestId('tts-processing')).toHaveTextContent('false');
    });

    it('should handle TTS actions', async () => {
      render(
        <TTSProvider>
          <TTSTestComponent />
        </TTSProvider>
      );

      const updateButton = screen.getByTestId('update-settings');
      const clearButton = screen.getByTestId('clear-queue');

      // Test update settings action
      act(() => {
        updateButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('tts-enabled')).toHaveTextContent('true');
      });

      // Test clear queue action
      act(() => {
        clearButton.click();
      });

      expect(screen.getByTestId('tts-queue-length')).toHaveTextContent('0');
    });

    it('should accept initial settings', () => {
      const initialSettings = { enabled: true, volume: 0.7 };

      render(
        <TTSProvider initialSettings={initialSettings}>
          <TTSTestComponent />
        </TTSProvider>
      );

      expect(screen.getByTestId('tts-enabled')).toHaveTextContent('true');
    });
  });

  describe('Context Integration', () => {
    it('should integrate chat and TTS contexts properly', async () => {
      render(
        <AppProvider initialTTSSettings={{ enabled: true }}>
          <TestComponent />
        </AppProvider>
      );

      // Should show TTS as enabled from initial settings
      await waitFor(() => {
        expect(screen.getByTestId('tts-enabled')).toHaveTextContent('true');
      });

      // Should show initial state values
      expect(screen.getByTestId('chat-connected')).toHaveTextContent('false');
      expect(screen.getByTestId('message-count')).toHaveTextContent('0');
      expect(screen.getByTestId('queue-count')).toHaveTextContent('0');
    });
  });
});

describe('Custom Hooks', () => {
  describe('useAppActions', () => {
    it('should provide all expected actions', () => {
      let actions: any;

      function TestHook() {
        actions = useAppActions();
        return null;
      }

      render(
        <AppProvider>
          <TestHook />
        </AppProvider>
      );

      expect(actions).toHaveProperty('connectToChat');
      expect(actions).toHaveProperty('disconnectFromChat');
      expect(actions).toHaveProperty('clearChatMessages');
      expect(actions).toHaveProperty('updateTTSSettings');
      expect(actions).toHaveProperty('clearTTSQueue');
      expect(actions).toHaveProperty('skipCurrentTTS');
      expect(actions).toHaveProperty('testTTSSpeak');
      expect(actions).toHaveProperty('enableTTS');
      expect(actions).toHaveProperty('disableTTS');
    });
  });

  describe('useAppStatus', () => {
    it('should provide all expected status values', () => {
      let status: any;

      function TestHook() {
        status = useAppStatus();
        return null;
      }

      render(
        <AppProvider>
          <TestHook />
        </AppProvider>
      );

      expect(status).toHaveProperty('isConnectedToChat');
      expect(status).toHaveProperty('chatConnectionStatus');
      expect(status).toHaveProperty('chatError');
      expect(status).toHaveProperty('messageCount');
      expect(status).toHaveProperty('isTTSEnabled');
      expect(status).toHaveProperty('isTTSSupported');
      expect(status).toHaveProperty('ttsError');
      expect(status).toHaveProperty('queueCount');
      expect(status).toHaveProperty('isProcessingTTS');
      expect(status).toHaveProperty('currentTTSItem');
      expect(status).toHaveProperty('isFullyOperational');
      expect(status).toHaveProperty('hasErrors');
      expect(status).toHaveProperty('errors');
    });
  });
});