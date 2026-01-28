/**
 * WebSocket Audio Recorder
 * Combines inbound and outbound audio tracks from Twilio Media Streams
 * into a single audio file for call recording
 */

import { logger } from '../../lib/logger';

/**
 * Twilio Media Streams audio format:
 * - Encoding: μ-law (PCMU)
 * - Sample Rate: 8000 Hz
 * - Channels: 1 (mono) per track
 * - Payload: Base64 encoded, 20ms chunks (160 bytes each)
 */

export interface AudioTracks {
  inbound: Buffer[];
  outbound: Buffer[];
}

/**
 * Mix two audio tracks into stereo (inbound=left, outbound=right)
 * This preserves both sides of the conversation in separate channels
 */
export function mixAudioTracks(tracks: AudioTracks): Buffer {
  const { inbound, outbound } = tracks;
  
  logger.info('🎵 Mixing audio tracks', {
    inboundChunks: inbound.length,
    outboundChunks: outbound.length,
    type: 'audio_mix_start'
  });
  
  // Concatenate all chunks for each track
  const inboundBuffer = Buffer.concat(inbound);
  const outboundBuffer = Buffer.concat(outbound);
  
  // Pad the shorter buffer with silence (0x00 for μ-law)
  const maxLength = Math.max(inboundBuffer.length, outboundBuffer.length);
  const paddedInbound = Buffer.alloc(maxLength, 0x7F); // μ-law silence
  const paddedOutbound = Buffer.alloc(maxLength, 0x7F);
  
  inboundBuffer.copy(paddedInbound);
  outboundBuffer.copy(paddedOutbound);
  
  // Interleave samples for stereo: [L, R, L, R, L, R, ...]
  const stereoBuffer = Buffer.alloc(maxLength * 2);
  for (let i = 0; i < maxLength; i++) {
    stereoBuffer[i * 2] = paddedInbound[i];     // Left channel (inbound/caller)
    stereoBuffer[i * 2 + 1] = paddedOutbound[i]; // Right channel (outbound/bot)
  }
  
  logger.info('✅ Audio tracks mixed', {
    inboundSize: inboundBuffer.length,
    outboundSize: outboundBuffer.length,
    stereoSize: stereoBuffer.length,
    type: 'audio_mix_complete'
  });
  
  return stereoBuffer;
}

/**
 * Create a WAV file header for the audio data
 * Format: μ-law, 8000 Hz, 2 channels (stereo)
 */
export function createWavHeader(audioDataLength: number): Buffer {
  const numChannels = 2; // Stereo
  const sampleRate = 8000; // 8 kHz
  const bitsPerSample = 8; // μ-law is 8-bit
  const audioFormat = 7; // μ-law (WAVE_FORMAT_MULAW)
  
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  
  const header = Buffer.alloc(58); // WAV header with fact chunk for non-PCM
  
  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(audioDataLength + 50, 4); // File size - 8
  header.write('WAVE', 8);
  
  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(18, 16); // fmt chunk size (18 for non-PCM)
  header.writeUInt16LE(audioFormat, 20); // Audio format (7 = μ-law)
  header.writeUInt16LE(numChannels, 22); // Number of channels
  header.writeUInt32LE(sampleRate, 24); // Sample rate
  header.writeUInt32LE(byteRate, 28); // Byte rate
  header.writeUInt16LE(blockAlign, 32); // Block align
  header.writeUInt16LE(bitsPerSample, 34); // Bits per sample
  header.writeUInt16LE(0, 36); // Extra params size
  
  // fact sub-chunk (required for non-PCM)
  header.write('fact', 38);
  header.writeUInt32LE(4, 42); // fact chunk size
  header.writeUInt32LE(audioDataLength / blockAlign, 46); // Sample frames
  
  // data sub-chunk
  header.write('data', 50);
  header.writeUInt32LE(audioDataLength, 54); // Data size
  
  return header;
}

/**
 * Convert audio tracks to a complete WAV file
 */
export function tracksToWav(tracks: AudioTracks): Buffer {
  const mixedAudio = mixAudioTracks(tracks);
  const wavHeader = createWavHeader(mixedAudio.length);
  
  return Buffer.concat([wavHeader, mixedAudio]);
}

/**
 * Get audio statistics
 */
export function getAudioStats(tracks: AudioTracks): {
  inboundChunks: number;
  outboundChunks: number;
  inboundBytes: number;
  outboundBytes: number;
  estimatedDuration: number;
} {
  const inboundBytes = tracks.inbound.reduce((sum, buf) => sum + buf.length, 0);
  const outboundBytes = tracks.outbound.reduce((sum, buf) => sum + buf.length, 0);
  
  // Each chunk is 160 bytes = 20ms of audio
  const inboundDuration = (inboundBytes / 160) * 0.02;
  const outboundDuration = (outboundBytes / 160) * 0.02;
  const estimatedDuration = Math.max(inboundDuration, outboundDuration);
  
  return {
    inboundChunks: tracks.inbound.length,
    outboundChunks: tracks.outbound.length,
    inboundBytes,
    outboundBytes,
    estimatedDuration
  };
}

