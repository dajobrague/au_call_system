/**
 * Advanced Stream Buffer Manager
 * Handles audio buffering, streaming, and memory optimization for long calls
 */

const { audioProcessor } = require('./audio-processor');

class StreamBuffer {
  constructor(callSid, options = {}) {
    this.callSid = callSid;
    this.options = {
      maxBufferSize: options.maxBufferSize || 5 * 1024 * 1024, // 5MB
      flushThreshold: options.flushThreshold || 1 * 1024 * 1024, // 1MB
      segmentDuration: options.segmentDuration || 30000, // 30 seconds
      enableVAD: options.enableVAD || true, // Voice Activity Detection
      enableCompression: options.enableCompression || true,
      ...options
    };

    // Audio buffers
    this.inboundBuffer = Buffer.alloc(0);
    this.outboundBuffer = Buffer.alloc(0);
    this.mixedBuffer = Buffer.alloc(0);
    
    // Buffer management
    this.totalBytesReceived = 0;
    this.totalChunks = 0;
    this.lastFlushTime = Date.now();
    this.segments = [];
    
    // Voice activity tracking
    this.voiceActivityStats = {
      totalSpeechTime: 0,
      totalSilenceTime: 0,
      speechSegments: 0,
      lastActivity: null
    };

    // Performance metrics
    this.metrics = {
      bufferOverflows: 0,
      compressionRatio: 0,
      averageChunkSize: 0,
      processingTime: 0
    };

    console.log(`📦 Stream buffer initialized for call ${callSid}`);
  }

  /**
   * Add audio chunk to appropriate buffer
   */
  addChunk(audioData, track = 'mixed', timestamp = null) {
    const startTime = Date.now();
    
    try {
      // Convert base64 to buffer if needed
      let buffer;
      if (typeof audioData === 'string') {
        buffer = Buffer.from(audioData, 'base64');
      } else if (Buffer.isBuffer(audioData)) {
        buffer = audioData;
      } else {
        console.warn(`⚠️ Invalid audio data type for call ${this.callSid}`);
        return false;
      }

      // Add to appropriate buffer
      switch (track) {
        case 'inbound':
          this.inboundBuffer = Buffer.concat([this.inboundBuffer, buffer]);
          break;
        case 'outbound':
          this.outboundBuffer = Buffer.concat([this.outboundBuffer, buffer]);
          break;
        case 'mixed':
        default:
          this.mixedBuffer = Buffer.concat([this.mixedBuffer, buffer]);
          break;
      }

      // Update statistics
      this.totalBytesReceived += buffer.length;
      this.totalChunks++;
      this.metrics.averageChunkSize = this.totalBytesReceived / this.totalChunks;

      // Process voice activity if enabled
      if (this.options.enableVAD && track !== 'outbound') {
        this.processVoiceActivity(buffer, timestamp);
      }

      // Check if we need to flush to prevent memory overflow
      if (this.shouldFlush()) {
        this.flushToSegment();
      }

      // Update processing time metric
      this.metrics.processingTime += Date.now() - startTime;
      return true;

    } catch (error) {
      console.error(`❌ Error adding chunk to buffer for ${this.callSid}:`, error);
      return false;
    }
  }

  /**
   * Process voice activity detection
   */
  processVoiceActivity(audioBuffer, timestamp) {
    try {
      // Convert μ-law to PCM for analysis
      const pcmBuffer = audioProcessor.mulawToPCM16Enhanced(new Uint8Array(audioBuffer));
      if (!pcmBuffer) return;

      // Detect voice activity
      const vad = audioProcessor.detectVoiceActivity(pcmBuffer);
      const now = timestamp || Date.now();
      const duration = (pcmBuffer.length / 8000) * 1000; // Duration in ms

      if (vad.hasVoice) {
        this.voiceActivityStats.totalSpeechTime += duration;
        this.voiceActivityStats.speechSegments++;
        this.voiceActivityStats.lastActivity = now;
      } else {
        this.voiceActivityStats.totalSilenceTime += duration;
      }

    } catch (error) {
      console.error(`❌ VAD processing error for ${this.callSid}:`, error);
    }
  }

