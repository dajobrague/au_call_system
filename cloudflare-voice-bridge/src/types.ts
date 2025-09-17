/**
 * TypeScript interfaces for Twilio Media Streams and ElevenLabs Realtime
 */

// Twilio Media Stream message types
export interface TwilioStartMessage {
  event: 'start';
  streamSid: string;
  start: {
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
}

export interface TwilioMediaMessage {
  event: 'media';
  streamSid: string;
  media: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // base64 encoded audio
  };
}

export interface TwilioMarkMessage {
  event: 'mark';
  streamSid: string;
  mark: {
    name: string;
  };
}

export interface TwilioStopMessage {
  event: 'stop';
  streamSid: string;
}

export type TwilioMessage = TwilioStartMessage | TwilioMediaMessage | TwilioMarkMessage | TwilioStopMessage;

// ElevenLabs Realtime message types
export interface ElevenLabsConversationConfig {
  agent_id: string;
  override_agent_settings?: {
    voice?: {
      voice_id: string;
      stability: number;
      similarity_boost: number;
    };
  };
}

export interface ElevenLabsAudioMessage {
  type: 'audio';
  audio_data: string; // base64 encoded
}

export interface ElevenLabsTextMessage {
  type: 'message';
  message: string;
}

export interface ElevenLabsControlMessage {
  type: 'conversation_initiation_metadata' | 'user_transcript' | 'agent_response' | 'interruption';
  [key: string]: any;
}

export type ElevenLabsMessage = ElevenLabsAudioMessage | ElevenLabsTextMessage | ElevenLabsControlMessage;

// Call session state
export interface CallSessionState {
  callSid: string;
  streamSid?: string;
  twilioSocket?: WebSocket;
  elevenLabsSocket?: WebSocket;
  startTime: number;
  lastActivity: number;
  audioFormat: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
  metrics: {
    bytesReceived: number;
    bytesSent: number;
    messagesReceived: number;
    messagesSent: number;
    reconnects: number;
  };
  status: 'connecting' | 'active' | 'closing' | 'closed' | 'error';
}

// Environment interface
export interface Env {
  CALL_SESSIONS: DurableObjectNamespace;
  XI_API_KEY: string;
  ELEVENLABS_AGENT_ID?: string;
  ELEVENLABS_VOICE_ID?: string;
  ELEVENLABS_MODE?: string;
  MAX_CALL_DURATION?: string;
  AUDIO_BUFFER_SIZE?: string;
}

// Audio processing types
export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  sampleRate: number;
  encoding: 'mulaw' | 'pcm';
}

export interface AudioConversionResult {
  success: boolean;
  data?: ArrayBuffer;
  error?: string;
}
