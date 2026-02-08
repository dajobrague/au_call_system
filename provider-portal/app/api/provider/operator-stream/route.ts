/**
 * Operator Stream - Server-Sent Events (SSE) endpoint
 * Streams real-time call events to the operator dashboard
 * Provider-scoped: only reads events for the authenticated provider
 */

import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRedisClient } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/provider/operator-stream
 * Returns an SSE stream of call events for the authenticated provider
 */
export async function GET(request: NextRequest) {
  // Authenticate
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const providerId = user.providerId;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const streamKey = `call-events:provider:${providerId}:${today}`;

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let lastId = '0-0'; // Start from beginning, or use '$' for only new events
  let isAborted = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ providerId, streamKey })}\n\n`)
      );

      const redis = getRedisClient();

      // Poll Redis Streams every 2 seconds
      const pollInterval = setInterval(async () => {
        if (isAborted) {
          clearInterval(pollInterval);
          return;
        }

        try {
          // Read new events since last ID
          const events = await redis.xrange(streamKey, `(${lastId}`, '+');

          if (events && events.length > 0) {
            for (const [eventId, fields] of events) {
              // Parse fields array into object
              const eventData: Record<string, string> = {};
              for (let i = 0; i < fields.length; i += 2) {
                eventData[fields[i]] = fields[i + 1];
              }

              // Parse optional data field
              let parsedData: Record<string, unknown> = {};
              if (eventData.data) {
                try {
                  parsedData = JSON.parse(eventData.data);
                } catch {
                  // ignore parse errors
                }
              }

              // Send event via SSE
              const sseData = JSON.stringify({
                id: eventId,
                eventType: eventData.eventType,
                callSid: eventData.callSid,
                providerId: eventData.providerId,
                timestamp: eventData.timestamp,
                data: parsedData,
              });

              controller.enqueue(
                encoder.encode(`event: call-event\ndata: ${sseData}\n\n`)
              );

              // Update cursor
              lastId = eventId;
            }
          }
        } catch (error) {
          // Don't crash the stream on transient errors
          console.error('SSE poll error:', error);
        }
      }, 2000);

      // Send keepalive every 15 seconds to prevent connection timeout
      const keepaliveInterval = setInterval(() => {
        if (isAborted) {
          clearInterval(keepaliveInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: keepalive ${new Date().toISOString()}\n\n`));
        } catch {
          clearInterval(keepaliveInterval);
        }
      }, 15000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        isAborted = true;
        clearInterval(pollInterval);
        clearInterval(keepaliveInterval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
