/**
 * Redis Configuration for Bull Queue
 * Uses Railway Redis (standard Redis, not Upstash REST API)
 */

import Redis from 'ioredis';

// Railway Redis URL (standard redis:// format)
const RAILWAY_REDIS_URL = process.env.RAILWAY_REDIS_URL || process.env.REDIS_URL || '';

/**
 * Parse Railway Redis URL and create ioredis config
 */
export function getBullRedisConfig() {
  if (!RAILWAY_REDIS_URL) {
    throw new Error('RAILWAY_REDIS_URL or REDIS_URL environment variable is required for Bull queue');
  }

  // If it's a full redis URL, parse it
  if (RAILWAY_REDIS_URL.startsWith('redis://') || RAILWAY_REDIS_URL.startsWith('rediss://')) {
    return RAILWAY_REDIS_URL;
  }

  // Otherwise, construct from host/port/password
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD;
  const db = parseInt(process.env.REDIS_DB || '0', 10);

  return {
    host,
    port,
    password,
    db,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  };
}

/**
 * Create ioredis client for Bull
 */
export function createBullRedisClient(): Redis {
  const config = getBullRedisConfig();
  
  if (typeof config === 'string') {
    return new Redis(config);
  }
  
  return new Redis(config);
}

/**
 * Validate Bull Redis configuration
 */
export function validateBullRedisConfig(): void {
  try {
    getBullRedisConfig();
  } catch (error) {
    throw new Error('Bull Redis configuration is invalid. Ensure RAILWAY_REDIS_URL or REDIS_URL is set.');
  }
}
