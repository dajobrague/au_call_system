/**
 * Outbound Call Response Handler
 * Phase 4: Handles DTMF input from staff (1=accept, 2=decline)
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleJobAcceptance, handleJobDecline } from '../../../../src/services/calling/call-outcome-handler';
import { 
  generateAcceptedTwiML, 
  generateDeclinedTwiML,
  generateInvalidInputTwiML,
  getTwiMLContentType 
} from '../../../../src/services/calling/twiml-generator';
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
    const round = searchParams.get('round');
    
    // Parse form data from Twilio
    const formData = await request.formData();
    const digits = formData.get('Digits') as string;
    const callSid = formData.get('CallSid') as string;
    
    logger.info('Received outbound call DTMF response', {
      callId,
      occurrenceId,
      employeeId,
      round,
      digits,
      callSid,
      type: 'outbound_response_received'
    });
    
    // Validate required parameters
    if (!callId || !occurrenceId || !employeeId) {
      logger.error('Missing required parameters', {
        callId,
        occurrenceId,
        employeeId,
        type: 'outbound_response_missing_params'
      });
      
      return new NextResponse(generateInvalidInputTwiML('', '', '', '', 1), {
        status: 400,
        headers: { 'Content-Type': getTwiMLContentType() }
      });
    }
    
    // Handle based on digit pressed
    if (digits === '1') {
      // ACCEPT - Assign job to employee
      logger.info('Staff accepted shift', {
        callId,
        occurrenceId,
        employeeId,
        callSid,
        type: 'outbound_response_accepted'
      });
      
      // Get call log record ID from query params if available
      const callLogRecordId = searchParams.get('callLogRecordId') || undefined;
      
      // Process acceptance
      const result = await handleJobAcceptance(
        occurrenceId,
        employeeId,
        callSid,
        callLogRecordId
      );
      
      if (result.success) {
        logger.info('Job acceptance processed successfully', {
          callId,
          occurrenceId,
          employeeId,
          type: 'outbound_acceptance_success'
        });
        
        // Return TwiML with confirmation message
        return new NextResponse(generateAcceptedTwiML(), {
          status: 200,
          headers: { 'Content-Type': getTwiMLContentType() }
        });
      } else {
        logger.error('Job acceptance processing failed', {
          callId,
          occurrenceId,
          employeeId,
          error: result.error,
          type: 'outbound_acceptance_failed'
        });
        
        // Return error TwiML
        return new NextResponse(generateAcceptedTwiML(), {
          status: 200,
          headers: { 'Content-Type': getTwiMLContentType() }
        });
      }
      
    } else if (digits === '2') {
      // DECLINE - Schedule next call
      logger.info('Staff declined shift', {
        callId,
        occurrenceId,
        employeeId,
        callSid,
        type: 'outbound_response_declined'
      });
      
      // Get job data from queue to pass to handler
      // We need to reconstruct the job data or get it from Redis
      // For now, we'll get it from the active job
      const jobs = await outboundCallQueue.getJobs(['active', 'waiting', 'delayed']);
      const currentJob = jobs.find((job: any) => 
        job.data.occurrenceId === occurrenceId && 
        job.data.staffPoolIds[job.data.currentStaffIndex] === employeeId
      );
      
      if (currentJob) {
        const callLogRecordId = searchParams.get('callLogRecordId') || undefined;
        
        const result = await handleJobDecline(
          currentJob.data,
          employeeId,
          callSid,
          callLogRecordId
        );
        
        logger.info('Job decline processed', {
          callId,
          occurrenceId,
          employeeId,
          nextCallScheduled: result.nextCallScheduled,
          type: 'outbound_decline_processed'
        });
      } else {
        logger.warn('Could not find job data for decline handling', {
          callId,
          occurrenceId,
          employeeId,
          type: 'outbound_decline_no_job_data'
        });
      }
      
      // Return TwiML with decline message
      return new NextResponse(generateDeclinedTwiML(), {
        status: 200,
        headers: { 'Content-Type': getTwiMLContentType() }
      });
      
    } else {
      // INVALID INPUT - Re-prompt
      logger.warn('Invalid DTMF input received', {
        callId,
        occurrenceId,
        employeeId,
        digits,
        type: 'outbound_response_invalid'
      });
      
      // Generate TwiML to re-prompt (need audio URL)
      // For now, just return declined TwiML
      return new NextResponse(generateDeclinedTwiML(), {
        status: 200,
        headers: { 'Content-Type': getTwiMLContentType() }
      });
    }
    
  } catch (error) {
    logger.error('Outbound call response handler error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'outbound_response_handler_error'
    });
    
    // Return error TwiML
    return new NextResponse(generateDeclinedTwiML(), {
      status: 500,
      headers: { 'Content-Type': getTwiMLContentType() }
    });
  }
}
