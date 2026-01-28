/**
 * Outbound Call Worker
 * Processes scheduled outbound calls from Bull queue
 * Phase 4: Full implementation with actual calling
 */

import { outboundCallQueue } from '../services/queue/outbound-call-queue';
import { processOutboundCall } from '../services/calling/outbound-call-processor';
import { logger } from '../lib/logger';

/**
 * Initialize the outbound call worker
 * This should be called when the server starts
 */
export function initializeOutboundCallWorker(): void {
  logger.info('Initializing Outbound Call Worker', {
    type: 'outbound_worker_init'
  });

  // Process call jobs with concurrency of 5 (can handle multiple calls simultaneously)
  outboundCallQueue.process(5, async (job) => {
    const { occurrenceId, currentRound, currentStaffIndex, staffPoolIds } = job.data;
    const staffId = staffPoolIds[currentStaffIndex];
    
    logger.info('Outbound call worker processing job', {
      jobId: job.id,
      occurrenceId,
      currentRound,
      currentStaffIndex,
      staffId,
      staffPoolSize: staffPoolIds.length,
      attempts: job.attemptsMade + 1,
      type: 'outbound_worker_processing'
    });

    try {
      // Phase 4: Process actual outbound call
      await processOutboundCall(job.data);
      
      logger.info('Outbound call worker completed job', {
        jobId: job.id,
        occurrenceId,
        round: currentRound,
        staffIndex: currentStaffIndex,
        type: 'outbound_worker_completed'
      });
      
    } catch (error) {
      logger.error('Outbound call worker job failed', {
        jobId: job.id,
        occurrenceId,
        round: currentRound,
        staffIndex: currentStaffIndex,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: 'outbound_worker_failed'
      });
      
      throw error; // Re-throw to let Bull handle retries
    }
  });

  // Event: Worker is ready
  outboundCallQueue.on('ready', () => {
    logger.info('Outbound Call Worker is ready', {
      type: 'outbound_worker_ready'
    });
  });

  // Event: Job completed successfully
  outboundCallQueue.on('completed', (job, result) => {
    logger.info('Outbound call job completed', {
      jobId: job.id,
      occurrenceId: job.data.occurrenceId,
      round: job.data.currentRound,
      staffIndex: job.data.currentStaffIndex,
      type: 'outbound_job_completed'
    });
  });

  // Event: Job failed after all retries
  outboundCallQueue.on('failed', (job, error) => {
    logger.error('Outbound call job failed permanently', {
      jobId: job?.id,
      occurrenceId: job?.data?.occurrenceId,
      round: job?.data?.currentRound,
      staffIndex: job?.data?.currentStaffIndex,
      attempts: job?.attemptsMade,
      error: error.message,
      type: 'outbound_job_failed_permanent'
    });
  });

  // Event: Job is stalled (took too long)
  outboundCallQueue.on('stalled', (job) => {
    logger.warn('Outbound call job stalled', {
      jobId: job.id,
      occurrenceId: job.data.occurrenceId,
      round: job.data.currentRound,
      staffIndex: job.data.currentStaffIndex,
      type: 'outbound_job_stalled'
    });
  });

  // Event: Error in the queue itself
  outboundCallQueue.on('error', (error) => {
    logger.error('Outbound Call Queue error', {
      error: error.message,
      stack: error.stack,
      type: 'outbound_queue_error'
    });
  });

  // Event: Job is active (started processing)
  outboundCallQueue.on('active', (job) => {
    logger.info('Outbound call job started', {
      jobId: job.id,
      occurrenceId: job.data.occurrenceId,
      round: job.data.currentRound,
      staffIndex: job.data.currentStaffIndex,
      type: 'outbound_job_active'
    });
  });

  // Event: Job progress (if we implement progress reporting)
  outboundCallQueue.on('progress', (job, progress) => {
    logger.info('Outbound call job progress', {
      jobId: job.id,
      occurrenceId: job.data.occurrenceId,
      round: job.data.currentRound,
      staffIndex: job.data.currentStaffIndex,
      progress,
      type: 'outbound_job_progress'
    });
  });

  logger.info('Outbound Call Worker initialized successfully', {
    type: 'outbound_worker_initialized'
  });
}

/**
 * Graceful shutdown of the worker
 */
export async function shutdownOutboundCallWorker(): Promise<void> {
  logger.info('Shutting down Outbound Call Worker', {
    type: 'outbound_worker_shutdown_start'
  });

  try {
    await outboundCallQueue.close();
    
    logger.info('Outbound Call Worker shut down successfully', {
      type: 'outbound_worker_shutdown_complete'
    });
  } catch (error) {
    logger.error('Error shutting down Outbound Call Worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'outbound_worker_shutdown_error'
    });
  }
}

// Export the queue for external access if needed
export { outboundCallQueue };
