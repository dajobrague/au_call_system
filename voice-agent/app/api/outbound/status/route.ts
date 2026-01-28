/**
 * Outbound Call Status Callback Handler
 * Phase 4: Handles Twilio status callbacks (answered, completed, busy, no-answer, failed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleNoAnswer } from '../../../../src/services/calling/call-outcome-handler';
import { updateCallLog } from '../../../../src/services/airtable/call-log-service';
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
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    const direction = formData.get('Direction') as string;
    
    logger.info('Received outbound call status callback', {
      callId,
      occurrenceId,
      employeeId,
      round,
      callSid,
      callStatus,
      callDuration,
      direction,
      type: 'outbound_status_callback'
    });
    
    // Validate required parameters
    if (!callId || !occurrenceId || !employeeId) {
      logger.error('Missing required parameters in status callback', {
        callId,
        occurrenceId,
        employeeId,
        type: 'outbound_status_missing_params'
      });
      
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Handle different call statuses
    switch (callStatus) {
      case 'completed':
        // Call completed normally (handled by response webhook)
        logger.info('Call completed normally', {
          callId,
          occurrenceId,
          employeeId,
          callDuration,
          type: 'outbound_status_completed'
        });
        break;
        
      case 'no-answer':
      case 'canceled':
      case 'busy':
        // No answer scenarios - schedule next call
        logger.info('Call not answered', {
          callId,
          occurrenceId,
          employeeId,
          callStatus,
          type: 'outbound_status_no_answer'
        });
        
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
          
          logger.info('No answer handled', {
            callId,
            occurrenceId,
            employeeId,
            nextCallScheduled: result.nextCallScheduled,
            type: 'outbound_no_answer_handled'
          });
        } else {
          logger.warn('Could not find job data for no-answer handling', {
            callId,
            occurrenceId,
            employeeId,
            type: 'outbound_no_answer_no_job_data'
          });
        }
        break;
        
      case 'failed':
        // Call failed - log and schedule next
        logger.error('Call failed', {
          callId,
          occurrenceId,
          employeeId,
          callStatus,
          type: 'outbound_status_failed'
        });
        
        // Update call log with failure
        const callLogRecordId = searchParams.get('callLogRecordId');
        if (callLogRecordId) {
          try {
            await updateCallLog(callLogRecordId, {
              endedAt: new Date().toISOString(),
              seconds: parseInt(callDuration || '0', 10),
              callOutcome: 'Failed',
              notes: `Call failed with status: ${callStatus}`,
              rawPayload: JSON.stringify({
                callSid,
                callStatus,
                direction,
                allFormData: Object.fromEntries(formData.entries())
              }),
            });
          } catch (error) {
            logger.warn('Failed to update call log for failed call', {
              callLogRecordId,
              error: error instanceof Error ? error.message : 'Unknown error',
              type: 'outbound_failed_log_warning'
            });
          }
        }
        
        // Schedule next call
        const failedJobs = await outboundCallQueue.getJobs(['active', 'waiting', 'delayed']);
        const failedJob = failedJobs.find((job: any) => 
          job.data.occurrenceId === occurrenceId && 
          job.data.staffPoolIds[job.data.currentStaffIndex] === employeeId
        );
        
        if (failedJob) {
          await handleNoAnswer(
            failedJob.data,
            employeeId,
            callSid,
            callLogRecordId || undefined
          );
        }
        break;
        
      case 'answered':
        // Call was answered - waiting for DTMF input
        logger.info('Call answered, waiting for DTMF', {
          callId,
          occurrenceId,
          employeeId,
          type: 'outbound_status_answered'
        });
        break;
        
      default:
        logger.warn('Unknown call status', {
          callId,
          occurrenceId,
          employeeId,
          callStatus,
          type: 'outbound_status_unknown'
        });
    }
    
    return NextResponse.json({ success: true }, { status: 200 });
    
  } catch (error) {
    logger.error('Outbound call status handler error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'outbound_status_handler_error'
    });
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
