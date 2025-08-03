import type { ChatMessage, ConnectionStatus, ServiceEvents } from "../types";

/**
 * Service for connecting to Twitch IRC and handling chat messages
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export class TwitchChatService {
  private ws: WebSocket | null = null;
  private connectionStatus: ConnectionStatus = "disconnected";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 second
  private reconnectTimeout: number | null = null;
  private isReconnecting = false;
  private eventListeners: Map<keyof ServiceEvents, Set<Function>> = new Map();
  private channel: string;
  private isIntentionalDisconnect = false;

  constructor(channel: string = "huikkakoodaa") {
    this.channel = channel.toLowerCase().replace("#", "");
    this.initializeEventListeners();
  }

  /**
   * Initialize event listener storage
   */
  private initializeEventListeners(): void {
    const events: (keyof ServiceEvents)[] = [
      "chat:message",
      "chat:connected",
      "chat:disconnected",
      "chat:error",
    ];

    events.forEach((event) => {
      this.eventListeners.set(event, new Set());
    });
  }

  /**
   * Add event listener for service events
   */
  public on<K extends keyof ServiceEvents>(
    event: K,
    listener: (data: ServiceEvents[K]) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * Remove event listener
   */
  public off<K extends keyof ServiceEvents>(
    event: K,
    listener: (data: ServiceEvents[K]) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit<K extends keyof ServiceEvents>(
    event: K,
    data: ServiceEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Connect to Twitch IRC
   * Requirements: 1.1, 1.3
   */
  public async connect(): Promise<void> {
    if (
      this.connectionStatus === "connecting" ||
      this.connectionStatus === "connected"
    ) {
      return;
    }

    // Don't attempt connection if we're in the middle of an intentional disconnect
    if (this.isIntentionalDisconnect) {
      return;
    }

    this.isIntentionalDisconnect = false;
    this.setConnectionStatus("connecting");

    try {
      this.ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
      this.setupWebSocketHandlers();
    } catch (error) {
      this.handleConnectionError(
        `Failed to create WebSocket connection: ${error}`
      );
    }
  }

  /**
   * Disconnect from Twitch IRC
   */
  public disconnect(): void {
    this.isIntentionalDisconnect = true;
    this.clearReconnectTimeout();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setConnectionStatus("disconnected");
    this.emit("chat:disconnected", undefined);
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get current reconnect attempts count
   */
  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.handleConnectionOpen();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      this.handleConnectionClose(event);
    };

    this.ws.onerror = (error) => {
      // Provide more meaningful error messages
      let errorMessage = 'WebSocket connection error';
      
      if (error instanceof ErrorEvent) {
        errorMessage = `WebSocket error: ${error.message || 'Connection failed'}`;
      } else if (error.type) {
        errorMessage = `WebSocket error: ${error.type}`;
      }
      
      this.handleConnectionError(errorMessage);
    };
  }

  /**
   * Handle WebSocket connection open
   * Requirements: 1.1
   */
  private handleConnectionOpen(): void {
    console.log("Connected to Twitch IRC");

    // Send authentication and join channel
    this.sendRawMessage("CAP REQ :twitch.tv/tags twitch.tv/commands");
    this.sendRawMessage("PASS oauth:justinfan12345"); // Anonymous connection
    this.sendRawMessage("NICK justinfan12345");
    this.sendRawMessage(`JOIN #${this.channel}`);

    this.reconnectAttempts = 0;
    this.setConnectionStatus("connected");
    this.emit("chat:connected", undefined);
  }

  /**
   * Handle incoming WebSocket messages
   * Requirements: 1.2
   */
  private handleMessage(data: string): void {
    const lines = data.trim().split("\r\n");

    lines.forEach((line) => {
      if (line.startsWith("PING")) {
        // Respond to ping to keep connection alive
        this.sendRawMessage(`PONG ${line.substring(5)}`);
        return;
      }

      const chatMessage = this.parseIRCMessage(line);
      if (chatMessage) {
        this.emit("chat:message", chatMessage);
      }
    });
  }

  /**
   * Parse IRC message to ChatMessage object
   * Requirements: 1.2
   */
  private parseIRCMessage(line: string): ChatMessage | null {
    // Parse IRC message format: @tags :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
    const privmsgMatch = line.match(
      /^@([^:]*):([^!]+)![^@]+@[^.]+\.tmi\.twitch\.tv PRIVMSG #[^\s]+ :(.+)$/
    );

    if (!privmsgMatch) {
      return null;
    }

    const [, tagsString, username, message] = privmsgMatch;
    const tags = this.parseTags(tagsString);

    // Generate unique ID for the message
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Check if user is a bot based on badges or username patterns
    const isBot = this.isUserBot(username, tags.badges || "");

    // Parse badges
    const badges = this.parseBadges(tags.badges || "");

    return {
      id,
      username,
      message,
      timestamp: new Date(),
      isBot,
      badges,
    };
  }

  /**
   * Parse IRC tags into key-value pairs
   */
  private parseTags(tagsString: string): Record<string, string> {
    const tags: Record<string, string> = {};

    if (!tagsString) return tags;

    tagsString.split(";").forEach((tag) => {
      const [key, value] = tag.split("=");
      if (key && value !== undefined) {
        tags[key] = value;
      }
    });

    return tags;
  }

  /**
   * Parse badges from IRC tags
   */
  private parseBadges(badgesString: string): string[] {
    if (!badgesString) return [];

    return badgesString
      .split(",")
      .map((badge) => {
        const [name] = badge.split("/");
        return name;
      })
      .filter(Boolean);
  }

  /**
   * Determine if user is a bot based on username and badges
   */
  private isUserBot(username: string, badges: string): boolean {
    // Common bot username patterns
    const botPatterns = [
      /bot$/i,
      /^nightbot$/i,
      /^streamlabs$/i,
      /^streamelements$/i,
      /^moobot$/i,
      /^fossabot$/i,
    ];

    // Check username patterns
    if (botPatterns.some((pattern) => pattern.test(username))) {
      return true;
    }

    // Check for bot badges
    if (badges.includes("bot")) {
      return true;
    }

    return false;
  }

  /**
   * Handle WebSocket connection close
   * Requirements: 1.3, 1.4
   */
  private handleConnectionClose(event: CloseEvent): void {
    console.log("Twitch IRC connection closed:", event.code, event.reason);

    this.ws = null;
    this.setConnectionStatus("disconnected");
    this.emit("chat:disconnected", undefined);

    // Attempt reconnection if not intentional disconnect
    if (!this.isIntentionalDisconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle connection errors
   * Requirements: 1.4
   */
  private handleConnectionError(error: string): void {
    console.error("Twitch IRC connection error:", error);

    this.setConnectionStatus("error");
    this.emit("chat:error", error);

    // Attempt reconnection on error
    if (!this.isIntentionalDisconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   * Requirements: 1.4
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.emit("chat:error", "Max reconnection attempts reached");
      this.isReconnecting = false;
      return;
    }

    if (this.isReconnecting) {
      console.log("Reconnection already in progress, skipping");
      return;
    }

    this.isReconnecting = true;
    this.clearReconnectTimeout();

    // Calculate delay with exponential backoff: baseDelay * 2^attempts
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    console.log(
      `Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().finally(() => {
        this.isReconnecting = false;
      });
    }, delay);
  }

  /**
   * Clear reconnection timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isReconnecting = false;
  }

  /**
   * Send raw message to IRC
   */
  private sendRawMessage(message: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message + "\r\n");
    }
  }

  /**
   * Set connection status and log changes
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      console.log(
        `Connection status changed: ${this.connectionStatus} -> ${status}`
      );
      this.connectionStatus = status;
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.disconnect();
    this.eventListeners.clear();
  }
}
