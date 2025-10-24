/**
 * Audio Format Converter
 * Converts μ-law audio to WAV format for Whisper API
 */

const mulaw = require('alawmulaw');

/**
 * Convert μ-law buffer to WAV format
 * Uses proven library for accurate decoding
 * 
 * @param mulawBuffer - Raw μ-law audio data from Twilio
 * @returns WAV file as Buffer
 */
export function mulawToWav(mulawBuffer: Buffer): Buffer {
  // Decode μ-law to PCM16 using proven library
  const pcmArray = mulaw.mulaw.decode(mulawBuffer);
  const pcmBuffer = Buffer.from(pcmArray);
  
  // Create WAV header (44 bytes) + PCM data
  const wavBuffer = Buffer.alloc(44 + pcmBuffer.length);
  
  // RIFF chunk descriptor
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + pcmBuffer.length, 4); // File size - 8
  wavBuffer.write('WAVE', 8);
  
  // fmt sub-chunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);      // Subchunk size (PCM = 16)
  wavBuffer.writeUInt16LE(1, 20);       // Audio format (1 = PCM)
  wavBuffer.writeUInt16LE(1, 22);       // Number of channels (1 = mono)
  wavBuffer.writeUInt32LE(8000, 24);    // Sample rate (8000 Hz)
  wavBuffer.writeUInt32LE(16000, 28);   // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
  wavBuffer.writeUInt16LE(2, 32);       // Block align (NumChannels * BitsPerSample/8)
  wavBuffer.writeUInt16LE(16, 34);      // Bits per sample (16-bit)
  
  // data sub-chunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(pcmBuffer.length, 40); // Data size
  
  // Copy PCM data
  pcmBuffer.copy(wavBuffer, 44);
  
  return wavBuffer;
}

/**
 * Validate audio buffer size
 * Ensures buffer is within acceptable range for STT
 */
export function validateAudioSize(buffer: Buffer): {
  valid: boolean;
  reason?: string;
  durationMs?: number;
} {
  const MIN_SIZE = 1600;  // ~200ms at 8kHz
  const MAX_SIZE = 80000; // ~10s at 8kHz
  
  const size = buffer.length;
  const durationMs = (size / 8000) * 1000;
  
  if (size < MIN_SIZE) {
    return {
      valid: false,
      reason: 'Audio too short',
      durationMs
    };
  }
  
  if (size > MAX_SIZE) {
    return {
      valid: false,
      reason: 'Audio too long',
      durationMs
    };
  }
  
  return {
    valid: true,
    durationMs
  };
}
