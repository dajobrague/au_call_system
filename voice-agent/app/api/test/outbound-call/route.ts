import { NextRequest, NextResponse } from 'next/server';
import { getJobOccurrenceById } from '../../../../src/services/airtable/job-service';
import { getEmployeeById } from '../../../../src/services/airtable/employee-service';
import { generateOutboundCallAudio } from '../../../../src/services/calling/audio-pregenerator';
import { generateTwiMLUrl } from '../../../../src/services/calling/twiml-generator';
import { createCallLog } from '../../../../src/services/airtable/call-log-service';
import { twilioClient, twilioConfig } from '../../../../src/config/telephony';

export const runtime = 'nodejs';

/**
 * Test API Endpoint - Trigger Outbound Call
 * 
 * POST /api/test/outbound-call
 * 
 * Body:
 * {
 *   "phoneNumber": "+522281957913",
 *   "occurrenceId": "recXXXXXXXXX",  // Any open job
 *   "employeeId": "recYYYYYYYYY"      // Optional: any employee (for name)
 * }
 * 
 * This endpoint:
 * 1. Fetches job details from Airtable
 * 2. Generates personalized audio
 * 3. Makes a test call to the specified number
 * 4. Creates a call log
 * 
 * Safe to use in production - only makes ONE call, doesn't affect queues
 */
