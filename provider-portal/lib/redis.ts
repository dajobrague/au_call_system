/**
 * Redis Client for Provider Portal
 * Uses Railway Redis (same as voice-agent)
 */

import Redis from 'ioredis';

let redis: Redis | null = null;

/**
 * Get or create Redis client
 */
export function getRedisClient(): Redis {
  if (redis) {
    return redis;
  }

  const REDIS_URL = process.env.RAILWAY_REDIS_URL || process.env.REDIS_URL;

  if (!REDIS_URL) {
    throw new Error('RAILWAY_REDIS_URL or REDIS_URL environment variable is required');
  }

  redis = new Redis(REDIS_URL, {
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  redis.on('error', (error) => {
    console.error('Redis connection error:', error);
  });

  redis.on('connect', () => {
    console.log('Redis connected successfully');
  });

  return redis;
}

/**
 * Save report comments to Redis
 */
export async function saveReportComments(
  providerId: string,
  date: string,
  comments: string
): Promise<void> {
  const client = getRedisClient();
  const key = `report-comments:${providerId}:${date}`;
  
  // Store with 365 day (1 year) expiration
  await client.setex(key, 60 * 60 * 24 * 365, comments);
}

/**
 * Load report comments from Redis
 */
export async function loadReportComments(
  providerId: string,
  date: string
): Promise<string | null> {
  const client = getRedisClient();
  const key = `report-comments:${providerId}:${date}`;
  
  return await client.get(key);
}

/**
 * Close Redis connection (for cleanup)
 */
export function closeRedis(): void {
  if (redis) {
    redis.disconnect();
    redis = null;
  }
}

