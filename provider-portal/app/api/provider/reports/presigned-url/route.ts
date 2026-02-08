/**
 * Presigned URL Generation API
 * Generates fresh presigned URLs for S3 objects (reports, recordings)
 * This solves the expired URL problem by creating URLs on-demand
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generatePresignedUrl, extractS3KeyFromUrl } from '@/lib/services/s3-service';

/**
 * POST /api/provider/reports/presigned-url
 * 
 * Request body:
 * {
 *   "url": "https://bucket.s3.region.amazonaws.com/reports/..." // or just the S3 key
 *   "expiresIn": 3600 // optional, defaults to 1 hour
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "url": "https://bucket.s3.region.amazonaws.com/reports/...?X-Amz-..."
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { url, expiresIn = 3600 } = body;
    
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL or S3 key is required' },
        { status: 400 }
      );
    }
    
    // Extract the S3 key to verify it's a valid report path
    const s3Key = extractS3KeyFromUrl(url);
    
    if (!s3Key) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL or S3 key format' },
        { status: 400 }
      );
    }
    
    // Security: Only allow access to reports and recordings prefixes
    // This prevents users from generating URLs for arbitrary S3 objects
    const allowedPrefixes = ['reports/', 'call-recordings/'];
    const isAllowed = allowedPrefixes.some(prefix => s3Key.startsWith(prefix));
    
    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: 'Access to this resource is not allowed' },
        { status: 403 }
      );
    }
    
    // Generate fresh presigned URL
    const result = await generatePresignedUrl(s3Key, expiresIn);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to generate URL' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      url: result.url,
      key: s3Key,
      expiresIn,
    });
    
  } catch (error) {
    console.error('Error in presigned URL generation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
