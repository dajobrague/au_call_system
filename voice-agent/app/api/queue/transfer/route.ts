/**
 * Queue Transfer Handler
 * Handles transferring calls to representatives or enqueueing them
 */

import { NextRequest, NextResponse } from 'next/server';
import { callQueueService } from '@/services/queue/call-queue-service';
import { transferCallToPhone } from '@/services/queue/twilio-availability';
import { logger } from '@/lib/logger';
import { loadCallState } from '@/fsm/state/state-manager';
const twilio = require('twilio');

const VoiceResponse = twilio.twiml.VoiceResponse;

export interface TransferRequest {
  callSid: string;
  callerPhone: string;
  callerName?: string;
  jobInfo?: {
    jobTitle: string;
    patientName: string;
  };
}

/**
 * POST /api/queue/transfer
 * Attempts to transfer call to representative or enqueue if unavailable
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json() as TransferRequest;
    const { callSid, callerPhone, callerName, jobInfo } = body;
    
    if (!callSid || !callerPhone) {
      logger.error('Missing required fields in transfer request', {
        callSid,
        callerPhone,
        type: 'transfer_validation_error'
      });
      
      return NextResponse.json(
        { error: 'Missing required fields: callSid, callerPhone' },
        { status: 400 }
      );
    }
    
    // Load dynamic transfer number from call state (provider-specific)
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
    
    // Always attempt transfer - let Twilio Dial handle availability
    logger.info('Attempting transfer to representative', {
      callSid,
      callerPhone,
      representativePhone: transferNumber,
      source: transferNumberSource,
      type: 'transfer_attempt'
    });
    
    const transferResult = await transferCallToPhone(
      callSid,
      transferNumber,
      callerPhone
    );
    
    if (transferResult.success) {
      return NextResponse.json({
        status: 'transferred',
        message: 'Call transfer initiated to representative'
      });
    } else {
      // Transfer initiation failed, enqueue instead
      logger.warn('Transfer initiation failed, enqueueing call', {
        callSid,
        error: transferResult.error,
        type: 'transfer_fallback_enqueue'
      });
    }
    
    // Representative unavailable or transfer failed - enqueue the call
    const queueResult = await callQueueService.enqueueCall(
      callSid,
      callerPhone,
      callerName,
      jobInfo
    );
    
    logger.info('Call enqueued successfully', {
      callSid,
      callerPhone,
      position: queueResult.position,
      queueSize: queueResult.queueSize,
      duration: Date.now() - startTime,
      type: 'transfer_enqueued'
    });
    
    return NextResponse.json({
      status: 'enqueued',
      position: queueResult.position,
      queueSize: queueResult.queueSize,
      message: `You are number ${queueResult.position} in the queue`
    });
    
  } catch (error) {
    logger.error('Error in transfer handler', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      type: 'transfer_handler_error'
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/queue/transfer/next
 * Gets the next caller from the queue (called when representative becomes available)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get next call from queue (skip availability check to avoid auth errors)
    // If representative is truly busy, they simply won't call this endpoint
    logger.info('Getting next caller from queue', {
      type: 'queue_next_caller_request'
    });
    
    const nextCall = await callQueueService.dequeueCall();
    
    if (!nextCall) {
      return NextResponse.json({
        status: 'empty',
        message: 'No calls in queue'
      });
    }
    
    logger.info('Next caller retrieved from queue', {
      callSid: nextCall.callSid,
      callerPhone: nextCall.callerPhone,
      waitTime: Date.now() - new Date(nextCall.enqueuedAt).getTime(),
      duration: Date.now() - startTime,
      type: 'queue_next_caller'
    });
    
    return NextResponse.json({
      status: 'success',
      call: nextCall
    });
    
  } catch (error) {
    logger.error('Error getting next caller', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
      type: 'queue_next_error'
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
