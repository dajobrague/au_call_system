/**
 * Initiate Transfer TwiML Handler
 * Returns TwiML to initiate a transfer or enqueue process
 */

import { NextRequest, NextResponse } from 'next/server';
import { callQueueService } from '@/services/queue/call-queue-service';
import { checkPhoneAvailability } from '@/services/queue/twilio-availability';
import { logger } from '@/lib/logger';
import { twiml } from 'twilio';

const VoiceResponse = twiml.VoiceResponse;

const REPRESENTATIVE_PHONE = '+522281957913';

/**
 * POST /api/queue/initiate-transfer
 * Returns TwiML to either transfer immediately or enqueue the caller
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const callerName = formData.get('CallerName') as string | undefined;
    const jobTitle = formData.get('JobTitle') as string | undefined;
    const patientName = formData.get('PatientName') as string | undefined;
    
    if (!callSid || !from) {
      logger.error('Missing required parameters', {
        callSid,
        from,
        type: 'initiate_transfer_error'
      });
      
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please call back later.');
      twiml.hangup();
      
      return new NextResponse(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' }
      });
    }
    
    // Check if representative is available
    const availability = await checkPhoneAvailability(REPRESENTATIVE_PHONE);
    
    const twiml = new VoiceResponse();
    
    if (availability.isAvailable) {
      // Representative is available - transfer immediately
      logger.info('Representative available, initiating transfer', {
        callSid,
        from,
        representativePhone: REPRESENTATIVE_PHONE,
        type: 'initiate_transfer_immediate'
      });
      
      twiml.say(
        { voice: 'Polly.Amy' },
        'A representative is available. Transferring you now. Please hold.'
      );
      
      const dial = twiml.dial({
        callerId: from,
        timeout: 30,
        action: '/api/queue/transfer-status'
      });
      
      dial.number(REPRESENTATIVE_PHONE);
      
      // If transfer fails, redirect to enqueue
      twiml.say(
        { voice: 'Polly.Amy' },
        'The representative is not answering. You will be placed in the queue.'
      );
      twiml.redirect(`/api/queue/enqueue-caller?callSid=${callSid}&from=${encodeURIComponent(from)}`);
      
    } else {
      // Representative unavailable - enqueue immediately
      logger.info('Representative unavailable, enqueueing caller', {
        callSid,
        from,
        reason: availability.reason,
        activeCallsCount: availability.activeCallsCount,
        type: 'initiate_transfer_enqueue'
      });
      
      // Enqueue the call
      const jobInfo = jobTitle && patientName ? { jobTitle, patientName } : undefined;
      const queueResult = await callQueueService.enqueueCall(
        callSid,
        from,
        callerName,
        jobInfo
      );
      
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
      
      // Play hold music and redirect to wait handler
      twiml.play({}, 'http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3');
      twiml.redirect(`/api/queue/wait-handler?callSid=${callSid}`);
    }
    
    logger.info('Transfer initiation completed', {
      callSid,
      from,
      isAvailable: availability.isAvailable,
      duration: Date.now() - startTime,
      type: 'initiate_transfer_complete'
    });
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
    
  } catch (error) {
    logger.error('Error initiating transfer', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      type: 'initiate_transfer_error'
    });
    
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please call back later.');
    twiml.hangup();
    
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}
