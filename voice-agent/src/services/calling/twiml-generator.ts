/**
 * TwiML Generator for Outbound Calls
 * Phase 3: Audio Generation & TwiML
 * 
 * Generates TwiML responses for outbound calls with DTMF input gathering
 */

import { logger } from '../../lib/logger';
import { 
  OUTBOUND_CALL_DEFAULTS, 
  TWIML_VOICE, 
  RESPONSE_MESSAGES 
} from '../../config/outbound-calling';

/**
 * TwiML generation options
 */
export interface TwiMLOptions {
  audioUrl: string;              // URL to pre-generated audio
  callId: string;                // Unique call identifier
  occurrenceId: string;          // Job occurrence ID
  employeeId: string;            // Employee being called
  round: number;                 // Current round number
}

/**
 * Generate TwiML for initial outbound call
 * This plays the pre-generated audio and gathers DTMF input
 * 
 * @param options - TwiML generation options
 * @returns TwiML XML string
 */
export function generateOutboundCallTwiML(options: TwiMLOptions): string {
  const { audioUrl, callId, occurrenceId, employeeId, round } = options;
  const { getBaseUrl } = require('../../config/base-url');
  const baseUrl = getBaseUrl();
  
  // Action URL for DTMF response
  const actionUrl = `${baseUrl}/api/outbound/response?callId=${callId}&occurrenceId=${occurrenceId}&employeeId=${employeeId}&round=${round}`;
  
  // Timeout URL (no input received)
  const timeoutUrl = `${baseUrl}/api/outbound/timeout?callId=${callId}&occurrenceId=${occurrenceId}&employeeId=${employeeId}`;
  
  logger.info('Generating outbound call TwiML', {
    callId,
    occurrenceId,
    employeeId,
    round,
    audioUrl,
    type: 'twiml_generation'
  });
  
  // Generate TwiML with Gather element
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    numDigits="${OUTBOUND_CALL_DEFAULTS.GATHER_NUM_DIGITS}" 
    timeout="${OUTBOUND_CALL_DEFAULTS.GATHER_TIMEOUT}"
    action="${actionUrl}"
    method="POST"
  >
    <Play>${audioUrl}</Play>
  </Gather>
  
  <!-- Fallback if no input received -->
  <Say voice="${TWIML_VOICE.VOICE}" language="${TWIML_VOICE.LANGUAGE}">
    ${RESPONSE_MESSAGES.NO_RESPONSE}
  </Say>
  <Redirect>${timeoutUrl}</Redirect>
</Response>`;
  
  return twiml;
}

/**
 * Generate TwiML response for accepted shift (press 1)
 */
export function generateAcceptedTwiML(): string {
  logger.info('Generating accepted response TwiML', {
    type: 'twiml_accepted'
  });
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${TWIML_VOICE.VOICE}" language="${TWIML_VOICE.LANGUAGE}">
    ${RESPONSE_MESSAGES.ACCEPTED}
  </Say>
  <Hangup/>
</Response>`;
  
  return twiml;
}

/**
 * Generate TwiML response for declined shift (press 2)
 */
export function generateDeclinedTwiML(): string {
  logger.info('Generating declined response TwiML', {
    type: 'twiml_declined'
  });
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${TWIML_VOICE.VOICE}" language="${TWIML_VOICE.LANGUAGE}">
    ${RESPONSE_MESSAGES.DECLINED}
  </Say>
  <Hangup/>
</Response>`;
  
  return twiml;
}

/**
 * Generate TwiML response for timeout (no input)
 */
export function generateTimeoutTwiML(): string {
  logger.info('Generating timeout response TwiML', {
    type: 'twiml_timeout'
  });
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${TWIML_VOICE.VOICE}" language="${TWIML_VOICE.LANGUAGE}">
    ${RESPONSE_MESSAGES.TIMEOUT}
  </Say>
  <Hangup/>
</Response>`;
  
  return twiml;
}

/**
 * Generate TwiML response for error
 */
export function generateErrorTwiML(): string {
  logger.error('Generating error response TwiML', {
    type: 'twiml_error'
  });
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${TWIML_VOICE.VOICE}" language="${TWIML_VOICE.LANGUAGE}">
    ${RESPONSE_MESSAGES.ERROR}
  </Say>
  <Hangup/>
</Response>`;
  
  return twiml;
}

/**
 * Generate TwiML for invalid DTMF input (not 1 or 2)
 */
export function generateInvalidInputTwiML(
  audioUrl: string,
  callId: string,
  occurrenceId: string,
  employeeId: string,
  round: number
): string {
  const { getBaseUrl } = require('../../config/base-url');
  const baseUrl = getBaseUrl();
  
  const actionUrl = `${baseUrl}/api/outbound/response?callId=${callId}&occurrenceId=${occurrenceId}&employeeId=${employeeId}&round=${round}`;
  
  logger.warn('Generating invalid input TwiML', {
    callId,
    occurrenceId,
    employeeId,
    type: 'twiml_invalid_input'
  });
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${TWIML_VOICE.VOICE}" language="${TWIML_VOICE.LANGUAGE}">
    Invalid input. Please press 1 to accept the shift, or press 2 to decline.
  </Say>
  <Gather 
    numDigits="${OUTBOUND_CALL_DEFAULTS.GATHER_NUM_DIGITS}" 
    timeout="${OUTBOUND_CALL_DEFAULTS.GATHER_TIMEOUT}"
    action="${actionUrl}"
    method="POST"
  >
    <Play>${audioUrl}</Play>
  </Gather>
  <Say voice="${TWIML_VOICE.VOICE}" language="${TWIML_VOICE.LANGUAGE}">
    ${RESPONSE_MESSAGES.TIMEOUT}
  </Say>
  <Hangup/>
</Response>`;
  
  return twiml;
}

/**
 * Escape XML special characters for TwiML
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Validate TwiML structure
 * Basic validation to ensure well-formed XML
 */
export function validateTwiML(twiml: string): { valid: boolean; error?: string } {
  try {
    // Check for required opening tag
    if (!twiml.includes('<Response>')) {
      return { valid: false, error: 'Missing <Response> opening tag' };
    }
    
    // Check for required closing tag
    if (!twiml.includes('</Response>')) {
      return { valid: false, error: 'Missing </Response> closing tag' };
    }
    
    // Check for XML declaration
    if (!twiml.includes('<?xml')) {
      return { valid: false, error: 'Missing XML declaration' };
    }
    
    // Basic balance check (not comprehensive but catches obvious errors)
    const openTags = (twiml.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (twiml.match(/<\/[^>]+>/g) || []).length;
    
    if (openTags !== closeTags) {
      return { valid: false, error: 'Unbalanced tags detected' };
    }
    
    return { valid: true };
    
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Validation error' 
    };
  }
}

/**
 * Get TwiML content type header
 */
export function getTwiMLContentType(): string {
  return 'application/xml; charset=utf-8';
}

/**
 * Generate TwiML URL for Twilio call initiation
 * This is the URL Twilio will request when the call connects
 */
export function generateTwiMLUrl(
  callId: string,
  occurrenceId: string,
  employeeId: string,
  round: number
): string {
  const { getBaseUrl } = require('../../config/base-url');
  const baseUrl = getBaseUrl();
  
  return `${baseUrl}/api/outbound/twiml?callId=${callId}&occurrenceId=${occurrenceId}&employeeId=${employeeId}&round=${round}`;
}
