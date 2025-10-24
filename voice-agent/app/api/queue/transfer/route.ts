/**
 * Queue Transfer Handler
 * Handles transferring calls to representatives or enqueueing them
 */

import { NextRequest, NextResponse } from 'next/server';
import { callQueueService } from '@/src/services/queue/call-queue-service';
import { checkPhoneAvailability, transferCallToPhone } from '@/src/services/queue/twilio-availability';
import { logger } from '@/src/lib/logger';
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

const REPRESENTATIVE_PHONE = '+522281957913';

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
    
    // Check if representative is available
    const availability = await checkPhoneAvailability(REPRESENTATIVE_PHONE);
    
    if (availability.isAvailable) {
      // Representative is available - transfer immediately
      logger.info('Representative available, transferring call', {
        callSid,
        callerPhone,
        representativePhone: REPRESENTATIVE_PHONE,
        type: 'transfer_immediate'
      });
      
      const transferResult = await transferCallToPhone(
        callSid,
        REPRESENTATIVE_PHONE,
        callerPhone
      );
      
      if (transferResult.success) {
        return NextResponse.json({
          status: 'transferred',
          message: 'Call transferred to representative'
        });
      } else {
        // Transfer failed, enqueue instead
        logger.warn('Transfer failed, enqueueing call', {
          callSid,
          error: transferResult.error,
          type: 'transfer_fallback_enqueue'
        });
      }
    } else {
      logger.info('Representative unavailable, enqueueing call', {
        callSid,
        callerPhone,
        reason: availability.reason,
        activeCallsCount: availability.activeCallsCount,
        type: 'transfer_enqueue'
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
    // Check if representative is available
    const availability = await checkPhoneAvailability(REPRESENTATIVE_PHONE);
    
    if (!availability.isAvailable) {
      return NextResponse.json({
        status: 'unavailable',
        message: 'Representative is currently busy'
      });
    }
    
    // Get next call from queue
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
