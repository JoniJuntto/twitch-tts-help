import type { ChatMessage, TTSQueueItem, TTSSettings, ServiceEvents } from '../types';

/**
 * Service for handling text-to-speech functionality using Web Speech API
 * Requirements: 2.1, 2.4, 3.2, 3.4
 */
export class TTSService {
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isInitialized = false;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private eventListeners: Map<keyof ServiceEvents, Set<Function>> = new Map();
  private settings: TTSSettings;

  constructor(initialSettings: TTSSettings) {
    this.synthesis = window.speechSynthesis;
    this.settings = { ...initialSettings };
    this.initializeEventListeners();
    this.initializeVoices();
  }

  /**
   * Initialize event listener storage
   */
  private initializeEventListeners(): void {
    const events: (keyof ServiceEvents)[] = [
      'tts:started',
      'tts:ended',
      'tts:error'
    ];
    
    events.forEach(event => {
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
   * Initialize and load available voices
   * Requirements: 2.1
   */
  private async initializeVoices(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait time
      
      // Voices might not be immediately available, so we need to wait
      const loadVoices = () => {
        attempts++;
        this.availableVoices = this.synthesis.getVoices();
        
        if (this.availableVoices.length > 0) {
          this.isInitialized = true;
          
          // Set default voice if none is selected
          if (!this.settings.voice && this.availableVoices.length > 0) {
            // Prefer English voices
            const englishVoice = this.availableVoices.find(voice => 
              voice.lang.startsWith('en')
            );
            this.settings.voice = englishVoice || this.availableVoices[0];
          }
          
          console.log(`TTS initialized with ${this.availableVoices.length} voices`);
          resolve();
        } else if (attempts >= maxAttempts) {
          // Timeout - mark as initialized anyway but with no voices
          console.warn('TTS voices not loaded after timeout, continuing without voices');
          this.isInitialized = true;
          resolve();
        } else {
          // Voices not loaded yet, wait a bit and try again
          setTimeout(loadVoices, 100);
        }
      };

      // Some browsers fire this event when voices are loaded
      if ('onvoiceschanged' in this.synthesis) {
        this.synthesis.onvoiceschanged = () => {
          if (!this.isInitialized) {
            loadVoices();
          }
        };
      }
      
      // Also try immediately in case voices are already available
      loadVoices();
    });
  }

  /**
   * Get all available voices
   * Requirements: 2.1
   */
  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return [...this.availableVoices];
  }

  /**
   * Check if TTS is supported and initialized
   */
  public isSupported(): boolean {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  /**
   * Check if TTS is fully initialized with voices
   */
  public isInitialized(): boolean {
    return this.isInitialized && this.availableVoices.length > 0;
  }

  /**
   * Update TTS settings
   * Requirements: 3.2, 3.4
   */
  public updateSettings(newSettings: Partial<TTSSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // If TTS is disabled, stop current speech
    if (newSettings.enabled === false) {
      this.stop();
    }
  }

  /**
   * Get current settings
   */
  public getSettings(): TTSSettings {
    return { ...this.settings };
  }

  /**
   * Speak a message from a queue item
   * Requirements: 2.1, 2.4
   */
  public async speak(queueItem: TTSQueueItem): Promise<void> {
    if (!this.isSupported() || !this.settings.enabled) {
      throw new Error('TTS is not supported or disabled');
    }

    if (this.currentUtterance) {
      throw new Error('Another message is currently being spoken');
    }

    try {
      const processedText = this.preprocessMessage(queueItem.message.message);
      
      if (!processedText.trim()) {
        throw new Error('Message is empty after preprocessing');
      }

      const utterance = new SpeechSynthesisUtterance(processedText);
      this.configureUtterance(utterance);
      
      this.currentUtterance = utterance;
      
      // Set up event handlers for the utterance
      this.setupUtteranceHandlers(utterance, queueItem);
      
      // Start speaking
      this.synthesis.speak(utterance);
      
      // Emit started event
      this.emit('tts:started', queueItem);
      
    } catch (error) {
      this.currentUtterance = null;
      const errorMessage = error instanceof Error ? error.message : 'Unknown TTS error';
      this.emit('tts:error', { item: queueItem, error: errorMessage });
      throw error;
    }
  }

  /**
   * Stop current speech
   * Requirements: 3.2
   */
  public stop(): void {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }
    this.currentUtterance = null;
  }

