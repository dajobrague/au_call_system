/**
 * Transfer Handler
 * Handles representative transfer with queue management
 */

import { checkPhoneAvailability } from '../services/queue/twilio-availability';
import { callQueueService } from '../services/queue/call-queue-service';
import { transferToRepresentative } from '../services/twilio/conference-manager';
import { logger } from '../lib/logger';

export interface TransferOptions {
  callSid: string;
  callerPhone: string;
  callerName?: string;
  representativePhone: string;
  jobInfo?: {
    jobTitle: string;
    patientName: string;
  };
}

export interface TransferResult {
  status: 'transferred' | 'enqueued' | 'error';
  message: string;
  queuePosition?: number;
  queueSize?: number;
  estimatedWaitMinutes?: number;
  conferenceName?: string;
  error?: string;
}

/**
 * Attempt to transfer call to representative
 * If representative is busy, enqueue the caller
 */
export async function handleRepresentativeTransfer(
  options: TransferOptions
): Promise<TransferResult> {
  const {
    callSid,
    callerPhone,
    callerName,
    representativePhone,
    jobInfo
  } = options;
  
  const startTime = Date.now();
  
  try {
    logger.info('Checking representative availability', {
      callSid,
      representativePhone,
      type: 'transfer_check_start'
    });
    
    // Check if representative is available
    const availability = await checkPhoneAvailability(representativePhone);
    
    if (availability.isAvailable) {
      // Representative is available - transfer immediately
      logger.info('Representative available - initiating transfer', {
        callSid,
        representativePhone,
        activeCallsCount: availability.activeCallsCount,
        duration: Date.now() - startTime,
        type: 'transfer_immediate'
      });
      
      const transferResult = await transferToRepresentative({
        callerCallSid: callSid,
        representativePhone,
        callerPhone
      });
      
      if (transferResult.success) {
        return {
          status: 'transferred',
          message: 'A representative is available. Transferring you now. Please hold while I connect your call.',
          conferenceName: transferResult.conferenceName
        };
      } else {
        // Transfer failed, fall through to enqueue
        logger.warn('Transfer failed, enqueueing instead', {
          callSid,
          error: transferResult.error,
          type: 'transfer_failed_enqueue'
        });
      }
    } else {
      logger.info('Representative busy - enqueueing caller', {
        callSid,
        representativePhone,
        activeCallsCount: availability.activeCallsCount,
        reason: availability.reason,
        duration: Date.now() - startTime,
        type: 'transfer_enqueue'
      });
    }
    
    // Representative unavailable or transfer failed - enqueue the caller
    const queueResult = await callQueueService.enqueueCall(
      callSid,
      callerPhone,
      callerName,
      jobInfo
    );
    
    // Calculate estimated wait time
    const estimatedWaitSeconds = await callQueueService.getEstimatedWaitTime(queueResult.position);
    const estimatedWaitMinutes = Math.ceil(estimatedWaitSeconds / 60);
    
    // Generate queue message
    let queueMessage: string;
    if (queueResult.position === 1) {
      queueMessage = 'All representatives are currently assisting other callers. You are next in line. A representative will be with you shortly. Please stay on the line.';
    } else {
      queueMessage = `All representatives are currently assisting other callers. You are number ${queueResult.position} in the queue. Your estimated wait time is approximately ${estimatedWaitMinutes} ${estimatedWaitMinutes === 1 ? 'minute' : 'minutes'}. Please stay on the line. Your call is important to us.`;
    }
    
    logger.info('Caller enqueued successfully', {
      callSid,
      position: queueResult.position,
      queueSize: queueResult.queueSize,
      estimatedWaitMinutes,
      duration: Date.now() - startTime,
      type: 'transfer_enqueued_success'
    });
    
    return {
      status: 'enqueued',
      message: queueMessage,
      queuePosition: queueResult.position,
      queueSize: queueResult.queueSize,
      estimatedWaitMinutes
    };
    
  } catch (error) {
    logger.error('Transfer handler error', {
      callSid,
      representativePhone,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'transfer_handler_error'
    });
    
    return {
      status: 'error',
      message: "I'm having trouble connecting you to a representative. Please try again later.",
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get periodic queue update message
 * @param callSid - Call SID to check position
 * @returns Update message or null if not in queue
 */
export async function getQueueUpdateMessage(callSid: string): Promise<string | null> {
  try {
    const position = await callQueueService.getCallPosition(callSid);
    
    if (position === null) {
      // Call removed from queue (transferred or disconnected)
      return null;
    }
    
    if (position === 1) {
      return 'You are next in line. A representative will be with you shortly. Thank you for your patience.';
    } else {
      const waitTime = await callQueueService.getEstimatedWaitTime(position);
      const waitMinutes = Math.ceil(waitTime / 60);
      return `You are number ${position} in the queue. Estimated wait time is ${waitMinutes} ${waitMinutes === 1 ? 'minute' : 'minutes'}. Thank you for your patience.`;
    }
  } catch (error) {
    logger.error('Queue update error', {
      callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'queue_update_error'
    });
    return null;
  }
}
