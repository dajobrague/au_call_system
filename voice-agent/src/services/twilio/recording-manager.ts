/**
 * Twilio Recording Manager
 * Manages recording lifecycle including deletion after S3 archival
 * 
 * Supports dual-region credentials:
 * - US1: default authToken (outbound call recordings)
 * - AU1: au1AuthToken (inbound call recordings)
 */

import { twilioConfig } from '../../config/twilio';
import { logger } from '../../lib/logger';

const twilio = require('twilio');

// US1 client (default)
const twilioClientUS1 = twilio(twilioConfig.accountSid, twilioConfig.authToken);

// AU1 client — for inbound call recordings stored in the Australia region
const twilioClientAU1 = twilioConfig.au1AuthToken
  ? twilio(twilioConfig.accountSid, twilioConfig.au1AuthToken, { region: 'au1', edge: 'sydney' })
  : null;

export type TwilioRegion = 'us1' | 'au1';

/**
 * Get the appropriate Twilio client for a given region
 */
function getClientForRegion(region?: TwilioRegion) {
  if (region === 'au1' && twilioClientAU1) {
    return twilioClientAU1;
  }
  return twilioClientUS1;
}

export interface DeleteRecordingResult {
  success: boolean;
  error?: string;
}

export interface ScheduleDeleteResult {
  success: boolean;
  scheduledFor?: Date;
  error?: string;
}

/**
 * Delete a recording from Twilio
 * Use after successful S3 archival for NDIS compliance
 * @param region - Which Twilio region holds the recording ('au1' for inbound, 'us1' for outbound)
 */
export async function deleteRecording(recordingSid: string, region?: TwilioRegion): Promise<DeleteRecordingResult> {
  const startTime = Date.now();

  try {
    logger.info('Deleting recording from Twilio', {
      recordingSid,
      region: region || 'us1',
      type: 'twilio_recording_delete_start'
    });

    const client = getClientForRegion(region);
    await client.recordings(recordingSid).remove();

    logger.info('Recording deleted from Twilio', {
      recordingSid,
      region: region || 'us1',
      duration: Date.now() - startTime,
      type: 'twilio_recording_deleted'
    });

    return { success: true };

  } catch (error) {
    logger.error('Failed to delete recording from Twilio', {
      recordingSid,
      region: region || 'us1',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'twilio_recording_delete_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Schedule recording deletion after retention period
 * For testing: 24 hours
 * For production: Can be set to immediate (0 hours)
 * @param region - Which Twilio region holds the recording ('au1' for inbound, 'us1' for outbound)
 */
export function scheduleRecordingDeletion(
  recordingSid: string,
  retentionHours: number = 24,
  region?: TwilioRegion
): ScheduleDeleteResult {
  try {
    const scheduledFor = new Date(Date.now() + retentionHours * 60 * 60 * 1000);

    // Set timeout for deletion
    setTimeout(async () => {
      logger.info('Executing scheduled recording deletion', {
        recordingSid,
        region: region || 'us1',
        scheduledFor,
        type: 'scheduled_deletion_executing'
      });

      const result = await deleteRecording(recordingSid, region);
      
      if (result.success) {
        logger.info('Scheduled deletion completed', {
          recordingSid,
          region: region || 'us1',
          type: 'scheduled_deletion_completed'
        });
      } else {
        logger.error('Scheduled deletion failed', {
          recordingSid,
          region: region || 'us1',
          error: result.error,
          type: 'scheduled_deletion_failed'
        });
      }
    }, retentionHours * 60 * 60 * 1000);

    logger.info('Recording deletion scheduled', {
      recordingSid,
      region: region || 'us1',
      scheduledFor: scheduledFor.toISOString(),
      retentionHours,
      type: 'deletion_scheduled'
    });

    return {
      success: true,
      scheduledFor
    };

  } catch (error) {
    logger.error('Failed to schedule recording deletion', {
      recordingSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'schedule_deletion_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get recording info for verification before deletion
 * Tries AU1 first if available, falls back to US1
 */
export async function getRecordingInfo(recordingSid: string, region?: TwilioRegion) {
  const client = getClientForRegion(region);

  try {
    const recording = await client.recordings(recordingSid).fetch();
    
    return {
      success: true,
      info: {
        sid: recording.sid,
        callSid: recording.callSid,
        duration: recording.duration,
        status: recording.status,
        dateCreated: recording.dateCreated
      }
    };
  } catch (error) {
    logger.error('Failed to fetch recording info', {
      recordingSid,
      region: region || 'us1',
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'recording_info_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
