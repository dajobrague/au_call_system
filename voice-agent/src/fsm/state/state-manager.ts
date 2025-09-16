/**
 * State management for FSM calls
 * Handles CRUD operations for call state in Redis
 */

import { getState, setState, deleteState } from '../../services/redis';
import { stateKeys, redisConfig } from '../../services/redis/config';
import type { CallState } from '../types';

/**
 * Load call state from Redis or create new one
 */
export async function loadCallState(callSid: string): Promise<CallState> {
  const key = stateKeys.call(callSid);
  const existingState = await getState<CallState>(key);
  
  if (existingState) {
    // Check if call has been running too long (safety cleanup)
    const callAge = Date.now() - new Date(existingState.createdAt).getTime();
    const maxAge = redisConfig.maxCallDuration * 1000; // Convert to milliseconds
    
    if (callAge > maxAge) {
      console.log(`Call ${callSid} exceeded max duration (${callAge}ms), cleaning up`);
      await deleteCallState(callSid);
      // Create fresh state after cleanup
      const { createInitialState } = await import('./state-factory');
      const newState = createInitialState(callSid);
      await setState(key, newState);
      return newState;
    }
    
    return existingState;
  }
  
  // Create new state
  const { createInitialState } = await import('./state-factory');
  const newState = createInitialState(callSid);
  await setState(key, newState);
  return newState;
}

/**
 * Save call state to Redis with TTL refresh
 */
export async function saveCallState(state: CallState): Promise<boolean> {
  const key = stateKeys.call(state.sid);
  const updatedState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  return await setState(key, updatedState);
}

/**
 * Delete call state from Redis
 */
export async function deleteCallState(callSid: string): Promise<boolean> {
  const key = stateKeys.call(callSid);
  return await deleteState(key);
}
