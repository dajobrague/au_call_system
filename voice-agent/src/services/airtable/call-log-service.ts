/**
 * Call Log Service
 * Manages call logging to Airtable for compliance and analytics
 */

import { airtableClient } from './client';
import { logger } from '../../lib/logger';
import { CallEvent, CallLogCreateData, CallLogUpdateData, CallLogResult } from '../../types/call-log';
import { CallState } from '../../fsm/types';

const CALL_LOGS_TABLE_ID = 'tbl9BBKoeV45juYaj';

/**
 * Get Australian timezone timestamp
 */
function getAustralianTimestamp(date: Date = new Date()): string {
  return date.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Create initial call log record
 */
export async function createCallLog(data: CallLogCreateData): Promise<CallLogResult> {
  try {
    logger.info('Creating call log record', {
      callSid: data.callSid,
      employeeId: data.employeeId,
      providerId: data.providerId,
      type: 'call_log_create_start'
    });

    const fields: any = {
      'CallSid': data.callSid,
      'Direction': data.direction,
      'Started At': data.startedAt
    };

    // Add linked records if available
    if (data.providerId) {
      fields['Provider'] = [data.providerId];
    }
    if (data.employeeId) {
      fields['Employee'] = [data.employeeId];
    }
    
    // Add outbound calling fields (Phase 4)
    if (data.callPurpose) {
      fields['Call Purpose'] = data.callPurpose;
    }
    if (data.attemptRound) {
      fields['Attempt Round'] = data.attemptRound;
    }

    const response = await airtableClient.createRecord(CALL_LOGS_TABLE_ID, fields);

    logger.info('Call log record created', {
      callSid: data.callSid,
      recordId: response.id,
      type: 'call_log_created'
    });

    return {
      success: true,
      recordId: response.id
    };

  } catch (error) {
    logger.error('Failed to create call log', {
      callSid: data.callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'call_log_create_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update call log record with final details
 */
export async function updateCallLog(recordId: string, data: CallLogUpdateData): Promise<CallLogResult> {
  try {
    logger.info('Updating call log record', {
      recordId,
      duration: data.seconds,
      hasRecording: !!data.recordingUrl,
      type: 'call_log_update_start'
    });

    const fields: any = {
      'Ended At': data.endedAt,
      'Seconds': data.seconds,
      'Raw Payload': data.rawPayload
    };

    // Add optional fields
    if (data.recordingUrl) {
      fields['Recording URL (Twilio/S3)'] = data.recordingUrl;
    }
    if (data.detectedIntent) {
      fields['Detected Intent/Action'] = data.detectedIntent;
    }
    if (data.patientId) {
      fields['Patient'] = [data.patientId];
    }
    if (data.relatedOccurrenceId) {
      fields['Related Occurrence'] = [data.relatedOccurrenceId];
    }
    if (data.notes) {
      fields['Notes'] = data.notes;
    }
    
    // Add outbound calling fields (Phase 4)
    if (data.callOutcome) {
      fields['Call Outcome'] = data.callOutcome;
    }
    if (data.dtmfResponse) {
      fields['DTMF Response'] = data.dtmfResponse;
    }

    await airtableClient.updateRecord(CALL_LOGS_TABLE_ID, recordId, fields);

    logger.info('Call log record updated', {
      recordId,
      type: 'call_log_updated'
    });

    return { success: true, recordId };

  } catch (error) {
    logger.error('Failed to update call log', {
      recordId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'call_log_update_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update call log with transfer recording URL
 * This is called separately after the conference recording is processed
 */
export async function updateCallLogWithTransferRecording(
  callSid: string,
  transferRecordingUrl: string
): Promise<CallLogResult> {
  try {
    logger.info('Updating call log with transfer recording', {
      callSid,
      type: 'call_log_transfer_recording_update_start'
    });

    // Find the call log record by CallSid
    const { airtableClient } = await import('./client');
    const records = await airtableClient.findRecords(
      CALL_LOGS_TABLE_ID, 
      `{CallSid} = '${callSid}'`,
      { maxRecords: 1 }
    );

    if (!records || records.length === 0) {
      logger.error('Call log record not found for transfer recording update', {
        callSid,
        type: 'call_log_not_found'
      });
      return {
        success: false,
        error: 'Call log record not found'
      };
    }

    const recordId = records[0].id;
    const fields: any = {
      'Transfer Recording URL': transferRecordingUrl
    };

    await airtableClient.updateRecord(CALL_LOGS_TABLE_ID, recordId, fields);

    logger.info('✅ Call log updated with transfer recording URL', {
      callSid,
      recordId,
      type: 'call_log_transfer_recording_updated'
    });

    return { success: true, recordId };

  } catch (error) {
    logger.error('Failed to update call log with transfer recording', {
      callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'call_log_transfer_recording_update_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Build human-readable activity summary
 */
export function buildActivitySummary(callState: CallState, events: CallEvent[]): string {
  const activities: string[] = [];

  // Check for reschedule
  const rescheduleEvent = events.find(e => e.action === 'reschedule_confirmed');
  if (rescheduleEvent && callState.dateTimeInput) {
    const oldDate = callState.selectedOccurrence?.scheduledAt || 'previous date';
    const newDate = callState.dateTimeInput.displayDateTime || 
                    `${callState.dateTimeInput.fullDate} at ${callState.dateTimeInput.time}`;
    activities.push(`Rescheduled appointment from ${oldDate} to ${newDate}`);
  }

  // Check for leave open
  const leaveOpenEvent = events.find(e => e.action === 'leave_open_confirmed');
  if (leaveOpenEvent && callState.selectedOccurrence) {
    activities.push(`Left job open for ${callState.selectedOccurrence.scheduledAt}`);
  }

  // Check for transfer
  const transferEvent = events.find(e => e.action === 'transferred_to_representative');
  if (transferEvent) {
    const reason = transferEvent.details?.reason || 'user request';
    activities.push(`Transferred to representative (${reason})`);
  }

  // Check for multiple job selections
  const jobSelections = events.filter(e => e.action === 'job_selected');
  if (jobSelections.length > 1) {
    activities.push(`Selected ${jobSelections.length} different jobs`);
  }

  // Check for authentication method
  const authEvent = events.find(e => e.action === 'phone_auth_success' || e.action === 'pin_auth_success');
  if (authEvent) {
    const method = authEvent.action === 'phone_auth_success' ? 'phone' : 'PIN';
    activities.push(`Authenticated via ${method}`);
  }

  return activities.length > 0 ? activities.join('; ') : 'Call completed';
}

/**
 * Build human-readable raw payload (Option B format)
 */
export function buildRawPayload(events: CallEvent[]): string {
  const lines: string[] = [];

  events.forEach(event => {
    const timestamp = new Date(event.timestamp);
    const timeStr = timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });

    // Format action for readability
    const action = formatAction(event.action, event.details);
    lines.push(`[${timeStr}] ${event.phase}: ${action}`);
  });

  return lines.join('\n');
}

/**
 * Format action for human readability
 */
function formatAction(action: string, details?: any): string {
  switch (action) {
    case 'phone_auth_success':
      return `Phone authentication successful (${details?.employeeName || 'Employee'})`;
    
    case 'pin_auth_success':
      return `PIN authentication successful (${details?.employeeName || 'Employee'})`;
    
    case 'provider_selected':
      return `Selected provider: ${details?.providerName || 'Unknown'}`;
    
    case 'job_selected':
      return `Selected job: "${details?.jobTitle || 'Unknown'}" (${details?.jobCode || ''}) for ${details?.patientName || 'Patient'}`;
    
    case 'occurrence_selected':
      return `Selected occurrence: ${details?.date || 'Unknown date'}`;
    
    case 'speech_transcribed':
      return `User said: "${details?.text || ''}"`;
    
    case 'datetime_extracted':
      return `AI extracted: ${details?.displayText || details?.dateISO || 'date/time'}`;
    
    case 'reschedule_confirmed':
      return `Rescheduled to ${details?.newDate || ''} at ${details?.newTime || ''}`;
    
    case 'leave_open_confirmed':
      return `Left job open for ${details?.date || 'occurrence'}`;
    
    case 'transferred_to_representative':
      return `Transferred to representative (${details?.reason || 'user request'})`;
    
    case 'call_ended':
      return `Call ended (${details?.reason || 'normal'})`;
    
    default:
      return action.replace(/_/g, ' ');
  }
}

/**
 * Helper to track event in WebSocket
 */
export function trackCallEvent(
  events: CallEvent[], 
  phase: string, 
  action: string, 
  details?: any
): void {
  events.push({
    timestamp: new Date().toISOString(),
    phase,
    action,
    details
  });
}
