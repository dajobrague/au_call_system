/**
 * Redis Connection Test
 */

import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    const redis = getRedisClient();
    
    // Test connection by setting and getting a test key
    await redis.set('test-key', 'test-value', 'EX', 10);
    const value = await redis.get('test-key');
    
    if (value === 'test-value') {
      return NextResponse.json({
        success: true,
        message: 'Redis connected successfully',
        test: 'passed'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Redis write/read test failed',
        test: 'failed'
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      test: 'error'
    }, { status: 500 });
  }
}

