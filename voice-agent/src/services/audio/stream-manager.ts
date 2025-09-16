/**
 * Audio streaming infrastructure
 * Manages WebSocket connections and audio buffer handling for Twilio Media Streams
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export interface AudioChunk {
  timestamp: number;
  sequenceNumber: number;
  audioData: Buffer;
  sampleRate: number;
}

export interface StreamMetadata {
  streamSid: string;
  accountSid: string;
  callSid: string;
  tracks: string[];
  mediaFormat: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
}

/**
 * Manages Twilio Media Stream WebSocket connections
 */
export class AudioStreamManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private streamMetadata: StreamMetadata | null = null;
  private audioBuffer: Buffer[] = [];
  private sequenceNumber = 0;
  private isConnected = false;

  constructor() {
    super();
  }

  /**
   * Initialize WebSocket connection for Twilio Media Streams
   */
  initializeConnection(ws: WebSocket): void {
    this.ws = ws;
    this.isConnected = true;
    
    console.log('Audio stream manager: WebSocket connection initialized');

    // Handle WebSocket messages
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        this.handleTwilioMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    // Handle WebSocket close
    ws.on('close', () => {
      console.log('Audio stream manager: WebSocket connection closed');
      this.isConnected = false;
      this.cleanup();
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
      console.error('Audio stream manager: WebSocket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Handle incoming Twilio Media Stream messages
   */
  private handleTwilioMessage(data: any): void {
    switch (data.event) {
      case 'connected':
        console.log('Twilio Media Stream connected:', data.protocol, data.version);
        break;

      case 'start':
        this.streamMetadata = {
          streamSid: data.streamSid,
          accountSid: data.start.accountSid,
          callSid: data.start.callSid,
          tracks: data.start.tracks,
          mediaFormat: data.start.mediaFormat,
        };
        console.log('Media stream started:', this.streamMetadata);
        this.emit('streamStarted', this.streamMetadata);
        break;

      case 'media':
        this.handleAudioData(data);
        break;

      case 'stop':
        console.log('Media stream stopped:', data.streamSid);
        this.emit('streamStopped', data.streamSid);
        break;

      case 'mark':
        console.log('Media stream mark received:', data.mark.name);
        this.emit('mark', data.mark);
        break;

      default:
        console.log('Unknown Twilio message event:', data.event);
    }
  }

  /**
   * Handle incoming audio data from Twilio
   */
  private handleAudioData(data: any): void {
    if (!data.media || !data.media.payload) {
      return;
    }

    try {
      // Decode base64 audio data
      const audioBuffer = Buffer.from(data.media.payload, 'base64');
      
      const audioChunk: AudioChunk = {
        timestamp: parseInt(data.media.timestamp),
        sequenceNumber: this.sequenceNumber++,
        audioData: audioBuffer,
        sampleRate: this.streamMetadata?.mediaFormat.sampleRate || 8000,
      };

      // Add to buffer
      this.audioBuffer.push(audioBuffer);
      
      // Emit audio chunk for processing
      this.emit('audioChunk', audioChunk);

      // Process accumulated audio when we have enough data
      this.processAudioBuffer();

    } catch (error) {
      console.error('Error processing audio data:', error);
    }
  }

  /**
   * Process accumulated audio buffer
   */
  private processAudioBuffer(): void {
    // Process audio when we have at least 500ms worth of data
    const targetBufferSize = (this.streamMetadata?.mediaFormat.sampleRate || 8000) * 0.5; // 500ms
    const currentBufferSize = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);

    if (currentBufferSize >= targetBufferSize) {
      const audioData = Buffer.concat(this.audioBuffer);
      this.audioBuffer = []; // Clear buffer

      // Emit processed audio for STT
      this.emit('audioReady', {
        audioData,
        sampleRate: this.streamMetadata?.mediaFormat.sampleRate || 8000,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Send audio data back to Twilio (for TTS responses)
   */
  sendAudio(audioBuffer: Buffer, contentType: string = 'audio/x-mulaw'): boolean {
    if (!this.ws || !this.isConnected) {
      console.error('Cannot send audio: WebSocket not connected');
      return false;
    }

    try {
      // Convert audio buffer to base64
      const payload = audioBuffer.toString('base64');
      
      const message = {
        event: 'media',
        streamSid: this.streamMetadata?.streamSid,
        media: {
          contentType,
          payload,
        },
      };

      this.ws.send(JSON.stringify(message));
      return true;

    } catch (error) {
      console.error('Error sending audio:', error);
      return false;
    }
  }

  /**
   * Send a mark message to Twilio (for synchronization)
   */
  sendMark(name: string): boolean {
    if (!this.ws || !this.isConnected) {
      console.error('Cannot send mark: WebSocket not connected');
      return false;
    }

    try {
      const message = {
        event: 'mark',
        streamSid: this.streamMetadata?.streamSid,
        mark: {
          name,
        },
      };

      this.ws.send(JSON.stringify(message));
      return true;

    } catch (error) {
      console.error('Error sending mark:', error);
      return false;
    }
  }

  /**
   * Clear audio buffer
   */
  clearBuffer(): void {
    this.audioBuffer = [];
    console.log('Audio buffer cleared');
  }

  /**
   * Get current stream metadata
   */
  getStreamMetadata(): StreamMetadata | null {
    return this.streamMetadata;
  }

  /**
   * Check if stream is connected
   */
  isStreamConnected(): boolean {
    return this.isConnected && this.streamMetadata !== null;
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
    }
    this.cleanup();
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.audioBuffer = [];
    this.streamMetadata = null;
    this.sequenceNumber = 0;
    this.isConnected = false;
    this.removeAllListeners();
  }
}

/**
 * Audio format conversion utilities
 */
export class AudioConverter {
  /**
   * Convert audio buffer to different format/sample rate
   */
  static convertFormat(
    inputBuffer: Buffer,
    inputSampleRate: number,
    outputSampleRate: number,
    inputFormat: string = 'mulaw',
    outputFormat: string = 'pcm'
  ): Buffer {
    // Basic format conversion (would need more sophisticated conversion for production)
    // For now, return the input buffer (Twilio uses mulaw at 8kHz)
    console.log(`Audio conversion: ${inputFormat}@${inputSampleRate}Hz -> ${outputFormat}@${outputSampleRate}Hz`);
    return inputBuffer;
  }

  /**
   * Resample audio buffer
   */
  static resample(inputBuffer: Buffer, inputRate: number, outputRate: number): Buffer {
    if (inputRate === outputRate) {
      return inputBuffer;
    }

    // Simple resampling (linear interpolation)
    // For production, would use more sophisticated resampling algorithms
    const ratio = outputRate / inputRate;
    const outputLength = Math.floor(inputBuffer.length * ratio);
    const outputBuffer = Buffer.alloc(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i / ratio;
      const sourceIndexFloor = Math.floor(sourceIndex);
      const sourceIndexCeil = Math.min(sourceIndexFloor + 1, inputBuffer.length - 1);
      
      // Linear interpolation
      const fraction = sourceIndex - sourceIndexFloor;
      const sample1 = inputBuffer[sourceIndexFloor];
      const sample2 = inputBuffer[sourceIndexCeil];
      
      outputBuffer[i] = Math.round(sample1 * (1 - fraction) + sample2 * fraction);
    }

    return outputBuffer;
  }
}

/**
 * Audio buffer utilities
 */
export class AudioBuffer {
  private chunks: Buffer[] = [];
  private maxSize: number;
  private currentSize = 0;

  constructor(maxSizeBytes: number = 64000) { // ~4 seconds at 8kHz mulaw
    this.maxSize = maxSizeBytes;
  }

  /**
   * Add audio chunk to buffer
   */
  addChunk(chunk: Buffer): void {
    this.chunks.push(chunk);
    this.currentSize += chunk.length;

    // Remove old chunks if buffer is too large
    while (this.currentSize > this.maxSize && this.chunks.length > 0) {
      const removedChunk = this.chunks.shift();
      if (removedChunk) {
        this.currentSize -= removedChunk.length;
      }
    }
  }

  /**
   * Get all audio data as single buffer
   */
  getBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }

  /**
   * Get buffer size in bytes
   */
  getSize(): number {
    return this.currentSize;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.chunks = [];
    this.currentSize = 0;
  }

  /**
   * Get duration in seconds (assuming 8kHz mulaw)
   */
  getDuration(sampleRate: number = 8000): number {
    return this.currentSize / sampleRate;
  }
}
