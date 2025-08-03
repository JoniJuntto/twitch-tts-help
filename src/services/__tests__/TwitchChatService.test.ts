import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TwitchChatService } from '../TwitchChatService';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  url: string;
  
  constructor(url: string) {
    this.url = url;
    // Simulate connection opening after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(_data: string) {
    // Mock send functionality
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

// Mock global WebSocket
(globalThis as any).WebSocket = MockWebSocket;

describe('TwitchChatService', () => {
  let service: TwitchChatService;

  beforeEach(() => {
    service = new TwitchChatService('testchannel');
  });

  afterEach(() => {
    service.destroy();
  });

  it('should initialize with disconnected status', () => {
    expect(service.getConnectionStatus()).toBe('disconnected');
    expect(service.getReconnectAttempts()).toBe(0);
  });

  it('should connect to Twitch IRC', async () => {
    service.connect();
    expect(service.getConnectionStatus()).toBe('connecting');
    
    // Wait for connection to complete
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(service.getConnectionStatus()).toBe('connected');
  });

  it('should emit connection events', async () => {
    const connectedSpy = vi.fn();
    service.on('chat:connected', connectedSpy);

    await service.connect();
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(connectedSpy).toHaveBeenCalled();
  });

  it('should parse IRC messages correctly', () => {
    const messageSpy = vi.fn();
    service.on('chat:message', messageSpy);

    // Simulate receiving an IRC message
    const mockMessage = '@badges=moderator/1;color=#FF0000;display-name=TestUser :testuser!testuser@testuser.tmi.twitch.tv PRIVMSG #testchannel :Hello world!';
    
    // Access private method for testing (not ideal but necessary for unit testing)
    const parseMethod = (service as any).parseIRCMessage.bind(service);
    const result = parseMethod(mockMessage);

    expect(result).toMatchObject({
      username: 'testuser',
      message: 'Hello world!',
      isBot: false,
      badges: ['moderator']
    });
    expect(result.id).toBeDefined();
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('should identify bot users correctly', () => {
    const parseMethod = (service as any).parseIRCMessage.bind(service);
    
    // Test bot username
    const botMessage = '@badges= :nightbot!nightbot@nightbot.tmi.twitch.tv PRIVMSG #testchannel :Bot message';
    const botResult = parseMethod(botMessage);
    expect(botResult?.isBot).toBe(true);

    // Test regular user
    const userMessage = '@badges= :regularuser!regularuser@regularuser.tmi.twitch.tv PRIVMSG #testchannel :User message';
    const userResult = parseMethod(userMessage);
    expect(userResult?.isBot).toBe(false);
  });

  it('should handle disconnection', async () => {
    const disconnectedSpy = vi.fn();
    service.on('chat:disconnected', disconnectedSpy);

    await service.connect();
    await new Promise(resolve => setTimeout(resolve, 20));
    
    service.disconnect();
    expect(service.getConnectionStatus()).toBe('disconnected');
    expect(disconnectedSpy).toHaveBeenCalled();
  });

  it('should remove event listeners', () => {
    const listener = vi.fn();
    service.on('chat:message', listener);
    service.off('chat:message', listener);

    // Simulate message - listener should not be called
    const parseMethod = (service as any).parseIRCMessage.bind(service);
    const mockMessage = '@badges= :testuser!testuser@testuser.tmi.twitch.tv PRIVMSG #testchannel :Test';
    parseMethod(mockMessage);

    expect(listener).not.toHaveBeenCalled();
  });
});