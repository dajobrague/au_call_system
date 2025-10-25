import { NextRequest, NextResponse } from 'next/server';
import { processCallState } from '@/fsm/state-service';
import { logger } from '@/lib/logger';
import { validateTwilioRequest } from '@/security/twilio-signature';
import { env } from '@/config/env';
import { voiceMetrics } from '../../../../src/services/monitoring/voice-metrics';
import type { TwilioWebhookData } from '@/fsm/types';

// Force Node.js runtime for Redis compatibility
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let callSid: string | undefined;
  
  try {
    // Get request body for signature validation
    const body = await request.text();
    
    // Construct the exact URL Twilio used for signature generation
    // Twilio uses the webhook URL without query parameters
    const url = new URL(request.url);
    const webhookUrl = `${url.protocol}//${url.host}${url.pathname}`;
    
    // Validate Twilio signature for security (skip in development for testing)
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isTestRequest = request.headers.get('User-Agent')?.includes('curl');
    const skipSignatureValidation = (isDevelopment && !request.headers.get('X-Twilio-Signature')) || 
                                   (isTestRequest && !request.headers.get('X-Twilio-Signature'));
    
    // Parse Twilio form data from body
    const formData = new URLSearchParams(body);
    
    if (!skipSignatureValidation) {
      const validation = validateTwilioRequest(
        request.headers,
        webhookUrl,
        formData,
        env.TWILIO_AUTH_TOKEN
      );
      
      if (!validation.isValid) {
        logger.error('Invalid Twilio signature', { 
          reason: validation.reason,
          hasSignature: !!request.headers.get('X-Twilio-Signature'),
          hasAuthToken: !!env.TWILIO_AUTH_TOKEN,
          webhookUrl,
          bodyLength: body.length,
          userAgent: request.headers.get('User-Agent')
        });
        
        return new NextResponse('Forbidden: Invalid signature', { 
          status: 403,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
    
    // Extract webhook data from parsed form data
    const webhookData: TwilioWebhookData = {
      CallSid: formData.get('CallSid') as string,
      From: formData.get('From') as string,
      To: formData.get('To') as string,
      SpeechResult: formData.get('SpeechResult') || undefined,
      Digits: formData.get('Digits') || undefined,
      GatherAttempt: formData.get('GatherAttempt') || undefined,
    };
    
    callSid = webhookData.CallSid;
    
    // Record call start for metrics
    if (callSid) {
      voiceMetrics.recordCallStart(callSid);
    }

    // Validate required fields
    if (!webhookData.CallSid || !webhookData.From || !webhookData.To) {
      logger.error('Missing required webhook data', { 
        callSid: webhookData.CallSid,
        hasFrom: !!webhookData.From,
        hasTo: !!webhookData.To 
      });
      
      return new NextResponse('Bad Request: Missing required fields', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Log incoming request
    logger.webhookRequest({
      sid: webhookData.CallSid,
      from: webhookData.From,
      to: webhookData.To,
      hasInput: !!(webhookData.SpeechResult || webhookData.Digits),
      inputSource: webhookData.SpeechResult ? 'speech' : webhookData.Digits ? 'dtmf' : 'none',
    });

    // For Voice AI mode, return TwiML to stream to Railway WebSocket
    const WEBSOCKET_URL = env.WEBSOCKET_URL || process.env.WEBSOCKET_URL || 'wss://aucallsystem-ivr-system.up.railway.app/stream';
    
    // Generate TwiML with WebSocket stream URL and phone number parameter
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${WEBSOCKET_URL}?phone=${encodeURIComponent(webhookData.From)}&callSid=${webhookData.CallSid}" />
  </Connect>
</Response>`;

    const latencyMs = Date.now() - startTime;
    
    logger.info('Returning TwiML for WebSocket stream', {
      callSid: webhookData.CallSid,
      from: webhookData.From,
      websocketUrl: WEBSOCKET_URL,
      latencyMs
    });

    // Record call metrics
    if (callSid) {
      voiceMetrics.recordCallCompletion(callSid, latencyMs, true);
      voiceMetrics.recordPerformanceMetrics(latencyMs, 1);
    }

    // Return TwiML response
    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'no-cache',
        'X-Response-Time': latencyMs.toString(),
      },
    });

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    
    logger.error('Webhook processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      latencyMs,
    });

    // Fallback TwiML response
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-A" language="en-AU">Sorry, there was an error processing your request. Please try again later.</Say>
  <Hangup/>
</Response>`;

    return new NextResponse(errorTwiML, {
      status: 500,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'no-cache',
      },
    });
  }
}

// Handle unsupported methods
export async function GET() {
  return new NextResponse('Method Not Allowed', { status: 405 });
}