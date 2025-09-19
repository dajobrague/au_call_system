/**
 * Redis client wrapper for Upstash
 * Provides singleton connection and state management operations
 */

import { Redis } from '@upstash/redis';
import { redisConfig, validateRedisConfig } from './config';

let redisClient: Redis | null = null;

/**
 * Get or create Redis client (singleton pattern)
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    validateRedisConfig();
    redisClient = new Redis({
      url: redisConfig.url,
      token: redisConfig.token,
    });
  }
  return redisClient;
}

/**
 * Get value from Redis with JSON parsing
 */
export async function getState<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? (value as T) : null;
  } catch (error) {
    console.error('Redis GET error:', { key, error });
    return null;
  }
}

/**
 * Set value in Redis with JSON serialization and TTL
 */
export async function setState<T>(key: string, value: T): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.setex(key, redisConfig.ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis SET error:', { key, error });
    return false;
  }
}

/**
 * Delete key from Redis
 */
export async function deleteState(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', { key, error });
    return false;
  }
}

/**
 * Check if Redis is available (health check)
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

/**
 * Cache voice prompt for WebSocket to retrieve
 */
export async function cacheVoicePrompt(callSid: string, prompt: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    const key = `voice_prompt:${callSid}`;
    // Short TTL for prompts (5 minutes)
    await client.setex(key, 300, JSON.stringify({ prompt, timestamp: Date.now() }));
    console.log(`💾 Cached voice prompt for ${callSid}: "${prompt}"`);
    return true;
  } catch (error) {
    console.error('Redis voice prompt cache error:', { callSid, error });
    return false;
  }
}

/**
 * Get cached voice prompt for WebSocket
 */
export async function getVoicePrompt(callSid: string): Promise<string | null> {
  try {
    const client = getRedisClient();
    const key = `voice_prompt:${callSid}`;
    const cached = await client.get(key);
    
    if (cached && typeof cached === 'object' && 'prompt' in cached) {
      const promptData = cached as { prompt: string; timestamp: number };
      console.log(`📝 Retrieved cached voice prompt for ${callSid}: "${promptData.prompt}"`);
      return promptData.prompt;
    }
    
    return null;
  } catch (error) {
    console.error('Redis voice prompt get error:', { callSid, error });
    return null;
  }
}
