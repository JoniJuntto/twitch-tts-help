import { useEffect, useCallback, useRef } from "react";
import {
  AppProvider,
  useAppContext,
  useAppActions,
  useAppStatus,
} from "./contexts/AppContext";
import { ChatDisplay } from "./components/ChatDisplay";
import { TTSControls } from "./components/TTSControls";
import { QueueStatus } from "./components/QueueStatus";
import { FilterControls } from "./components/FilterControls";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { TabContainer } from "./components/TabContainer";
import type { TabItem } from "./components/TabContainer";
import "./App.css";

/**
 * Inner App component that orchestrates all services and handles application lifecycle
 * Requirements: 1.1, 1.2, 2.1, 5.1
 */
function AppContent() {
  const { chat } = useAppContext();
  const actions = useAppActions();
  const status = useAppStatus();
  const hasInitialized = useRef(false);

  /**
   * Initialize services and connect to Twitch chat on app start
   * Requirements: 1.1, 1.2
   */
  const initializeApp = useCallback(async () => {
    if (hasInitialized.current) {
      return;
    }

    console.log("Initializing Twitch Chat TTS application...");

    try {
      // Connect to Twitch chat for "Huikkakoodaa" channel
      console.log("Connecting to Huikkakoodaa Twitch chat...");
      await actions.connectToChat();

      console.log("Application initialized successfully");
      hasInitialized.current = true;
    } catch (error) {
      console.error("Failed to initialize application:", error);
    }
  }, [actions]);

  /**
   * Handle application lifecycle - initialize on mount
   * Requirements: 1.1, 1.2, 5.1
   */
  useEffect(() => {
    initializeApp();

    // Cleanup function for application lifecycle
    return () => {
      console.log("Cleaning up application...");
      hasInitialized.current = false;

      // Disconnect from chat
      actions.disconnectFromChat();

      // Clear TTS queue and disable TTS
      actions.disableTTS();

      console.log("Application cleanup completed");
    };
  }, []); // Remove dependencies to prevent re-initialization

  /**
   * Auto-reconnect logic for chat connection
   * Requirements: 1.3, 1.4
   */
  useEffect(() => {
    // Only attempt reconnection if we're initialized and not in an error state
    if (
      hasInitialized.current &&
      status.chatConnectionStatus === "disconnected" &&
      !status.chatError
    ) {
      // Limit reconnection attempts

      console.log("Chat connection lost, attempting to reconnect...");

      const reconnectTimer = setTimeout(() => {
        if (hasInitialized.current) {
          // Double-check we're still initialized
          actions.connectToChat().catch((error) => {
            console.error("Reconnection attempt failed:", error);
          });
        }
      }, 2000);

      return () => clearTimeout(reconnectTimer);
    }
  }, [status.chatConnectionStatus, status.chatError, actions]);

  /**
   * Log application status changes for debugging
   * Requirements: 1.2, 2.1, 4.1
   */
  useEffect(() => {
    console.log("App Status Update:", {
      chatConnected: status.isConnectedToChat,
      chatStatus: status.chatConnectionStatus,
      ttsEnabled: status.isTTSEnabled,
      ttsSupported: status.isTTSSupported,
      queueCount: status.queueCount,
      isProcessing: status.isProcessingTTS,
      hasErrors: status.hasErrors,
      errors: status.errors,
    });
  }, [status]);

  /**
   * Handle critical errors by showing user-friendly messages
   * Requirements: 1.4, 2.1
   */
  const handleCriticalError = useCallback((error: string) => {
    console.error("Critical application error:", error);

    // You could implement a toast notification system here
    // For now, we'll just log the error
  }, []);

  // Monitor for critical errors
  useEffect(() => {
    if (status.hasErrors) {
      status.errors.forEach((error) => {
        if (error) {
          handleCriticalError(error);
        }
      });
    }
  }, [status.hasErrors, status.errors, handleCriticalError]);

  // Create tabs configuration
  const tabs: TabItem[] = [
    {
      id: "chat",
      label: "Chat",
      icon: "💬",
      content: (
        <ChatDisplay
          messages={chat.state.messages}
          maxMessages={100}
          className="app-chat-display"
          isLoading={
            !hasInitialized.current &&
            status.chatConnectionStatus === "connecting"
          }
          isConnected={status.isConnectedToChat}
        />
      ),
      badge:
        chat.state.messages.length > 0 ? chat.state.messages.length : undefined,
    },
    {
      id: "connection",
      label: "Connection",
      icon: "🔗",
      content: <ConnectionStatus />,
    },
    {
      id: "tts",
      label: "Text-to-Speech",
      icon: "🔊",
      content: <TTSControls />,
    },
    {
      id: "filters",
      label: "Filters",
      icon: "🔍",
      content: <FilterControls />,
    },
    {
      id: "queue",
      label: "Queue",
      icon: "📋",
      content: <QueueStatus />,
      badge: status.queueCount > 0 ? status.queueCount : undefined,
    },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Twitch Chat TTS</h1>
        <p>Real-time chat display for Huikkakoodaa's stream</p>

        {/* Show initialization status */}
        {!hasInitialized.current && (
          <div className="app-status">
            <p>Initializing application...</p>
          </div>
        )}

        {/* Show critical errors */}
        {status.hasErrors && (
          <div className="app-errors">
            {status.errors.map(
              (error, index) =>
                error && (
                  <p key={index} className="error-message">
                    Error: {error}
                  </p>
                )
            )}
          </div>
        )}
      </header>

      <main className="app-main">
        <TabContainer
          tabs={tabs}
          defaultActiveTab="chat"
          className="app-tabs"
        />
      </main>
    </div>
  );
}

/**
 * Main App component with providers and service orchestration
 * Requirements: 1.1, 1.2, 2.1, 5.1
 */
function App() {
  return (
    <AppProvider
      channel="huikkakoodaa"
      maxMessages={100}
      initialTTSSettings={{
        enabled: false, // Start with TTS disabled, user can enable it
        volume: 0.8,
        rate: 1.0,
        pitch: 1.0,
        filterBots: true,
        minMessageLength: 3,
        blockedUsers: [],
        skipEmoteOnly: true,
      }}
    >
      <AppContent />
    </AppProvider>
  );
}

export default App;
