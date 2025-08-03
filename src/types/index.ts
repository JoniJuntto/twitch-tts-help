// Core TypeScript interfaces and types for the application

/**
 * Represents a chat message from Twitch IRC
 * Requirements: 1.2, 2.1
 */
export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  isBot: boolean;
  badges: string[];
}

/**
 * Represents an item in the TTS queue with processing status
 * Requirements: 2.1, 4.1
 */
export interface TTSQueueItem {
  id: string;
  message: ChatMessage;
  status: 'pending' | 'speaking' | 'completed';
}

/**
 * User preferences for TTS functionality and message filtering
 * Requirements: 3.1, 4.1
 */
export interface TTSSettings {
  enabled: boolean;
  volume: number; // 0-1
  rate: number; // 0.1-10
  pitch: number; // 0-2
  voice: SpeechSynthesisVoice | null;
  filterBots: boolean;
  minMessageLength: number;
  blockedUsers: string[];
  skipEmoteOnly: boolean;
}

/**
 * Connection status for Twitch IRC
 * Requirements: 1.2
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * TTS queue operations
 * Requirements: 4.1
 */
export type QueueOperation = 'add' | 'remove' | 'clear' | 'skip';

/**
 * Service event types for communication between services and components
 * Requirements: 1.2, 2.1, 4.1
 */
export interface ServiceEvents {
  // Chat service events
  'chat:message': ChatMessage;
  'chat:connected': void;
  'chat:disconnected': void;
  'chat:error': string;
  
  // TTS service events
  'tts:started': TTSQueueItem;
  'tts:ended': TTSQueueItem;
  'tts:error': { item: TTSQueueItem; error: string };
  
  // Queue events
  'queue:updated': TTSQueueItem[];
  'queue:cleared': void;
}

/**
 * Component prop types for better type safety
 */
export interface ChatDisplayProps {
  messages: ChatMessage[];
  maxMessages?: number;
}

export interface TTSControlsProps {
  settings: TTSSettings;
  onSettingsChange: (settings: Partial<TTSSettings>) => void;
  voices: SpeechSynthesisVoice[];
}

export interface QueueStatusProps {
  queue: TTSQueueItem[];
  currentItem: TTSQueueItem | null;
  onClearQueue: () => void;
  onSkipCurrent: () => void;
}

export interface ConnectionStatusProps {
  status: ConnectionStatus;
  error?: string;
  reconnectAttempts?: number;
}

export interface FilterControlsProps {
  settings: Pick<TTSSettings, 'filterBots' | 'minMessageLength' | 'blockedUsers' | 'skipEmoteOnly'>;
  onSettingsChange: (settings: Partial<TTSSettings>) => void;
}

/**
 * Service response types
 */
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface VoiceLoadResponse extends ServiceResponse<SpeechSynthesisVoice[]> {}

export interface ConnectionResponse extends ServiceResponse<void> {}

/**
 * Utility types for better type inference
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Event handler types
 */
export type EventHandler<T = void> = (data: T) => void;

export type AsyncEventHandler<T = void> = (data: T) => Promise<void>;

/**
 * Settings validation types
 */
export interface SettingsValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * Message filtering types
 */
export interface FilterResult {
  shouldProcess: boolean;
  reason?: string;
}