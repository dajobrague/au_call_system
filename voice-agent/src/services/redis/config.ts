/**
 * Redis configuration for Upstash
 * Reads environment variables and exports constants for state management
 */

export const redisConfig = {
  url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
  ttlSeconds: parseInt(process.env.STATE_TTL_SECONDS || '3600', 10), // 1 hour default
  maxCallDuration: parseInt(process.env.MAX_CALL_DURATION_SECONDS || '600', 10), // 10 minutes max call
} as const;

export const stateKeys = {
  call: (callSid: string) => `call:${callSid}`,
} as const;

// Validate required environment variables
export function validateRedisConfig(): void {
  if (!redisConfig.url) {
    throw new Error('REDIS_URL or UPSTASH_REDIS_REST_URL environment variable is required');
  }
  if (!redisConfig.token) {
    throw new Error('REDIS_TOKEN or UPSTASH_REDIS_REST_TOKEN environment variable is required');
  }
}
