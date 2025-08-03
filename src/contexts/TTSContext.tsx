import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { TTSSettings, TTSQueueItem, ChatMessage } from '../types';
import { TTSService } from '../services/TTSService';
import { QueueManager } from '../services/QueueManager';

/**
 * TTS context state interface
 * Requirements: 3.1, 4.1
 */
interface TTSState {
  settings: TTSSettings;
  queue: TTSQueueItem[];
  currentItem: TTSQueueItem | null;
  isProcessing: boolean;
  availableVoices: SpeechSynthesisVoice[];
  isSupported: boolean;
  error: string | null;
}

/**
 * TTS context actions
 */
type TTSAction =
  | { type: 'UPDATE_SETTINGS'; payload: Partial<TTSSettings> }
  | { type: 'SET_QUEUE'; payload: TTSQueueItem[] }
  | { type: 'SET_CURRENT_ITEM'; payload: TTSQueueItem | null }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_AVAILABLE_VOICES'; payload: SpeechSynthesisVoice[] }
  | { type: 'SET_SUPPORTED'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_QUEUE' };

/**
 * TTS context interface
 */
interface TTSContextType {
  state: TTSState;
  actions: {
    updateSettings: (settings: Partial<TTSSettings>) => void;
    addToQueue: (message: ChatMessage) => TTSQueueItem | null;
    removeFromQueue: (itemId: string) => boolean;
    clearQueue: () => void;
    skipCurrent: () => boolean;
    testSpeak: (text?: string) => Promise<void>;
  };
  services: {
    ttsService: TTSService | null;
    queueManager: QueueManager | null;
  };
}

/**
 * Default TTS settings
 * Requirements: 3.1
 */
const defaultSettings: TTSSettings = {
  enabled: false,
  volume: 0.8,
  rate: 1.0,
  pitch: 1.0,
  voice: null,
  filterBots: true,
  minMessageLength: 3,
  blockedUsers: [],
  skipEmoteOnly: true,
};

/**
 * Initial TTS state
 */
const initialState: TTSState = {
  settings: defaultSettings,
  queue: [],
  currentItem: null,
  isProcessing: false,
  availableVoices: [],
  isSupported: false,
  error: null,
};

/**
 * TTS reducer for state management
 */
function ttsReducer(state: TTSState, action: TTSAction): TTSState {
  switch (action.type) {
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };

    case 'SET_QUEUE':
      return {
        ...state,
        queue: action.payload,
      };

    case 'SET_CURRENT_ITEM':
      return {
        ...state,
        currentItem: action.payload,
      };

    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.payload,
      };

    case 'SET_AVAILABLE_VOICES':
      return {
        ...state,
        availableVoices: action.payload,
      };

    case 'SET_SUPPORTED':
      return {
        ...state,
        isSupported: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'CLEAR_QUEUE':
      return {
        ...state,
        queue: [],
        currentItem: null,
        isProcessing: false,
      };

    default:
      return state;
  }
}

/**
 * TTS context
 */
const TTSContext = createContext<TTSContextType | null>(null);

/**
 * TTS context provider props
 */
interface TTSProviderProps {
  children: ReactNode;
  initialSettings?: Partial<TTSSettings>;
}

/**
 * TTS context provider component
 * Requirements: 3.1, 4.1, 5.1
 */
