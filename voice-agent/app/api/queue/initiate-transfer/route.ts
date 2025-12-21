/**
 * Initiate Transfer TwiML Handler
 * Returns TwiML to initiate a transfer or enqueue process
 */

import { NextRequest, NextResponse } from 'next/server';
import { callQueueService } from '@/services/queue/call-queue-service';
import { HOLD_MUSIC_CONFIG } from '@/config/hold-music';
import { logger } from '@/lib/logger';
import { loadCallState } from '@/fsm/state/state-manager';
const twilio = require('twilio');

const VoiceResponse = twilio.twiml.VoiceResponse;

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
    
    // Load call state to get dynamic transfer number
    let transferNumber = process.env.REPRESENTATIVE_PHONE || '+61490550941';
    let transferNumberSource = process.env.REPRESENTATIVE_PHONE ? 'environment' : 'default';
    
    try {
      const callState = await loadCallState(callSid);
      if (callState?.pendingTransfer?.representativePhone) {
        transferNumber = callState.pendingTransfer.representativePhone;
        transferNumberSource = 'call_state';
        logger.info('Transfer number loaded from call state', {
          callSid,
          transferNumber,
          providerName: callState.provider?.name,
          type: 'transfer_number_from_state'
        });
      } else if (callState?.provider?.transferNumber) {
        transferNumber = callState.provider.transferNumber;
        transferNumberSource = 'provider';
        logger.info('Transfer number loaded from provider', {
          callSid,
          transferNumber,
          providerName: callState.provider.name,
          type: 'transfer_number_from_provider'
        });
      }
    } catch (stateError) {
      logger.warn('Could not load call state for transfer number, using fallback', {
        callSid,
        error: stateError instanceof Error ? stateError.message : 'Unknown error',
        type: 'transfer_state_load_error'
      });
    }
    
    // Always attempt transfer - Twilio Dial timeout handles unavailability automatically
    // This avoids authentication errors with checkPhoneAvailability API
    logger.info('Attempting transfer to representative', {
      callSid,
      from,
      representativePhone: transferNumber,
      source: transferNumberSource,
      type: 'initiate_transfer_attempt'
    });
    
    const twiml = new VoiceResponse();
    
    // Always try to dial first
    twiml.say(
      { voice: 'Polly.Amy' },
      'Connecting you to a representative. Please hold.'
    );
    
    const dial = twiml.dial({
      callerId: from,
      timeout: 30,
      action: '/api/queue/transfer-status'
    });
    
    dial.number(transferNumber);
    
    // If transfer fails (no answer/busy), redirect to enqueue
    twiml.say(
      { voice: 'Polly.Amy' },
      'The representative is not answering. You will be placed in the queue.'
    );
    twiml.redirect(`/api/queue/enqueue-caller?callSid=${callSid}&from=${encodeURIComponent(from)}`);
    
    logger.info('Transfer TwiML sent - Dial will attempt connection', {
      callSid,
      from,
      representativePhone: transferNumber,
      source: transferNumberSource,
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
