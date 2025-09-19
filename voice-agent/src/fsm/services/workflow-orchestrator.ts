/**
 * Main FSM workflow orchestrator
 * Coordinates phase processing and state transitions
 */

import { PHASES } from '../constants';
import { telephonyConfig } from '../../config/telephony';
import { loadCallState, saveCallState, deleteCallState } from '../state/state-manager';
import { normalizeInput } from '../input/input-normalizer';
import { generateTwiML } from '../twiml/twiml-generator';
import { 
  generatePhaseTransition, 
  enhanceSystemResponse, 
  generateNaturalErrorMessage,
  generatePersonalizedGreeting,
  getCurrentTimeOfDay
} from '../../services/voice/conversation-flow';
import { 
  initializeConversationMemory, 
  updateConversationMemory 
} from '../../services/voice/context-manager';
import type { TwilioWebhookData, ProcessingResult, CallState } from '../types';

// Import phase processors
import { processClientIdPhase, processConfirmClientIdPhase } from '../phases/client-id-phase';
import { processJobNumberPhase, processConfirmJobNumberPhase } from '../phases/job-number-phase';
import { processJobCodePhase, processConfirmJobCodePhase } from '../phases/job-code-phase';
import { processJobOptionsPhase } from '../phases/job-options-phase';
import { processOccurrenceSelectionPhase } from '../phases/occurrence-phase';
import { processProviderSelectionPhase } from '../phases/provider-phase';
import { 
  processCollectDayPhase, 
  processCollectMonthPhase, 
  processCollectTimePhase, 
  processConfirmDateTimePhase 
} from '../phases/datetime-phase';
import { processCollectReasonPhase, processConfirmLeaveOpenPhase } from '../phases/reason-phase';
import { setCurrentCallContext, clearCurrentCallContext } from '../twiml/twiml-generator';

/**
 * Main FSM processing function
 */
