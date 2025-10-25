/**
 * Call Queue Service
 * Manages call queue for representative transfers using Redis
 */

import { getState, setState, deleteState } from '../redis';
import { logger } from '../../lib/logger';

export interface QueuedCall {
  callSid: string;
  callerPhone: string;
  callerName?: string;
  enqueuedAt: string;
  position: number;
  jobInfo?: {
    jobTitle: string;
    patientName: string;
  };
}

export interface QueueStats {
  totalInQueue: number;
  averageWaitTime: number;
  longestWaitTime: number;
}

const QUEUE_KEY = 'call_queue:representative';
const QUEUE_STATS_KEY = 'call_queue:stats';

/**
 * Call Queue Service Class
 */
export class CallQueueService {
  /**
   * Add a call to the queue
   */
  async enqueueCall(
    callSid: string,
    callerPhone: string,
    callerName?: string,
    jobInfo?: { jobTitle: string; patientName: string }
  ): Promise<{ position: number; queueSize: number }> {
    const startTime = Date.now();
    
    try {
      // Get current queue
      const queue = await this.getQueue();
      
      // Create queued call entry
      const queuedCall: QueuedCall = {
        callSid,
        callerPhone,
        callerName,
        enqueuedAt: new Date().toISOString(),
        position: queue.length + 1,
        jobInfo,
      };
      
      // Add to queue
      queue.push(queuedCall);
      
      // Save updated queue
      await setState(QUEUE_KEY, JSON.stringify(queue));
      
      logger.info('Call added to queue', {
        callSid,
        callerPhone,
        position: queuedCall.position,
        queueSize: queue.length,
        duration: Date.now() - startTime,
        type: 'queue_enqueue'
      });
      
      return {
        position: queuedCall.position,
        queueSize: queue.length
      };
      
    } catch (error) {
      logger.error('Error enqueueing call', {
        callSid,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        type: 'queue_enqueue_error'
      });
      
      throw error;
    }
  }
  
  /**
   * Remove a call from the queue (dequeue)
   */
  async dequeueCall(): Promise<QueuedCall | null> {
    const startTime = Date.now();
    
    try {
      // Get current queue
      const queue = await this.getQueue();
      
      if (queue.length === 0) {
        return null;
      }
      
      // Get first call in queue (FIFO)
      const dequeuedCall = queue.shift();
      
      if (!dequeuedCall) {
        return null;
      }
      
      // Update positions for remaining calls
      queue.forEach((call, index) => {
        call.position = index + 1;
      });
      
      // Save updated queue
      await setState(QUEUE_KEY, JSON.stringify(queue));
      
      logger.info('Call dequeued', {
        callSid: dequeuedCall.callSid,
        callerPhone: dequeuedCall.callerPhone,
        waitTime: Date.now() - new Date(dequeuedCall.enqueuedAt).getTime(),
        remainingInQueue: queue.length,
        duration: Date.now() - startTime,
        type: 'queue_dequeue'
      });
      
      return dequeuedCall;
      
    } catch (error) {
      logger.error('Error dequeuing call', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        type: 'queue_dequeue_error'
      });
      
      throw error;
    }
  }
  
  /**
   * Remove a specific call from the queue (e.g., if caller hangs up)
   */
  async removeFromQueue(callSid: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Get current queue
      const queue = await this.getQueue();
      
      // Find and remove the call
      const initialLength = queue.length;
      const updatedQueue = queue.filter(call => call.callSid !== callSid);
      
      if (updatedQueue.length === initialLength) {
        // Call not found in queue
        return false;
      }
      
      // Update positions for remaining calls
      updatedQueue.forEach((call, index) => {
        call.position = index + 1;
      });
      
      // Save updated queue
      await setState(QUEUE_KEY, JSON.stringify(updatedQueue));
      
      logger.info('Call removed from queue', {
        callSid,
        remainingInQueue: updatedQueue.length,
        duration: Date.now() - startTime,
        type: 'queue_remove'
      });
      
      return true;
      
    } catch (error) {
      logger.error('Error removing call from queue', {
        callSid,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        type: 'queue_remove_error'
      });
      
      throw error;
    }
  }
  
  /**
   * Get current queue
   */
  async getQueue(): Promise<QueuedCall[]> {
    try {
      const queueData = await getState(QUEUE_KEY);
      
      if (!queueData) {
        return [];
      }
      
      return JSON.parse(queueData as string) as QueuedCall[];
      
    } catch (error) {
      logger.error('Error getting queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'queue_get_error'
      });
      
      return [];
    }
  }
  
  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }
  
  /**
   * Get position of a specific call in queue
   */
  async getCallPosition(callSid: string): Promise<number | null> {
    const queue = await this.getQueue();
    const call = queue.find(c => c.callSid === callSid);
    return call ? call.position : null;
  }
  
  /**
   * Get estimated wait time based on queue size
   * Assumes average call duration of 3 minutes
   */
  async getEstimatedWaitTime(position: number): Promise<number> {
    const averageCallDuration = 3 * 60; // 3 minutes in seconds
    return position * averageCallDuration;
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const queue = await this.getQueue();
    const now = Date.now();
    
    if (queue.length === 0) {
      return {
        totalInQueue: 0,
        averageWaitTime: 0,
        longestWaitTime: 0
      };
    }
    
    const waitTimes = queue.map(call => 
      now - new Date(call.enqueuedAt).getTime()
    );
    
    const totalWaitTime = waitTimes.reduce((sum, time) => sum + time, 0);
    const averageWaitTime = Math.floor(totalWaitTime / queue.length / 1000); // in seconds
    const longestWaitTime = Math.floor(Math.max(...waitTimes) / 1000); // in seconds
    
    return {
      totalInQueue: queue.length,
      averageWaitTime,
      longestWaitTime
    };
  }
  
  /**
   * Clear the entire queue (admin function)
   */
  async clearQueue(): Promise<void> {
    try {
      await deleteState(QUEUE_KEY);
      logger.info('Queue cleared', { type: 'queue_clear' });
    } catch (error) {
      logger.error('Error clearing queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'queue_clear_error'
      });
      throw error;
    }
  }
}

// Export singleton instance
export const callQueueService = new CallQueueService();
