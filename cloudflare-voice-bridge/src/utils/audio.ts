/**
 * Audio format conversion utilities
 * Handles μ-law ↔ PCM conversion and sample rate adjustments
 */

import type { AudioChunk, AudioConversionResult, TwilioMediaMessage } from '../types';

/**
 * μ-law to PCM conversion table
 */
const MULAW_TO_PCM: number[] = (() => {
  const table = new Array(256);
  for (let i = 0; i < 256; i++) {
    const sign = (i & 0x80) ? -1 : 1;
    const exponent = (i >> 4) & 0x07;
    const mantissa = i & 0x0F;
    const sample = sign * (33 + 2 * mantissa) * Math.pow(2, exponent + 2) - 33 * sign;
    table[i] = Math.max(-32768, Math.min(32767, sample));
  }
  return table;
})();

/**
 * PCM to μ-law conversion table
 */
const PCM_TO_MULAW: Uint8Array = (() => {
  const table = new Uint8Array(65536);
  for (let i = 0; i < 65536; i++) {
    const sample = i - 32768; // Convert to signed 16-bit
    const sign = sample < 0 ? 0x80 : 0x00;
    const abs = Math.abs(sample);
    
    let exponent = 7;
    for (let exp = 0; exp < 8; exp++) {
      if (abs <= (33 + 2 * 15) * Math.pow(2, exp + 2) - 33) {
        exponent = exp;
        break;
      }
    }
    
    const mantissa = Math.floor((abs - 33) / Math.pow(2, exponent + 2) / 2);
    table[i] = sign | (exponent << 4) | Math.min(15, mantissa);
  }
  return table;
})();

/**
 * Convert μ-law audio to PCM
 */
export function mulawToPcm(mulawData: ArrayBuffer): AudioConversionResult {
  try {
    const input = new Uint8Array(mulawData);
    const output = new Int16Array(input.length);
    
    for (let i = 0; i < input.length; i++) {
      output[i] = MULAW_TO_PCM[input[i]];
    }
    
    return {
      success: true,
      data: output.buffer,
    };
  } catch (error) {
    return {
      success: false,
      error: `μ-law to PCM conversion failed: ${error}`,
    };
  }
}

/**
 * Convert PCM audio to μ-law
 */
export function pcmToMulaw(pcmData: ArrayBuffer): AudioConversionResult {
  try {
    const input = new Int16Array(pcmData);
    const output = new Uint8Array(input.length);
    
    for (let i = 0; i < input.length; i++) {
      const sample = input[i] + 32768; // Convert to unsigned
      output[i] = PCM_TO_MULAW[Math.max(0, Math.min(65535, sample))];
    }
    
    return {
      success: true,
      data: output.buffer,
    };
  } catch (error) {
    return {
      success: false,
      error: `PCM to μ-law conversion failed: ${error}`,
    };
  }
}

/**
 * Resample audio data
 */
export function resampleAudio(
  audioData: ArrayBuffer,
  fromSampleRate: number,
  toSampleRate: number
): AudioConversionResult {
  try {
    if (fromSampleRate === toSampleRate) {
      return { success: true, data: audioData };
    }
    
    const input = new Int16Array(audioData);
    const ratio = toSampleRate / fromSampleRate;
    const outputLength = Math.floor(input.length * ratio);
    const output = new Int16Array(outputLength);
    
    // Simple linear interpolation resampling
    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i / ratio;
      const sourceIndexFloor = Math.floor(sourceIndex);
      const sourceIndexCeil = Math.min(sourceIndexFloor + 1, input.length - 1);
      
      const fraction = sourceIndex - sourceIndexFloor;
      const sample1 = input[sourceIndexFloor] || 0;
      const sample2 = input[sourceIndexCeil] || 0;
      
      output[i] = Math.round(sample1 * (1 - fraction) + sample2 * fraction);
    }
    
    return {
      success: true,
      data: output.buffer,
    };
  } catch (error) {
    return {
      success: false,
      error: `Resampling failed: ${error}`,
    };
  }
}

/**
 * Convert base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binaryString = '';
  
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binaryString);
}

/**
 * Process Twilio audio chunk for ElevenLabs
 */
export function processTwilioAudio(
  base64Payload: string,
  fromEncoding: 'mulaw' | 'pcm' = 'mulaw',
  fromSampleRate: number = 8000,
  toSampleRate: number = 16000
): AudioConversionResult {
  try {
    // Decode base64 to ArrayBuffer
    const audioBuffer = base64ToArrayBuffer(base64Payload);
    
    // Convert μ-law to PCM if needed
    let pcmData: ArrayBuffer;
    if (fromEncoding === 'mulaw') {
      const conversion = mulawToPcm(audioBuffer);
      if (!conversion.success || !conversion.data) {
        return conversion;
      }
      pcmData = conversion.data;
    } else {
      pcmData = audioBuffer;
    }
    
    // Resample if needed
    if (fromSampleRate !== toSampleRate) {
      const resampled = resampleAudio(pcmData, fromSampleRate, toSampleRate);
      if (!resampled.success || !resampled.data) {
        return resampled;
      }
      pcmData = resampled.data;
    }
    
    return {
      success: true,
      data: pcmData,
    };
  } catch (error) {
    return {
      success: false,
      error: `Audio processing failed: ${error}`,
    };
  }
}

/**
 * Process ElevenLabs audio for Twilio
 */
export function processElevenLabsAudio(
  audioData: ArrayBuffer,
  fromSampleRate: number = 16000,
  toEncoding: 'mulaw' | 'pcm' = 'mulaw',
  toSampleRate: number = 8000
): AudioConversionResult {
  try {
    let processedData = audioData;
    
    // Resample if needed
    if (fromSampleRate !== toSampleRate) {
      const resampled = resampleAudio(processedData, fromSampleRate, toSampleRate);
      if (!resampled.success || !resampled.data) {
        return resampled;
      }
      processedData = resampled.data;
    }
    
    // Convert to μ-law if needed
    if (toEncoding === 'mulaw') {
      const conversion = pcmToMulaw(processedData);
      if (!conversion.success || !conversion.data) {
        return conversion;
      }
      processedData = conversion.data;
    }
    
    return {
      success: true,
      data: processedData,
    };
  } catch (error) {
    return {
      success: false,
      error: `ElevenLabs audio processing failed: ${error}`,
    };
  }
}

/**
 * Create audio chunk from Twilio media message
 */
export function createAudioChunk(mediaMessage: TwilioMediaMessage): AudioChunk {
  return {
    data: base64ToArrayBuffer(mediaMessage.media.payload),
    timestamp: parseInt(mediaMessage.media.timestamp),
    sampleRate: 8000, // Twilio default
    encoding: 'mulaw', // Twilio default
  };
}

/**
 * Calculate audio duration in milliseconds
 */
export function calculateAudioDuration(
  audioData: ArrayBuffer,
  sampleRate: number,
  channels: number = 1
): number {
  const samples = audioData.byteLength / 2; // Assuming 16-bit samples
  return (samples / sampleRate / channels) * 1000;
}
