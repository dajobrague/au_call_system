/**
 * Outbound Call TwiML Generator Route
 * Phase 4: Serves TwiML when outbound call is answered
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateOutboundCallTwiML, getTwiMLContentType } from '../../../../src/services/calling/twiml-generator';
import { logger } from '../../../../src/lib/logger';

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
          headers: { 'Content-Type': getTwiMLContentType() }
        }
      );
    }
    
    // Generate audio URL
    const { getBaseUrl } = await import('../../../../src/config/base-url');
    const baseUrl = getBaseUrl();
    const audioUrl = `${baseUrl}/api/outbound/audio/${callId}`;
    
    // Generate TwiML
    const twiml = generateOutboundCallTwiML({
      audioUrl,
      callId,
      occurrenceId,
      employeeId,
      round: parseInt(round, 10),
    });
    
    logger.info('TwiML generated successfully', {
      callId,
      occurrenceId,
      employeeId,
      audioUrl,
      type: 'outbound_twiml_generated'
    });
    
    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': getTwiMLContentType() }
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
        headers: { 'Content-Type': getTwiMLContentType() }
      }
    );
  }
}

// Support POST as well (Twilio can use either)
export async function POST(request: NextRequest) {
  return GET(request);
}
