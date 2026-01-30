import { NextRequest, NextResponse } from 'next/server';
import { airtableClient } from '../../../../src/services/airtable/client';
import { twilioConfig } from '../../../../src/config/twilio';
import { generateTwiMLUrl } from '../../../../src/services/calling/twiml-generator';
import { createCallLog } from '../../../../src/services/airtable/call-log-service';
import { logger } from '../../../../src/lib/logger';
const twilio = require('twilio');

export const runtime = 'nodejs';

const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);

/**
 * Test API Endpoint - Trigger Outbound Call
 * 
 * POST /api/test/outbound-call
 * 
 * Body:
 * {
 *   "phoneNumber": "+522281957913",
 *   "occurrenceId": "recXXXXXXXXX"  // Any open job
 * }
 * 
 * Makes ONE test call - safe to use in production
 */
export async function POST(request: NextRequest) {
  logger.info('Test outbound call endpoint called', { type: 'test_outbound_start' });
  
  try {
    const body = await request.json();
    const { phoneNumber, occurrenceId } = body;
    
    // Validation
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'phoneNumber is required (E.164 format, e.g., +522281957913)' },
        { status: 400 }
      );
    }
    
    if (!occurrenceId) {
      return NextResponse.json(
        { error: 'occurrenceId is required (any job ID from Airtable)' },
        { status: 400 }
      );
    }
    
    logger.info('Test call request', {
      phoneNumber,
      occurrenceId,
      type: 'test_outbound_request'
    });
    
    // Fetch job details
    const job = await airtableClient.getJobOccurrenceById(occurrenceId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found', occurrenceId },
        { status: 404 }
      );
    }
    
    logger.info('Job found', {
      occurrenceId,
      status: job.fields['Status'],
      type: 'test_outbound_job_found'
    });
    
    // Prepare job details
    const patientName = job.fields['Patient TXT'] || 'the patient';
    const scheduledDate = job.fields['Scheduled At'] || 'today';
    const displayDate = job.fields['Display Date'] || scheduledDate;
    const startTime = job.fields['Time'] || 'soon';
    const providerId = job.fields['Provider']?.[0] || '';
    
    // Generate unique call ID
    const callId = `TEST-${Date.now()}`;
    
    logger.info('Preparing outbound call (audio will be generated via WebSocket)', { 
      callId, 
      patientName,
      displayDate,
      startTime,
      type: 'test_outbound_preparing' 
    });
    
    // Create call log
    const callLogResult = await createCallLog({
      callSid: 'pending',
      providerId,
      direction: 'Outbound',
      startedAt: new Date().toISOString(),
      callPurpose: 'Outbound Job Offer',
      attemptRound: 1
    });
    
    const callLogRecordId = callLogResult.recordId || '';
    
    // Generate TwiML URL
    const twimlUrl = generateTwiMLUrl(callId, occurrenceId, 'TEST_EMPLOYEE', 1);
    
    // Get base URL for callbacks
    const { getBaseUrl } = await import('../../../../src/config/base-url');
    const baseUrl = getBaseUrl();
    
    logger.info('Initiating Twilio call', {
      callId,
      phoneNumber,
      from: twilioConfig.phoneNumber,
      twimlUrl,
      type: 'test_outbound_twilio_start'
    });
    
    // Make the call
    const call = await twilioClient.calls.create({
      to: phoneNumber,
      from: twilioConfig.phoneNumber,
      url: twimlUrl,
      statusCallback: `${baseUrl}/api/outbound/status?callId=${callId}&occurrenceId=${occurrenceId}&employeeId=TEST&round=1`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      timeout: 30
    });
    
    logger.info('Call initiated', {
      callId,
      callSid: call.sid,
      status: call.status,
      type: 'test_outbound_success'
    });
    
    // Update call log with real CallSid
    if (callLogRecordId) {
      try {
        await airtableClient.updateRecord(
          'tbl9BBKoeV45juYaj', // Call Logs table
          callLogRecordId,
          { 'CallSid': call.sid }
        );
      } catch (error) {
        logger.warn('Failed to update call log with CallSid', {
          callId,
          callSid: call.sid,
          error: error instanceof Error ? error.message : 'Unknown',
          type: 'test_outbound_log_update_warning'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test call initiated successfully',
      data: {
        callSid: call.sid,
        callStatus: call.status,
        phoneNumber,
        occurrenceId,
        jobDetails: {
          patientName,
          date: displayDate,
          time: startTime
        },
        callLogId: callLogRecordId,
        instructions: {
          next: 'Answer the phone when it rings',
          accept: 'Press 1 to accept the shift',
          decline: 'Press 2 to decline the shift',
          monitoring: 'Check Railway logs and Airtable Call Logs table'
        }
      }
    });
    
  } catch (error) {
    logger.error('Test call failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'test_outbound_error'
    });
    
    return NextResponse.json(
      {
        error: 'Failed to initiate test call',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET to show documentation
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/test/outbound-call',
    description: 'Test endpoint to trigger a single outbound call',
    usage: {
      method: 'POST',
      body: {
        phoneNumber: 'string (required) - E.164 format (e.g., +522281957913)',
        occurrenceId: 'string (required) - Any job ID from Airtable'
      },
      example: {
        phoneNumber: '+522281957913',
        occurrenceId: 'recABCDEFGHIJK'
      }
    },
    safety: 'Safe to use in production - only makes ONE call'
  });
}
