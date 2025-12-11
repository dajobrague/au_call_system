/**
 * Transfer Handler
 * Handles representative transfer with queue management
 * 
 * NOTE: With the new Connect action URL pattern, this handler is no longer
 * directly used for transfers. The transfer is now handled by:
 * 1. Setting pendingTransfer flag in call state (dtmf-router)
 * 2. Closing WebSocket
 * 3. Twilio calls action URL (/api/transfer/after-connect)
 * 4. Action endpoint returns Dial TwiML
 * 
 * This handler is kept for backwards compatibility and queue management.
 */

import { callQueueService } from '../services/queue/call-queue-service';
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
  error?: string;
}

/**
 * Simplified transfer handler
 * Now just returns success - actual transfer handled by Connect action URL
 */
export async function handleRepresentativeTransfer(
  options: TransferOptions
): Promise<TransferResult> {
  const {
    callSid,
    representativePhone
  } = options;
  
  logger.info('Transfer handler called - pendingTransfer flag should be set', {
    callSid,
    representativePhone,
    type: 'transfer_handler_called'
  });
  
  // Return success - the actual transfer is handled by the action URL
  // after the WebSocket closes
  return {
    status: 'transferred',
    message: 'Transfer initiated'
  };
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
