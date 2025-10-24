/**
 * Multi-Track Audio Manager
 * Handles separate inbound/outbound audio track recording and processing
 */

const { StreamBuffer } = require('./stream-buffer');
const { audioProcessor } = require('./audio-processor');

class TrackManager {
  constructor(callSid, options = {}) {
    this.callSid = callSid;
    this.options = {
      separateTracks: options.separateTracks || true,
      enableMixdown: options.enableMixdown || true,
      trackSyncTolerance: options.trackSyncTolerance || 100, // ms
      enableEchoCancellation: options.enableEchoCancellation || false,
      ...options
    };

    // Track buffers
    this.tracks = {
      inbound: new StreamBuffer(callSid + '_inbound', {
        ...options,
        enableVAD: true // Always enable VAD for caller audio
      }),
      outbound: new StreamBuffer(callSid + '_outbound', {
        ...options,
        enableVAD: false // System audio doesn't need VAD
      }),
      mixed: this.options.enableMixdown ? new StreamBuffer(callSid + '_mixed', options) : null
    };

    // Track synchronization
    this.trackSync = {
      inboundTimestamp: null,
      outboundTimestamp: null,
      mixedTimestamp: null,
      offsetCorrection: 0
    };

    // Audio analysis
    this.audioAnalysis = {
      dominantSpeaker: null, // 'caller' or 'system'
      conversationSegments: [],
      interruptionCount: 0,
      averageResponseTime: 0
    };

    console.log(`🎵 Track manager initialized for call ${callSid}`);
  }

