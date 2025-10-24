/**
 * AWS S3 Service - TypeScript Wrapper
 * Handles uploads to S3 for recordings and PDF reports
 * NDIS Compliance: ap-southeast-2 with SSE-S3 encryption
 */

import { S3Client, PutObjectCommand, HeadBucketCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

interface S3UploadOptions {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

interface S3UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

interface TwilioRecordingMetadata {
  callSid: string;
  recordingSid: string;
  provider?: string;
  employee?: string;
  duration?: number;
  uploadedAt?: string;
}

class S3Service {
  private s3Client: S3Client | null = null;
  private initialized: boolean = false;
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = env.AWS_S3_BUCKET;
    this.region = env.AWS_REGION;
  }

  /**
   * Initialize S3 client
   */
  async initialize(): Promise<boolean> {
    try {
      if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_S3_BUCKET) {
        logger.warn('AWS credentials not configured', {
          type: 's3_init_skipped'
        });
        return false;
      }

      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY
        }
      });

      // Test connection
      await this.testConnection();
      
      this.initialized = true;
      logger.info('S3 service initialized', {
        region: this.region,
        bucket: this.bucket,
        type: 's3_initialized'
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize S3 service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 's3_init_error'
      });
      return false;
    }
  }

  /**
   * Test S3 connection
   */
  private async testConnection(): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new HeadBucketCommand({ Bucket: this.bucket });
    await this.s3Client.send(command);
    
    logger.info('S3 bucket accessible', {
      bucket: this.bucket,
      type: 's3_connection_test'
    });
  }

  /**
   * Upload Twilio recording to S3
   */
  async uploadTwilioRecording(
    audioBuffer: Buffer,
    metadata: TwilioRecordingMetadata
  ): Promise<S3UploadResult> {
    if (!this.initialized || !this.s3Client) {
      return {
        success: false,
        error: 'S3 service not initialized'
      };
    }

    const startTime = Date.now();

    try {
      // Generate S3 key: call-recordings/{provider}/{employee}/{callSid}/twilio-recording.mp3
      const provider = metadata.provider || 'unknown-provider';
      const employee = metadata.employee || 'unknown-employee';
      const key = `${env.AWS_S3_RECORDINGS_PREFIX}${provider}/${employee}/${metadata.callSid}/twilio-recording.mp3`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
        ServerSideEncryption: 'AES256',
        StorageClass: 'STANDARD_IA',
        Metadata: {
          'call-sid': metadata.callSid,
          'recording-sid': metadata.recordingSid,
          'provider': provider,
          'employee': employee,
          'duration': metadata.duration?.toString() || '',
          'uploaded-at': new Date().toISOString()
        }
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

      logger.info('Twilio recording uploaded to S3', {
        callSid: metadata.callSid,
        recordingSid: metadata.recordingSid,
        key,
        size: audioBuffer.length,
        duration: Date.now() - startTime,
        type: 's3_recording_upload_success'
      });

      return {
        success: true,
        url,
        key
      };

    } catch (error) {
      logger.error('Failed to upload recording to S3', {
        callSid: metadata.callSid,
        recordingSid: metadata.recordingSid,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        type: 's3_recording_upload_error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Upload PDF report to S3
   */
  async uploadPdfReport(
    pdfBuffer: Buffer,
    key: string,
    metadata?: Record<string, string>
  ): Promise<S3UploadResult> {
    if (!this.initialized || !this.s3Client) {
      return {
        success: false,
        error: 'S3 service not initialized'
      };
    }

    const startTime = Date.now();

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ServerSideEncryption: 'AES256',
        StorageClass: 'STANDARD_IA',
        Metadata: {
          ...metadata,
          'uploaded-at': new Date().toISOString()
        }
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

      logger.info('PDF report uploaded to S3', {
        key,
        size: pdfBuffer.length,
        duration: Date.now() - startTime,
        type: 's3_pdf_upload_success'
      });

      return {
        success: true,
        url,
        key
      };

    } catch (error) {
      logger.error('Failed to upload PDF to S3', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        type: 's3_pdf_upload_error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate presigned URL for secure file access
   */
  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    if (!this.initialized || !this.s3Client) {
      logger.error('Cannot generate presigned URL - S3 not initialized', {
        type: 's3_presigned_url_error'
      });
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      logger.info('Presigned URL generated', {
        key,
        expiresIn,
        type: 's3_presigned_url_generated'
      });

      return url;

    } catch (error) {
      logger.error('Failed to generate presigned URL', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 's3_presigned_url_error'
      });

      return null;
    }
  }

  /**
   * Generic upload method
   */
  async upload(options: S3UploadOptions): Promise<S3UploadResult> {
    if (!this.initialized || !this.s3Client) {
      return {
        success: false,
        error: 'S3 service not initialized'
      };
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType,
        ServerSideEncryption: 'AES256',
        Metadata: options.metadata
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${options.key}`;

      return {
        success: true,
        url,
        key: options.key
      };

    } catch (error) {
      logger.error('S3 upload failed', {
        key: options.key,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 's3_upload_error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const s3Service = new S3Service();

