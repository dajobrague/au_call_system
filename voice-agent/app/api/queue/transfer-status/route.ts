/**
 * Transfer Status Handler
 * Handles the result of a transfer attempt
 */

import { NextRequest, NextResponse } from 'next/server';
import { callQueueService } from '@/services/queue/call-queue-service';
import { logger } from '@/lib/logger';
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * POST /api/queue/transfer-status
 * Handles the callback after a transfer attempt
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const dialCallStatus = formData.get('DialCallStatus') as string;
    const from = formData.get('From') as string;
    
    logger.info('Transfer status received', {
      callSid,
      dialCallStatus,
      from,
      type: 'transfer_status'
    });
    
    const twiml = new VoiceResponse();
    
    // Check if transfer was successful
    if (dialCallStatus === 'completed') {
      // Transfer successful - call ended normally
      logger.info('Transfer completed successfully', {
        callSid,
        type: 'transfer_success'
      });
      
      twiml.hangup();
      
    } else if (dialCallStatus === 'busy' || dialCallStatus === 'no-answer' || dialCallStatus === 'failed') {
      // Transfer failed - enqueue the caller
      logger.info('Transfer failed, enqueueing caller', {
        callSid,
        dialCallStatus,
        type: 'transfer_failed_enqueue'
      });
      
      // Enqueue the call
      const queueResult = await callQueueService.enqueueCall(
        callSid,
        from
      );
      
      twiml.say(
        { voice: 'Polly.Amy' },
        'The representative is not available. You will be placed in the queue.'
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
      
      // Play hold music and redirect to wait handler
      twiml.play({}, 'http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3');
      twiml.redirect(`/api/queue/wait-handler?callSid=${callSid}`);
      
    } else {
      // Unknown status
      logger.warn('Unknown transfer status', {
        callSid,
        dialCallStatus,
        type: 'transfer_status_unknown'
      });
      
      twiml.say({ voice: 'Polly.Amy' }, 'Thank you for calling. Goodbye.');
      twiml.hangup();
    }
    
    logger.info('Transfer status handled', {
      callSid,
      dialCallStatus,
      duration: Date.now() - startTime,
      type: 'transfer_status_handled'
    });
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
    
  } catch (error) {
    logger.error('Error handling transfer status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      type: 'transfer_status_error'
    });
    
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please call back later.');
    twiml.hangup();
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}
