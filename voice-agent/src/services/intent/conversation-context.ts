/**
 * Conversation context management
 * Tracks conversation state and context for better intent recognition
 */

import type { CallState } from '../../fsm/types';

export interface ConversationContext {
  currentPhase: string;
  expectedInputType: 'confirmation' | 'selection' | 'freeform' | 'number';
  previousIntents: string[];
  failedAttempts: number;
  lastSuccessfulIntent?: string;
  conversationHistory: Array<{
    timestamp: string;
    userInput: string;
    intent: string;
    confidence: number;
  }>;
}

/**
 * Determine conversation context from FSM state
 */
export function getConversationContext(state: CallState): string {
  switch (state.phase) {
    case 'pin_auth':
      return 'pin_entry';
    
    case 'provider_selection':
      return 'provider_selection';
    
    case 'collect_job_code':
      return 'job_code_entry';
    
    case 'confirm_job_code':
      return 'confirmation';
    
    case 'job_options':
      return 'job_options';
    
    case 'occurrence_selection':
      return 'occurrence_selection';
    
    case 'collect_reason':
      return 'reason_collection';
    
    case 'confirm_leave_open':
      return 'confirmation';
    
    case 'collect_day':
    case 'collect_month':
    case 'collect_time':
      return 'date_time_entry';
    
    case 'confirm_datetime':
      return 'confirmation';
    
    default:
      return 'general';
  }
}

/**
 * Get expected input type for current phase
 */
export function getExpectedInputType(state: CallState): 'confirmation' | 'selection' | 'freeform' | 'number' {
  switch (state.phase) {
    case 'pin_auth':
    case 'collect_job_code':
    case 'collect_day':
    case 'collect_month':
    case 'collect_time':
      return 'number';
    
    case 'confirm_job_code':
    case 'confirm_datetime':
    case 'confirm_leave_open':
      return 'confirmation';
    
    case 'provider_selection':
    case 'job_options':
    case 'occurrence_selection':
      return 'selection';
    
    case 'collect_reason':
      return 'freeform';
    
    default:
      return 'freeform';
  }
}

/**
 * Build conversation context from state
 */
export function buildConversationContext(state: CallState): ConversationContext {
  const currentPhase = state.phase;
  const expectedInputType = getExpectedInputType(state);
  
  // Calculate failed attempts for current phase
  const failedAttempts = getFailedAttemptsForPhase(state);
  
  return {
    currentPhase,
    expectedInputType,
    previousIntents: [], // Would be populated from conversation history
    failedAttempts,
    conversationHistory: [], // Would be populated from stored history
  };
}

/**
 * Get failed attempts count for current phase
 */
function getFailedAttemptsForPhase(state: CallState): number {
  switch (state.phase) {
    case 'pin_auth':
    case 'collect_job_code':
      return state.attempts.clientId;
    
    case 'confirm_job_code':
    case 'confirm_leave_open':
      return state.attempts.confirmClientId;
    
    case 'job_options':
      return state.attempts.jobOptions;
    
    case 'occurrence_selection':
      return state.attempts.occurrenceSelection;
    
    case 'collect_day':
    case 'collect_month':
    case 'collect_time':
      return state.attempts.clientId;
    
    case 'confirm_datetime':
      return state.attempts.confirmJobNumber;
    
    default:
      return 0;
  }
}

/**
 * Determine if we should ask for clarification based on context
 */
export function shouldRequestClarification(
  context: ConversationContext,
  confidence: number
): boolean {
  const thresholds = {
    confirmation: 0.85,  // High confidence needed for yes/no
    selection: 0.8,      // High confidence for menu selections
    number: 0.9,         // Very high confidence for numbers
    freeform: 0.7,       // Lower threshold for free-form speech
  };

  const threshold = thresholds[context.expectedInputType] || 0.8;
  
  // Lower threshold if user has failed multiple times
  const adjustedThreshold = Math.max(threshold - (context.failedAttempts * 0.1), 0.5);
  
  return confidence < adjustedThreshold;
}

