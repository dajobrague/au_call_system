/**
 * Twilio Recording Manager
 * Manages recording lifecycle including deletion after S3 archival
 */

import { twilioConfig } from '../../config/twilio';
import { logger } from '../../lib/logger';

const twilio = require('twilio');
const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);

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
 */
export async function deleteRecording(recordingSid: string): Promise<DeleteRecordingResult> {
  const startTime = Date.now();

  try {
    logger.info('Deleting recording from Twilio', {
      recordingSid,
      type: 'twilio_recording_delete_start'
    });

    await twilioClient.recordings(recordingSid).remove();

    logger.info('Recording deleted from Twilio', {
      recordingSid,
      duration: Date.now() - startTime,
      type: 'twilio_recording_deleted'
    });

    return { success: true };

  } catch (error) {
    logger.error('Failed to delete recording from Twilio', {
      recordingSid,
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
 */
export function scheduleRecordingDeletion(
  recordingSid: string,
  retentionHours: number = 24
): ScheduleDeleteResult {
  try {
    const scheduledFor = new Date(Date.now() + retentionHours * 60 * 60 * 1000);

    // Set timeout for deletion
    setTimeout(async () => {
      logger.info('Executing scheduled recording deletion', {
        recordingSid,
        scheduledFor,
        type: 'scheduled_deletion_executing'
      });

      const result = await deleteRecording(recordingSid);
      
      if (result.success) {
        logger.info('Scheduled deletion completed', {
          recordingSid,
          type: 'scheduled_deletion_completed'
        });
      } else {
        logger.error('Scheduled deletion failed', {
          recordingSid,
          error: result.error,
          type: 'scheduled_deletion_failed'
        });
      }
    }, retentionHours * 60 * 60 * 1000);

    logger.info('Recording deletion scheduled', {
      recordingSid,
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
 */
export async function getRecordingInfo(recordingSid: string) {
  try {
    const recording = await twilioClient.recordings(recordingSid).fetch();
    
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
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'recording_info_error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

