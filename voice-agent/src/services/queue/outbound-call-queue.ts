/**
 * Outbound Call Queue Service
 * Manages scheduled outbound calls using Bull queue with Redis
 * Phase 2: Queue Infrastructure
 */

import Bull from 'bull';
import { getBullRedisConfig } from '../../config/redis-bull';
import { logger } from '../../lib/logger';

/**
 * Outbound call job data structure
 * Supports round-robin calling: calls each staff member up to maxRounds times
 */
export interface OutboundCallJobData {
  occurrenceId: string;           // Job occurrence ID
  providerId: string;             // Provider ID for fetching config
  staffPoolIds: string[];         // Staff pool members to call (in order)
  currentRound: number;           // Current round (1-based: 1, 2, 3, etc.)
  currentStaffIndex: number;      // Current position in staff pool (0-based)
  maxRounds: number;              // Maximum rounds to call each staff member
  callAttemptsByStaff: Record<string, number>; // Track attempts per staff member
  jobDetails: {
    patientName: string;          // Patient full name
    patientFirstName: string;     // For personalization
    patientLastInitial: string;   // For privacy
    scheduledDate: string;        // Shift date (YYYY-MM-DD)
    displayDate: string;          // Formatted date for speech
    startTime: string;            // Start time (HH:MM or formatted)
    endTime?: string;             // End time if applicable
    suburb?: string;              // Location suburb
    messageTemplate: string;      // Custom message template from provider config
  };
}

/**
 * Create Outbound Call Queue with Railway Redis
 */
export const outboundCallQueue = new Bull<OutboundCallJobData>('outbound-calls', {
  redis: getBullRedisConfig(),
  defaultJobOptions: {
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 100,
    },
    removeOnFail: {
      age: 172800, // Keep failed jobs for 48 hours
    },
    attempts: 2, // Retry up to 2 times on technical failure
    backoff: {
      type: 'exponential',
      delay: 3000, // Start with 3 second delay
    },
  },
});

/**
 * Schedule initial outbound call round after Wave 3
 * Called from wave-processor.ts after Wave 3 completes
 */
export async function scheduleOutboundCallAfterSMS(
  occurrenceId: string,
  waitMinutes: number,
  jobData: Omit<OutboundCallJobData, 'currentRound' | 'currentStaffIndex' | 'callAttemptsByStaff'>
): Promise<Bull.Job<OutboundCallJobData>> {
  try {
    const delayMs = waitMinutes * 60 * 1000;
    
    // Initialize round-robin state
    const initialJobData: OutboundCallJobData = {
      ...jobData,
      currentRound: 1,
      currentStaffIndex: 0,
      callAttemptsByStaff: {},
    };

    const job = await outboundCallQueue.add(initialJobData, {
      delay: delayMs,
      jobId: `outbound-${occurrenceId}-r1-s0`, // Round 1, Staff 0
      priority: 10, // High priority
    });

    logger.info('Initial outbound call scheduled', {
      occurrenceId,
      waitMinutes,
      delayMs,
      staffPoolSize: jobData.staffPoolIds.length,
      maxRounds: jobData.maxRounds,
      jobId: job.id,
      type: 'outbound_call_scheduled'
    });

    return job;
  } catch (error) {
    logger.error('Failed to schedule initial outbound call', {
      occurrenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'outbound_call_schedule_error'
    });
    throw error;
  }
}

/**
 * Schedule next call attempt (next staff member or next round)
 * Called after a call is declined or not answered
 */