export async function processCallState(webhookData: TwilioWebhookData): Promise<ProcessingResult> {
  const { input, source } = normalizeInput(webhookData);
  const hasInput = input.length > 0;
  
  try {
    // Set call context for TwiML generation
    setCurrentCallContext(webhookData.CallSid, webhookData.From);
    
    // Load current state
    let state = await loadCallState(webhookData.CallSid);
    
    // Idempotency protection: check if we've already processed this GatherAttempt
    if (webhookData.GatherAttempt && state.lastGatherAttempt === webhookData.GatherAttempt) {
      console.log(`Duplicate GatherAttempt detected: ${webhookData.GatherAttempt}, returning last response`);
      
      // Return a safe "please wait" response for duplicates
      return {
        twiml: generateTwiML('Please wait while we process your request.', false),
        action: 'duplicate',
        shouldDeleteState: false,
        logData: {
          phase: state.phase,
          hasInput,
          inputSource: source,
          attempts: state.attempts,
          action: 'duplicate',
        },
      };
    }
    
    // Legacy initial call handler removed - now using phone_auth phase

    // If this is a fresh state but we have input, treat it as first client ID attempt
    if (state.attempts.clientId === 0 && hasInput && state.phase === PHASES.COLLECT_CLIENT_ID) {
      state = {
        ...state,
        attempts: {
          ...state.attempts,
          clientId: 1,
        },
      };
    }
    
    // Log state for debugging (production-ready)
    console.log(`FSM: CallSid=${webhookData.CallSid}, Phase=${state.phase}, HasInput=${hasInput}`);

    // Process based on current phase
    let newState: CallState;
    let result: Partial<ProcessingResult>;
    
    switch (state.phase) {
      case PHASES.PHONE_AUTH: {
        // Phone authentication phase - no user input expected initially
        const { processPhoneAuthPhase } = await import('../phases/phone-auth');
        const phoneAuthResult = await processPhoneAuthPhase(state, webhookData);
        newState = phoneAuthResult.newState;
        result = phoneAuthResult.result;
        break;
      }
        
      case PHASES.PIN_AUTH: {
        // PIN authentication phase
        const { processPinAuthPhase } = await import('../phases/pin-auth');
        const pinAuthResult = await processPinAuthPhase(state, input, hasInput, source);
        newState = pinAuthResult.newState;
        result = pinAuthResult.result;
        break;
      }
        
      case PHASES.PROVIDER_SELECTION:
        ({ newState, result } = await processProviderSelectionPhase(state, input, hasInput));
        break;
        
      case PHASES.PROVIDER_GREETING:
        // This phase should transition immediately to job code collection
        // If we hit this, it means we need to collect job code
        ({ newState, result } = await processJobCodePhase(state, input, hasInput, source));
        break;
        
      case PHASES.COLLECT_CLIENT_ID:
        ({ newState, result } = processClientIdPhase(state, input, hasInput));
        break;
        
      case PHASES.CONFIRM_CLIENT_ID:
        ({ newState, result } = processConfirmClientIdPhase(state, input, hasInput));
        break;
        
      case PHASES.COLLECT_JOB_NUMBER:
        ({ newState, result } = processJobNumberPhase(state, input, hasInput));
        break;
        
      case PHASES.CONFIRM_JOB_NUMBER:
        ({ newState, result } = processConfirmJobNumberPhase(state, input, hasInput));
        break;
        
      case PHASES.COLLECT_JOB_CODE:
        ({ newState, result } = await processJobCodePhase(state, input, hasInput, source));
        break;
        
      case PHASES.CONFIRM_JOB_CODE:
        ({ newState, result } = processConfirmJobCodePhase(state, input, hasInput));
        break;
        
      case PHASES.JOB_OPTIONS:
        ({ newState, result } = processJobOptionsPhase(state, input, hasInput, source));
        break;
        
      case PHASES.OCCURRENCE_SELECTION:
        ({ newState, result } = await processOccurrenceSelectionPhase(state, input, hasInput));
        break;
        
      case PHASES.COLLECT_REASON:
        ({ newState, result } = processCollectReasonPhase(state, input, hasInput, source));
        break;
        
      case PHASES.CONFIRM_LEAVE_OPEN:
        ({ newState, result } = await processConfirmLeaveOpenPhase(state, input, hasInput));
        break;
        
      case PHASES.COLLECT_DAY:
        // Check if voice AI mode is enabled for conversational datetime
        if (process.env.VOICE_AI_ENABLED === 'true' && source === 'speech') {
          const { processConversationalDateTime } = await import('../phases/datetime-phase');
          ({ newState, result } = processConversationalDateTime(state, input, hasInput, source));
        } else {
          ({ newState, result } = processCollectDayPhase(state, input, hasInput));
        }
        break;
        
      case PHASES.COLLECT_MONTH:
        ({ newState, result } = processCollectMonthPhase(state, input, hasInput));
        break;
        
      case PHASES.COLLECT_TIME:
        ({ newState, result } = processCollectTimePhase(state, input, hasInput));
        break;
        
      case PHASES.CONFIRM_DATETIME:
        ({ newState, result } = await processConfirmDateTimePhase(state, input, hasInput));
        break;
        
      case PHASES.SCHEDULE_NEW_OCCURRENCE:
        // For now, just complete workflow - scheduling will be implemented later
        return {
          twiml: generateTwiML('Scheduling new appointments will be available soon. Connecting you with a representative to schedule manually.', false),
          action: 'goodbye',
          shouldDeleteState: true,
          logData: {
            phase: state.phase,
            action: 'schedule_new_not_implemented'
          },
        };
        
      case PHASES.WORKFLOW_COMPLETE:
        // Should rarely hit this if we delete state properly
        return {
          twiml: generateTwiML(telephonyConfig.prompts.workflow_complete, false),
          action: 'goodbye',
          shouldDeleteState: true,
          logData: {
            phase: state.phase,
            hasInput,
            inputSource: source,
            attempts: state.attempts,
            action: 'goodbye',
          },
        };
        
      case PHASES.DONE:
        // Should rarely hit this if we delete state properly
        return {
          twiml: generateTwiML(telephonyConfig.prompts.goodbye, false),
          action: 'goodbye',
          shouldDeleteState: true,
          logData: {
            phase: state.phase,
            hasInput,
            inputSource: source,
            attempts: state.attempts,
            action: 'goodbye',
          },
        };
        
      default:
        throw new Error(`Unknown phase: ${state.phase}`);
    }
    
    // Save or delete state
    if (result.shouldDeleteState) {
      await deleteCallState(webhookData.CallSid);
    } else {
      // Update GatherAttempt for idempotency tracking
      newState.lastGatherAttempt = webhookData.GatherAttempt;
      newState.updatedAt = new Date().toISOString();
      await saveCallState(newState);
    }
    
    return {
      twiml: result.twiml!,
      action: result.action!,
      shouldDeleteState: result.shouldDeleteState!,
      logData: {
        phase: newState.phase,
        hasInput,
        inputSource: source,
        attempts: newState.attempts,
        action: result.action!,
      },
    };
    
  } catch (error) {
    console.error('FSM processing error:', error);
    
    // Fallback: single-turn prompt with no persistence
    // If Redis is unavailable, provide a basic response based on input
    if (hasInput) {
      // If we have input but can't persist state, acknowledge and ask for both pieces of info
      return {
        twiml: generateTwiML('Thank you. Due to a technical issue, please call back and provide both your client number and job number when prompted.', false),
        action: 'error',
        shouldDeleteState: false,
        logData: {
          phase: PHASES.ERROR,
          hasInput,
          inputSource: source,
          attempts: { clientId: 0, confirmClientId: 0, jobNumber: 0, confirmJobNumber: 0, jobOptions: 0, occurrenceSelection: 0 },
          action: 'error',
        },
      };
    } else {
      // No input, provide system error message
      return {
        twiml: generateTwiML('Our automated system is not available at this time. We are connecting you with a representative.', false),
        action: 'error',
        shouldDeleteState: true,
        logData: {
          phase: PHASES.ERROR,
          hasInput,
          inputSource: source,
          attempts: { clientId: 0, confirmClientId: 0, jobNumber: 0, confirmJobNumber: 0, jobOptions: 0, occurrenceSelection: 0 },
          action: 'error',
        },
      };
    }
  } finally {
    // Clear call context
    clearCurrentCallContext();
  }
}
