/**
 * Outbound Call TwiML Generator Route
 * Returns Connect/Stream TwiML to use WebSocket (same as inbound)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../src/lib/logger';
import { getWebSocketUrl } from '../../../../src/config/base-url';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('callId');
    const occurrenceId = searchParams.get('occurrenceId');
    const employeeId = searchParams.get('employeeId');
    const round = searchParams.get('round');
    
    logger.info('Generating outbound call TwiML', {
      callId,
      occurrenceId,
      employeeId,
      round,
      type: 'outbound_twiml_request'
    });
    
    // Validate required parameters
    if (!callId || !occurrenceId || !employeeId || !round) {
      logger.error('Missing required parameters for TwiML', {
        callId,
        occurrenceId,
        employeeId,
        round,
        type: 'outbound_twiml_missing_params'
      });
      
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>System error. Please contact support.</Say><Hangup/></Response>',
        {
          status: 400,
          headers: { 'Content-Type': 'application/xml' }
        }
      );
    }
    
    // Generate WebSocket URL
    const websocketUrl = getWebSocketUrl();
    
    // Generate TwiML with Connect/Stream (same as inbound calls)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${websocketUrl}">
      <Parameter name="callType" value="outbound" />
      <Parameter name="callId" value="${callId}" />
      <Parameter name="occurrenceId" value="${occurrenceId}" />
      <Parameter name="employeeId" value="${employeeId}" />
      <Parameter name="round" value="${round}" />
    </Stream>
  </Connect>
</Response>`;
    
    logger.info('TwiML generated with WebSocket stream', {
      callId,
      occurrenceId,
      employeeId,
      round,
      websocketUrl,
      type: 'outbound_twiml_generated'
    });
    
    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    });
    
  } catch (error) {
    logger.error('TwiML generation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'outbound_twiml_error'
    });
    
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>System error. Please contact support.</Say><Hangup/></Response>',
      {
        status: 500,
        headers: { 'Content-Type': 'application/xml' }
      }
    );
  }
}

// Support POST as well (Twilio can use either)
export async function POST(request: NextRequest) {
  return GET(request);
}
