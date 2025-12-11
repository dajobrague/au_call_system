/**
 * SMS Wave Queue Service
 * Manages scheduled SMS waves using Bull queue with Redis
 */

import Bull from 'bull';
import { getBullRedisConfig } from '../../config/redis-bull';
import { logger } from '../../lib/logger';

/**
 * Wave job data structure
 */
export interface WaveJobData {
  occurrenceId: string;
  waveNumber: 1 | 2 | 3;
  providerId: string;
  scheduledAt: string;
  timeString?: string;  // Time of shift (e.g., "14:00") for timezone calculations
  timezone?: string;    // Provider timezone (e.g., "Australia/Sydney")
  jobDetails: {
    patientFirstName: string;
    patientLastInitial: string;
    patientFullName: string;
    dateTime: string;
    displayDate: string;
  };
}

/**
 * Create SMS Wave Queue with Railway Redis
 */
export const smsWaveQueue = new Bull<WaveJobData>('sms-waves', {
  redis: getBullRedisConfig(),
  defaultJobOptions: {
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 100,
    },
    removeOnFail: {
      age: 172800, // Keep failed jobs for 48 hours
    },
    attempts: 3, // Retry up to 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5 second delay
    },
  },
});

/**
 * Schedule Wave 2 (after calculated interval)
 */
export async function scheduleWave2(
  occurrenceId: string,
  delayMs: number,
  waveData: Omit<WaveJobData, 'waveNumber'>
): Promise<Bull.Job<WaveJobData>> {
  try {
    const jobData: WaveJobData = {
      ...waveData,
      waveNumber: 2,
    };

    const job = await smsWaveQueue.add(jobData, {
      delay: delayMs,
      jobId: `wave-2-${occurrenceId}`, // Unique ID for easy cancellation
      priority: 10, // Higher priority than wave 3
    });

    logger.info('Wave 2 scheduled', {
      occurrenceId,
      delayMs,
      delayMinutes: Math.round(delayMs / 60000),
      jobId: job.id,
      type: 'wave_2_scheduled'
    });

    return job;
  } catch (error) {
    logger.error('Failed to schedule wave 2', {
      occurrenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'wave_2_schedule_error'
    });
    throw error;
  }
}

/**
 * Schedule Wave 3 (after 2x calculated interval)
 */
export async function scheduleWave3(
  occurrenceId: string,
  delayMs: number,
  waveData: Omit<WaveJobData, 'waveNumber'>
): Promise<Bull.Job<WaveJobData>> {
  try {
    const jobData: WaveJobData = {
      ...waveData,
      waveNumber: 3,
    };

    const job = await smsWaveQueue.add(jobData, {
      delay: delayMs,
      jobId: `wave-3-${occurrenceId}`, // Unique ID for easy cancellation
      priority: 5, // Lower priority than wave 2
    });

    logger.info('Wave 3 scheduled', {
      occurrenceId,
      delayMs,
      delayMinutes: Math.round(delayMs / 60000),
      jobId: job.id,
      type: 'wave_3_scheduled'
    });

    return job;
  } catch (error) {
    logger.error('Failed to schedule wave 3', {
      occurrenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'wave_3_schedule_error'
    });
    throw error;
  }
}

/**
 * Cancel pending waves for a job occurrence
 * Called when job is assigned
 */
export async function cancelWaves(occurrenceId: string): Promise<{ wave2: boolean; wave3: boolean }> {
  try {
    logger.info('Cancelling pending waves', {
      occurrenceId,
      type: 'waves_cancel_start'
    });

    const results = {
      wave2: false,
      wave3: false,
    };

    // Try to remove wave 2
    try {
      const wave2Job = await smsWaveQueue.getJob(`wave-2-${occurrenceId}`);
      if (wave2Job) {
        await wave2Job.remove();
        results.wave2 = true;
        logger.info('Wave 2 cancelled', {
          occurrenceId,
          jobId: wave2Job.id,
          type: 'wave_2_cancelled'
        });
      }
    } catch (error) {
      logger.warn('Failed to cancel wave 2 (may not exist)', {
        occurrenceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'wave_2_cancel_warning'
      });
    }

    // Try to remove wave 3
    try {
      const wave3Job = await smsWaveQueue.getJob(`wave-3-${occurrenceId}`);
      if (wave3Job) {
        await wave3Job.remove();
        results.wave3 = true;
        logger.info('Wave 3 cancelled', {
          occurrenceId,
          jobId: wave3Job.id,
          type: 'wave_3_cancelled'
        });
      }
    } catch (error) {
      logger.warn('Failed to cancel wave 3 (may not exist)', {
        occurrenceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'wave_3_cancel_warning'
      });
    }

    logger.info('Waves cancellation complete', {
      occurrenceId,
      wave2Cancelled: results.wave2,
      wave3Cancelled: results.wave3,
      type: 'waves_cancelled'
    });

    return results;
  } catch (error) {
    logger.error('Failed to cancel waves', {
      occurrenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'waves_cancel_error'
    });
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      smsWaveQueue.getWaitingCount(),
      smsWaveQueue.getActiveCount(),
      smsWaveQueue.getCompletedCount(),
      smsWaveQueue.getFailedCount(),
      smsWaveQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  } catch (error) {
    logger.error('Failed to get queue stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'queue_stats_error'
    });
    return null;
  }
}

/**
 * Clean old completed/failed jobs
 */
export async function cleanOldJobs(): Promise<void> {
  try {
    await smsWaveQueue.clean(86400000, 'completed'); // Clean completed jobs older than 24 hours
    await smsWaveQueue.clean(172800000, 'failed'); // Clean failed jobs older than 48 hours
    
    logger.info('Old jobs cleaned', {
      type: 'queue_cleaned'
    });
  } catch (error) {
    logger.error('Failed to clean old jobs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'queue_clean_error'
    });
  }
}

// Queue event handlers for monitoring
smsWaveQueue.on('completed', (job) => {
  logger.info('Wave job completed', {
    jobId: job.id,
    occurrenceId: job.data.occurrenceId,
    waveNumber: job.data.waveNumber,
    type: 'wave_job_completed'
  });
});

smsWaveQueue.on('failed', (job, error) => {
  logger.error('Wave job failed', {
    jobId: job?.id,
    occurrenceId: job?.data?.occurrenceId,
    waveNumber: job?.data?.waveNumber,
    error: error.message,
    type: 'wave_job_failed'
  });
});

smsWaveQueue.on('stalled', (job) => {
  logger.warn('Wave job stalled', {
    jobId: job.id,
    occurrenceId: job.data.occurrenceId,
    waveNumber: job.data.waveNumber,
    type: 'wave_job_stalled'
  });
});

// Export queue instance and helper functions
export default smsWaveQueue;
