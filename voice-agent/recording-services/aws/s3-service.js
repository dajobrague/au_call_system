/**
 * AWS S3 Service for Call Recording
 * Handles S3 uploads, folder creation, and file management
 */

const AWS = require('aws-sdk');
const { awsConfig, validateAWSConfig } = require('../config/aws-config');

class S3RecordingService {
  constructor() {
    this.s3 = null;
    this.initialized = false;
  }

  /**
   * Initialize S3 client
   */
  async initialize() {
    try {
      validateAWSConfig();
      
      // Configure AWS SDK
      AWS.config.update({
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
        region: awsConfig.region
      });

      this.s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        httpOptions: {
          timeout: awsConfig.uploadTimeout
        },
        maxRetries: 3,
        retryDelayOptions: {
          customBackoff: function(retryCount) {
            return Math.pow(2, retryCount) * 100; // Exponential backoff
          }
        }
      });

      // Test S3 connection
      await this.testConnection();
      
      this.initialized = true;
      console.log('✅ S3 Recording Service initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize S3 Recording Service:', error);
      throw error;
    }
  }

  /**
   * Test S3 connection and bucket access
   */
  async testConnection() {
    try {
      await this.s3.headBucket({ Bucket: awsConfig.bucket }).promise();
      console.log(`✅ S3 bucket ${awsConfig.bucket} is accessible`);
    } catch (error) {
      if (error.code === 'NotFound') {
        throw new Error(`S3 bucket ${awsConfig.bucket} not found`);
      } else if (error.code === 'Forbidden') {
        throw new Error(`Access denied to S3 bucket ${awsConfig.bucket}`);
      }
      throw error;
    }
  }

  /**
   * Check if S3 folder exists
   */
  async folderExists(folderPath) {
    try {
      const params = {
        Bucket: awsConfig.bucket,
        Prefix: folderPath,
        MaxKeys: 1
      };

      const result = await this.s3.listObjectsV2(params).promise();
      return result.Contents && result.Contents.length > 0;
    } catch (error) {
      console.error('❌ Error checking folder existence:', error);
      return false;
    }
  }

  /**
   * Create S3 folder by uploading a marker file
   */
  async createFolder(folderPath) {
    try {
      const markerKey = `${folderPath}.folder_marker`;
      const params = {
        Bucket: awsConfig.bucket,
        Key: markerKey,
        Body: '',
        ContentType: 'text/plain',
        ServerSideEncryption: awsConfig.serverSideEncryption,
        Metadata: {
          'created-by': 'voice-agent-recording-system',
          'created-at': new Date().toISOString()
        }
      };

      await this.s3.putObject(params).promise();
      console.log(`📁 Created S3 folder: ${folderPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error creating folder ${folderPath}:`, error);
      return false;
    }
  }

  /**
   * Upload recording file to S3
   */
  async uploadRecording(objectKey, audioBuffer, metadata = {}) {
    if (!this.initialized) {
      throw new Error('S3 service not initialized');
    }

    try {
      const params = {
        Bucket: awsConfig.bucket,
        Key: objectKey,
        Body: audioBuffer,
        ContentType: 'audio/wav',
        StorageClass: awsConfig.storageClass,
        ServerSideEncryption: awsConfig.serverSideEncryption,
        Metadata: {
          ...metadata,
          'content-type': 'audio/wav',
          'uploaded-at': new Date().toISOString()
        }
      };

      // Use multipart upload for large files
      if (audioBuffer.length > awsConfig.partSize) {
        return await this.multipartUpload(params);
      } else {
        const result = await this.s3.putObject(params).promise();
        console.log(`✅ Uploaded recording: ${objectKey}`);
        return result;
      }
    } catch (error) {
      console.error(`❌ Error uploading recording ${objectKey}:`, error);
      throw error;
    }
  }

  /**
   * Upload metadata file to S3
   */
  async uploadMetadata(objectKey, metadata) {
    if (!this.initialized) {
      throw new Error('S3 service not initialized');
    }

    try {
      const params = {
        Bucket: awsConfig.bucket,
        Key: objectKey,
        Body: JSON.stringify(metadata, null, 2),
        ContentType: 'application/json',
        StorageClass: awsConfig.storageClass,
        ServerSideEncryption: awsConfig.serverSideEncryption,
        Metadata: {
          'content-type': 'application/json',
          'uploaded-at': new Date().toISOString()
        }
      };

      const result = await this.s3.putObject(params).promise();
      console.log(`✅ Uploaded metadata: ${objectKey}`);
      return result;
    } catch (error) {
      console.error(`❌ Error uploading metadata ${objectKey}:`, error);
      throw error;
    }
  }

  /**
   * Multipart upload for large files
   */
  async multipartUpload(params) {
    try {
      console.log(`🔄 Starting multipart upload for: ${params.Key}`);
      
      const upload = this.s3.upload(params, {
        partSize: awsConfig.partSize,
        queueSize: awsConfig.queueSize
      });

      // Track upload progress
      upload.on('httpUploadProgress', (progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        console.log(`📤 Upload progress: ${percent}% (${progress.loaded}/${progress.total} bytes)`);
      });

      const result = await upload.promise();
      console.log(`✅ Multipart upload completed: ${params.Key}`);
      return result;
    } catch (error) {
      console.error(`❌ Multipart upload failed for ${params.Key}:`, error);
      throw error;
    }
  }

  /**
   * Generate presigned URL for playback
   */
  async generatePresignedUrl(objectKey, expiresIn = 3600) {
    if (!this.initialized) {
      throw new Error('S3 service not initialized');
    }

    try {
      const params = {
        Bucket: awsConfig.bucket,
        Key: objectKey,
        Expires: expiresIn
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      console.log(`🔗 Generated presigned URL for: ${objectKey}`);
      return url;
    } catch (error) {
      console.error(`❌ Error generating presigned URL for ${objectKey}:`, error);
      throw error;
    }
  }

  /**
   * List recordings in a folder
   */
  async listRecordings(folderPath) {
    if (!this.initialized) {
      throw new Error('S3 service not initialized');
    }

    try {
      const params = {
        Bucket: awsConfig.bucket,
        Prefix: folderPath,
        MaxKeys: 1000
      };

      const result = await this.s3.listObjectsV2(params).promise();
      const recordings = result.Contents
        .filter(obj => !obj.Key.endsWith('.folder_marker'))
        .map(obj => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          fileName: obj.Key.split('/').pop()
        }));

      console.log(`📋 Found ${recordings.length} recordings in: ${folderPath}`);
      return recordings;
    } catch (error) {
      console.error(`❌ Error listing recordings in ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * Delete recording (for cleanup/testing)
   */
  async deleteRecording(objectKey) {
    if (!this.initialized) {
      throw new Error('S3 service not initialized');
    }

    try {
      const params = {
        Bucket: awsConfig.bucket,
        Key: objectKey
      };

      await this.s3.deleteObject(params).promise();
      console.log(`🗑️ Deleted recording: ${objectKey}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting recording ${objectKey}:`, error);
      throw error;
    }
  }

  /**
   * Get bucket storage usage
   */
  async getBucketStats() {
    if (!this.initialized) {
      throw new Error('S3 service not initialized');
    }

    try {
      const params = {
        Bucket: awsConfig.bucket,
        Prefix: awsConfig.recordingsPrefix
      };

      const result = await this.s3.listObjectsV2(params).promise();
      const totalSize = result.Contents.reduce((sum, obj) => sum + obj.Size, 0);
      const totalFiles = result.Contents.length;

      return {
        totalFiles,
        totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        bucket: awsConfig.bucket,
        prefix: awsConfig.recordingsPrefix
      };
    } catch (error) {
      console.error('❌ Error getting bucket stats:', error);
      throw error;
    }
  }
}

// Create singleton instance
const s3Service = new S3RecordingService();

module.exports = {
  S3RecordingService,
  s3Service
};
