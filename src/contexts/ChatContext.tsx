import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { ChatMessage, ConnectionStatus } from '../types';
import { TwitchChatService } from '../services/TwitchChatService';

/**
 * Chat context state interface
 * Requirements: 1.2, 5.1
 */
interface ChatState {
  messages: ChatMessage[];
  connectionStatus: ConnectionStatus;
  reconnectAttempts: number;
  error: string | null;
  isConnected: boolean;
}

/**
 * Chat context actions
 */
type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionStatus }
  | { type: 'SET_RECONNECT_ATTEMPTS'; payload: number }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'LIMIT_MESSAGES'; payload: number };

/**
 * Chat context interface
 */
interface ChatContextType {
  state: ChatState;
  actions: {
    connect: () => Promise<void>;
    disconnect: () => void;
    clearMessages: () => void;
    limitMessages: (maxMessages: number) => void;
  };
  service: TwitchChatService | null;
}

/**
 * Initial chat state
 */
const initialState: ChatState = {
  messages: [],
  connectionStatus: 'disconnected',
  reconnectAttempts: 0,
  error: null,
  isConnected: false,
};

/**
 * Chat reducer for state management
 */
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        connectionStatus: action.payload,
        isConnected: action.payload === 'connected',
        error: action.payload === 'connected' ? null : state.error,
      };

    case 'SET_RECONNECT_ATTEMPTS':
      return {
        ...state,
        reconnectAttempts: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
      };

    case 'LIMIT_MESSAGES':
      return {
        ...state,
        messages: state.messages.slice(-action.payload),
      };

    default:
      return state;
  }
}

/**
 * Chat context
 */
const ChatContext = createContext<ChatContextType | null>(null);

/**
 * Chat context provider props
 */
interface ChatProviderProps {
  children: ReactNode;
  channel?: string;
  maxMessages?: number;
}

/**
 * Chat context provider component
 * Requirements: 1.2, 5.1
 */
export function ChatProvider({ 
  children, 
  channel = 'huikkakoodaa',
  maxMessages = 100 
}: ChatProviderProps) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [service, setService] = React.useState<TwitchChatService | null>(null);

  // Initialize service
  useEffect(() => {
    const chatService = new TwitchChatService(channel);
    setService(chatService);

    // Set up event listeners
    chatService.on('chat:message', (message) => {
      dispatch({ type: 'ADD_MESSAGE', payload: message });
      
      // Auto-limit messages to prevent memory issues
      // Use setTimeout to allow the message to be added first
      setTimeout(() => {
        dispatch({ type: 'LIMIT_MESSAGES', payload: maxMessages });
      }, 0);
    });

    chatService.on('chat:connected', () => {
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });
      dispatch({ type: 'SET_RECONNECT_ATTEMPTS', payload: 0 });
    });

    chatService.on('chat:disconnected', () => {
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
    });

    chatService.on('chat:error', (error) => {
      dispatch({ type: 'SET_ERROR', payload: error });
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'error' });
    });

    // Cleanup on unmount
    return () => {
      chatService.destroy();
    };
  }, [channel, maxMessages]);

  // Update reconnect attempts periodically when service is available
  useEffect(() => {
    if (!service) return;

    const interval = setInterval(() => {
      const attempts = service.getReconnectAttempts();
      if (attempts !== state.reconnectAttempts) {
        dispatch({ type: 'SET_RECONNECT_ATTEMPTS', payload: attempts });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [service, state.reconnectAttempts]);

  // Actions
  const connect = useCallback(async () => {
    if (service) {
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' });
      dispatch({ type: 'SET_ERROR', payload: null });
      await service.connect();
    }
  }, [service]);

  const disconnect = useCallback(() => {
    if (service) {
      service.disconnect();
    }
  }, [service]);

  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  const limitMessages = useCallback((maxMessages: number) => {
    dispatch({ type: 'LIMIT_MESSAGES', payload: maxMessages });
  }, []);

  const contextValue: ChatContextType = {
    state,
    actions: {
      connect,
      disconnect,
      clearMessages,
      limitMessages,
    },
    service,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

/**
 * Custom hook to use chat context
 * Requirements: 1.2, 5.1
 */
export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext);
  
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  
  return context;
}

/**
 * Custom hook to get chat messages
 * Requirements: 1.2
 */
export function useChatMessages(): ChatMessage[] {
  const { state } = useChatContext();
  return state.messages;
}

/**
 * Custom hook to get connection status
 * Requirements: 1.2
 */
export function useConnectionStatus(): {
  status: ConnectionStatus;
  isConnected: boolean;
  reconnectAttempts: number;
  error: string | null;
} {
  const { state } = useChatContext();
  return {
    status: state.connectionStatus,
    isConnected: state.isConnected,
    reconnectAttempts: state.reconnectAttempts,
    error: state.error,
  };
}

/**
 * Custom hook to get chat actions
 * Requirements: 1.2
 */
export function useChatActions(): ChatContextType['actions'] {
  const { actions } = useChatContext();
  return actions;
}