/**
 * Call Event Publisher for Live Call Logs
 * Publishes call events to Redis Streams for real-time monitoring
 * Uses Railway Redis (ioredis) - same as SMS queues and provider-portal
 */

import Redis from 'ioredis';
import { format } from 'date-fns';

let redisClient: Redis | null = null;

/**
 * Get or create Railway Redis client
 */
function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const REDIS_URL = process.env.RAILWAY_REDIS_URL || process.env.REDIS_URL;

  if (!REDIS_URL) {
    console.warn('⚠️  RAILWAY_REDIS_URL not set. Call event publishing disabled.');
    // Return a mock client that does nothing
    return {
      xadd: async () => null,
      expire: async () => 0,
    } as any;
  }

  redisClient = new Redis(REDIS_URL, {
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  redisClient.on('error', (error) => {
    console.error('❌ Redis Stream Publisher error:', error);
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis Stream Publisher connected');
  });

  return redisClient;
}

/**
 * Event types for call logs
 */
export type CallEventType =
  | 'call_started'
  | 'call_authenticated'
  | 'authentication_failed'
  | 'intent_detected'
  | 'shift_opened'
  | 'staff_notified'
  | 'transfer_initiated'
  | 'transfer_completed'
  | 'call_ended';

/**
 * Event data structure
 */
export interface CallEventData {
  eventType: CallEventType;
  callSid: string;
  providerId: string;
  timestamp: string;
  data?: Record<string, any>;
}

/**
 * Generate stream key for provider and date
 * Format: call-events:provider:{providerId}:{YYYY-MM-DD}
 */
function getStreamKey(providerId: string, date?: Date): string {
  const dateStr = format(date || new Date(), 'yyyy-MM-dd');
  return `call-events:provider:${providerId}:${dateStr}`;
}

/**
 * Publish a call event to Redis Stream
 * 
 * @param eventData - Event data to publish
 * @returns Promise<boolean> - Success status
 */
export async function publishCallEvent(eventData: CallEventData): Promise<boolean> {
  try {
    const client = getRedisClient();
    
    // Skip if mock client (no Redis URL configured)
    if (!process.env.RAILWAY_REDIS_URL && !process.env.REDIS_URL) {
      return false;
    }

    const streamKey = getStreamKey(eventData.providerId);
    
    // Prepare event fields for Redis Stream
    const fields: Record<string, string> = {
      eventType: eventData.eventType,
      callSid: eventData.callSid,
      providerId: eventData.providerId,
      timestamp: eventData.timestamp,
    };

    // Add optional data fields
    if (eventData.data) {
      fields.data = JSON.stringify(eventData.data);
    }

    // Add to stream using XADD
    const eventId = await client.xadd(
      streamKey,
      '*', // Auto-generate ID
      ...Object.entries(fields).flat()
    );

    // Set TTL on first write (25 hours = 90000 seconds)
    // This will keep the stream for current day + a bit into next day
    await client.expire(streamKey, 90000, 'NX'); // NX = only if no expiry set

    console.log(`📡 Event published: ${eventData.eventType} [${eventData.callSid}] -> ${streamKey}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to publish call event:', {
      eventType: eventData.eventType,
      callSid: eventData.callSid,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
}

/**
 * Helper functions for specific event types
 */

export async function publishCallStarted(
  callSid: string,
  providerId: string,
  fromNumber: string
): Promise<boolean> {
  return publishCallEvent({
    eventType: 'call_started',
    callSid,
    providerId,
    timestamp: new Date().toISOString(),
    data: { fromNumber },
  });
}

export async function publishCallAuthenticated(
  callSid: string,
  providerId: string,
  employeeName: string,
  employeeId: string
): Promise<boolean> {
  return publishCallEvent({
    eventType: 'call_authenticated',
    callSid,
    providerId,
    timestamp: new Date().toISOString(),
    data: { employeeName, employeeId },
  });
}

export async function publishAuthenticationFailed(
  callSid: string,
  providerId: string,
  reason: string
): Promise<boolean> {
  return publishCallEvent({
    eventType: 'authentication_failed',
    callSid,
    providerId,
    timestamp: new Date().toISOString(),
    data: { reason },
  });
}

export async function publishIntentDetected(
  callSid: string,
  providerId: string,
  intent: string,
  description?: string
): Promise<boolean> {
  return publishCallEvent({
    eventType: 'intent_detected',
    callSid,
    providerId,
    timestamp: new Date().toISOString(),
    data: { intent, description },
  });
}

export async function publishShiftOpened(
  callSid: string,
  providerId: string,
  shiftId: string,
  patientName?: string
): Promise<boolean> {
  return publishCallEvent({
    eventType: 'shift_opened',
    callSid,
    providerId,
    timestamp: new Date().toISOString(),
    data: { shiftId, patientName },
  });
}

export async function publishStaffNotified(
  callSid: string,
  providerId: string,
  staffCount: number,
  shiftId?: string
): Promise<boolean> {
  return publishCallEvent({
    eventType: 'staff_notified',
    callSid,
    providerId,
    timestamp: new Date().toISOString(),
    data: { staffCount, shiftId },
  });
}

export async function publishTransferInitiated(
  callSid: string,
  providerId: string,
  transferTo: string,
  reason?: string
): Promise<boolean> {
  return publishCallEvent({
    eventType: 'transfer_initiated',
    callSid,
    providerId,
    timestamp: new Date().toISOString(),
    data: { transferTo, reason },
  });
}

export async function publishTransferCompleted(
  callSid: string,
  providerId: string,
  success: boolean
): Promise<boolean> {
  return publishCallEvent({
    eventType: 'transfer_completed',
    callSid,
    providerId,
    timestamp: new Date().toISOString(),
    data: { success },
  });
}

export async function publishCallEnded(
  callSid: string,
  providerId: string,
  duration: number
): Promise<boolean> {
  return publishCallEvent({
    eventType: 'call_ended',
    callSid,
    providerId,
    timestamp: new Date().toISOString(),
    data: { duration },
  });
}

/**
 * Close Redis connection (for cleanup/testing)
 */
export function closeRedisPublisher(): void {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
}
