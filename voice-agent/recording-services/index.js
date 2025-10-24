/**
 * Recording Services Main Export
 * Provides a unified interface for all recording functionality
 */

const { recordingManager } = require('./audio/recording-manager');
const { s3Service } = require('./aws/s3-service');
const { awsConfig, recordingConfig } = require('./config/aws-config');

/**
 * Initialize all recording services
 */
async function initializeRecordingServices() {
  try {
    console.log('🎬 Initializing Call Recording Services...');
    
    // Check if recording is enabled
    if (!recordingConfig.enabled) {
      console.log('📹 Call recording is disabled via configuration');
      return { success: false, reason: 'disabled' };
    }

    // Initialize recording manager (which initializes S3 service)
    const initialized = await recordingManager.initialize();
    
    if (initialized) {
      console.log('✅ Call Recording Services initialized successfully');
      console.log(`📊 Recording Configuration:`);
      console.log(`  - Format: ${recordingConfig.format}`);
      console.log(`  - Sample Rate: ${recordingConfig.sampleRate}Hz`);
      console.log(`  - Max Duration: ${recordingConfig.maxDuration / 1000}s`);
      console.log(`  - S3 Bucket: ${awsConfig.bucket}`);
      console.log(`  - S3 Prefix: ${awsConfig.recordingsPrefix}`);
      
      return { success: true, initialized: true };
    } else {
      console.log('❌ Failed to initialize Call Recording Services');
      return { success: false, reason: 'initialization_failed' };
    }
  } catch (error) {
    console.error('❌ Error initializing recording services:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Recording Service Interface
 */
class RecordingService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    const result = await initializeRecordingServices();
    this.initialized = result.success;
    return result;
  }

  /**
   * Start recording a call
   */
  async startRecording(callSid, callData = {}) {
    if (!this.initialized) {
      console.warn('⚠️ Recording service not initialized');
      return false;
    }
    return await recordingManager.startRecording(callSid, callData);
  }

  /**
   * Add audio chunk to recording
   */
  addAudioChunk(callSid, audioData, track = 'mixed') {
    if (!this.initialized) {
      return false;
    }
    return recordingManager.addAudioChunk(callSid, audioData, track);
  }

  /**
   * Update call authentication data
   */
  updateCallAuth(callSid, provider, employee) {
    if (!this.initialized) {
      return false;
    }
    return recordingManager.updateCallAuth(callSid, provider, employee);
  }

  /**
   * Stop recording and upload
   */
  async stopRecording(callSid, reason = 'call_ended') {
    if (!this.initialized) {
      return false;
    }
    return await recordingManager.stopRecording(callSid, reason);
  }

  /**
   * Get recording status
   */
  getRecordingStatus(callSid) {
    if (!this.initialized) {
      return null;
    }
    return recordingManager.getRecordingStatus(callSid);
  }

  /**
   * Get all active recordings
   */
  getActiveRecordings() {
    if (!this.initialized) {
      return [];
    }
    return recordingManager.getActiveRecordings();
  }

  /**
   * Get S3 bucket statistics
   */
  async getBucketStats() {
    if (!this.initialized) {
      return null;
    }
    return await s3Service.getBucketStats();
  }

  /**
   * Generate presigned URL for playback
   */
  async generatePlaybackUrl(provider, employeePin, callSid, fileName = 'recording.wav') {
    if (!this.initialized) {
      return null;
    }
    
    const { getS3ObjectKey } = require('./config/aws-config');
    const objectKey = getS3ObjectKey(provider, employeePin, callSid, fileName);
    return await s3Service.generatePresignedUrl(objectKey);
  }

  /**
   * List recordings for a specific path
   */
  async listRecordings(provider, employeePin = null, callSid = null) {
    if (!this.initialized) {
      return [];
    }
    
    const { getS3FolderPath } = require('./config/aws-config');
    let folderPath;
    
    if (callSid) {
      folderPath = getS3FolderPath(provider, employeePin, callSid);
    } else if (employeePin) {
      folderPath = getS3FolderPath(provider, employeePin, '').slice(0, -1); // Remove trailing slash
    } else {
      folderPath = getS3FolderPath(provider, '', '').split('/')[0] + '/'; // Provider folder only
    }
    
    return await s3Service.listRecordings(folderPath);
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, reason: 'not_initialized' };
    }

    try {
      // Test S3 connection
      await s3Service.testConnection();
      
      return {
        healthy: true,
        activeRecordings: this.getActiveRecordings().length,
        config: {
          enabled: recordingConfig.enabled,
          bucket: awsConfig.bucket,
          format: recordingConfig.format
        }
      };
    } catch (error) {
      return {
        healthy: false,
        reason: 'connection_error',
        error: error.message
      };
    }
  }
}

// Create singleton instance
const recordingService = new RecordingService();

module.exports = {
  RecordingService,
  recordingService,
  initializeRecordingServices,
  
  // Export individual services for direct access if needed
  recordingManager,
  s3Service,
  awsConfig,
  recordingConfig
};
