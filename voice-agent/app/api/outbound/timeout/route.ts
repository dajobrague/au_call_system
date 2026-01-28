/**
 * Outbound Call Timeout Handler
 * Phase 4: Handles timeout when no DTMF input received
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleNoAnswer } from '../../../../src/services/calling/call-outcome-handler';
import { generateTimeoutTwiML, getTwiMLContentType } from '../../../../src/services/calling/twiml-generator';
import { logger } from '../../../../src/lib/logger';
import { outboundCallQueue } from '../../../../src/services/queue/outbound-call-queue';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get('callId');
    const occurrenceId = searchParams.get('occurrenceId');
    const employeeId = searchParams.get('employeeId');
    
    // Parse form data from Twilio
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    
    logger.info('Received outbound call timeout', {
      callId,
      occurrenceId,
      employeeId,
      callSid,
      type: 'outbound_timeout_received'
    });
    
    // Validate required parameters
    if (!callId || !occurrenceId || !employeeId) {
      logger.error('Missing required parameters in timeout', {
        callId,
        occurrenceId,
        employeeId,
        type: 'outbound_timeout_missing_params'
      });
      
      return new NextResponse(generateTimeoutTwiML(), {
        status: 400,
        headers: { 'Content-Type': getTwiMLContentType() }
      });
    }
    
    // Get job data from queue
    const jobs = await outboundCallQueue.getJobs(['active', 'waiting', 'delayed']);
    const currentJob = jobs.find((job: any) => 
      job.data.occurrenceId === occurrenceId && 
      job.data.staffPoolIds[job.data.currentStaffIndex] === employeeId
    );
    
    if (currentJob) {
      const callLogRecordId = searchParams.get('callLogRecordId') || undefined;
      
      const result = await handleNoAnswer(
        currentJob.data,
        employeeId,
        callSid,
        callLogRecordId
      );
      
      logger.info('Timeout handled', {
        callId,
        occurrenceId,
        employeeId,
        nextCallScheduled: result.nextCallScheduled,
        type: 'outbound_timeout_handled'
      });
    } else {
      logger.warn('Could not find job data for timeout handling', {
        callId,
        occurrenceId,
        employeeId,
        type: 'outbound_timeout_no_job_data'
      });
    }
    
    // Return TwiML with timeout message
    return new NextResponse(generateTimeoutTwiML(), {
      status: 200,
      headers: { 'Content-Type': getTwiMLContentType() }
    });
    
  } catch (error) {
    logger.error('Outbound call timeout handler error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'outbound_timeout_handler_error'
    });
    
    return new NextResponse(generateTimeoutTwiML(), {
      status: 500,
      headers: { 'Content-Type': getTwiMLContentType() }
    });
  }
}
