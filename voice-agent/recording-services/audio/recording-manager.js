/**
 * Call Recording Manager
 * Manages the lifecycle of call recordings, audio buffering, and processing
 */

const { recordingConfig, getS3ObjectKey, createRecordingMetadata } = require('../config/aws-config');
const { s3Service } = require('../aws/s3-service');
const { TrackManager } = require('./track-manager');
const { audioProcessor } = require('./audio-processor');

class CallRecordingManager {
  constructor() {
    this.activeRecordings = new Map(); // callSid -> recording data
    this.initialized = false;
  }

  /**
   * Initialize recording manager
   */
  async initialize() {
    try {
      if (!recordingConfig.enabled) {
        console.log('📹 Call recording is disabled');
        return false;
      }

      // Initialize S3 service
      await s3Service.initialize();
      
      this.initialized = true;
      console.log('✅ Call Recording Manager initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Call Recording Manager:', error);
      return false;
    }
  }

  /**
   * Start recording for a call
   */
  async startRecording(callSid, callData = {}) {
    if (!this.initialized || !recordingConfig.enabled) {
      console.log(`📹 Recording disabled or not initialized for call ${callSid}`);
      return false;
    }

    try {
      if (this.activeRecordings.has(callSid)) {
        console.warn(`⚠️ Recording already active for call ${callSid}`);
        return false;
      }

      const recording = {
        callSid,
        startTime: new Date().toISOString(),
        endTime: null,
        duration: 0,
        
        // Call metadata
        callerNumber: callData.callerNumber || 'unknown',
        twilioNumber: callData.twilioNumber || 'unknown',
        accountSid: callData.accountSid || 'unknown',
        streamSid: callData.streamSid || 'unknown',
        
        // Authentication data (will be filled later)
        provider: null,
        employee: null,
        
        // Advanced audio management
        trackManager: new TrackManager(callSid, {
          separateTracks: true,
          enableMixdown: true,
          enableVAD: true,
          enableCompression: recordingConfig.format === 'wav'
        }),
        
        // Recording state
        isRecording: true,
        bufferSize: 0,
        chunkCount: 0,
        
        // S3 paths (will be set when provider/employee known)
        s3FolderPath: null,
        s3ObjectKeys: {
          recording: null,
          metadata: null,
          inbound: null,
          outbound: null
        },
        
        // Enhanced metadata
        recordingQuality: 'standard',
        audioAnalysis: null
      };

      this.activeRecordings.set(callSid, recording);
      console.log(`🎙️ Started recording for call ${callSid}`);
      return true;
    } catch (error) {
      console.error(`❌ Error starting recording for call ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Add audio chunk to recording with advanced processing
   */
  addAudioChunk(callSid, audioData, track = 'mixed', timestamp = null) {
    if (!this.initialized || !recordingConfig.enabled) {
      return false;
    }

    const recording = this.activeRecordings.get(callSid);
    if (!recording || !recording.isRecording) {
      return false;
    }

    try {
      // Validate audio data
      if (!audioData) {
        return false;
      }

      // Use track manager for advanced audio processing
      const success = recording.trackManager.addAudioData(audioData, track, timestamp);
      
      if (success) {
        // Update recording statistics
        const dataSize = typeof audioData === 'string' ? 
          Buffer.from(audioData, 'base64').length : 
          (Buffer.isBuffer(audioData) ? audioData.length : 0);
        
        recording.bufferSize += dataSize;
        recording.chunkCount++;

        // Check buffer size limits
        if (recording.bufferSize > recordingConfig.maxDuration * recordingConfig.sampleRate) {
          console.warn(`⚠️ Recording buffer size limit reached for call ${callSid}`);
          this.stopRecording(callSid, 'buffer_limit_reached');
        }
      }

      return success;
    } catch (error) {
      console.error(`❌ Error adding audio chunk for call ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Update call authentication data
   */
  updateCallAuth(callSid, provider, employee) {
    const recording = this.activeRecordings.get(callSid);
    if (!recording) {
      console.warn(`⚠️ No recording found for call ${callSid} when updating auth`);
      return false;
    }

    try {
      recording.provider = provider;
      recording.employee = employee;

      // Now we can set the S3 paths
      const providerName = provider?.name || 'unknown-provider';
      const employeePin = employee?.pin?.toString() || 'unknown-employee';

      recording.s3ObjectKeys = {
        recording: getS3ObjectKey(providerName, employeePin, callSid, recordingConfig.fileNames.recording),
        metadata: getS3ObjectKey(providerName, employeePin, callSid, recordingConfig.fileNames.metadata),
        inbound: getS3ObjectKey(providerName, employeePin, callSid, recordingConfig.fileNames.inbound),
        outbound: getS3ObjectKey(providerName, employeePin, callSid, recordingConfig.fileNames.outbound)
      };

      console.log(`✅ Updated recording auth for call ${callSid}: ${providerName}/${employeePin}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating call auth for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Stop recording and upload to S3
   */
  async stopRecording(callSid, reason = 'call_ended') {
    const recording = this.activeRecordings.get(callSid);
    if (!recording) {
      console.warn(`⚠️ No recording found for call ${callSid}`);
      return false;
    }

    try {
      recording.isRecording = false;
      recording.endTime = new Date().toISOString();
      recording.duration = Math.round((new Date(recording.endTime) - new Date(recording.startTime)) / 1000);

      console.log(`🛑 Stopping recording for call ${callSid} (${reason})`);
      
      // Get comprehensive recording statistics
      const trackStats = recording.trackManager.getTrackStats();
      console.log(`📊 Recording stats: ${recording.bufferSize} bytes, ${recording.chunkCount} chunks, ${recording.duration}s`);
      
      if (trackStats && trackStats.conversationMetrics) {
        const cm = trackStats.conversationMetrics;
        console.log(`🗣️ Conversation: ${cm.totalSegments} segments, ${Math.round(cm.callerSpeakingPercentage)}% caller, ${cm.interruptionRate.toFixed(1)} interruptions/min`);
      }

      // Store audio analysis
      recording.audioAnalysis = trackStats;

      // If we don't have authentication data, use fallback paths
      if (!recording.provider || !recording.employee) {
        console.warn(`⚠️ Missing auth data for call ${callSid}, using fallback paths`);
        const fallbackProvider = 'unauthenticated';
        const fallbackEmployee = 'unknown';
        
        recording.s3ObjectKeys = {
          recording: getS3ObjectKey(fallbackProvider, fallbackEmployee, callSid, recordingConfig.fileNames.recording),
          metadata: getS3ObjectKey(fallbackProvider, fallbackEmployee, callSid, recordingConfig.fileNames.metadata),
          inbound: getS3ObjectKey(fallbackProvider, fallbackEmployee, callSid, recordingConfig.fileNames.inbound),
          outbound: getS3ObjectKey(fallbackProvider, fallbackEmployee, callSid, recordingConfig.fileNames.outbound)
        };
      }

      // Upload recordings to S3
      await this.uploadRecordingToS3(recording, reason);

      // Clean up track manager
      recording.trackManager.cleanup();
      
      // Clean up recording
      this.activeRecordings.delete(callSid);
      console.log(`✅ Recording completed and uploaded for call ${callSid}`);
      return true;
    } catch (error) {
      console.error(`❌ Error stopping recording for call ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Upload recording data to S3 with enhanced processing
   */
  async uploadRecordingToS3(recording, reason) {
    try {
      const uploads = [];

      // Get enhanced audio data from track manager
      const mixedWav = recording.trackManager.getMixedAudio(1.0, 0.8); // Favor caller audio slightly
      const inboundWav = recording.trackManager.getTrackAudio('inbound');
      const outboundWav = recording.trackManager.getTrackAudio('outbound');
      
      // Upload main mixed recording
      if (mixedWav && mixedWav.length > 0) {
        const uploadPromise = s3Service.uploadRecording(
          recording.s3ObjectKeys.recording,
          mixedWav,
          {
            'call-sid': recording.callSid,
            'caller-number': recording.callerNumber,
            'provider': recording.provider?.name || 'unknown',
            'employee-pin': recording.employee?.pin?.toString() || 'unknown',
            'stop-reason': reason,
            'recording-type': 'mixed',
            'audio-quality': recording.recordingQuality
          }
        );
        uploads.push(uploadPromise);
        console.log(`📤 Uploading mixed recording: ${Math.round(mixedWav.length / 1024)}KB`);
      }

      // Upload separate tracks if available and enabled
      if (inboundWav && inboundWav.length > 0) {
        const uploadPromise = s3Service.uploadRecording(
          recording.s3ObjectKeys.inbound, 
          inboundWav,
          {
            'call-sid': recording.callSid,
            'recording-type': 'inbound',
            'track': 'caller'
          }
        );
        uploads.push(uploadPromise);
        console.log(`📤 Uploading inbound track: ${Math.round(inboundWav.length / 1024)}KB`);
      }

      if (outboundWav && outboundWav.length > 0) {
        const uploadPromise = s3Service.uploadRecording(
          recording.s3ObjectKeys.outbound, 
          outboundWav,
          {
            'call-sid': recording.callSid,
            'recording-type': 'outbound',
            'track': 'system'
          }
        );
        uploads.push(uploadPromise);
        console.log(`📤 Uploading outbound track: ${Math.round(outboundWav.length / 1024)}KB`);
      }

      // Create enhanced metadata with audio analysis
      const metadata = createRecordingMetadata({
        ...recording,
        fileSize: mixedWav ? mixedWav.length : 0,
        stopReason: reason,
        audioAnalysis: recording.audioAnalysis,
        trackInfo: {
          hasSeparateTracks: !!(inboundWav || outboundWav),
          inboundSize: inboundWav ? inboundWav.length : 0,
          outboundSize: outboundWav ? outboundWav.length : 0,
          mixedSize: mixedWav ? mixedWav.length : 0
        }
      });
      
      uploads.push(s3Service.uploadMetadata(recording.s3ObjectKeys.metadata, metadata));
      console.log(`📤 Uploading metadata with audio analysis`);

      // Wait for all uploads to complete
      await Promise.all(uploads);
      console.log(`✅ All recording files uploaded for call ${recording.callSid}`);
    } catch (error) {
      console.error(`❌ Error uploading recording for call ${recording.callSid}:`, error);
      throw error;
    }
  }

  /**
   * Convert μ-law audio buffer to WAV format
   */
  convertToWav(mulawBuffer) {
    if (!mulawBuffer || mulawBuffer.length === 0) {
      return null;
    }

    try {
      // Convert μ-law to PCM16
      const pcmBuffer = new Int16Array(mulawBuffer.length);
      
      for (let i = 0; i < mulawBuffer.length; i++) {
        const mulaw = mulawBuffer[i];
        const sign = mulaw & 0x80 ? -1 : 1;
        const exponent = (mulaw & 0x70) >> 4;
        const mantissa = mulaw & 0x0F;
        
        let linear = (33 + 2 * mantissa) * Math.pow(2, exponent + 2) - 33;
        pcmBuffer[i] = sign * Math.min(32767, linear);
      }

      // Create WAV header (44 bytes) + PCM data
      const wavBuffer = Buffer.alloc(44 + pcmBuffer.length * 2);
      
      // WAV header
      wavBuffer.write('RIFF', 0);
      wavBuffer.writeUInt32LE(36 + pcmBuffer.length * 2, 4);
      wavBuffer.write('WAVE', 8);
      wavBuffer.write('fmt ', 12);
      wavBuffer.writeUInt32LE(16, 16); // PCM format size
      wavBuffer.writeUInt16LE(1, 20);  // PCM format
      wavBuffer.writeUInt16LE(1, 22);  // Mono
      wavBuffer.writeUInt32LE(recordingConfig.sampleRate, 24); // Sample rate
      wavBuffer.writeUInt32LE(recordingConfig.sampleRate * 2, 28); // Byte rate
      wavBuffer.writeUInt16LE(2, 32);  // Block align
      wavBuffer.writeUInt16LE(16, 34); // Bits per sample
      wavBuffer.write('data', 36);
      wavBuffer.writeUInt32LE(pcmBuffer.length * 2, 40);
      
      // Copy PCM data
      for (let i = 0; i < pcmBuffer.length; i++) {
        wavBuffer.writeInt16LE(pcmBuffer[i], 44 + i * 2);
      }
      
      return wavBuffer;
    } catch (error) {
      console.error('❌ Error converting μ-law to WAV:', error);
      return null;
    }
  }

  /**
   * Get enhanced recording status
   */
  getRecordingStatus(callSid) {
    const recording = this.activeRecordings.get(callSid);
    if (!recording) {
      return null;
    }

    const trackStats = recording.trackManager ? recording.trackManager.getTrackStats() : null;

    return {
      callSid: recording.callSid,
      isRecording: recording.isRecording,
      startTime: recording.startTime,
      duration: Math.round((new Date() - new Date(recording.startTime)) / 1000),
      bufferSize: recording.bufferSize,
      chunkCount: recording.chunkCount,
      hasAuth: !!(recording.provider && recording.employee),
      recordingQuality: recording.recordingQuality,
      
      // Enhanced audio information
      tracks: trackStats ? {
        totalTracks: Object.keys(trackStats.tracks).length,
        activeBuffers: Object.values(trackStats.tracks).filter(t => t.bufferSize > 0).length,
        conversationMetrics: trackStats.conversationMetrics
      } : null,
      
      // Voice activity summary
      voiceActivity: trackStats?.analysis ? {
        dominantSpeaker: trackStats.analysis.dominantSpeaker,
        interruptionCount: trackStats.analysis.interruptionCount,
        totalSegments: trackStats.analysis.conversationSegments?.length || 0
      } : null
    };
  }

  /**
   * Get all active recordings
   */
  getActiveRecordings() {
    const active = [];
    for (const [callSid, recording] of this.activeRecordings) {
      active.push(this.getRecordingStatus(callSid));
    }
    return active;
  }

  /**
   * Force stop all recordings (for cleanup)
   */
  async stopAllRecordings() {
    const promises = [];
    for (const callSid of this.activeRecordings.keys()) {
      promises.push(this.stopRecording(callSid, 'force_stop'));
    }
    await Promise.all(promises);
    console.log('🛑 All recordings stopped');
  }
}

// Create singleton instance
const recordingManager = new CallRecordingManager();

module.exports = {
  CallRecordingManager,
  recordingManager
};
