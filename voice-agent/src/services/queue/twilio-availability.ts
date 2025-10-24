/**
 * Twilio Availability Service
 * Checks if representative phone is available for transfer
 */

import twilio from 'twilio';
import { twilioConfig } from '../../config/twilio';
import { logger } from '../../lib/logger';

const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);

export interface PhoneAvailability {
  isAvailable: boolean;
  reason?: string;
  activeCallsCount: number;
}

/**
 * Check if a phone number is available to receive calls
 * A phone is considered unavailable if it has any active calls
 */
export async function checkPhoneAvailability(
  phoneNumber: string
): Promise<PhoneAvailability> {
  const startTime = Date.now();
  
  try {
    // Query Twilio for active calls to/from this phone number
    const calls = await twilioClient.calls.list({
      to: phoneNumber,
      status: 'in-progress',
      limit: 20
    });
    
    const activeCallsCount = calls.length;
    const isAvailable = activeCallsCount === 0;
    
    logger.info('Phone availability checked', {
      phoneNumber,
      isAvailable,
      activeCallsCount,
      duration: Date.now() - startTime,
      type: 'phone_availability_check'
    });
    
    return {
      isAvailable,
      reason: isAvailable ? undefined : 'Phone is currently on another call',
      activeCallsCount
    };
    
  } catch (error) {
    logger.error('Error checking phone availability', {
      phoneNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'phone_availability_error'
    });
    
    // On error, assume phone is unavailable to be safe
    return {
      isAvailable: false,
      reason: 'Unable to verify phone availability',
      activeCallsCount: 0
    };
  }
}

/**
 * Transfer a call to a phone number
 */
export async function transferCallToPhone(
  callSid: string,
  toPhoneNumber: string,
  fromPhoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Update the call to transfer it
    await twilioClient.calls(callSid).update({
      twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Transferring you to a representative now. Please hold.</Say>
  <Dial callerId="${fromPhoneNumber}" timeout="30" action="/api/twilio/transfer-status">
    <Number>${toPhoneNumber}</Number>
  </Dial>
  <Say voice="Polly.Amy">Sorry, the representative is not available. You will be placed in the queue.</Say>
  <Redirect>/api/queue/wait-handler?callSid=${callSid}</Redirect>
</Response>`
    });
    
    logger.info('Call transferred', {
      callSid,
      toPhoneNumber,
      duration: Date.now() - startTime,
      type: 'call_transfer'
    });
    
    return { success: true };
    
  } catch (error) {
    logger.error('Error transferring call', {
      callSid,
      toPhoneNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'call_transfer_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Connect a queued caller to the representative
 * This is called when the representative becomes available
 */
export async function connectQueuedCall(
  queuedCallSid: string,
  representativePhone: string,
  callerPhone: string
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Update the queued call to dial the representative
    await twilioClient.calls(queuedCallSid).update({
      twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Connecting you to a representative now.</Say>
  <Dial callerId="${callerPhone}" timeout="30">
    <Number>${representativePhone}</Number>
  </Dial>
  <Say voice="Polly.Amy">The representative did not answer. Please call back later.</Say>
  <Hangup/>
</Response>`
    });
    
    logger.info('Queued call connected to representative', {
      queuedCallSid,
      representativePhone,
      duration: Date.now() - startTime,
      type: 'queued_call_connect'
    });
    
    return { success: true };
    
  } catch (error) {
    logger.error('Error connecting queued call', {
      queuedCallSid,
      representativePhone,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'queued_call_connect_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