export function TTSProvider({ 
  children, 
  initialSettings = {} 
}: TTSProviderProps) {
  const [state, dispatch] = useReducer(ttsReducer, {
    ...initialState,
    settings: { ...defaultSettings, ...initialSettings },
  });
  
  const [ttsService, setTTSService] = React.useState<TTSService | null>(null);
  const [queueManager, setQueueManager] = React.useState<QueueManager | null>(null);

  // Initialize services
  useEffect(() => {
    let isMounted = true; // Track if component is still mounted
    
    const initializeServices = async () => {
      try {
        console.log('Initializing TTS services...');
        
        // Check basic TTS support first
        if (!('speechSynthesis' in window)) {
          if (isMounted) {
            dispatch({ type: 'SET_ERROR', payload: 'Text-to-speech is not supported in this browser' });
            dispatch({ type: 'SET_SUPPORTED', payload: false });
          }
          return;
        }

        // Create TTS service
        const tts = new TTSService(state.settings);
        
        if (!isMounted) return; // Component unmounted during initialization
        
        setTTSService(tts);

        // Wait for TTS to be fully initialized (voices loaded)
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for voices to load
        
        if (!isMounted) return; // Component unmounted during initialization

        // Check if TTS is supported after initialization
        const isSupported = tts.isSupported();
        dispatch({ type: 'SET_SUPPORTED', payload: isSupported });

        if (isSupported) {
          // Get available voices
          const voices = tts.getAvailableVoices();
          dispatch({ type: 'SET_AVAILABLE_VOICES', payload: voices });

          // Create queue manager
          const queue = new QueueManager(tts);
          
          if (!isMounted) return; // Component unmounted during initialization
          
          setQueueManager(queue);

          // Set up event listeners
          setupEventListeners(tts, queue);
          
          console.log('TTS services initialized successfully');
        } else {
          dispatch({ type: 'SET_ERROR', payload: 'Text-to-speech is not supported in this browser' });
        }
      } catch (error) {
        console.error('TTS initialization error:', error);
        if (isMounted) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to initialize TTS services';
          dispatch({ type: 'SET_ERROR', payload: errorMessage });
        }
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (ttsService) {
        ttsService.destroy();
      }
      if (queueManager) {
        queueManager.destroy();
      }
    };
  }, []); // Empty dependency array - only run once

  // Set up event listeners for services
  const setupEventListeners = useCallback((tts: TTSService, queue: QueueManager) => {
    // TTS service events
    tts.on('tts:started', (queueItem) => {
      dispatch({ type: 'SET_CURRENT_ITEM', payload: queueItem });
      dispatch({ type: 'SET_PROCESSING', payload: true });
    });

    tts.on('tts:ended', () => {
      dispatch({ type: 'SET_CURRENT_ITEM', payload: null });
      dispatch({ type: 'SET_PROCESSING', payload: false });
    });

    tts.on('tts:error', ({ error }) => {
      dispatch({ type: 'SET_ERROR', payload: error });
      dispatch({ type: 'SET_CURRENT_ITEM', payload: null });
      dispatch({ type: 'SET_PROCESSING', payload: false });
    });

    // Queue manager events
    queue.on('queue:updated', (queueItems) => {
      // Separate current item from pending queue
      const currentItem = queueItems.find(item => item.status === 'speaking') || null;
      const pendingQueue = queueItems.filter(item => item.status === 'pending');
      
      dispatch({ type: 'SET_QUEUE', payload: pendingQueue });
      dispatch({ type: 'SET_CURRENT_ITEM', payload: currentItem });
      dispatch({ type: 'SET_PROCESSING', payload: queue.isCurrentlyProcessing() });
    });

    queue.on('queue:cleared', () => {
      dispatch({ type: 'CLEAR_QUEUE' });
    });
  }, []);

  // Update TTS service settings when state changes
  useEffect(() => {
    if (ttsService) {
      ttsService.updateSettings(state.settings);
    }
  }, [ttsService, state.settings]);

  // Message filtering logic
  const shouldProcessMessage = useCallback((message: ChatMessage): boolean => {
    const { settings } = state;

    // Check if TTS is enabled
    if (!settings.enabled) {
      return false;
    }

    // Filter bots if enabled
    if (settings.filterBots && message.isBot) {
      return false;
    }

    // Check minimum message length
    if (message.message.length < settings.minMessageLength) {
      return false;
    }

    // Check blocked users
    if (settings.blockedUsers.includes(message.username.toLowerCase())) {
      return false;
    }

    // Check emote-only messages if filtering enabled
    if (settings.skipEmoteOnly) {
      // Simple check: if message is all uppercase and short, likely emote-only
      const isLikelyEmoteOnly = /^[A-Z\s]+$/.test(message.message) && message.message.length < 20;
      if (isLikelyEmoteOnly) {
        return false;
      }
    }

    return true;
  }, [state.settings]);

  // Actions
  const updateSettings = useCallback((newSettings: Partial<TTSSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const addToQueue = useCallback((message: ChatMessage): TTSQueueItem | null => {
    if (!queueManager || !shouldProcessMessage(message)) {
      return null;
    }

    try {
      const queueItem = queueManager.add(message);
      return queueItem;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add message to queue';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return null;
    }
  }, [queueManager, shouldProcessMessage]);

  const removeFromQueue = useCallback((itemId: string): boolean => {
    if (!queueManager) {
      return false;
    }

    try {
      return queueManager.remove(itemId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove item from queue';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    }
  }, [queueManager]);

  const clearQueue = useCallback(() => {
    if (!queueManager) {
      return;
    }

    try {
      queueManager.clear();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear queue';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [queueManager]);

  const skipCurrent = useCallback((): boolean => {
    if (!queueManager) {
      return false;
    }

    try {
      return queueManager.skip();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to skip current item';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    }
  }, [queueManager]);

  const testSpeak = useCallback(async (text?: string): Promise<void> => {
    if (!ttsService) {
      throw new Error('TTS service not available');
    }

    try {
      await ttsService.testSpeak(text);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to test speak';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    }
  }, [ttsService]);

  const contextValue: TTSContextType = {
    state,
    actions: {
      updateSettings,
      addToQueue,
      removeFromQueue,
      clearQueue,
      skipCurrent,
      testSpeak,
    },
    services: {
      ttsService,
      queueManager,
    },
  };

  return (
    <TTSContext.Provider value={contextValue}>
      {children}
    </TTSContext.Provider>
  );
}

/**
 * Custom hook to use TTS context
 * Requirements: 3.1, 4.1
 */
export function useTTSContext(): TTSContextType {
  const context = useContext(TTSContext);
  
  if (!context) {
    throw new Error('useTTSContext must be used within a TTSProvider');
  }
  
  return context;
}

/**
 * Custom hook to get TTS settings
 * Requirements: 3.1
 */
export function useTTSSettings(): {
  settings: TTSSettings;
  updateSettings: (settings: Partial<TTSSettings>) => void;
  availableVoices: SpeechSynthesisVoice[];
  isSupported: boolean;
} {
  const { state, actions } = useTTSContext();
  return {
    settings: state.settings,
    updateSettings: actions.updateSettings,
    availableVoices: state.availableVoices,
    isSupported: state.isSupported,
  };
}

/**
 * Custom hook to get TTS queue status
 * Requirements: 4.1
 */
export function useTTSQueue(): {
  queue: TTSQueueItem[];
  currentItem: TTSQueueItem | null;
  isProcessing: boolean;
  queueCount: number;
  isEmpty: boolean;
  actions: {
    addToQueue: (message: ChatMessage) => TTSQueueItem | null;
    removeFromQueue: (itemId: string) => boolean;
    clearQueue: () => void;
    skipCurrent: () => boolean;
  };
} {
  const { state, actions } = useTTSContext();
  return {
    queue: state.queue,
    currentItem: state.currentItem,
    isProcessing: state.isProcessing,
    queueCount: state.queue.length,
    isEmpty: state.queue.length === 0 && !state.currentItem,
    actions: {
      addToQueue: actions.addToQueue,
      removeFromQueue: actions.removeFromQueue,
      clearQueue: actions.clearQueue,
      skipCurrent: actions.skipCurrent,
    },
  };
}

/**
 * Custom hook to get TTS controls
 * Requirements: 3.1
 */
export function useTTSControls(): {
  settings: TTSSettings;
  updateSettings: (settings: Partial<TTSSettings>) => void;
  testSpeak: (text?: string) => Promise<void>;
  availableVoices: SpeechSynthesisVoice[];
  isSupported: boolean;
  error: string | null;
} {
  const { state, actions } = useTTSContext();
  return {
    settings: state.settings,
    updateSettings: actions.updateSettings,
    testSpeak: actions.testSpeak,
    availableVoices: state.availableVoices,
    isSupported: state.isSupported,
    error: state.error,
  };
}