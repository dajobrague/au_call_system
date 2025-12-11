/**
 * SMS Wave Worker
 * Processes scheduled SMS waves from Bull queue
 */

import { smsWaveQueue } from '../services/queue/sms-wave-queue';
import { processScheduledWave } from '../services/sms/wave-processor';
import { logger } from '../lib/logger';

/**
 * Initialize the wave worker
 * This should be called when the server starts
 */
export function initializeSMSWaveWorker(): void {
  logger.info('Initializing SMS Wave Worker', {
    type: 'wave_worker_init'
  });

  // Process wave jobs with concurrency of 2 (process up to 2 waves simultaneously)
  smsWaveQueue.process(2, async (job) => {
    const { occurrenceId, waveNumber } = job.data;
    
    logger.info('Wave worker processing job', {
      jobId: job.id,
      occurrenceId,
      waveNumber,
      attempts: job.attemptsMade + 1,
      type: 'wave_worker_processing'
    });

    try {
      await processScheduledWave(job.data);
      
      logger.info('Wave worker completed job', {
        jobId: job.id,
        occurrenceId,
        waveNumber,
        type: 'wave_worker_completed'
      });
      
    } catch (error) {
      logger.error('Wave worker job failed', {
        jobId: job.id,
        occurrenceId,
        waveNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: 'wave_worker_failed'
      });
      
      throw error; // Re-throw to let Bull handle retries
    }
  });

  // Event: Worker is ready
  smsWaveQueue.on('ready', () => {
    logger.info('SMS Wave Worker is ready', {
      type: 'wave_worker_ready'
    });
  });

  // Event: Job completed successfully
  smsWaveQueue.on('completed', (job, result) => {
    logger.info('Wave job completed', {
      jobId: job.id,
      occurrenceId: job.data.occurrenceId,
      waveNumber: job.data.waveNumber,
      type: 'wave_job_completed'
    });
  });

  // Event: Job failed after all retries
  smsWaveQueue.on('failed', (job, error) => {
    logger.error('Wave job failed permanently', {
      jobId: job?.id,
      occurrenceId: job?.data?.occurrenceId,
      waveNumber: job?.data?.waveNumber,
      attempts: job?.attemptsMade,
      error: error.message,
      type: 'wave_job_failed_permanent'
    });
  });

  // Event: Job is stalled (took too long)
  smsWaveQueue.on('stalled', (job) => {
    logger.warn('Wave job stalled', {
      jobId: job.id,
      occurrenceId: job.data.occurrenceId,
      waveNumber: job.data.waveNumber,
      type: 'wave_job_stalled'
    });
  });

  // Event: Error in the queue itself
  smsWaveQueue.on('error', (error) => {
    logger.error('SMS Wave Queue error', {
      error: error.message,
      stack: error.stack,
      type: 'wave_queue_error'
    });
  });

  // Event: Job is active (started processing)
  smsWaveQueue.on('active', (job) => {
    logger.info('Wave job started', {
      jobId: job.id,
      occurrenceId: job.data.occurrenceId,
      waveNumber: job.data.waveNumber,
      type: 'wave_job_active'
    });
  });

  // Event: Job progress (if we implement progress reporting)
  smsWaveQueue.on('progress', (job, progress) => {
    logger.info('Wave job progress', {
      jobId: job.id,
      occurrenceId: job.data.occurrenceId,
      waveNumber: job.data.waveNumber,
      progress,
      type: 'wave_job_progress'
    });
  });

  logger.info('SMS Wave Worker initialized successfully', {
    type: 'wave_worker_initialized'
  });
}

/**
 * Graceful shutdown of the worker
 */
export async function shutdownSMSWaveWorker(): Promise<void> {
  logger.info('Shutting down SMS Wave Worker', {
    type: 'wave_worker_shutdown_start'
  });

  try {
    await smsWaveQueue.close();
    
    logger.info('SMS Wave Worker shut down successfully', {
      type: 'wave_worker_shutdown_complete'
    });
  } catch (error) {
    logger.error('Error shutting down SMS Wave Worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'wave_worker_shutdown_error'
    });
  }
}

// Export the queue for external access if needed
export { smsWaveQueue };
