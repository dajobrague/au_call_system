/**
 * Twilio Dial Transfer Service
 * Handles call transfers using TwiML <Dial> verb
 * Maintains call recording for compliance
 */

const twilio = require('twilio');
import { twilioConfig } from '../../config/twilio';
import { logger } from '../../lib/logger';
import { publishTransferInitiated, publishTransferCompleted } from '../redis/call-event-publisher';

const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);

export interface DialTransferOptions {
  callerCallSid: string;
  representativePhone: string;
  callerPhone: string;
  baseUrl?: string;
  providerId?: string;
}

export interface DialTransferResult {
  success: boolean;
  error?: string;
}

/**
 * Transfer a call to a representative using TwiML <Dial>
 * This function updates the live call with inline TwiML after WebSocket closes
 * 
 * IMPORTANT: WebSocket MUST be closed BEFORE calling this function
 * 
 * @param options - Transfer options including call SID and representative phone
 * @returns Transfer result with success status
 */
export async function dialTransferToRepresentative(
  options: DialTransferOptions
): Promise<DialTransferResult> {
  const { getBaseUrl } = await import('../../config/base-url');
  const {
    callerCallSid,
    representativePhone,
    callerPhone,
    baseUrl = getBaseUrl(),
    providerId
  } = options;
  
  const startTime = Date.now();
  
  try {
    logger.info('Updating call with Dial TwiML', {
      callerCallSid,
      representativePhone,
      type: 'dial_transfer_update_start'
    });
    
    // Publish transfer_initiated event to Redis Stream (non-blocking)
    if (providerId) {
      publishTransferInitiated(
        callerCallSid,
        providerId,
        representativePhone,
        'Employee requested to speak with representative'
      ).catch(err => {
        logger.error('Failed to publish transfer_initiated event', {
          callSid: callerCallSid,
          error: err.message,
          type: 'redis_stream_error'
        });
      });
    }
    
    // Build inline TwiML with <Dial> and fallback to queue
    // If rep doesn't answer within 30 seconds, redirect to queue endpoint
    const dialTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-C">Connecting you to a representative. Please hold.</Say>
  <Dial 
    callerId="${callerPhone}" 
    timeout="30" 
    record="record-from-answer"
    action="${baseUrl}/api/queue/transfer-status?callSid=${callerCallSid}&amp;from=${encodeURIComponent(callerPhone)}">
    <Number>${representativePhone}</Number>
  </Dial>
  <Say voice="Google.en-AU-Wavenet-C">The representative is not available. You will be placed in the queue.</Say>
  <Redirect>${baseUrl}/api/queue/enqueue-caller?callSid=${callerCallSid}&amp;from=${encodeURIComponent(callerPhone)}</Redirect>
</Response>`;
    
    // Update the call with new TwiML
    // This will work now because WebSocket has been closed
    await twilioClient.calls(callerCallSid).update({
      twiml: dialTwiml
    });
    
    const duration = Date.now() - startTime;
    
    logger.info('Call updated with Dial TwiML successfully', {
      callerCallSid,
      representativePhone,
      duration,
      type: 'dial_transfer_update_success'
    });
    
    // Publish transfer_completed event to Redis Stream (non-blocking)
    if (providerId) {
      publishTransferCompleted(
        callerCallSid,
        providerId,
        true
      ).catch(err => {
        logger.error('Failed to publish transfer_completed event', {
          callSid: callerCallSid,
          error: err.message,
          type: 'redis_stream_error'
        });
      });
    }
    
    return {
      success: true
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to update call with Dial TwiML', {
      callerCallSid,
      representativePhone,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration,
      type: 'dial_transfer_update_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

