/**
 * Redis Stream Reader for Live Call Logs
 * Reads call events from Redis Streams published by voice-agent
 */

import { getRedisClient } from './redis';

export interface CallEvent {
  timestamp: string;
  type: string;
  description: string;
  data?: any;
}

export interface CallSession {
  callSid: string;
  status: 'in_progress' | 'completed';
  startTime: string;
  endTime?: string;
  duration?: number;
  fromNumber?: string;
  callerName?: string;
  events: CallEvent[];
}

export interface LiveCallLogData {
  calls: CallSession[];
  totalCalls: number;
  inProgressCalls: number;
  lastUpdated: string;
}

/**
 * Time range mappings (in milliseconds)
 */
const TIME_RANGES: Record<string, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

/**
 * Read live call log from Redis Stream for a provider
 */
export async function readLiveCallLog(
  providerId: string,
  timeRange: string = '30m'
): Promise<LiveCallLogData> {
  const redis = getRedisClient();
  const now = Date.now();
  const rangeMs = TIME_RANGES[timeRange] || TIME_RANGES['30m'];
  const cutoffTime = now - rangeMs;

  // Get today's stream key
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const streamKey = `call-events:provider:${providerId}:${today}`;

  try {
    // Read all events from the stream
    const events = await redis.xrange(streamKey, '-', '+');

    if (!events || events.length === 0) {
      return {
        calls: [],
        totalCalls: 0,
        inProgressCalls: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Parse events and group by callSid
    const callMap = new Map<string, CallSession>();

    for (const [eventId, fields] of events) {
      // Parse fields array into object
      const eventData: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        eventData[fields[i]] = fields[i + 1];
      }

      const timestamp = eventData.timestamp;
      const eventTime = new Date(timestamp).getTime();

      // Filter by time range
      if (eventTime < cutoffTime) {
        continue;
      }

      const callSid = eventData.callSid;
      const eventType = eventData.eventType;
      const providerId = eventData.providerId;
      
      // Parse optional data field
      let parsedData: any = {};
      if (eventData.data) {
        try {
          parsedData = JSON.parse(eventData.data);
        } catch (e) {
          console.error('Failed to parse event data:', e);
        }
      }

      // Get or create call session
      if (!callMap.has(callSid)) {
        callMap.set(callSid, {
          callSid,
          status: 'in_progress',
          startTime: timestamp,
          fromNumber: parsedData.fromNumber || '',
          events: [],
        });
      }

      const session = callMap.get(callSid)!;

      // Add event to session
      session.events.push({
        timestamp,
        type: eventType,
        description: formatEventDescription(eventType, parsedData),
        data: parsedData,
      });

      // Update session based on event type
      switch (eventType) {
        case 'call_authenticated':
          session.callerName = parsedData.employeeName;
          break;

        case 'call_ended':
          session.status = 'completed';
          session.endTime = timestamp;
          session.duration = parsedData.duration;
          break;
      }
    }

    // Convert map to array and sort by start time (newest first)
    const calls = Array.from(callMap.values()).sort((a, b) => {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

    // Calculate stats
    const inProgressCalls = calls.filter((c) => c.status === 'in_progress').length;

    return {
      calls,
      totalCalls: calls.length,
      inProgressCalls,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error reading live call log from Redis:', error);
    throw error;
  }
}

/**
 * Format event description for display
 */
function formatEventDescription(eventType: string, data: any): string {
  switch (eventType) {
    case 'call_started':
      return data.fromNumber ? `Call received from ${data.fromNumber}` : 'Call received';

    case 'call_authenticated':
      return `Caller identified as ${data.employeeName || 'Staff member'}`;

    case 'authentication_failed':
      return `Authentication failed: ${data.reason || 'unknown reason'}`;

    case 'intent_detected':
      return `Intent: ${data.description || data.intent || 'unknown'}`;

    case 'shift_opened':
      const patientName = data.patientName ? ` for ${data.patientName}` : '';
      return `Shift ${data.shiftId} opened${patientName}`;

    case 'staff_notified':
      return `${data.staffCount || 0} staff members notified via SMS`;

    case 'transfer_initiated':
      return `Transfer initiated to ${data.transferTo || 'representative'}`;

    case 'transfer_completed':
      return data.success ? 'Transfer completed successfully' : 'Transfer failed';

    case 'call_ended':
      const duration = data.duration ? ` (${formatDuration(data.duration)})` : '';
      return `Call ended${duration}`;

    default:
      return eventType.replace(/_/g, ' ');
  }
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}
