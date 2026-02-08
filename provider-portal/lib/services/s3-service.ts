/**
 * S3 Service for Provider Portal
 * Handles file uploads and presigned URL generation for AWS S3
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';

// Lazy-initialized S3 client singleton
let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
    return null;
  }
  
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  
  return s3ClientInstance;
}

export interface S3UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Upload file to S3
 */
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<S3UploadResult> {
  try {
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
      return {
        success: false,
        error: 'S3 credentials not configured',
      };
    }

    // Create S3 client
    const s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
      Metadata: {
        ...metadata,
        'uploaded-at': new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    // Generate public URL
    const url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;

    return {
      success: true,
      url,
      key,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload provider logo to S3
 */
export async function uploadProviderLogo(
  buffer: Buffer,
  filename: string,
  providerId: string
): Promise<S3UploadResult> {
  // Generate S3 key: provider-logos/{providerId}/{timestamp}-{filename}
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `provider-logos/${providerId}/${timestamp}-${sanitizedFilename}`;

  // Determine content type from filename
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';

  return uploadToS3(buffer, key, contentType, {
    'provider-id': providerId,
    'file-type': 'logo',
  });
}

/**
 * Extract S3 key from a presigned URL or return the key if already a key
 * Handles both:
 * - Full presigned URLs: https://bucket.s3.region.amazonaws.com/key?X-Amz-...
 * - S3 keys: reports/2026/01/provider-2026-01-15.pdf
 */
export function extractS3KeyFromUrl(urlOrKey: string): string | null {
  if (!urlOrKey) return null;
  
  // If it doesn't start with http, assume it's already an S3 key
  if (!urlOrKey.startsWith('http')) {
    return urlOrKey;
  }
  
  try {
    const url = new URL(urlOrKey);
    
    // Remove leading slash and query parameters
    // pathname will be like /reports/2026/01/file.pdf
    const key = url.pathname.slice(1); // Remove leading /
    
    if (!key) return null;
    
    return key;
  } catch {
    // If URL parsing fails, return null
    return null;
  }
}

/**
 * Generate a fresh presigned URL for an S3 object
 * @param keyOrUrl - Either an S3 key or an existing (possibly expired) presigned URL
 * @param expiresIn - Expiration time in seconds (default: 1 hour, max: 7 days)
 * @returns Fresh presigned URL or null if generation fails
 */
export async function generatePresignedUrl(
  keyOrUrl: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const s3Client = getS3Client();
    
    if (!s3Client) {
      return {
        success: false,
        error: 'S3 credentials not configured',
      };
    }
    
    // Extract the S3 key from URL if needed
    const key = extractS3KeyFromUrl(keyOrUrl);
    
    if (!key) {
      return {
        success: false,
        error: 'Invalid S3 key or URL provided',
      };
    }
    
    // Cap expiration at 7 days (maximum for IAM user credentials)
    const maxExpiration = 7 * 24 * 60 * 60; // 7 days in seconds
    const safeExpiresIn = Math.min(expiresIn, maxExpiration);
    
    const command = new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: safeExpiresIn,
    });
    
    return {
      success: true,
      url: presignedUrl,
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if S3 is properly configured
 */
export function isS3Configured(): boolean {
  return !!(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_S3_BUCKET);
}

/**
 * Get S3 bucket name (for debugging/logging)
 */
export function getS3BucketName(): string {
  return AWS_S3_BUCKET;
}