export async function scheduleNextCallAttempt(
  jobData: OutboundCallJobData,
  delayMs: number = 5000 // Default 5 seconds between calls
): Promise<Bull.Job<OutboundCallJobData> | null> {
  try {
    const nextIndex = jobData.currentStaffIndex + 1;
    
    // Check if more staff in current round
    if (nextIndex < jobData.staffPoolIds.length) {
      // Call next staff member in current round
      const nextJobData: OutboundCallJobData = {
        ...jobData,
        currentStaffIndex: nextIndex,
      };

      const job = await outboundCallQueue.add(nextJobData, {
        delay: delayMs,
        jobId: `outbound-${jobData.occurrenceId}-r${jobData.currentRound}-s${nextIndex}`,
        priority: 10,
      });

      logger.info('Next staff member call scheduled', {
        occurrenceId: jobData.occurrenceId,
        round: jobData.currentRound,
        staffIndex: nextIndex,
        staffId: jobData.staffPoolIds[nextIndex],
        delayMs,
        jobId: job.id,
        type: 'outbound_next_staff_scheduled'
      });

      return job;
    } 
    // Check if more rounds available
    else if (jobData.currentRound < jobData.maxRounds) {
      // Start next round
      const nextRound = jobData.currentRound + 1;
      const nextJobData: OutboundCallJobData = {
        ...jobData,
        currentRound: nextRound,
        currentStaffIndex: 0,
      };

      const job = await outboundCallQueue.add(nextJobData, {
        delay: 60000, // 1 minute delay between rounds
        jobId: `outbound-${jobData.occurrenceId}-r${nextRound}-s0`,
        priority: 8, // Slightly lower priority for later rounds
      });

      logger.info('Next round call scheduled', {
        occurrenceId: jobData.occurrenceId,
        nextRound,
        staffPoolSize: jobData.staffPoolIds.length,
        delayMs: 60000,
        jobId: job.id,
        type: 'outbound_next_round_scheduled'
      });

      return job;
    } 
    // All rounds completed
    else {
      logger.info('All outbound call rounds completed', {
        occurrenceId: jobData.occurrenceId,
        totalRounds: jobData.maxRounds,
        staffPoolSize: jobData.staffPoolIds.length,
        totalPossibleCalls: jobData.maxRounds * jobData.staffPoolIds.length,
        type: 'outbound_all_rounds_complete'
      });

      return null; // No more calls to schedule
    }
  } catch (error) {
    logger.error('Failed to schedule next call attempt', {
      occurrenceId: jobData.occurrenceId,
      currentRound: jobData.currentRound,
      currentStaffIndex: jobData.currentStaffIndex,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'outbound_next_call_schedule_error'
    });
    throw error;
  }
}

/**
 * Cancel all pending outbound calls for a job occurrence
 * Called when job is assigned or no longer needs calling
 */
export async function cancelOutboundCalls(occurrenceId: string): Promise<{ cancelled: number }> {
  try {
    logger.info('Cancelling pending outbound calls', {
      occurrenceId,
      type: 'outbound_cancel_start'
    });

    // Get all jobs matching this occurrence
    const jobs = await outboundCallQueue.getJobs(['waiting', 'delayed']);
    const matchingJobs = jobs.filter(job => job.data.occurrenceId === occurrenceId);

    let cancelledCount = 0;
    for (const job of matchingJobs) {
      try {
        await job.remove();
        cancelledCount++;
        
        logger.info('Outbound call job cancelled', {
          occurrenceId,
          jobId: job.id,
          round: job.data.currentRound,
          staffIndex: job.data.currentStaffIndex,
          type: 'outbound_job_cancelled'
        });
      } catch (error) {
        logger.warn('Failed to cancel outbound call job', {
          occurrenceId,
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'outbound_job_cancel_warning'
        });
      }
    }

    logger.info('Outbound calls cancellation complete', {
      occurrenceId,
      totalCancelled: cancelledCount,
      type: 'outbound_cancelled'
    });

    return { cancelled: cancelledCount };
  } catch (error) {
    logger.error('Failed to cancel outbound calls', {
      occurrenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'outbound_cancel_error'
    });
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getOutboundCallQueueStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      outboundCallQueue.getWaitingCount(),
      outboundCallQueue.getActiveCount(),
      outboundCallQueue.getCompletedCount(),
      outboundCallQueue.getFailedCount(),
      outboundCallQueue.getDelayedCount(),
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
    logger.error('Failed to get outbound call queue stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'outbound_queue_stats_error'
    });
    return null;
  }
}

/**
 * Clean old completed/failed jobs
 */
export async function cleanOldOutboundCallJobs(): Promise<void> {
  try {
    await outboundCallQueue.clean(86400000, 'completed'); // Clean completed jobs older than 24 hours
    await outboundCallQueue.clean(172800000, 'failed'); // Clean failed jobs older than 48 hours
    
    logger.info('Old outbound call jobs cleaned', {
      type: 'outbound_queue_cleaned'
    });
  } catch (error) {
    logger.error('Failed to clean old outbound call jobs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'outbound_queue_clean_error'
    });
  }
}

// Queue event handlers for monitoring
outboundCallQueue.on('completed', (job) => {
  logger.info('Outbound call job completed', {
    jobId: job.id,
    occurrenceId: job.data.occurrenceId,
    round: job.data.currentRound,
    staffIndex: job.data.currentStaffIndex,
    type: 'outbound_job_completed'
  });
});

outboundCallQueue.on('failed', (job, error) => {
  logger.error('Outbound call job failed', {
    jobId: job?.id,
    occurrenceId: job?.data?.occurrenceId,
    round: job?.data?.currentRound,
    staffIndex: job?.data?.currentStaffIndex,
    error: error.message,
    type: 'outbound_job_failed'
  });
});

outboundCallQueue.on('stalled', (job) => {
  logger.warn('Outbound call job stalled', {
    jobId: job.id,
    occurrenceId: job.data.occurrenceId,
    round: job.data.currentRound,
    staffIndex: job.data.currentStaffIndex,
    type: 'outbound_job_stalled'
  });
});

// Export queue instance
export default outboundCallQueue;
