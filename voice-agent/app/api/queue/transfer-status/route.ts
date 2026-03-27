/**
 * Transfer Status Handler
 * Handles the result of a transfer attempt
 */

import { NextRequest, NextResponse } from 'next/server';
import { callQueueService } from '@/services/queue/call-queue-service';
import { HOLD_MUSIC_CONFIG } from '@/config/hold-music';
import { logger } from '@/lib/logger';
import { publishTransferAnswered, publishTransferFailed } from '@/services/redis/call-event-publisher';
import { loadCallState } from '@/fsm/state/state-manager';
const twilio = require('twilio');

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
    const dialCallDuration = formData.get('DialCallDuration') as string;
    const from = formData.get('From') as string;
    
    // Get the caller phone from URL params (set when TwiML was generated)
    const url = new URL(request.url);
    const callerPhone = url.searchParams.get('from') || from || '';
    
    logger.info('Transfer status received', {
      callSid,
      dialCallStatus,
      from,
      callerPhone,
      type: 'transfer_status'
    });
    
    // Load call state to get providerId for event publishing
    let providerId: string | undefined;
    try {
      const callState = await loadCallState(callSid);
      providerId = callState?.provider?.id || callState?.employee?.providerId;
    } catch (err) {
      logger.warn('Could not load call state for transfer event publishing', {
        callSid,
        error: err instanceof Error ? err.message : 'Unknown error',
        type: 'transfer_status_state_warning'
      });
    }
    
    const twiml = new VoiceResponse();
    
    // Check if transfer was successful
    if (dialCallStatus === 'completed') {
      // Transfer successful - call ended normally
      logger.info('Transfer completed successfully', {
        callSid,
        type: 'transfer_success'
      });
      
      // Publish transfer_answered event to Redis (non-blocking)
      if (providerId) {
        publishTransferAnswered(
          callSid,
          providerId,
          callerPhone,
          dialCallDuration ? parseInt(dialCallDuration, 10) : undefined
        ).catch(err => {
          logger.error('Failed to publish transfer_answered event', {
            callSid, error: err.message, type: 'redis_stream_error'
          });
        });
      }
      
      twiml.hangup();
      
    } else if (dialCallStatus === 'busy' || dialCallStatus === 'no-answer' || dialCallStatus === 'failed') {
      // Transfer failed - enqueue the caller
      logger.info('Transfer failed, enqueueing caller', {
        callSid,
        dialCallStatus,
        type: 'transfer_failed_enqueue'
      });
      
      // Publish transfer_failed event to Redis (non-blocking)
      if (providerId) {
        publishTransferFailed(
          callSid,
          providerId,
          callerPhone,
          dialCallStatus
        ).catch(err => {
          logger.error('Failed to publish transfer_failed event', {
            callSid, error: err.message, type: 'redis_stream_error'
          });
        });
      }
      
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
      
      // Play high-quality hosted hold music with looping
      twiml.play({ loop: HOLD_MUSIC_CONFIG.loop }, HOLD_MUSIC_CONFIG.url);
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
