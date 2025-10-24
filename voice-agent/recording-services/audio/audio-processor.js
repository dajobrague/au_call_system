/**
 * Advanced Audio Processor
 * Handles audio format conversion, quality enhancement, and stream processing
 */

class AudioProcessor {
  constructor() {
    this.sampleRate = 8000; // Twilio standard
    this.bitsPerSample = 16;
    this.channels = 1; // Mono
    this.frameSize = 160; // 20ms at 8kHz
  }

  /**
   * Enhanced μ-law to PCM16 conversion with noise reduction
   */
  mulawToPCM16Enhanced(mulawBuffer) {
    if (!mulawBuffer || mulawBuffer.length === 0) {
      return null;
    }

    const pcmBuffer = new Int16Array(mulawBuffer.length);
    const mulawTable = this.generateMulawTable();
    
    // Convert with lookup table for better performance
    for (let i = 0; i < mulawBuffer.length; i++) {
      pcmBuffer[i] = mulawTable[mulawBuffer[i]];
    }

    // Apply simple noise gate
    return this.applyNoiseGate(pcmBuffer);
  }

  /**
   * Generate μ-law to linear conversion table
   */
  generateMulawTable() {
    const table = new Int16Array(256);
    
    for (let i = 0; i < 256; i++) {
      const mulaw = i;
      const sign = mulaw & 0x80 ? -1 : 1;
      const exponent = (mulaw & 0x70) >> 4;
      const mantissa = mulaw & 0x0F;
      
      let linear = (33 + 2 * mantissa) * Math.pow(2, exponent + 2) - 33;
      table[i] = sign * Math.min(32767, Math.max(-32768, linear));
    }
    
    return table;
  }

  /**
   * Apply noise gate to reduce background noise
   */
  applyNoiseGate(pcmBuffer, threshold = 500) {
    const processed = new Int16Array(pcmBuffer.length);
    
    for (let i = 0; i < pcmBuffer.length; i++) {
      const sample = Math.abs(pcmBuffer[i]);
      processed[i] = sample > threshold ? pcmBuffer[i] : 0;
    }
    
    return processed;
  }

  /**
   * Detect voice activity in audio buffer
   */
  detectVoiceActivity(pcmBuffer, windowSize = 160) {
    if (!pcmBuffer || pcmBuffer.length < windowSize) {
      return { hasVoice: false, energy: 0, confidence: 0 };
    }

    let totalEnergy = 0;
    let peakLevel = 0;
    let zeroCrossings = 0;
    
    // Calculate energy and zero crossings
    for (let i = 0; i < pcmBuffer.length; i++) {
      const sample = Math.abs(pcmBuffer[i]);
      totalEnergy += sample * sample;
      peakLevel = Math.max(peakLevel, sample);
      
      // Count zero crossings (indicator of speech vs noise)
      if (i > 0 && 
          ((pcmBuffer[i-1] >= 0 && pcmBuffer[i] < 0) || 
           (pcmBuffer[i-1] < 0 && pcmBuffer[i] >= 0))) {
        zeroCrossings++;
      }
    }

    const avgEnergy = totalEnergy / pcmBuffer.length;
    const zeroCrossingRate = zeroCrossings / pcmBuffer.length;

    // Voice activity detection thresholds
    const energyThreshold = 1000000; // Adjust based on testing
    const zcThreshold = 0.1; // Zero crossing rate threshold
    
    const hasVoice = avgEnergy > energyThreshold && 
                     zeroCrossingRate > zcThreshold && 
                     peakLevel > 1000;

    const confidence = Math.min(1.0, avgEnergy / (energyThreshold * 2));

    return {
      hasVoice,
      energy: avgEnergy,
      peakLevel,
      zeroCrossingRate,
      confidence
    };
  }

  /**
   * Create enhanced WAV header with proper metadata
   */
  createWavHeader(dataSize, metadata = {}) {
    const header = Buffer.alloc(44);
    
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    
    // Format chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // PCM format chunk size
    header.writeUInt16LE(1, 20);  // PCM format
    header.writeUInt16LE(this.channels, 22);
    header.writeUInt32LE(this.sampleRate, 24);
    header.writeUInt32LE(this.sampleRate * this.channels * (this.bitsPerSample / 8), 28);
    header.writeUInt16LE(this.channels * (this.bitsPerSample / 8), 32);
    header.writeUInt16LE(this.bitsPerSample, 34);
    
    // Data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    return header;
  }

  /**
   * Convert PCM buffer to WAV with enhanced quality
   */
  pcmToWav(pcmBuffer, metadata = {}) {
    if (!pcmBuffer || pcmBuffer.length === 0) {
      return null;
    }

    const dataSize = pcmBuffer.length * 2; // 16-bit samples
    const header = this.createWavHeader(dataSize, metadata);
    const wavBuffer = Buffer.alloc(44 + dataSize);
    
    // Copy header
    header.copy(wavBuffer, 0);
    
    // Copy PCM data
    for (let i = 0; i < pcmBuffer.length; i++) {
      wavBuffer.writeInt16LE(pcmBuffer[i], 44 + i * 2);
    }
    
    return wavBuffer;
  }

