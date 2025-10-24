/**
 * AWS S3 Configuration for Call Recording
 * Handles AWS credentials and S3 bucket configuration
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
function loadEnvironmentVariables() {
  const envPath = path.join(__dirname, '../../.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
}

// Initialize environment variables
loadEnvironmentVariables();

/**
 * AWS S3 Configuration
 * NDIS Compliance: Data stored in ap-southeast-2 (Sydney) with SSE-S3 encryption
 */
const awsConfig = {
  // AWS Credentials
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AWS_REGION || 'ap-southeast-2', // Australia (Sydney) for NDIS compliance
  
  // S3 Bucket Configuration
  bucket: process.env.AWS_S3_BUCKET || '',
  recordingsPrefix: process.env.AWS_S3_RECORDINGS_PREFIX || 'call-recordings/',
  reportsPrefix: process.env.AWS_S3_REPORTS_PREFIX || 'reports/',
  
  // S3 Upload Configuration
  uploadTimeout: 30000, // 30 seconds
  partSize: 5 * 1024 * 1024, // 5MB for multipart uploads
  queueSize: 4, // Concurrent upload parts
  
  // S3 Object Configuration
  storageClass: 'STANDARD_IA', // Infrequent Access for cost optimization
  serverSideEncryption: 'AES256', // SSE-S3 encryption for NDIS compliance
  
  // Metadata Configuration
  metadataPrefix: 'x-amz-meta-call-',
  
  // Retention Configuration (for testing - 24 hours on Twilio)
  twilioRetentionHours: 24,
};

/**
 * Recording Configuration
 */
const recordingConfig = {
  // Recording Settings
  enabled: process.env.RECORDING_ENABLED === 'true',
  format: process.env.RECORDING_FORMAT || 'wav',
  sampleRate: parseInt(process.env.RECORDING_SAMPLE_RATE) || 8000,
  
  // Buffer Settings
  maxDuration: parseInt(process.env.RECORDING_MAX_DURATION) || 600000, // 10 minutes
  bufferSize: parseInt(process.env.RECORDING_BUFFER_SIZE) || 1048576, // 1MB
  chunkSize: 160, // 20ms at 8kHz = 160 bytes
  
  // Audio Format Settings
  bitsPerSample: 16,
  channels: 1, // Mono
  
  // Folder Structure Settings
  folderStructure: {
    provider: '{provider-name}',
    employee: '{employee-pin}',
    call: '{call-sid}'
  },
  
  // File Naming
  fileNames: {
    recording: 'recording.wav',
    metadata: 'metadata.json',
    inbound: 'inbound.wav',
    outbound: 'outbound.wav'
  }
};

/**
 * Validation Functions
 */
function validateAWSConfig() {
  const required = ['accessKeyId', 'secretAccessKey', 'bucket'];
  const missing = required.filter(key => !awsConfig[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required AWS configuration: ${missing.join(', ')}`);
  }
  
  return true;
}

function validateRecordingConfig() {
  if (!recordingConfig.enabled) {
    console.log('📹 Call recording is disabled');
    return false;
  }
  
  if (recordingConfig.sampleRate !== 8000) {
    console.warn('⚠️ Recording sample rate should be 8000Hz for Twilio compatibility');
  }
  
  return true;
}

/**
 * Get S3 folder path for a call
 */
function getS3FolderPath(provider, employeePin, callSid) {
  const sanitizeFolder = (name) => {
    return name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  };
  
  const providerFolder = sanitizeFolder(provider || 'unknown-provider');
  const employeeFolder = sanitizeFolder(employeePin || 'unknown-employee');
  const callFolder = sanitizeFolder(callSid || 'unknown-call');
  
  return `${awsConfig.recordingsPrefix}${providerFolder}/${employeeFolder}/${callFolder}/`;
}

/**
 * Get S3 object key for a recording file
 */
function getS3ObjectKey(provider, employeePin, callSid, fileName) {
  const folderPath = getS3FolderPath(provider, employeePin, callSid);
  return `${folderPath}${fileName}`;
}

/**
 * Create metadata object for recording
 */
function createRecordingMetadata(callData) {
  return {
    callSid: callData.callSid,
    callerNumber: callData.callerNumber,
    twilioNumber: callData.twilioNumber,
    startTime: callData.startTime,
    endTime: callData.endTime,
    duration: callData.duration,
    provider: callData.provider,
    employee: callData.employee,
    recordingFormat: recordingConfig.format,
    sampleRate: recordingConfig.sampleRate,
    fileSize: callData.fileSize,
    version: '1.0',
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  awsConfig,
  recordingConfig,
  validateAWSConfig,
  validateRecordingConfig,
  getS3FolderPath,
  getS3ObjectKey,
  createRecordingMetadata
};