  /**
   * Add audio data to specific track
   */
  addAudioData(audioData, track, timestamp = null) {
    try {
      const now = timestamp || Date.now();
      
      // Update track timestamps for sync
      this.updateTrackTimestamp(track, now);
      
      // Add to appropriate track buffer
      if (this.tracks[track]) {
        const success = this.tracks[track].addChunk(audioData, track, now);
        
        if (success && this.options.enableMixdown && track !== 'mixed') {
          // Also add to mixed track for consolidated recording
          if (this.tracks.mixed) {
            this.tracks.mixed.addChunk(audioData, 'mixed', now);
          }
        }
        
        // Analyze conversation patterns
        if (track === 'inbound') {
          this.analyzeCallerAudio(audioData, now);
        } else if (track === 'outbound') {
          this.analyzeSystemAudio(audioData, now);
        }
        
        return success;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Error adding audio to track ${track} for ${this.callSid}:`, error);
      return false;
    }
  }

  /**
   * Update track timestamp for synchronization
   */
  updateTrackTimestamp(track, timestamp) {
    switch (track) {
      case 'inbound':
        if (!this.trackSync.inboundTimestamp) {
          this.trackSync.inboundTimestamp = timestamp;
        }
        break;
      case 'outbound':
        if (!this.trackSync.outboundTimestamp) {
          this.trackSync.outboundTimestamp = timestamp;
        }
        break;
      case 'mixed':
        if (!this.trackSync.mixedTimestamp) {
          this.trackSync.mixedTimestamp = timestamp;
        }
        break;
    }
  }

  /**
   * Analyze caller audio for conversation patterns
   */
  analyzeCallerAudio(audioData, timestamp) {
    try {
      // Convert to PCM for analysis
      const buffer = typeof audioData === 'string' ? 
        Buffer.from(audioData, 'base64') : audioData;
      const pcmBuffer = audioProcessor.mulawToPCM16Enhanced(new Uint8Array(buffer));
      
      if (!pcmBuffer) return;
      
      // Detect voice activity
      const vad = audioProcessor.detectVoiceActivity(pcmBuffer);
      
      if (vad.hasVoice) {
        // Check for interruptions (caller speaking while system is speaking)
        const recentSystemActivity = this.hasRecentSystemActivity(timestamp, 500); // 500ms window
        
        if (recentSystemActivity) {
          this.audioAnalysis.interruptionCount++;
          console.log(`🗣️ Interruption detected in call ${this.callSid} (count: ${this.audioAnalysis.interruptionCount})`);
        }
        
        // Update dominant speaker analysis
        this.updateDominantSpeaker('caller', timestamp, vad.confidence);
        
        // Track conversation segments
        this.trackConversationSegment('caller', timestamp, vad);
      }
    } catch (error) {
      console.error(`❌ Error analyzing caller audio for ${this.callSid}:`, error);
    }
  }

  /**
   * Analyze system audio for conversation patterns
   */
  analyzeSystemAudio(audioData, timestamp) {
    try {
      // Convert to PCM for analysis
      const buffer = typeof audioData === 'string' ? 
        Buffer.from(audioData, 'base64') : audioData;
      const pcmBuffer = audioProcessor.mulawToPCM16Enhanced(new Uint8Array(buffer));
      
      if (!pcmBuffer) return;
      
      // Detect voice activity (for TTS/system responses)
      const vad = audioProcessor.detectVoiceActivity(pcmBuffer);
      
      if (vad.hasVoice) {
        // Update dominant speaker analysis
        this.updateDominantSpeaker('system', timestamp, vad.confidence);
        
        // Track conversation segments
        this.trackConversationSegment('system', timestamp, vad);
      }
    } catch (error) {
      console.error(`❌ Error analyzing system audio for ${this.callSid}:`, error);
    }
  }

  /**
   * Check if system had recent audio activity
   */
  hasRecentSystemActivity(timestamp, windowMs) {
    const cutoff = timestamp - windowMs;
    
    return this.audioAnalysis.conversationSegments.some(segment => 
      segment.speaker === 'system' && 
      segment.endTime > cutoff && 
      segment.startTime < timestamp
    );
  }

  /**
   * Update dominant speaker analysis
   */
  updateDominantSpeaker(speaker, timestamp, confidence) {
    // Simple algorithm: track total speaking time
    const segment = this.audioAnalysis.conversationSegments
      .filter(s => s.speaker === speaker)
      .reduce((total, s) => total + (s.endTime - s.startTime), 0);
    
    const totalTime = timestamp - (this.trackSync.inboundTimestamp || this.trackSync.mixedTimestamp || timestamp);
    
    if (totalTime > 0) {
      const speakerPercentage = segment / totalTime;
      
      if (speaker === 'caller' && speakerPercentage > 0.6) {
        this.audioAnalysis.dominantSpeaker = 'caller';
      } else if (speaker === 'system' && speakerPercentage > 0.6) {
        this.audioAnalysis.dominantSpeaker = 'system';
      }
    }
  }

  /**
   * Track conversation segments
   */
  trackConversationSegment(speaker, timestamp, vadInfo) {
    const lastSegment = this.audioAnalysis.conversationSegments
      .filter(s => s.speaker === speaker)
      .pop();
    
    const segmentGap = 200; // ms - gap to consider same segment
    
    if (lastSegment && (timestamp - lastSegment.endTime) < segmentGap) {
      // Extend existing segment
      lastSegment.endTime = timestamp;
      lastSegment.confidence = Math.max(lastSegment.confidence, vadInfo.confidence);
    } else {
      // Create new segment
      this.audioAnalysis.conversationSegments.push({
        speaker,
        startTime: timestamp,
        endTime: timestamp,
        confidence: vadInfo.confidence,
        energy: vadInfo.energy
      });
    }
    
    // Limit segment history to prevent memory growth
    if (this.audioAnalysis.conversationSegments.length > 1000) {
      this.audioAnalysis.conversationSegments = 
        this.audioAnalysis.conversationSegments.slice(-500);
    }
  }

  /**
   * Synchronize tracks for mixed output
   */
  synchronizeTracks() {
    try {
      // Calculate time offsets between tracks
      const inboundStart = this.trackSync.inboundTimestamp;
      const outboundStart = this.trackSync.outboundTimestamp;
      
      if (inboundStart && outboundStart) {
        const offset = Math.abs(inboundStart - outboundStart);
        
        if (offset > this.options.trackSyncTolerance) {
          this.trackSync.offsetCorrection = offset;
          console.log(`🔄 Track sync offset detected: ${offset}ms for call ${this.callSid}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error synchronizing tracks for ${this.callSid}:`, error);
    }
  }

  /**
   * Get audio data for specific track
   */
  getTrackAudio(track = 'mixed') {
    try {
      if (!this.tracks[track]) {
        console.warn(`⚠️ Track ${track} not found for call ${this.callSid}`);
        return null;
      }
      
      return this.tracks[track].getWavData(track);
    } catch (error) {
      console.error(`❌ Error getting track audio ${track} for ${this.callSid}:`, error);
      return null;
    }
  }

  /**
   * Get mixed audio with proper track balancing
   */
  getMixedAudio(inboundWeight = 1.0, outboundWeight = 1.0) {
    try {
      // Get individual track data
      const inboundData = this.tracks.inbound ? this.tracks.inbound.getAllAudioData() : null;
      const outboundData = this.tracks.outbound ? this.tracks.outbound.getAllAudioData() : null;
      
      if (!inboundData && !outboundData) {
        return null;
      }
      
      // If we have mixed track, use it
      if (this.tracks.mixed) {
        return this.tracks.mixed.getWavData('mixed');
      }
      
      // Otherwise, mix the tracks manually
      const tracks = [];
      const weights = [];
      
      if (inboundData && inboundData.inbound && inboundData.inbound.length > 0) {
        const pcm = audioProcessor.mulawToPCM16Enhanced(new Uint8Array(inboundData.inbound));
        if (pcm) {
          tracks.push(pcm);
          weights.push(inboundWeight);
        }
      }
      
      if (outboundData && outboundData.outbound && outboundData.outbound.length > 0) {
        const pcm = audioProcessor.mulawToPCM16Enhanced(new Uint8Array(outboundData.outbound));
        if (pcm) {
          tracks.push(pcm);
          weights.push(outboundWeight);
        }
      }
      
      if (tracks.length === 0) {
        return null;
      }
      
      // Mix tracks
      const mixedPCM = audioProcessor.mixAudioTracks(tracks, weights);
      const normalizedPCM = audioProcessor.normalizeAudio(mixedPCM, 0.8);
      
      return audioProcessor.pcmToWav(normalizedPCM, {
        callSid: this.callSid,
        track: 'mixed',
        inboundWeight,
        outboundWeight
      });
      
    } catch (error) {
      console.error(`❌ Error creating mixed audio for ${this.callSid}:`, error);
      return null;
    }
  }

  /**
   * Get comprehensive track statistics
   */
  getTrackStats() {
    try {
      const stats = {
        callSid: this.callSid,
        tracks: {},
        sync: this.trackSync,
        analysis: this.audioAnalysis,
        totalDuration: 0
      };
      
      // Get stats for each track
      for (const [trackName, track] of Object.entries(this.tracks)) {
        if (track) {
          const trackStats = track.getStats();
          stats.tracks[trackName] = trackStats;
          stats.totalDuration = Math.max(stats.totalDuration, trackStats.totalDuration);
        }
      }
      
      // Calculate conversation metrics
      stats.conversationMetrics = this.calculateConversationMetrics();
      
      return stats;
    } catch (error) {
      console.error(`❌ Error getting track stats for ${this.callSid}:`, error);
      return null;
    }
  }

  /**
   * Calculate conversation metrics
   */
  calculateConversationMetrics() {
    try {
      const segments = this.audioAnalysis.conversationSegments;
      
      if (segments.length === 0) {
        return {
          totalSegments: 0,
          callerSpeakingTime: 0,
          systemSpeakingTime: 0,
          averageSegmentLength: 0,
          longestSegment: 0,
          interruptionRate: 0
        };
      }
      
      const callerSegments = segments.filter(s => s.speaker === 'caller');
      const systemSegments = segments.filter(s => s.speaker === 'system');
      
      const callerSpeakingTime = callerSegments.reduce((total, s) => 
        total + (s.endTime - s.startTime), 0);
      const systemSpeakingTime = systemSegments.reduce((total, s) => 
        total + (s.endTime - s.startTime), 0);
      
      const allSegmentLengths = segments.map(s => s.endTime - s.startTime);
      const averageSegmentLength = allSegmentLengths.reduce((a, b) => a + b, 0) / segments.length;
      const longestSegment = Math.max(...allSegmentLengths);
      
      const totalTime = callerSpeakingTime + systemSpeakingTime;
      const interruptionRate = totalTime > 0 ? 
        (this.audioAnalysis.interruptionCount / totalTime) * 60000 : 0; // per minute
      
      return {
        totalSegments: segments.length,
        callerSpeakingTime,
        systemSpeakingTime,
        callerSpeakingPercentage: totalTime > 0 ? (callerSpeakingTime / totalTime) * 100 : 0,
        systemSpeakingPercentage: totalTime > 0 ? (systemSpeakingTime / totalTime) * 100 : 0,
        averageSegmentLength,
        longestSegment,
        interruptionRate,
        dominantSpeaker: this.audioAnalysis.dominantSpeaker
      };
    } catch (error) {
      console.error(`❌ Error calculating conversation metrics for ${this.callSid}:`, error);
      return null;
    }
  }

  /**
   * Clean up all tracks
   */
  cleanup() {
    try {
      for (const [trackName, track] of Object.entries(this.tracks)) {
        if (track) {
          track.cleanup();
        }
      }
      
      this.audioAnalysis.conversationSegments = [];
      console.log(`🧹 Cleaned up track manager for call ${this.callSid}`);
    } catch (error) {
      console.error(`❌ Error cleaning up track manager for ${this.callSid}:`, error);
    }
  }
}

module.exports = {
  TrackManager
};
