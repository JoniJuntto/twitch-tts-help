import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TTSService } from '../TTSService';
import type { TTSSettings, ChatMessage, TTSQueueItem } from '../../types';

// Mock the Web Speech API
const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn(() => [
    { name: 'Test Voice 1', lang: 'en-US', default: true, localService: true, voiceURI: 'test1' },
    { name: 'Test Voice 2', lang: 'en-GB', default: false, localService: true, voiceURI: 'test2' }
  ] as SpeechSynthesisVoice[]),
  speaking: false,
  pending: false,
  paused: false,
  onvoiceschanged: null
};

const mockSpeechSynthesisUtterance = vi.fn().mockImplementation((text: string) => ({
  text,
  voice: null,
  volume: 1,
  rate: 1,
  pitch: 1,
  onstart: null,
  onend: null,
  onerror: null,
  onpause: null,
  onresume: null
}));

// Mock global objects
Object.defineProperty(window, 'speechSynthesis', {
  value: mockSpeechSynthesis,
  writable: true
});

Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  value: mockSpeechSynthesisUtterance,
  writable: true
});

describe('TTSService', () => {
  let ttsService: TTSService;
  let defaultSettings: TTSSettings;
  let testMessage: ChatMessage;
  let testQueueItem: TTSQueueItem;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockSpeechSynthesis.speaking = false;

    defaultSettings = {
      enabled: true,
      volume: 1,
      rate: 1,
      pitch: 1,
      voice: null,
      filterBots: false,
      minMessageLength: 1,
      blockedUsers: [],
      skipEmoteOnly: false
    };

    testMessage = {
      id: 'test-1',
      username: 'testuser',
      message: 'Hello world!',
      timestamp: new Date(),
      isBot: false,
      badges: []
    };

    testQueueItem = {
      id: 'queue-1',
      message: testMessage,
      status: 'pending'
    };

    ttsService = new TTSService(defaultSettings);
  });

  afterEach(() => {
    ttsService.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with provided settings', () => {
      const settings = ttsService.getSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.volume).toBe(1);
      expect(settings.rate).toBe(1);
      expect(settings.pitch).toBe(1);
    });

    it('should check if TTS is supported', () => {
      expect(ttsService.isSupported()).toBe(true);
    });

    it('should load available voices', () => {
      const voices = ttsService.getAvailableVoices();
      expect(voices).toHaveLength(2);
      expect(voices[0].name).toBe('Test Voice 1');
      expect(voices[1].name).toBe('Test Voice 2');
    });
  });

  describe('Settings Management', () => {
    it('should update settings', () => {
      ttsService.updateSettings({ volume: 0.5, rate: 1.5 });
      const settings = ttsService.getSettings();
      expect(settings.volume).toBe(0.5);
      expect(settings.rate).toBe(1.5);
    });

    it('should set volume within valid range', () => {
      ttsService.setVolume(1.5); // Above max
      expect(ttsService.getSettings().volume).toBe(1);

      ttsService.setVolume(-0.5); // Below min
      expect(ttsService.getSettings().volume).toBe(0);

      ttsService.setVolume(0.7); // Valid
      expect(ttsService.getSettings().volume).toBe(0.7);
    });

    it('should set rate within valid range', () => {
      ttsService.setRate(15); // Above max
      expect(ttsService.getSettings().rate).toBe(10);

      ttsService.setRate(0.05); // Below min
      expect(ttsService.getSettings().rate).toBe(0.1);

      ttsService.setRate(2); // Valid
      expect(ttsService.getSettings().rate).toBe(2);
    });

    it('should set pitch within valid range', () => {
      ttsService.setPitch(5); // Above max
      expect(ttsService.getSettings().pitch).toBe(2);

      ttsService.setPitch(-1); // Below min
      expect(ttsService.getSettings().pitch).toBe(0);

      ttsService.setPitch(1.5); // Valid
      expect(ttsService.getSettings().pitch).toBe(1.5);
    });
  });

  describe('Voice Management', () => {
    it('should set voice by name', () => {
      const result = ttsService.setVoice('Test Voice 2');
      expect(result).toBe(true);
      expect(ttsService.getCurrentVoice()?.name).toBe('Test Voice 2');
    });

    it('should set voice by index', () => {
      const result = ttsService.setVoice(1);
      expect(result).toBe(true);
      expect(ttsService.getCurrentVoice()?.name).toBe('Test Voice 2');
    });

    it('should return false for invalid voice name', () => {
      const result = ttsService.setVoice('Nonexistent Voice');
      expect(result).toBe(false);
    });

    it('should return false for invalid voice index', () => {
      const result = ttsService.setVoice(10);
      expect(result).toBe(false);
    });
  });

  describe('Message Preprocessing', () => {
    it('should preprocess message correctly', async () => {
      const messageWithUrl = {
        ...testMessage,
        message: 'Check this out https://example.com KAPPA'
      };
      const queueItem = { ...testQueueItem, message: messageWithUrl };

      await ttsService.speak(queueItem);

      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith(
        expect.stringContaining('Check this out link')
      );
      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith(
        expect.not.stringContaining('KAPPA')
      );
    });

    it('should remove special characters', async () => {
      const messageWithSpecialChars = {
        ...testMessage,
        message: 'Hello @user #hashtag $money!'
      };
      const queueItem = { ...testQueueItem, message: messageWithSpecialChars };

      await ttsService.speak(queueItem);

      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith(
        expect.stringContaining('Hello user hashtag money!')
      );
    });

    it('should limit message length', async () => {
      const longMessage = {
        ...testMessage,
        message: 'a'.repeat(300) // Very long message
      };
      const queueItem = { ...testQueueItem, message: longMessage };

      await ttsService.speak(queueItem);

      const calledWith = mockSpeechSynthesisUtterance.mock.calls[0][0];
      expect(calledWith.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(calledWith).toMatch(/\.\.\.$/);
    });
  });

  describe('Speech Control', () => {
    it('should speak a message', async () => {
      await ttsService.speak(testQueueItem);

      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith('Hello world!');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should emit started event when speaking', async () => {
      const startedHandler = vi.fn();
      ttsService.on('tts:started', startedHandler);

      await ttsService.speak(testQueueItem);

      expect(startedHandler).toHaveBeenCalledWith(testQueueItem);
    });

    it('should throw error when TTS is disabled', async () => {
      ttsService.updateSettings({ enabled: false });

      await expect(ttsService.speak(testQueueItem)).rejects.toThrow(
        'TTS is not supported or disabled'
      );
    });

    it('should throw error when already speaking', async () => {
      // Mock that we're currently speaking
      mockSpeechSynthesis.speaking = true;
      
      // Start first speech
      await ttsService.speak(testQueueItem);

      // Try to speak again
      await expect(ttsService.speak(testQueueItem)).rejects.toThrow(
        'Another message is currently being spoken'
      );
    });

    it('should stop current speech', () => {
      mockSpeechSynthesis.speaking = true;
      ttsService.stop();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should check if currently speaking', () => {
      mockSpeechSynthesis.speaking = false;
      expect(ttsService.isSpeaking()).toBe(false);

      mockSpeechSynthesis.speaking = true;
      expect(ttsService.isSpeaking()).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should handle utterance end event', async () => {
      const endedHandler = vi.fn();
      ttsService.on('tts:ended', endedHandler);

      await ttsService.speak(testQueueItem);

      // Simulate utterance end
      const utterance = mockSpeechSynthesisUtterance.mock.results[0].value;
      utterance.onend();

      expect(endedHandler).toHaveBeenCalledWith(testQueueItem);
    });

    it('should handle utterance error event', async () => {
      const errorHandler = vi.fn();
      ttsService.on('tts:error', errorHandler);

      await ttsService.speak(testQueueItem);

      // Simulate utterance error
      const utterance = mockSpeechSynthesisUtterance.mock.results[0].value;
      utterance.onerror({ error: 'synthesis-failed' });

      expect(errorHandler).toHaveBeenCalledWith({
        item: testQueueItem,
        error: 'Speech synthesis error: synthesis-failed'
      });
    });
  });

  describe('Test Functionality', () => {
    it('should test speak with default message', async () => {
      await ttsService.testSpeak();

      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith(
        'This is a test message'
      );
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should test speak with custom message', async () => {
      await ttsService.testSpeak('Custom test message');

      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith(
        'Custom test message'
      );
    });
  });

  describe('Cleanup', () => {
    it('should stop speech and clear listeners on destroy', () => {
      mockSpeechSynthesis.speaking = true;
      
      ttsService.destroy();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });
});