/**
 * Generate context-aware clarification prompt
 */
export function generateContextualClarification(
  context: ConversationContext,
  lastInput?: string
): string {
  const phase = context.currentPhase;
  const attempts = context.failedAttempts;
  
  // More helpful prompts after multiple failures
  if (attempts >= 2) {
    switch (context.expectedInputType) {
      case 'confirmation':
        return 'I\'m having trouble understanding. Please clearly say "yes" to confirm or "no" to try again.';
      case 'selection':
        return 'Let me make this easier. Please say the number of your choice, like "one", "two", or "three".';
      case 'number':
        return 'I\'m having difficulty hearing the numbers. Please speak each digit clearly, like "one two three four".';
      case 'freeform':
        return 'I\'m having trouble understanding. Please speak clearly and tell me what you need help with.';
    }
  }

  // Standard clarification prompts
  switch (context.expectedInputType) {
    case 'confirmation':
      return 'I didn\'t catch that. Please say "yes" to confirm or "no" to try again.';
    case 'selection':
      return 'I didn\'t understand your choice. Please tell me which option you\'d like.';
    case 'number':
      return 'I didn\'t get the number clearly. Could you repeat it?';
    case 'freeform':
      return 'I didn\'t catch that. Could you tell me again?';
    default:
      return 'I didn\'t understand. Could you repeat that?';
  }
}

/**
 * Update conversation context with new interaction
 */
export function updateConversationContext(
  context: ConversationContext,
  userInput: string,
  intent: string,
  confidence: number
): ConversationContext {
  return {
    ...context,
    previousIntents: [...context.previousIntents.slice(-4), intent], // Keep last 5 intents
    lastSuccessfulIntent: confidence > 0.8 ? intent : context.lastSuccessfulIntent,
    conversationHistory: [
      ...context.conversationHistory.slice(-9), // Keep last 10 interactions
      {
        timestamp: new Date().toISOString(),
        userInput,
        intent,
        confidence,
      }
    ],
  };
}

/**
 * Check if user is repeating the same intent (might indicate frustration)
 */
export function isRepeatingIntent(context: ConversationContext, newIntent: string): boolean {
  const recentIntents = context.previousIntents.slice(-3);
  return recentIntents.length >= 2 && recentIntents.every(intent => intent === newIntent);
}

/**
 * Generate empathetic response for repeated intents
 */
export function generateEmpatheticResponse(intent: string, context: string): string {
  const responses: Record<string, string> = {
    '1': 'I understand you want to reschedule. Let me help you with that right away.',
    '2': 'I hear that you can\'t make it and want to leave it open. I\'ll take care of that for you.',
    '3': 'I understand you\'d like to speak with someone. Let me connect you with a representative.',
    '4': 'I see you want to enter a different job code. Let\'s start fresh with that.',
  };

  return responses[intent] || 'I understand what you\'re asking for. Let me help you with that.';
}

/**
 * Test conversation context functionality
 */
export function testConversationContext() {
  console.log('Testing conversation context:');
  console.log('============================');

  // Mock state for testing
  const mockState: Partial<CallState> = {
    phase: 'job_options',
    attempts: { jobOptions: 1, clientId: 0, confirmClientId: 0, jobNumber: 0, confirmJobNumber: 0, occurrenceSelection: 0 },
  };

  const context = buildConversationContext(mockState as CallState);
  console.log('Context for job_options phase:', context);

  // Test clarification logic
  console.log('\nClarification tests:');
  console.log('- High confidence (0.9):', shouldRequestClarification(context, 0.9));
  console.log('- Medium confidence (0.7):', shouldRequestClarification(context, 0.7));
  console.log('- Low confidence (0.5):', shouldRequestClarification(context, 0.5));

  // Test clarification prompts
  console.log('\nClarification prompts:');
  console.log('- First attempt:', generateContextualClarification(context));
  
  const failedContext = { ...context, failedAttempts: 2 };
  console.log('- After failures:', generateContextualClarification(failedContext));
}
