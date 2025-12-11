/**
 * Twilio Conference Manager
 * Handles conference creation and call bridging for transfers
 */

const twilio = require('twilio');
import { twilioConfig } from '../../config/twilio';
import { logger } from '../../lib/logger';

const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);

export interface ConferenceTransferOptions {
  callerCallSid: string;
  representativePhone: string;
  callerPhone: string;
  baseUrl?: string;
}

export interface ConferenceTransferResult {
  success: boolean;
  outboundCallSid?: string;
  conferenceName?: string;
  error?: string;
}

/**
 * Transfer a call to a representative using Twilio Conference
 * Creates an outbound call to the representative and bridges both calls in a conference
 */
export async function transferToRepresentative(
  options: ConferenceTransferOptions
): Promise<ConferenceTransferResult> {
  const { getBaseUrl } = await import('../../config/base-url');
  const {
    callerCallSid,
    representativePhone,
    callerPhone,
    baseUrl = getBaseUrl()
  } = options;
  
  const startTime = Date.now();
  const conferenceName = `transfer-${callerCallSid}`;
  
  try {
    logger.info('Creating conference transfer', {
      callerCallSid,
      representativePhone,
      conferenceName,
      type: 'conference_transfer_start'
    });
    
    // Create an outbound call to the representative
    const outboundCall = await twilioClient.calls.create({
      to: representativePhone,
      from: twilioConfig.phoneNumber,
      twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">You have an incoming call from an employee. Connecting now.</Say>
  <Dial>
    <Conference 
      beep="false"
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      statusCallback="${baseUrl}/api/queue/conference-status"
      statusCallbackEvent="start end join leave"
    >${conferenceName}</Conference>
  </Dial>
</Response>`,
      statusCallback: `${baseUrl}/api/queue/transfer-status`,
      statusCallbackEvent: ['answered', 'completed'],
      timeout: 30
    });
    
    logger.info('Outbound call created', {
      outboundCallSid: outboundCall.sid,
      representativePhone,
      duration: Date.now() - startTime,
      type: 'conference_outbound_created'
    });
    
    // Wait for representative to join, then add caller to conference
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Add the caller to the conference using Participant API
    // This keeps the MediaStreams WebSocket connection alive
    logger.info('Adding caller to conference via Participant API', {
      callerCallSid,
      conferenceName,
      type: 'conference_participant_create'
    });
    
    await twilioClient.conferences(conferenceName).participants.create({
      from: twilioConfig.phoneNumber,
      callSid: callerCallSid,
      beep: 'false',
      startConferenceOnEnter: true,
      endConferenceOnExit: true
    });
    
    logger.info('Caller added to conference', {
      callerCallSid,
      conferenceName,
      type: 'conference_participant_added'
    });
    
    logger.info('Conference transfer completed', {
      callerCallSid,
      outboundCallSid: outboundCall.sid,
      conferenceName,
      duration: Date.now() - startTime,
      type: 'conference_transfer_complete'
    });
    
    return {
      success: true,
      outboundCallSid: outboundCall.sid,
      conferenceName
    };
    
  } catch (error) {
    logger.error('Conference transfer failed', {
      callerCallSid,
      representativePhone,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'conference_transfer_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
