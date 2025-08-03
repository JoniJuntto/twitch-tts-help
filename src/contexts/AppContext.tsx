import { useEffect } from "react";
import type { ReactNode } from "react";
import { ChatProvider, useChatContext } from "./ChatContext";
import { TTSProvider, useTTSContext } from "./TTSContext";
import type { TTSSettings } from "../types";

/**
 * App context provider props
 */
interface AppProviderProps {
  children: ReactNode;
  channel?: string;
  maxMessages?: number;
  initialTTSSettings?: Partial<TTSSettings>;
}

/**
 * Internal component that handles integration between chat and TTS contexts
 * Requirements: 1.2, 2.1, 4.1
 */
function ChatTTSIntegration() {
  const { state: chatState } = useChatContext();
  const { actions: ttsActions } = useTTSContext();

  // Auto-add new chat messages to TTS queue
  useEffect(() => {
    // Get the latest message
    const latestMessage = chatState.messages[chatState.messages.length - 1];

    if (latestMessage && chatState.isConnected) {
      // Add to TTS queue (filtering is handled inside the TTS context)
      ttsActions.addToQueue(latestMessage);
    }
  }, [chatState.messages, chatState.isConnected]); // Remove ttsActions from dependencies

  return null; // This component only handles side effects
}

/**
 * Combined app context provider that orchestrates chat and TTS functionality
 * Requirements: 1.2, 3.1, 4.1, 5.1
 */
export function AppProvider({
  children,
  channel = "huikkakoodaa",
  maxMessages = 100,
  initialTTSSettings = {},
}: AppProviderProps) {
  return (
    <ChatProvider channel={channel} maxMessages={maxMessages}>
      <TTSProvider initialSettings={initialTTSSettings}>
        <ChatTTSIntegration />
        {children}
      </TTSProvider>
    </ChatProvider>
  );
}

/**
 * Custom hook to get combined app state and actions
 * Requirements: 1.2, 3.1, 4.1, 5.1
 */
export function useAppContext() {
  const chatContext = useChatContext();
  const ttsContext = useTTSContext();

  return {
    chat: chatContext,
    tts: ttsContext,
  };
}

/**
 * Custom hook for common app operations
 * Requirements: 1.2, 3.1, 4.1
 */
export function useAppActions() {
  const { actions: chatActions } = useChatContext();
  const { actions: ttsActions } = useTTSContext();

  return {
    // Chat actions
    connectToChat: chatActions.connect,
    disconnectFromChat: chatActions.disconnect,
    clearChatMessages: chatActions.clearMessages,

    // TTS actions
    updateTTSSettings: ttsActions.updateSettings,
    clearTTSQueue: ttsActions.clearQueue,
    skipCurrentTTS: ttsActions.skipCurrent,
    testTTSSpeak: ttsActions.testSpeak,

    // Combined actions
    enableTTS: () => ttsActions.updateSettings({ enabled: true }),
    disableTTS: () => {
      ttsActions.updateSettings({ enabled: false });
      ttsActions.clearQueue();
    },
  };
}

/**
 * Custom hook to get app status
 * Requirements: 1.2, 3.1, 4.1
 */
export function useAppStatus() {
  const { state: chatState } = useChatContext();
  const { state: ttsState } = useTTSContext();

  return {
    // Chat status
    isConnectedToChat: chatState.isConnected,
    chatConnectionStatus: chatState.connectionStatus,
    chatError: chatState.error,
    messageCount: chatState.messages.length,

    // TTS status
    isTTSEnabled: ttsState.settings.enabled,
    isTTSSupported: ttsState.isSupported,
    ttsError: ttsState.error,
    queueCount: ttsState.queue.length,
    isProcessingTTS: ttsState.isProcessing,
    currentTTSItem: ttsState.currentItem,

    // Combined status
    isFullyOperational:
      chatState.isConnected &&
      ttsState.isSupported &&
      ttsState.settings.enabled,
    hasErrors: !!(chatState.error || ttsState.error),
    errors: [chatState.error, ttsState.error].filter(Boolean),
  };
}
