import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { QueueManager } from '../QueueManager';
import { TTSService } from '../TTSService';
import type { ChatMessage, TTSQueueItem, TTSSettings } from '../../types';

// Mock TTSService
vi.mock('../TTSService');

describe('QueueManager', () => {
  let queueManager: QueueManager;
  let mockTTSService: TTSService;
  let mockTTSSettings: TTSSettings;

  // Helper function to create test chat messages
  const createTestMessage = (id: string, message: string, username = 'testuser'): ChatMessage => ({
    id,
    username,
    message,
    timestamp: new Date(),
    isBot: false,
    badges: []
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock TTS settings
    mockTTSSettings = {
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

    // Create mock TTS service
    mockTTSService = new TTSService(mockTTSSettings);
    
    // Mock TTS service methods
    (mockTTSService.speak as Mock) = vi.fn().mockResolvedValue(undefined);
    (mockTTSService.stop as Mock) = vi.fn();
    (mockTTSService.isSpeaking as Mock) = vi.fn().mockReturnValue(false);
    (mockTTSService.on as Mock) = vi.fn();
    (mockTTSService.off as Mock) = vi.fn();

    // Create queue manager
    queueManager = new QueueManager(mockTTSService);
  });

  describe('Initialization', () => {
    it('should initialize with empty queue', () => {
      expect(queueManager.getQueue()).toEqual([]);
      expect(queueManager.getCurrentItem()).toBeNull();
      expect(queueManager.getQueueCount()).toBe(0);
      expect(queueManager.isEmpty()).toBe(true);
      expect(queueManager.isCurrentlyProcessing()).toBe(false);
    });

    it('should set up TTS event handlers', () => {
      expect(mockTTSService.on).toHaveBeenCalledWith('tts:ended', expect.any(Function));
      expect(mockTTSService.on).toHaveBeenCalledWith('tts:error', expect.any(Function));
    });
  });

  describe('Adding messages to queue', () => {
    it('should add message to queue', () => {
      const message = createTestMessage('1', 'Hello world');
      const queueItem = queueManager.add(message);

      expect(queueItem).toMatchObject({
        id: expect.any(String),
        message,
        status: 'pending'
      });
      expect(queueManager.getQueueCount()).toBe(1);
      expect(queueManager.isEmpty()).toBe(false);
    });

    it('should generate unique IDs for queue items', () => {
      const message1 = createTestMessage('1', 'First message');
      const message2 = createTestMessage('2', 'Second message');
      
      const item1 = queueManager.add(message1);
      const item2 = queueManager.add(message2);

      expect(item1.id).not.toBe(item2.id);
    });

    it('should maintain FIFO order', async () => {
      // Mock TTS service to never resolve to prevent processing
      (mockTTSService.speak as Mock).mockImplementation(() => new Promise(() => {}));

      const message1 = createTestMessage('1', 'First');
      const message2 = createTestMessage('2', 'Second');
      const message3 = createTestMessage('3', 'Third');

      queueManager.add(message1);
      queueManager.add(message2);
      queueManager.add(message3);

      // Wait for async processing to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // First message should be current item, others in queue
      expect(queueManager.getCurrentItem()?.message.message).toBe('First');
      const queue = queueManager.getQueue();
      expect(queue[0].message.message).toBe('Second');
      expect(queue[1].message.message).toBe('Third');
    });
  });

  describe('Queue processing', () => {
    it('should start processing when message is added to empty queue', async () => {
      const message = createTestMessage('1', 'Test message');
      
      // Mock TTS service to resolve immediately
      (mockTTSService.speak as Mock).mockResolvedValue(undefined);
      
      queueManager.add(message);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockTTSService.speak).toHaveBeenCalledWith(
        expect.objectContaining({
          message,
          status: 'speaking'
        })
      );
    });

    it('should process messages sequentially', async () => {
      const message1 = createTestMessage('1', 'First');
      const message2 = createTestMessage('2', 'Second');

      // Mock TTS service to track call order
      const speakCalls: string[] = [];
      (mockTTSService.speak as Mock).mockImplementation((item: TTSQueueItem) => {
        speakCalls.push(item.message.message);
        return Promise.resolve();
      });

      queueManager.add(message1);
      queueManager.add(message2);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(speakCalls).toEqual(['First']);
      expect(queueManager.getQueueCount()).toBe(1); // Second message still in queue
    });

    it('should not process multiple messages simultaneously', async () => {
      const message1 = createTestMessage('1', 'First');
      const message2 = createTestMessage('2', 'Second');

      // Mock TTS service to never resolve
      (mockTTSService.speak as Mock).mockImplementation(() => new Promise(() => {}));

      queueManager.add(message1);
      queueManager.add(message2);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockTTSService.speak).toHaveBeenCalledTimes(1);
      expect(queueManager.isCurrentlyProcessing()).toBe(true);
    });
  });

  describe('Queue operations', () => {
    it('should remove specific item from queue', async () => {
      // Mock TTS service to never resolve to prevent processing
      (mockTTSService.speak as Mock).mockImplementation(() => new Promise(() => {}));

      const message1 = createTestMessage('1', 'First');
      const message2 = createTestMessage('2', 'Second');
      
      const item1 = queueManager.add(message1);
      const item2 = queueManager.add(message2);

      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Remove the second item (should be in queue)
      const removed = queueManager.remove(item2.id);

      expect(removed).toBe(true);
      expect(queueManager.getQueueCount()).toBe(0);
      expect(queueManager.getCurrentItem()?.id).toBe(item1.id);
    });

    it('should return false when removing non-existent item', async () => {
      // Mock TTS service to never resolve to prevent processing
      (mockTTSService.speak as Mock).mockImplementation(() => new Promise(() => {}));

      const message = createTestMessage('1', 'Test');
      queueManager.add(message);

      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const removed = queueManager.remove('non-existent-id');

      expect(removed).toBe(false);
      expect(queueManager.getQueueCount()).toBe(0); // Item moved to current
      expect(queueManager.getCurrentItem()).not.toBeNull();
    });

    it('should clear entire queue', () => {
      const message1 = createTestMessage('1', 'First');
      const message2 = createTestMessage('2', 'Second');
      
      queueManager.add(message1);
      queueManager.add(message2);

      queueManager.clear();

      expect(queueManager.getQueue()).toEqual([]);
      expect(queueManager.getCurrentItem()).toBeNull();
      expect(queueManager.getQueueCount()).toBe(0);
      expect(queueManager.isEmpty()).toBe(true);
      expect(queueManager.isCurrentlyProcessing()).toBe(false);
    });

    it('should stop current TTS when clearing queue', async () => {
      (mockTTSService.isSpeaking as Mock).mockReturnValue(true);
      (mockTTSService.speak as Mock).mockImplementation(() => new Promise(() => {}));
      
      const message = createTestMessage('1', 'Test');
      queueManager.add(message);

      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 10));

      queueManager.clear();

      expect(mockTTSService.stop).toHaveBeenCalled();
    });

    it('should skip current message', async () => {
      (mockTTSService.isSpeaking as Mock).mockReturnValue(true);
      (mockTTSService.speak as Mock).mockImplementation(() => new Promise(() => {}));
      
      const message = createTestMessage('1', 'Test');
      queueManager.add(message);

      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const skipped = queueManager.skip();

      expect(skipped).toBe(true);
      expect(mockTTSService.stop).toHaveBeenCalled();
    });

    it('should return false when skipping with no current message', () => {
      const skipped = queueManager.skip();
      expect(skipped).toBe(false);
    });
  });

  describe('Event handling', () => {
    it('should emit queue:updated event when adding message', () => {
      const listener = vi.fn();
      queueManager.on('queue:updated', listener);

      const message = createTestMessage('1', 'Test');
      queueManager.add(message);

      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ message })
        ])
      );
    });

    it('should emit queue:cleared event when clearing queue', () => {
      const listener = vi.fn();
      queueManager.on('queue:cleared', listener);

      queueManager.clear();

      expect(listener).toHaveBeenCalledWith(undefined);
    });

    it('should handle TTS ended event', () => {
      const message = createTestMessage('1', 'Test');
      const queueItem = queueManager.add(message);

      // Simulate TTS ended event
      const ttsEndedHandler = (mockTTSService.on as Mock).mock.calls
        .find(call => call[0] === 'tts:ended')[1];
      
      ttsEndedHandler(queueItem);

      expect(queueManager.getCurrentItem()).toBeNull();
      expect(queueManager.isCurrentlyProcessing()).toBe(false);
    });

    it('should handle TTS error event', () => {
      const message = createTestMessage('1', 'Test');
      const queueItem = queueManager.add(message);

      // Simulate TTS error event
      const ttsErrorHandler = (mockTTSService.on as Mock).mock.calls
        .find(call => call[0] === 'tts:error')[1];
      
      ttsErrorHandler({ item: queueItem, error: 'Test error' });

      expect(queueManager.getCurrentItem()).toBeNull();
      expect(queueManager.isCurrentlyProcessing()).toBe(false);
    });
  });

  describe('Queue statistics', () => {
    it('should provide accurate queue statistics', () => {
      const message1 = createTestMessage('1', 'First');
      const message2 = createTestMessage('2', 'Second');
      
      queueManager.add(message1);
      queueManager.add(message2);

      const stats = queueManager.getStats();

      expect(stats).toMatchObject({
        queueLength: expect.any(Number),
        isProcessing: expect.any(Boolean),
        currentItem: expect.any(Object),
        hasItems: true
      });
    });

    it('should show empty stats for empty queue', () => {
      const stats = queueManager.getStats();

      expect(stats).toMatchObject({
        queueLength: 0,
        isProcessing: false,
        currentItem: null,
        hasItems: false
      });
    });
  });

  describe('Pause and resume', () => {
    it('should pause queue processing', async () => {
      (mockTTSService.isSpeaking as Mock).mockReturnValue(true);
      (mockTTSService.speak as Mock).mockImplementation(() => new Promise(() => {}));
      
      const message = createTestMessage('1', 'Test');
      queueManager.add(message);

      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 10));

      queueManager.pause();

      expect(mockTTSService.stop).toHaveBeenCalled();
      expect(queueManager.isCurrentlyProcessing()).toBe(false);
    });

    it('should resume queue processing', async () => {
      const message = createTestMessage('1', 'Test');
      queueManager.add(message);
      
      queueManager.pause();
      queueManager.resume();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockTTSService.speak).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const message = createTestMessage('1', 'Test');
      queueManager.add(message);

      queueManager.destroy();

      expect(queueManager.getQueue()).toEqual([]);
      expect(queueManager.getCurrentItem()).toBeNull();
      expect(queueManager.isEmpty()).toBe(true);
    });
  });
});