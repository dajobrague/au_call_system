/**
 * Enqueue Caller TwiML Handler
 * Handles call enqueueing when representative is unavailable or transfer fails
 * Returns TwiML with queue status and hold music
 */

import { NextRequest, NextResponse } from 'next/server';
import { callQueueService } from '@/services/queue/call-queue-service';
import { HOLD_MUSIC_CONFIG } from '@/config/hold-music';
import { logger } from '@/lib/logger';

const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * GET /api/queue/enqueue-caller
 * Enqueues a caller and returns TwiML with queue status and hold music
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const callSid = searchParams.get('callSid') || undefined;
    const from = searchParams.get('from') || undefined;
    const callerName = searchParams.get('callerName') || undefined;
    
    if (!callSid || !from) {
      logger.error('Missing required parameters for enqueue', {
        callSid,
        from,
        type: 'enqueue_caller_error'
      });
      
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please call back later.');
      twiml.hangup();
      
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' }
      });
    }
    
    logger.info('Enqueueing caller from transfer fallback', {
      callSid,
      from,
      type: 'enqueue_caller_start'
    });
    
    // Enqueue the call
    const queueResult = await callQueueService.enqueueCall(
      callSid,
      from,
      callerName || undefined
    );
    
    const twiml = new VoiceResponse();
    
    // Announce queue status
    twiml.say(
      { voice: 'Polly.Amy' },
      'All representatives are currently assisting other callers.'
    );
    
    if (queueResult.position === 1) {
      twiml.say(
        { voice: 'Polly.Amy' },
        'You are next in line. A representative will be with you shortly.'
      );
    } else {
      const estimatedWaitSeconds = await callQueueService.getEstimatedWaitTime(queueResult.position);
      const estimatedWaitMinutes = Math.ceil(estimatedWaitSeconds / 60);
      
      twiml.say(
        { voice: 'Polly.Amy' },
        `You are number ${queueResult.position} in the queue. Your estimated wait time is approximately ${estimatedWaitMinutes} ${estimatedWaitMinutes === 1 ? 'minute' : 'minutes'}.`
      );
    }
    
    twiml.say(
      { voice: 'Polly.Amy' },
      'Please stay on the line. Your call is important to us.'
    );
    
    // Play high-quality hosted hold music with looping
    twiml.play({ loop: HOLD_MUSIC_CONFIG.loop }, HOLD_MUSIC_CONFIG.url);
    
    // Redirect to wait handler for queue updates
    twiml.redirect(`/api/queue/wait-handler?callSid=${callSid}`);
    
    logger.info('Caller enqueued successfully', {
      callSid,
      position: queueResult.position,
      queueSize: queueResult.queueSize,
      duration: Date.now() - startTime,
      type: 'enqueue_caller_complete'
    });
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
    
  } catch (error) {
    logger.error('Error enqueueing caller', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      type: 'enqueue_caller_error'
    });
    
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please call back later.');
    twiml.hangup();
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}

