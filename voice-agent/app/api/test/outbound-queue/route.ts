/**
 * Test API Endpoint - Trigger Outbound Call via Redis/Bull Queue
 * 
 * Simulates the post-Wave-3 flow: fetches occurrence data from Airtable,
 * looks up the provider config, gathers the staff pool, and queues the
 * outbound call job through Bull exactly as the wave processor would.
 * 
 * POST /api/test/outbound-queue
 * Body: { "occurrenceId": "recXXX", "delaySeconds": 5 }
 */

import { NextRequest, NextResponse } from 'next/server';
import { airtableClient } from '../../../../src/services/airtable/client';
import { scheduleOutboundCallAfterSMS, outboundCallQueue } from '../../../../src/services/queue/outbound-call-queue';
import { logger } from '../../../../src/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  logger.info('Test outbound queue endpoint called', { type: 'test_outbound_queue_start' });

  try {
    const body = await request.json();
    const { occurrenceId, delaySeconds } = body;

    if (!occurrenceId) {
      return NextResponse.json(
        { error: 'occurrenceId is required' },
        { status: 400 }
      );
    }

    // Step 1: Fetch the job occurrence from Airtable
    const jobOccurrence = await airtableClient.getJobOccurrenceById(occurrenceId);

    if (!jobOccurrence) {
      return NextResponse.json(
        { error: 'Job occurrence not found', occurrenceId },
        { status: 404 }
      );
    }

    const fields = jobOccurrence.fields;

    // Step 2: Resolve provider and staff pool via Patient record
    // The occurrence may not have a direct Provider link (that comes from Assigned Employee).
    // Instead, get the Patient record which has both Provider and Related Staff Pool.
    let providerId = fields['Provider']?.[0]
      || (fields as any)['recordId (from Provider) (from Patient (Link))']?.[0]
      || (fields as any)['recordId (from Provider) (from Job Template)']?.[0];
    let staffPoolIds: string[] = [];

    // Get Patient linked to this occurrence
    const patientId = fields['Patient (Link)']?.[0] || fields['Patient']?.[0] || (fields as any)['Patient (Lookup)']?.[0];

    if (patientId) {
      const patientRecord = await airtableClient.getPatientById(patientId);

      if (patientRecord) {
        // Use patient's provider if occurrence doesn't have one directly
        if (!providerId) {
          providerId = patientRecord.fields['Provider']?.[0];
        }
        // Get staff pool from patient record
        staffPoolIds = patientRecord.fields['Related Staff Pool'] || [];

        logger.info('Resolved provider and staff pool from Patient record', {
          occurrenceId,
          patientId,
          providerId,
          staffPoolSize: staffPoolIds.length,
          type: 'test_outbound_queue_patient_resolved'
        });
      }
    }

    if (!providerId) {
      return NextResponse.json(
        { error: 'No provider found on occurrence or linked patient', occurrenceId, patientId },
        { status: 400 }
      );
    }

    if (staffPoolIds.length === 0) {
      return NextResponse.json(
        { error: 'No staff pool found on linked patient record', occurrenceId, patientId },
        { status: 400 }
      );
    }

    // Step 3: Get provider config for outbound calling
    const providerRecord = await airtableClient.getProviderById(providerId);

    if (!providerRecord) {
      return NextResponse.json(
        { error: 'Provider not found', providerId },
        { status: 404 }
      );
    }

    const providerFields = providerRecord.fields;
    const maxRounds = providerFields['Outbound Call Max Rounds'] || 3;
    const messageTemplate = providerFields['Outbound Call Message Template'] || '';

    // Step 4: Gather job details (same as wave processor)
    const patientName = fields['Patient TXT'] || 'the patient';
    const scheduledDate = fields['Scheduled At'] || '';
    const displayDate = fields['Display Date'] || scheduledDate;
    const startTime = fields['Time'] || '';
    const endTime = (fields as any)['End Time'] || '';
    const suburb = (fields as any)['Suburb'] || '';

    // Extract first name and last initial for privacy
    const nameParts = patientName.split(' ');
    const patientFirstName = nameParts[0] || '';
    const patientLastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] || '' : '';

    // Step 5: Remove any stale job with the same ID (from previous test runs)
    const expectedJobId = `outbound-${occurrenceId}-r1-s0`;
    try {
      const existingJob = await outboundCallQueue.getJob(expectedJobId);
      if (existingJob) {
        const state = await existingJob.getState();
        logger.info('Found existing job, removing before re-queue', {
          jobId: expectedJobId,
          state,
          type: 'test_outbound_queue_cleanup'
        });
        await existingJob.remove();
      }
    } catch (cleanupErr) {
      logger.warn('Could not clean up stale job (non-fatal)', {
        jobId: expectedJobId,
        error: cleanupErr instanceof Error ? cleanupErr.message : 'Unknown',
        type: 'test_outbound_queue_cleanup_warn'
      });
    }

    // Step 6: Queue the job (use short delay for testing, default 5 seconds)
    const waitMinutes = (delaySeconds || 5) / 60; // Convert seconds to minutes

    logger.info('Queueing outbound call job via Bull', {
      occurrenceId,
      providerId,
      staffPoolSize: staffPoolIds.length,
      staffPoolIds,
      maxRounds,
      delaySeconds: delaySeconds || 5,
      patientName,
      scheduledDate,
      startTime,
      type: 'test_outbound_queue_scheduling'
    });

    const scheduledJob = await scheduleOutboundCallAfterSMS(
      occurrenceId,
      waitMinutes,
      {
        occurrenceId,
        providerId,
        staffPoolIds,
        maxRounds,
        jobDetails: {
          patientName,
          patientFirstName,
          patientLastInitial,
          scheduledDate,
          displayDate,
          startTime,
          endTime,
          suburb,
          messageTemplate
        }
      }
    );

    logger.info('Outbound call job queued successfully', {
      occurrenceId,
      jobId: scheduledJob.id,
      staffPoolSize: staffPoolIds.length,
      type: 'test_outbound_queue_scheduled'
    });

    return NextResponse.json({
      success: true,
      message: 'Outbound call job queued via Bull/Redis',
      data: {
        jobId: scheduledJob.id,
        occurrenceId,
        providerId,
        providerName: providerFields['Name'] || 'Unknown',
        staffPoolIds,
        staffPoolSize: staffPoolIds.length,
        maxRounds,
        delaySeconds: delaySeconds || 5,
        jobDetails: {
          patientName,
          scheduledDate,
          displayDate,
          startTime,
        },
        instructions: {
          flow: 'Job queued → Worker picks up after delay → Calls first staff member → Waits for DTMF',
          monitoring: 'Check Railway logs for: outbound_call_processing → outbound_call_twilio_start → outbound_twiml_request',
        }
      }
    });

  } catch (error) {
    logger.error('Test outbound queue failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'test_outbound_queue_error'
    });

    return NextResponse.json(
      {
        error: 'Failed to queue outbound call',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET to show documentation
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/test/outbound-queue',
    description: 'Test endpoint that queues an outbound call through the full Redis/Bull pipeline (same as post-Wave-3 flow)',
    usage: {
      method: 'POST',
      body: {
        occurrenceId: 'string (required) - Job occurrence ID from Airtable',
        delaySeconds: 'number (optional, default: 5) - Seconds before the worker processes the job'
      },
      example: {
        occurrenceId: 'recbT0OX8OA7tqXMx',
        delaySeconds: 5
      }
    },
    flow: 'Airtable lookup → Bull queue (with delay) → Worker → Twilio call → TwiML → WebSocket → Job offer'
  });
}