  /**
   * Check if buffer should be flushed
   */
  shouldFlush() {
    const totalSize = this.inboundBuffer.length + this.outboundBuffer.length + this.mixedBuffer.length;
    const timeSinceLastFlush = Date.now() - this.lastFlushTime;
    
    return totalSize >= this.options.flushThreshold || 
           timeSinceLastFlush >= this.options.segmentDuration;
  }

  /**
   * Flush current buffers to a segment
   */
  flushToSegment() {
    try {
      const timestamp = Date.now();
      
      // Create segment data
      const segment = {
        id: this.segments.length + 1,
        timestamp,
        duration: timestamp - this.lastFlushTime,
        buffers: {
          inbound: this.inboundBuffer.length > 0 ? Buffer.from(this.inboundBuffer) : null,
          outbound: this.outboundBuffer.length > 0 ? Buffer.from(this.outboundBuffer) : null,
          mixed: this.mixedBuffer.length > 0 ? Buffer.from(this.mixedBuffer) : null
        },
        stats: {
          totalBytes: this.inboundBuffer.length + this.outboundBuffer.length + this.mixedBuffer.length,
          chunks: this.totalChunks - (this.segments.length > 0 ? this.segments[this.segments.length - 1].totalChunks : 0),
          voiceActivity: { ...this.voiceActivityStats }
        },
        totalChunks: this.totalChunks
      };

      // Process and compress audio if enabled
      if (this.options.enableCompression) {
        segment.buffers = this.compressSegmentBuffers(segment.buffers);
      }

      this.segments.push(segment);

      // Clear current buffers
      this.inboundBuffer = Buffer.alloc(0);
      this.outboundBuffer = Buffer.alloc(0);
      this.mixedBuffer = Buffer.alloc(0);
      this.lastFlushTime = timestamp;

      console.log(`📦 Flushed segment ${segment.id} for call ${this.callSid} (${segment.stats.totalBytes} bytes)`);

      // Check for memory pressure
      if (this.segments.length > 10) {
        this.compactOldSegments();
      }

    } catch (error) {
      console.error(`❌ Error flushing segment for ${this.callSid}:`, error);
    }
  }

  /**
   * Compress segment buffers
   */
  compressSegmentBuffers(buffers) {
    const compressed = {};
    
    for (const [track, buffer] of Object.entries(buffers)) {
      if (buffer && buffer.length > 0) {
        try {
          // Convert to PCM, compress, then back to buffer
          const pcmBuffer = audioProcessor.mulawToPCM16Enhanced(new Uint8Array(buffer));
          if (pcmBuffer) {
            const compressedPCM = audioProcessor.compressAudio(pcmBuffer, 0.8);
            const wavBuffer = audioProcessor.pcmToWav(compressedPCM);
            compressed[track] = wavBuffer;
          } else {
            compressed[track] = buffer; // Keep original if conversion fails
          }
        } catch (error) {
          console.error(`❌ Compression error for ${track}:`, error);
          compressed[track] = buffer; // Keep original on error
        }
      }
    }
    
    return compressed;
  }

  /**
   * Compact old segments to save memory
   */
  compactOldSegments() {
    try {
      // Keep only the last 5 segments in memory, archive the rest
      const keepCount = 5;
      
      if (this.segments.length > keepCount) {
        const toArchive = this.segments.splice(0, this.segments.length - keepCount);
        
        // In a full implementation, these would be streamed to S3
        console.log(`📦 Archived ${toArchive.length} old segments for call ${this.callSid}`);
        
        // Update metrics
        this.metrics.bufferOverflows++;
      }
    } catch (error) {
      console.error(`❌ Error compacting segments for ${this.callSid}:`, error);
    }
  }