  /**
   * Check if currently speaking
   */
  public isSpeaking(): boolean {
    return this.synthesis.speaking;
  }

  /**
   * Preprocess message text for TTS
   * Requirements: 2.4
   */
  private preprocessMessage(message: string): string {
    let processed = message;

    // Remove URLs
    processed = processed.replace(/https?:\/\/[^\s]+/g, 'link');
    
    // Remove Twitch emotes (words in all caps that are likely emotes)
    processed = processed.replace(/\b[A-Z]{3,}\b/g, '');
    
    // Remove special characters but keep basic punctuation
    processed = processed.replace(/[^\w\s.,!?'-]/g, ' ');
    
    // Replace multiple spaces with single space
    processed = processed.replace(/\s+/g, ' ');
    
    // Remove leading/trailing whitespace
    processed = processed.trim();
    
    // Limit message length to prevent very long speeches
    const maxLength = 200;
    if (processed.length > maxLength) {
      processed = processed.substring(0, maxLength) + '...';
    }

    return processed;
  }

  /**
   * Configure utterance with current settings
   * Requirements: 3.2, 3.4
   */
  private configureUtterance(utterance: SpeechSynthesisUtterance): void {
    // Set voice
    if (this.settings.voice) {
      utterance.voice = this.settings.voice;
    }
    
    // Set volume (0-1)
    utterance.volume = Math.max(0, Math.min(1, this.settings.volume));
    
    // Set rate (0.1-10)
    utterance.rate = Math.max(0.1, Math.min(10, this.settings.rate));
    
    // Set pitch (0-2)
    utterance.pitch = Math.max(0, Math.min(2, this.settings.pitch));
  }

  /**
   * Set up event handlers for speech utterance
   * Requirements: 2.1
   */
  private setupUtteranceHandlers(
    utterance: SpeechSynthesisUtterance, 
    queueItem: TTSQueueItem
  ): void {
    utterance.onstart = () => {
      console.log('TTS started for message:', queueItem.message.message);
    };

    utterance.onend = () => {
      console.log('TTS ended for message:', queueItem.message.message);
      this.currentUtterance = null;
      this.emit('tts:ended', queueItem);
    };

    utterance.onerror = (event) => {
      console.error('TTS error:', event.error);
      this.currentUtterance = null;
      this.emit('tts:error', { 
        item: queueItem, 
        error: `Speech synthesis error: ${event.error}` 
      });
    };

    utterance.onpause = () => {
      console.log('TTS paused for message:', queueItem.message.message);
    };

    utterance.onresume = () => {
      console.log('TTS resumed for message:', queueItem.message.message);
    };
  }

  /**
   * Set specific voice by name or index
   * Requirements: 2.1
   */
  public setVoice(voice: SpeechSynthesisVoice | string | number): boolean {
    let targetVoice: SpeechSynthesisVoice | null = null;

    if (typeof voice === 'string') {
      // Find voice by name
      targetVoice = this.availableVoices.find(v => v.name === voice) || null;
    } else if (typeof voice === 'number') {
      // Find voice by index
      targetVoice = this.availableVoices[voice] || null;
    } else {
      // Voice object provided directly
      targetVoice = voice;
    }

    if (targetVoice) {
      this.settings.voice = targetVoice;
      return true;
    }

    return false;
  }

  /**
   * Set volume (0-1)
   * Requirements: 3.2
   */
  public setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Set speech rate (0.1-10)
   * Requirements: 3.2
   */
  public setRate(rate: number): void {
    this.settings.rate = Math.max(0.1, Math.min(10, rate));
  }

  /**
   * Set speech pitch (0-2)
   * Requirements: 3.2
   */
  public setPitch(pitch: number): void {
    this.settings.pitch = Math.max(0, Math.min(2, pitch));
  }

  /**
   * Get current voice information
   */
  public getCurrentVoice(): SpeechSynthesisVoice | null {
    return this.settings.voice;
  }

  /**
   * Test TTS with a sample message
   */
  public async testSpeak(text: string = 'This is a test message'): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('TTS is not supported');
    }

    const testMessage: ChatMessage = {
      id: 'test',
      username: 'test',
      message: text,
      timestamp: new Date(),
      isBot: false,
      badges: []
    };

    const testQueueItem: TTSQueueItem = {
      id: 'test',
      message: testMessage,
      status: 'speaking'
    };

    await this.speak(testQueueItem);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stop();
    this.eventListeners.clear();
  }
}