export async function POST(request: NextRequest) {
  console.log('[Test Outbound Call] API endpoint called');
  
  try {
    const body = await request.json();
    const { phoneNumber, occurrenceId, employeeId } = body;
    
    // Validation
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'phoneNumber is required' },
        { status: 400 }
      );
    }
    
    if (!occurrenceId) {
      return NextResponse.json(
        { error: 'occurrenceId is required (any open job ID)' },
        { status: 400 }
      );
    }
    
    console.log('[Test Outbound Call] Request:', {
      phoneNumber,
      occurrenceId,
      employeeId: employeeId || 'none (will use generic)'
    });
    
    // Fetch job details
    console.log('[Test Outbound Call] Fetching job details...');
    const job = await getJobOccurrenceById(occurrenceId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    console.log('[Test Outbound Call] Job found:', {
      status: job.status,
      patientName: job.patientName,
      date: job.scheduledDate
    });
    
    // Get employee name (or use generic)
    let employeeName = 'there';
    let employeeFirstName = 'there';
    
    if (employeeId) {
      console.log('[Test Outbound Call] Fetching employee details...');
      const employee = await getEmployeeById(employeeId);
      if (employee) {
        employeeName = `${employee.firstName} ${employee.lastName}`;
        employeeFirstName = employee.firstName;
        console.log('[Test Outbound Call] Employee found:', employeeName);
      }
    }
    
    // Prepare job details for audio generation
    const jobDetails = {
      patientName: job.patientName || 'the patient',
      patientFirstName: job.patientFirstName || 'the patient',
      patientLastInitial: job.patientLastName?.charAt(0) || '',
      scheduledDate: job.scheduledDate,
      displayDate: job.displayDate || job.scheduledDate,
      startTime: job.startTime,
      endTime: job.endTime,
      suburb: job.suburb,
      messageTemplate: `Hi {employeeName}, we have an urgent shift for {patientName} on {date} at {time}. It's in {suburb}. Press 1 to accept this shift, or press 2 to decline.`
    };
    
    console.log('[Test Outbound Call] Generating audio...');
    
    // Generate audio
    const audioResult = await generateOutboundCallAudio(
      employeeName,
      employeeFirstName,
      jobDetails
    );
    
    console.log('[Test Outbound Call] Audio generated:', {
      callId: audioResult.callId,
      audioUrl: audioResult.audioUrl,
      estimatedDuration: audioResult.estimatedDuration
    });
    
    // Create call log
    console.log('[Test Outbound Call] Creating call log...');
    const callLogResult = await createCallLog({
      callSid: `TEST-${Date.now()}`, // Will be updated with real SID
      providerId: job.providerId,
      employeeId: employeeId,
      direction: 'Outbound',
      startedAt: new Date().toISOString(),
      callPurpose: 'Outbound Job Offer',
      attemptRound: 1
    });
    
    const callLogRecordId = callLogResult.id;
    console.log('[Test Outbound Call] Call log created:', callLogRecordId);
    
    // Generate TwiML URL
    const twimlUrl = generateTwiMLUrl(
      audioResult.callId,
      occurrenceId,
      employeeId || 'TEST_EMPLOYEE',
      1 // Round 1
    );
    
    console.log('[Test Outbound Call] TwiML URL:', twimlUrl);
    
    // Get base URL for callbacks
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.RAILWAY_PUBLIC_DOMAIN 
                      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
                      : 'http://localhost:3000';
    
    // Make the call!
    console.log('[Test Outbound Call] Initiating Twilio call...');
    console.log('[Test Outbound Call] From:', twilioConfig.phoneNumber);
    console.log('[Test Outbound Call] To:', phoneNumber);
    
    const call = await twilioClient.calls.create({
      to: phoneNumber,
      from: twilioConfig.phoneNumber,
      url: twimlUrl,
      statusCallback: `${baseUrl}/api/outbound/status?callId=${audioResult.callId}&occurrenceId=${occurrenceId}&employeeId=${employeeId || 'TEST'}&round=1`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      timeout: 30,
      record: false, // Don't record test calls
      machineDetection: 'Enable'
    });
    
    console.log('[Test Outbound Call] ✅ Call initiated!');
    console.log('[Test Outbound Call] Call SID:', call.sid);
    console.log('[Test Outbound Call] Status:', call.status);
    
    return NextResponse.json({
      success: true,
      message: 'Test call initiated successfully',
      data: {
        callSid: call.sid,
        callStatus: call.status,
        phoneNumber: phoneNumber,
        occurrenceId: occurrenceId,
        employeeName: employeeName,
        jobDetails: {
          patientName: job.patientName,
          date: job.displayDate || job.scheduledDate,
          time: job.startTime,
          suburb: job.suburb
        },
        callLogId: callLogRecordId,
        twimlUrl: twimlUrl,
        audioUrl: audioResult.audioUrl,
        estimatedDuration: `${audioResult.estimatedDuration}s`,
        instructions: {
          next: 'Answer the phone when it rings',
          accept: 'Press 1 to accept the shift',
          decline: 'Press 2 to decline the shift',
          monitoring: {
            callLogs: 'Check Airtable Call Logs table',
            serverLogs: 'Check Railway logs for details',
            twilioConsole: 'Check Twilio console for call status'
          }
        }
      }
    });
    
  } catch (error) {
    console.error('[Test Outbound Call] ❌ Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to initiate test call',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Also support GET to show documentation
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/test/outbound-call',
    description: 'Test endpoint to trigger a single outbound call',
    usage: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        phoneNumber: 'string (required) - Phone number in E.164 format (e.g., +522281957913)',
        occurrenceId: 'string (required) - Any job occurrence ID from Airtable',
        employeeId: 'string (optional) - Employee ID for personalization, or omit for generic greeting'
      },
      example: {
        phoneNumber: '+522281957913',
        occurrenceId: 'recABCDEFGHIJK',
        employeeId: 'recXYZ123456789'
      }
    },
    safety: {
      production: 'Safe to use in production',
      impact: 'Only makes ONE call, does not affect job queues or assignment',
      cost: 'Each call costs ~$0.01-0.02 USD via Twilio'
    },
    testing: {
      step1: 'Deploy code to Railway',
      step2: 'Get any open job ID from Airtable Job Occurrences table',
      step3: 'Make POST request to this endpoint with your phone number',
      step4: 'Answer phone and press 1 or 2',
      step5: 'Check Airtable Call Logs for results'
    }
  });
}
