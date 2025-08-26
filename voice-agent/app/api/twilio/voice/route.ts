import { NextRequest, NextResponse } from 'next/server';
import { processCallState } from '@/fsm/state-service';
import { logger } from '@/lib/logger';
import type { TwilioWebhookData } from '@/fsm/types';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse Twilio form data
    const formData = await request.formData();
    const webhookData: TwilioWebhookData = {
      CallSid: formData.get('CallSid') as string,
      From: formData.get('From') as string,
      To: formData.get('To') as string,
      SpeechResult: formData.get('SpeechResult') as string || undefined,
      Digits: formData.get('Digits') as string || undefined,
      GatherAttempt: formData.get('GatherAttempt') as string || undefined,
    };

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

    // Process through FSM
    const result = await processCallState(webhookData);
    const latencyMs = Date.now() - startTime;

    // Log state transition
    logger.stateTransition({
      ...result.logData,
      sid: webhookData.CallSid,
      from: webhookData.From,
      to: webhookData.To,
      latencyMs,
    });

    // Return TwiML response
    return new NextResponse(result.twiml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'no-cache',
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
  <Say voice="ys3XeJJA4ArWMhRpcX1D" language="en-AU" ttsProvider="ElevenLabs">Sorry, there was an error processing your request. Please try again later.</Say>
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