import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { loadCallState } from '@/fsm/state/state-manager';
const twilio = require('twilio');

const VoiceResponse = twilio.twiml.VoiceResponse;

const REPRESENTATIVE_PHONE = process.env.REPRESENTATIVE_PHONE || '+61490550941';

/**
 * POST /api/transfer/after-connect
 * This endpoint is called by Twilio when the <Connect><Stream> ends.
 * It checks if a transfer was pending and returns appropriate TwiML.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Log immediately to confirm Twilio is calling this endpoint
  logger.info('🔔 AFTER-CONNECT ENDPOINT CALLED BY TWILIO', {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    type: 'after_connect_entry'
  });
  
  // Construct base URL from request headers
  const host = request.headers.get('host') || process.env.RAILWAY_PUBLIC_DOMAIN || 'aucallsystem-ivr-system.up.railway.app';
  const protocol = host.includes('localhost') || host.includes('ngrok') ? 'http' : 'https';
  const APP_BASE_URL = `${protocol}://${host}`;
  
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const callStatus = formData.get('CallStatus') as string;

    logger.info('After-connect handler called', {
      callSid,
      from,
      callStatus,
      type: 'after_connect_start'
    });

    const twiml = new VoiceResponse();

    if (!callSid) {
      logger.error('Missing CallSid in after-connect request', {
        type: 'after_connect_missing_callsid'
      });
      twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Goodbye.');
      twiml.hangup();
      return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
    }

    // Load call state to check for pending transfer
    const callState = await loadCallState(callSid);

    if (callState && callState.pendingTransfer) {
      logger.info('Pending transfer found - generating Dial TwiML', {
        callSid,
        representativePhone: callState.pendingTransfer.representativePhone,
        type: 'after_connect_transfer_found'
      });

      // Generate TwiML for transfer with Dial
      twiml.say({ voice: 'Polly.Amy' }, 'Connecting you to a representative. Please hold.');
      
      const dial = twiml.dial({
        callerId: callState.pendingTransfer.callerPhone,
        timeout: 30,
        record: 'record-from-answer',
        action: `${APP_BASE_URL}/api/queue/transfer-status?callSid=${callSid}&from=${encodeURIComponent(from)}`
      });
      
      dial.number(callState.pendingTransfer.representativePhone);

      // Fallback if representative doesn't answer
      twiml.say({ voice: 'Polly.Amy' }, 'The representative is not available. You will be placed in the queue.');
      twiml.redirect(`${APP_BASE_URL}/api/queue/enqueue-caller?callSid=${callSid}&from=${encodeURIComponent(from)}`);

      logger.info('Dial TwiML generated for transfer', {
        callSid,
        representativePhone: callState.pendingTransfer.representativePhone,
        duration: Date.now() - startTime,
        type: 'after_connect_dial_twiml'
      });

    } else {
      // No pending transfer - normal call end
      logger.info('No pending transfer - ending call', {
        callSid,
        type: 'after_connect_normal_end'
      });
      
      twiml.say({ voice: 'Polly.Amy' }, 'Thank you for calling. Goodbye.');
      twiml.hangup();
    }

    const duration = Date.now() - startTime;
    logger.info('After-connect handler complete', {
      callSid,
      duration,
      type: 'after_connect_complete'
    });

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    logger.error('Error in after-connect handler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'after_connect_error'
    });

    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please try again later.');
    twiml.hangup();

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}