  /**
   * Mix multiple audio tracks
   */
  mixAudioTracks(tracks, weights = null) {
    if (!tracks || tracks.length === 0) {
      return null;
    }

    if (tracks.length === 1) {
      return tracks[0];
    }

    // Find the longest track
    const maxLength = Math.max(...tracks.map(track => track.length));
    const mixed = new Int16Array(maxLength);
    
    // Default equal weights
    const trackWeights = weights || tracks.map(() => 1.0 / tracks.length);
    
    for (let i = 0; i < maxLength; i++) {
      let sample = 0;
      
      for (let t = 0; t < tracks.length; t++) {
        if (i < tracks[t].length) {
          sample += tracks[t][i] * trackWeights[t];
        }
      }
      
      // Clamp to prevent overflow
      mixed[i] = Math.max(-32768, Math.min(32767, Math.round(sample)));
    }
    
    return mixed;
  }

  /**
   * Apply audio normalization
   */
  normalizeAudio(pcmBuffer, targetLevel = 0.8) {
    if (!pcmBuffer || pcmBuffer.length === 0) {
      return pcmBuffer;
    }

    // Find peak level
    let peak = 0;
    for (let i = 0; i < pcmBuffer.length; i++) {
      peak = Math.max(peak, Math.abs(pcmBuffer[i]));
    }

    if (peak === 0) {
      return pcmBuffer;
    }

    // Calculate normalization factor
    const targetPeak = 32767 * targetLevel;
    const factor = targetPeak / peak;
    
    // Apply normalization
    const normalized = new Int16Array(pcmBuffer.length);
    for (let i = 0; i < pcmBuffer.length; i++) {
      normalized[i] = Math.max(-32768, Math.min(32767, Math.round(pcmBuffer[i] * factor)));
    }

    return normalized;
  }

  /**
   * Split audio into segments for analysis
   */
  segmentAudio(pcmBuffer, segmentDuration = 1000) {
    const samplesPerSegment = Math.floor((this.sampleRate * segmentDuration) / 1000);
    const segments = [];
    
    for (let i = 0; i < pcmBuffer.length; i += samplesPerSegment) {
      const end = Math.min(i + samplesPerSegment, pcmBuffer.length);
      const segment = pcmBuffer.slice(i, end);
      
      segments.push({
        startTime: (i / this.sampleRate) * 1000,
        duration: ((end - i) / this.sampleRate) * 1000,
        samples: segment,
        voiceActivity: this.detectVoiceActivity(segment)
      });
    }
    
    return segments;
  }

  /**
   * Generate audio statistics
   */
  generateAudioStats(pcmBuffer) {
    if (!pcmBuffer || pcmBuffer.length === 0) {
      return null;
    }

    let sum = 0;
    let sumSquares = 0;
    let peak = 0;
    let silentSamples = 0;
    const silenceThreshold = 100;

    for (let i = 0; i < pcmBuffer.length; i++) {
      const sample = Math.abs(pcmBuffer[i]);
      sum += sample;
      sumSquares += sample * sample;
      peak = Math.max(peak, sample);
      
      if (sample < silenceThreshold) {
        silentSamples++;
      }
    }

    const mean = sum / pcmBuffer.length;
    const rms = Math.sqrt(sumSquares / pcmBuffer.length);
    const silencePercentage = (silentSamples / pcmBuffer.length) * 100;
    
    return {
      duration: (pcmBuffer.length / this.sampleRate) * 1000, // ms
      samples: pcmBuffer.length,
      peak,
      mean,
      rms,
      silencePercentage,
      dynamicRange: peak > 0 ? 20 * Math.log10(peak / (mean || 1)) : 0
    };
  }

  /**
   * Compress audio for storage optimization
   */
  compressAudio(pcmBuffer, compressionRatio = 0.8) {
    if (!pcmBuffer || pcmBuffer.length === 0) {
      return pcmBuffer;
    }

    // Simple dynamic range compression
    const threshold = 16384; // 50% of max
    const ratio = compressionRatio;
    
    const compressed = new Int16Array(pcmBuffer.length);
    
    for (let i = 0; i < pcmBuffer.length; i++) {
      const sample = pcmBuffer[i];
      const absSample = Math.abs(sample);
      
      if (absSample > threshold) {
        const excess = absSample - threshold;
        const compressedExcess = excess * ratio;
        const newSample = threshold + compressedExcess;
        compressed[i] = sample >= 0 ? newSample : -newSample;
      } else {
        compressed[i] = sample;
      }
    }
    
    return compressed;
  }
}

// Create singleton instance
const audioProcessor = new AudioProcessor();

module.exports = {
  AudioProcessor,
  audioProcessor
};
