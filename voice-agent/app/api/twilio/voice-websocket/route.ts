/**
 * Twilio Voice WebSocket Entry Point
 * Initiates WebSocket connection with call recording
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Get WebSocket URL based on environment
 * Priority: WEBSOCKET_URL > CLOUDFLARE_VOICE_PROXY_URL > fallback
 */
function getWebSocketUrl(): string {
  const url = process.env.WEBSOCKET_URL || process.env.CLOUDFLARE_VOICE_PROXY_URL;
  
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      // Production fallback to Cloudflare WebSocket subdomain
      return 'wss://websocket.oncallafterhours.app/stream';
    }
    // Development fallback to ngrok
    return 'wss://climbing-merely-joey.ngrok-free.app/stream';
  }
  
  return url;
}

const WEBSOCKET_URL = getWebSocketUrl();
const RECORDING_STATUS_CALLBACK = process.env.RECORDING_STATUS_CALLBACK || 'https://sam-voice-agent.vercel.app/api/twilio/recording-status';

/**
 * POST /api/twilio/voice-websocket
 * Entry point for incoming Twilio calls
 * Starts recording and initiates WebSocket connection
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    
    logger.info('Incoming call - initiating WebSocket with recording', {
      callSid,
      from,
      to,
      type: 'call_incoming'
    });
    
    // Generate TwiML with recording and WebSocket connection
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${WEBSOCKET_URL}?from=${encodeURIComponent(from)}" />
  </Start>
  <Say voice="Polly.Amy"></Say>
  <Pause length="3600"/>
</Response>`;
    
    logger.info('TwiML generated with recording', {
      callSid,
      duration: Date.now() - startTime,
      type: 'twiml_generated'
    });
    
    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    logger.error('Error generating voice WebSocket TwiML', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'voice_websocket_error'
    });
    
    // Fallback TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">An error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`;
    
    return new NextResponse(errorTwiml, {
      status: 500,
      headers: {
        'Content-Type': 'application/xml'
      }
    });
  }
}

/**
 * GET /api/twilio/voice-websocket
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'voice-websocket',
    timestamp: new Date().toISOString()
  });
}
