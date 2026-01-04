/**
 * Public Redis Connection Test (No Auth Required)
 */

import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    // Check if environment variable exists
    const redisUrl = process.env.RAILWAY_REDIS_URL || process.env.REDIS_URL;
    
    if (!redisUrl) {
      return NextResponse.json({
        success: false,
        message: '❌ Redis URL not configured',
        envVars: {
          RAILWAY_REDIS_URL: !!process.env.RAILWAY_REDIS_URL,
          REDIS_URL: !!process.env.REDIS_URL
        },
        test: 'missing_env'
      }, { status: 500 });
    }

    // Try to connect and test
    const redis = getRedisClient();
    
    // Test connection by setting and getting a test key
    const testKey = `test-${Date.now()}`;
    await redis.set(testKey, 'test-value', 'EX', 10);
    const value = await redis.get(testKey);
    await redis.del(testKey);
    
    if (value === 'test-value') {
      return NextResponse.json({
        success: true,
        message: '✅ Redis connected and working!',
        test: 'passed',
        envVars: {
          RAILWAY_REDIS_URL: !!process.env.RAILWAY_REDIS_URL,
          REDIS_URL: !!process.env.REDIS_URL
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '❌ Redis write/read test failed',
        test: 'failed'
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: '❌ Redis connection error',
      error: error instanceof Error ? error.message : 'Unknown error',
      test: 'error'
    }, { status: 500 });
  }
}