  /**
   * Get all audio data as consolidated buffers
   */
  getAllAudioData() {
    try {
      // First flush any remaining data
      if (this.mixedBuffer.length > 0 || this.inboundBuffer.length > 0 || this.outboundBuffer.length > 0) {
        this.flushToSegment();
      }

      // Consolidate all segments
      const consolidated = {
        mixed: Buffer.alloc(0),
        inbound: Buffer.alloc(0),
        outbound: Buffer.alloc(0)
      };

      for (const segment of this.segments) {
        if (segment.buffers.mixed) {
          consolidated.mixed = Buffer.concat([consolidated.mixed, segment.buffers.mixed]);
        }
        if (segment.buffers.inbound) {
          consolidated.inbound = Buffer.concat([consolidated.inbound, segment.buffers.inbound]);
        }
        if (segment.buffers.outbound) {
          consolidated.outbound = Buffer.concat([consolidated.outbound, segment.buffers.outbound]);
        }
      }

      return consolidated;
    } catch (error) {
      console.error(`❌ Error consolidating audio data for ${this.callSid}:`, error);
      return null;
    }
  }

  /**
   * Convert consolidated audio to WAV format
   */
  getWavData(track = 'mixed') {
    try {
      const audioData = this.getAllAudioData();
      if (!audioData || !audioData[track] || audioData[track].length === 0) {
        return null;
      }

      // Convert μ-law to PCM
      const pcmBuffer = audioProcessor.mulawToPCM16Enhanced(new Uint8Array(audioData[track]));
      if (!pcmBuffer) {
        return null;
      }

      // Apply audio enhancements
      const normalizedPCM = audioProcessor.normalizeAudio(pcmBuffer, 0.8);
      
      // Convert to WAV
      return audioProcessor.pcmToWav(normalizedPCM, {
        callSid: this.callSid,
        track: track,
        totalDuration: this.getTotalDuration(),
        voiceActivity: this.voiceActivityStats
      });

    } catch (error) {
      console.error(`❌ Error converting to WAV for ${this.callSid}:`, error);
      return null;
    }
  }

  /**
   * Get buffer statistics
   */
  getStats() {
    const now = Date.now();
    const totalDuration = this.getTotalDuration();
    
    return {
      callSid: this.callSid,
      totalBytesReceived: this.totalBytesReceived,
      totalChunks: this.totalChunks,
      segments: this.segments.length,
      totalDuration,
      voiceActivity: {
        ...this.voiceActivityStats,
        speechPercentage: totalDuration > 0 ? 
          (this.voiceActivityStats.totalSpeechTime / totalDuration) * 100 : 0
      },
      metrics: {
        ...this.metrics,
        averageProcessingTime: this.totalChunks > 0 ? 
          this.metrics.processingTime / this.totalChunks : 0
      },
      memoryUsage: {
        currentBuffers: this.inboundBuffer.length + this.outboundBuffer.length + this.mixedBuffer.length,
        segmentedData: this.segments.reduce((total, seg) => {
          return total + (seg.buffers.mixed?.length || 0) + 
                        (seg.buffers.inbound?.length || 0) + 
                        (seg.buffers.outbound?.length || 0);
        }, 0)
      }
    };
  }

  /**
   * Get total recording duration
   */
  getTotalDuration() {
    if (this.segments.length === 0) {
      return Date.now() - this.lastFlushTime;
    }
    
    const firstSegment = this.segments[0];
    const lastSegment = this.segments[this.segments.length - 1];
    return lastSegment.timestamp - firstSegment.timestamp + (Date.now() - this.lastFlushTime);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    try {
      // Clear all buffers
      this.inboundBuffer = null;
      this.outboundBuffer = null;
      this.mixedBuffer = null;
      this.segments = [];
      
      console.log(`🧹 Cleaned up stream buffer for call ${this.callSid}`);
    } catch (error) {
      console.error(`❌ Error cleaning up buffer for ${this.callSid}:`, error);
    }
  }
}

module.exports = {
  StreamBuffer
};
