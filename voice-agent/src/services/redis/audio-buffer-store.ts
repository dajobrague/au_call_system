/**
 * Redis Audio Buffer Store
 * Stores call audio buffers in Redis to persist across WebSocket transfers
 * Allows combining recordings from multiple WebSocket connections (initial + transfer)
 */

import { redis } from './index';
import { logger } from '../../lib/logger';

const AUDIO_BUFFER_PREFIX = 'audio:buffers:';
const AUDIO_BUFFER_TTL = 3600; // 1 hour

export interface AudioBuffers {
  inbound: string[]; // Base64 encoded chunks
  outbound: string[];
  lastUpdated: number;
  websocketCount: number; // Track how many WebSockets have contributed
}

/**
 * Get the root callSid for storing audio (uses parentCallSid to group transfers)
 */
export function getRootCallSid(callSid: string, parentCallSid?: string): string {
  return parentCallSid || callSid;
}

/**
 * Append audio chunks to Redis buffer
 */
export async function appendAudioToRedis(
  callSid: string,
  parentCallSid: string | undefined,
  inboundChunks: Buffer[],
  outboundChunks: Buffer[]
): Promise<void> {
  const rootCallSid = getRootCallSid(callSid, parentCallSid);
  const key = `${AUDIO_BUFFER_PREFIX}${rootCallSid}`;
  
  try {
    // Get existing buffers or create new
    const existingData = await redis.get(key);
    const existing: AudioBuffers = existingData 
      ? (typeof existingData === 'string' ? JSON.parse(existingData) : existingData as AudioBuffers)
      : { inbound: [], outbound: [], lastUpdated: Date.now(), websocketCount: 0 };
    
    // Convert new chunks to base64 for JSON storage
    const newInbound = inboundChunks.map(buf => buf.toString('base64'));
    const newOutbound = outboundChunks.map(buf => buf.toString('base64'));
    
    // Append to existing buffers
    existing.inbound.push(...newInbound);
    existing.outbound.push(...newOutbound);
    existing.lastUpdated = Date.now();
    existing.websocketCount = (existing.websocketCount || 0) + 1;
    
    // Store back to Redis
    await redis.setex(key, AUDIO_BUFFER_TTL, JSON.stringify(existing));
    
    logger.info('📼 Audio buffers appended to Redis', {
      rootCallSid,
      callSid,
      newInboundChunks: newInbound.length,
      newOutboundChunks: newOutbound.length,
      totalInboundChunks: existing.inbound.length,
      totalOutboundChunks: existing.outbound.length,
      websocketCount: existing.websocketCount,
      type: 'audio_buffer_append'
    });
    
  } catch (error) {
    logger.error('Failed to append audio to Redis', {
      rootCallSid,
      callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'audio_buffer_append_error'
    });
    throw error;
  }
}

/**
 * Retrieve complete audio buffers from Redis
 */
export async function getAudioFromRedis(
  callSid: string,
  parentCallSid?: string
): Promise<{ inbound: Buffer[]; outbound: Buffer[] } | null> {
  const rootCallSid = getRootCallSid(callSid, parentCallSid);
  const key = `${AUDIO_BUFFER_PREFIX}${rootCallSid}`;
  
  try {
    const data = await redis.get(key);
    if (!data) {
      return null;
    }
    
    const buffers: AudioBuffers = typeof data === 'string' ? JSON.parse(data) : data as AudioBuffers;
    
    // Convert base64 back to Buffers
    const inbound = buffers.inbound.map(b64 => Buffer.from(b64, 'base64'));
    const outbound = buffers.outbound.map(b64 => Buffer.from(b64, 'base64'));
    
    logger.info('📼 Audio buffers retrieved from Redis', {
      rootCallSid,
      callSid,
      inboundChunks: inbound.length,
      outboundChunks: outbound.length,
      websocketCount: buffers.websocketCount,
      type: 'audio_buffer_retrieve'
    });
    
    return { inbound, outbound };
    
  } catch (error) {
    logger.error('Failed to retrieve audio from Redis', {
      rootCallSid,
      callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'audio_buffer_retrieve_error'
    });
    return null;
  }
}

/**
 * Delete audio buffers from Redis (after successful upload)
 */
export async function deleteAudioFromRedis(
  callSid: string,
  parentCallSid?: string
): Promise<void> {
  const rootCallSid = getRootCallSid(callSid, parentCallSid);
  const key = `${AUDIO_BUFFER_PREFIX}${rootCallSid}`;
  
  try {
    await redis.del(key);
    logger.info('🗑️ Audio buffers deleted from Redis', {
      rootCallSid,
      callSid,
      type: 'audio_buffer_delete'
    });
  } catch (error) {
    logger.error('Failed to delete audio from Redis', {
      rootCallSid,
      callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'audio_buffer_delete_error'
    });
  }
}

/**
 * Check if this is the final WebSocket in a call chain
 * (no pending transfers and no active child calls)
 * 
 * IMPORTANT: Checks cached state first to avoid race conditions with Redis writes.
 * The cache is updated synchronously before ws.close(), ensuring we always have
 * the latest state even if Redis write is still in progress.
 */
export async function isFinalWebSocket(
  ws: any // WebSocketWithExtensions
): Promise<boolean> {
  const callSid = ws.callSid || 'unknown';
  
  try {
    // STEP 1: Check cached state first (synchronous, always up-to-date)
    // This prevents race conditions where ws.close() happens before Redis write completes
    if (ws.cachedData?.callState) {
      const cachedState = ws.cachedData.callState;
      
      if (cachedState.pendingTransfer) {
        logger.info('Not final WebSocket - has pending transfer (from cache)', {
          callSid,
          cacheAge: Date.now() - (ws.cachedData.cachedAt || 0),
          type: 'audio_not_final_ws_cached'
        });
        return false;
      }
      
      logger.info('Final WebSocket confirmed (from cache)', {
        callSid,
        cacheAge: Date.now() - (ws.cachedData.cachedAt || 0),
        type: 'audio_final_ws_cached'
      });
      return true;
    }
    
    // STEP 2: Fallback to Redis if cache is missing (shouldn't happen, but safe)
    logger.warn('No cached state found, falling back to Redis', {
      callSid,
      type: 'audio_no_cache_fallback'
    });
    
    const { loadCallState } = await import('../../fsm/state/state-manager');
    const callState = await loadCallState(callSid);
    
    if (callState?.pendingTransfer) {
      logger.info('Not final WebSocket - has pending transfer (from Redis)', {
        callSid,
        type: 'audio_not_final_ws_redis'
      });
      return false;
    }
    
    return true;
    
  } catch (error) {
    logger.error('Error checking if final WebSocket', {
      callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'audio_final_ws_check_error'
    });
    // Default to true to avoid blocking uploads
    return true;
  }
}

