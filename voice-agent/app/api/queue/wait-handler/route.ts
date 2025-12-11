/**
 * Queue Wait Handler
 * Handles callers waiting in queue with position announcements and hold music
 */

import { NextRequest, NextResponse } from 'next/server';
import { callQueueService } from '@/services/queue/call-queue-service';
import { HOLD_MUSIC_CONFIG } from '@/config/hold-music';
import { logger } from '@/lib/logger';
const twilio = require('twilio');

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * GET/POST /api/queue/wait-handler
 * Provides hold music and periodic position announcements
 */
export async function GET(request: NextRequest) {
  return handleQueueWait(request);
}

export async function POST(request: NextRequest) {
  return handleQueueWait(request);
}

async function handleQueueWait(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const callSid = searchParams.get('callSid') || searchParams.get('CallSid');
  
  try {
    if (!callSid) {
      logger.error('Missing callSid in queue wait handler', {
        type: 'queue_wait_error'
      });
      
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please call back later.');
      twiml.hangup();
      
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' }
      });
    }
    
    // Get caller's position in queue
    const position = await callQueueService.getCallPosition(callSid);
    
    if (position === null) {
      // Call not in queue - this shouldn't happen
      logger.error('Call not found in queue', {
        callSid,
        type: 'queue_wait_error'
      });
      
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please call back later.');
      twiml.hangup();
      
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' }
      });
    }
    
    // Get estimated wait time
    const estimatedWaitSeconds = await callQueueService.getEstimatedWaitTime(position);
    const estimatedWaitMinutes = Math.ceil(estimatedWaitSeconds / 60);
    
    // Create TwiML response
    const twiml = new VoiceResponse();
    
    // Announce position
    if (position === 1) {
      twiml.say(
        { voice: 'Polly.Amy' },
        'You are next in line. A representative will be with you shortly.'
      );
    } else {
      twiml.say(
        { voice: 'Polly.Amy' },
        `You are number ${position} in the queue. Your estimated wait time is approximately ${estimatedWaitMinutes} ${estimatedWaitMinutes === 1 ? 'minute' : 'minutes'}.`
      );
    }
    
    twiml.say(
      { voice: 'Polly.Amy' },
      'Please stay on the line. Your call is important to us.'
    );
    
    // Play high-quality hosted hold music with looping
    twiml.play({ loop: HOLD_MUSIC_CONFIG.loop }, HOLD_MUSIC_CONFIG.url);
    
    // After hold music, redirect back to this handler to check position again
    twiml.redirect(`/api/queue/wait-handler?callSid=${callSid}`);
    
    logger.info('Queue wait handler executed', {
      callSid,
      position,
      estimatedWaitMinutes,
      duration: Date.now() - startTime,
      type: 'queue_wait_handler'
    });
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
    
  } catch (error) {
    logger.error('Error in queue wait handler', {
      callSid: callSid || undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      type: 'queue_wait_handler_error'
    });
    
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please call back later.');
    twiml.hangup();
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}
