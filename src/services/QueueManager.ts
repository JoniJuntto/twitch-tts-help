import type { ChatMessage, TTSQueueItem, ServiceEvents } from '../types';
import { TTSService } from './TTSService';

/**
 * Manages the TTS message queue with FIFO processing
 * Requirements: 2.2, 2.3, 4.1, 4.3, 4.4
 */
export class QueueManager {
  private queue: TTSQueueItem[] = [];
  private currentItem: TTSQueueItem | null = null;
  private isProcessing = false;
  private eventListeners: Map<keyof ServiceEvents, Set<Function>> = new Map();
  private ttsService: TTSService;
  private processingPromise: Promise<void> | null = null;

  constructor(ttsService: TTSService) {
    this.ttsService = ttsService;
    this.initializeEventListeners();
    this.setupTTSEventHandlers();
  }

  /**
   * Initialize event listener storage
   */
  private initializeEventListeners(): void {
    const events: (keyof ServiceEvents)[] = [
      'queue:updated',
      'queue:cleared'
    ];
    
    events.forEach(event => {
      this.eventListeners.set(event, new Set());
    });
  }

  /**
   * Set up handlers for TTS service events
   */
  private setupTTSEventHandlers(): void {
    this.ttsService.on('tts:ended', (queueItem) => {
      this.handleTTSEnded(queueItem);
    });

    this.ttsService.on('tts:error', ({ item, error }) => {
      this.handleTTSError(item, error);
    });
  }

  /**
   * Add event listener for queue events
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
  private emit<K extends keyof ServiceEvents>(event: K, data: ServiceEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Add a message to the TTS queue
   * Requirements: 2.2, 4.1
   */
  public add(message: ChatMessage): TTSQueueItem {
    const queueItem: TTSQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      status: 'pending'
    };

    this.queue.push(queueItem);
    this.emitQueueUpdate();
    
    // Start processing if not already processing (use setTimeout to allow synchronous return)
    if (!this.isProcessing) {
      setTimeout(() => this.processNext(), 0);
    }

    return queueItem;
  }

  /**
   * Remove a specific item from the queue
   * Requirements: 4.3
   */
  public remove(itemId: string): boolean {
    // Check if it's the current item being processed
    if (this.currentItem && this.currentItem.id === itemId) {
      // Stop current TTS and mark as completed
      if (this.ttsService.isSpeaking()) {
        this.ttsService.stop();
      }
      this.currentItem = null;
      this.isProcessing = false;
      this.emitQueueUpdate();
      
      // Start processing next item
      setTimeout(() => this.processNext(), 0);
      return true;
    }

    // Remove from pending queue
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(item => item.id !== itemId);
    
    const wasRemoved = this.queue.length < initialLength;
    if (wasRemoved) {
      this.emitQueueUpdate();
    }
    
    return wasRemoved;
  }

  /**
   * Clear all items from the queue and stop current speech
   * Requirements: 4.3
   */
  public clear(): void {
    // Stop current TTS if speaking
    if (this.currentItem && this.ttsService.isSpeaking()) {
      this.ttsService.stop();
    }

    // Clear the queue
    this.queue = [];
    this.currentItem = null;
    this.isProcessing = false;
    this.processingPromise = null;

    this.emit('queue:cleared', undefined);
    this.emitQueueUpdate();
  }

  /**
   * Skip the currently speaking message and move to next
   * Requirements: 4.3
   */
  public skip(): boolean {
    if (!this.currentItem || !this.ttsService.isSpeaking()) {
      return false;
    }

    // Stop current TTS
    this.ttsService.stop();
    
    // Mark current item as completed
    this.currentItem.status = 'completed';
    this.currentItem = null;
    
    // Process next item
    this.processNext();
    
    return true;
  }

  /**
   * Get current queue status
   * Requirements: 4.1, 4.2
   */
  public getQueue(): TTSQueueItem[] {
    return [...this.queue];
  }

  /**
   * Get currently speaking item
   * Requirements: 4.2
   */
  public getCurrentItem(): TTSQueueItem | null {
    return this.currentItem;
  }

  /**
   * Get queue count
   * Requirements: 4.1
   */
  public getQueueCount(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   * Requirements: 4.4
   */
  public isEmpty(): boolean {
    return this.queue.length === 0 && this.currentItem === null;
  }

  /**
   * Check if currently processing a message
   * Requirements: 2.3
   */
  public isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Process the next item in the queue
   * Requirements: 2.2, 2.3
   */
  private async processNext(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get next item from queue (FIFO)
      const nextItem = this.queue.shift();
      if (!nextItem) {
        this.isProcessing = false;
        return;
      }

      // Set as current item and update status
      this.currentItem = nextItem;
      this.currentItem.status = 'speaking';
      this.emitQueueUpdate();

      // Create processing promise
      this.processingPromise = this.ttsService.speak(this.currentItem);
      
      // Wait for TTS to complete
      await this.processingPromise;

    } catch (error) {
      console.error('Error processing queue item:', error);
      
      // Mark current item as completed even on error
      if (this.currentItem) {
        this.currentItem.status = 'completed';
        this.currentItem = null;
      }
      
      // Continue processing next item after error
      this.isProcessing = false;
      this.processNext();
    }
  }

  /**
   * Handle TTS ended event
   */
  private handleTTSEnded(queueItem: TTSQueueItem): void {
    if (this.currentItem && this.currentItem.id === queueItem.id) {
      this.currentItem.status = 'completed';
      this.currentItem = null;
      this.isProcessing = false;
      this.processingPromise = null;
      
      this.emitQueueUpdate();
      
      // Process next item in queue
      this.processNext();
    }
  }

  /**
   * Handle TTS error event
   */
  private handleTTSError(queueItem: TTSQueueItem, error: string): void {
    console.error(`TTS error for queue item ${queueItem.id}:`, error);
    
    if (this.currentItem && this.currentItem.id === queueItem.id) {
      this.currentItem.status = 'completed';
      this.currentItem = null;
      this.isProcessing = false;
      this.processingPromise = null;
      
      this.emitQueueUpdate();
      
      // Continue processing next item even after error
      this.processNext();
    }
  }

  /**
   * Emit queue update event
   */
  private emitQueueUpdate(): void {
    const fullQueue = this.currentItem 
      ? [this.currentItem, ...this.queue]
      : [...this.queue];
    
    this.emit('queue:updated', fullQueue);
  }

  /**
   * Get queue statistics
   */
  public getStats(): {
    queueLength: number;
    isProcessing: boolean;
    currentItem: TTSQueueItem | null;
    hasItems: boolean;
  } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      currentItem: this.currentItem,
      hasItems: !this.isEmpty()
    };
  }

  /**
   * Pause queue processing (stops current and prevents next)
   */
  public pause(): void {
    if (this.currentItem && this.ttsService.isSpeaking()) {
      this.ttsService.stop();
    }
    this.isProcessing = false;
  }

  /**
   * Resume queue processing
   */
  public resume(): void {
    if (!this.isProcessing && (this.queue.length > 0 || this.currentItem)) {
      this.processNext();
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.clear();
    this.eventListeners.clear();
  }
}