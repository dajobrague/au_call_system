/**
 * Comprehensive conversation context manager
 * Maintains conversation state and context across the entire call
 */

import type { CallState } from '../../fsm/types';
import { generatePhaseTransition, detectCommunicationStyle } from './conversation-flow';

export interface ConversationMemory {
  employeeInfo: {
    name?: string;
    authMethod?: string;
    pin?: number;
    providerId?: string;
  };
  jobInfo: {
    code?: string;
    title?: string;
    patientName?: string;
    appointmentDate?: string;
  };
  userBehavior: {
    communicationStyle: 'formal' | 'casual' | 'empathetic';
    hasExpressedFrustration: boolean;
    hasExpressedUrgency: boolean;
    preferredResponseLength: 'brief' | 'detailed';
    totalAttempts: number;
    successfulInteractions: number;
  };
  conversationFlow: {
    startTime: string;
    currentPhase: string;
    previousPhases: string[];
    phaseTransitions: Array<{
      from: string;
      to: string;
      timestamp: string;
      trigger: string;
    }>;
  };
  errorRecovery: {
    totalErrors: number;
    errorsByPhase: Record<string, number>;
    lastErrorType?: string;
    recoveryStrategies: string[];
  };
}

/**
 * Initialize conversation memory from call state
 */
export function initializeConversationMemory(state: CallState): ConversationMemory {
  return {
    employeeInfo: {
      name: state.employee?.name,
      authMethod: state.authMethod || undefined,
      pin: state.employee?.pin,
      providerId: state.employee?.providerId,
    },
    jobInfo: {
      code: state.jobCode || undefined,
      title: state.jobTemplate?.title,
      patientName: state.patient?.name,
      appointmentDate: state.selectedOccurrence?.displayDate,
    },
    userBehavior: {
      communicationStyle: 'casual',
      hasExpressedFrustration: false,
      hasExpressedUrgency: false,
      preferredResponseLength: 'brief',
      totalAttempts: getTotalAttempts(state),
      successfulInteractions: 0,
    },
    conversationFlow: {
      startTime: state.createdAt,
      currentPhase: state.phase,
      previousPhases: [],
      phaseTransitions: [],
    },
    errorRecovery: {
      totalErrors: 0,
      errorsByPhase: {},
      recoveryStrategies: [],
    },
  };
}

/**
 * Update conversation memory with new interaction
 */
export function updateConversationMemory(
  memory: ConversationMemory,
  userInput: string,
  systemResponse: string,
  newPhase: string,
  wasSuccessful: boolean
): ConversationMemory {
  // Detect communication style
  const detectedStyle = detectCommunicationStyle(userInput);
  
  // Check for frustration or urgency
  const hasFrustration = detectFrustrationInInput(userInput);
  const hasUrgency = detectUrgencyInInput(userInput);
  
  // Update phase transition if changed
  const phaseTransitions = [...memory.conversationFlow.phaseTransitions];
  if (newPhase !== memory.conversationFlow.currentPhase) {
    phaseTransitions.push({
      from: memory.conversationFlow.currentPhase,
      to: newPhase,
      timestamp: new Date().toISOString(),
      trigger: wasSuccessful ? 'success' : 'error',
    });
  }

  return {
    ...memory,
    userBehavior: {
      ...memory.userBehavior,
      communicationStyle: detectedStyle,
      hasExpressedFrustration: hasFrustration || memory.userBehavior.hasExpressedFrustration,
      hasExpressedUrgency: hasUrgency || memory.userBehavior.hasExpressedUrgency,
      totalAttempts: memory.userBehavior.totalAttempts + 1,
      successfulInteractions: wasSuccessful 
        ? memory.userBehavior.successfulInteractions + 1 
        : memory.userBehavior.successfulInteractions,
    },
    conversationFlow: {
      ...memory.conversationFlow,
      currentPhase: newPhase,
      previousPhases: [...memory.conversationFlow.previousPhases.slice(-4), memory.conversationFlow.currentPhase],
      phaseTransitions,
    },
    errorRecovery: wasSuccessful 
      ? memory.errorRecovery 
      : {
          ...memory.errorRecovery,
          totalErrors: memory.errorRecovery.totalErrors + 1,
          errorsByPhase: {
            ...memory.errorRecovery.errorsByPhase,
            [memory.conversationFlow.currentPhase]: (memory.errorRecovery.errorsByPhase[memory.conversationFlow.currentPhase] || 0) + 1,
          },
        },
  };
}

/**
 * Get total attempts from call state
 */
function getTotalAttempts(state: CallState): number {
  const attempts = state.attempts;
  return attempts.clientId + attempts.confirmClientId + attempts.jobNumber + 
         attempts.confirmJobNumber + attempts.jobOptions + attempts.occurrenceSelection;
}


/**
 * Detect frustration in user input
 */
function detectFrustrationInInput(input: string): boolean {
  const frustrationPatterns = [
    /\b(frustrated|annoying|stupid|ridiculous|terrible|awful|hate|give up)\b/i,
    /\bwhat.*(wrong|problem)\b/i,
    /\bthis.*(doesn't work|isn't working|is broken)\b/i,
    /\bwhy.*(so hard|difficult|complicated)\b/i,
  ];

  return frustrationPatterns.some(pattern => pattern.test(input));
}

/**
 * Detect urgency in user input
 */
function detectUrgencyInInput(input: string): boolean {
  const urgencyPatterns = [
    /\b(urgent|emergency|asap|quickly|right away|immediately|rush)\b/i,
    /\bneed.*(now|today|immediately|right away)\b/i,
    /\bhurry|fast|quick\b/i,
  ];

  return urgencyPatterns.some(pattern => pattern.test(input));
}

/**
 * Generate context-aware response based on conversation memory
 */
export function generateContextAwareResponse(
  baseResponse: string,
  memory: ConversationMemory,
  context: Record<string, any> = {}
): string {
  let enhanced = baseResponse;
  
  // Add personalization if we have employee info
  if (memory.employeeInfo.name && !enhanced.includes(memory.employeeInfo.name)) {
    // Only add name if it's not already in the response and it's appropriate
    const phasesThatNeedPersonalization = ['phone_auth', 'pin_auth', 'workflow_complete'];
    if (phasesThatNeedPersonalization.includes(memory.conversationFlow.currentPhase)) {
      enhanced = enhanced.replace(/^(Hi|Hello)/, `Hi ${memory.employeeInfo.name}`);
    }
  }
  
  // Add context about the job/patient if relevant
  if (memory.jobInfo.patientName && memory.jobInfo.title) {
    enhanced = enhanced.replace(
      /\byour appointment\b/gi, 
      `${memory.jobInfo.patientName}'s ${memory.jobInfo.title.toLowerCase()}`
    );
  }
  
  // Adapt based on user behavior
  if (memory.userBehavior.hasExpressedFrustration) {
    enhanced = addFrustrationSupport(enhanced);
  }
  
  if (memory.userBehavior.hasExpressedUrgency) {
    enhanced = addUrgencyAcknowledgment(enhanced);
  }
  
  // Adjust response length based on preference
  if (memory.userBehavior.preferredResponseLength === 'brief') {
    enhanced = makeBrief(enhanced);
  }
  
  return enhanced;
}

/**
 * Add frustration support to response
 */
function addFrustrationSupport(response: string): string {
  const supportPhrases = [
    'I understand this can be challenging.',
    'I know this process isn\'t always easy.',
    'I appreciate your patience with this.',
  ];
  
  // Don't add if already empathetic
  if (supportPhrases.some(phrase => response.includes(phrase))) {
    return response;
  }
  
  const randomSupport = supportPhrases[Math.floor(Math.random() * supportPhrases.length)];
  return `${randomSupport} ${response}`;
}

/**
 * Add urgency acknowledgment
 */
function addUrgencyAcknowledgment(response: string): string {
  if (!response.includes('right away') && !response.includes('immediately')) {
    return `I'll take care of this right away. ${response}`;
  }
  return response;
}

/**
 * Make response more brief
 */
function makeBrief(response: string): string {
  return response
    .replace(/\bI understand that\b/g, 'Got it')
    .replace(/\bI will\b/g, 'I\'ll')
    .replace(/\bI am going to\b/g, 'I\'ll')
    .replace(/\bThat is\b/g, 'That\'s')
    .replace(/\bYou are\b/g, 'You\'re');
}

/**
 * Test context management functionality
 */
export function testContextManager() {
  console.log('Testing context management:');
  console.log('==========================');

  // Mock call state
  const mockState: Partial<CallState> = {
    phase: 'job_options',
    employee: { name: 'David Bracho', id: '1', pin: 1234, phone: '+123', providerId: '1', jobTemplateIds: [], active: true },
    jobCode: 'AB12',
    jobTemplate: { id: '1', jobCode: 'AB12', title: 'Home Visit', serviceType: 'Healthcare', patientId: '1', occurrenceIds: [] },
    patient: { id: '1', name: 'Maria Garcia', patientId: 123 },
    createdAt: new Date().toISOString(),
  };

  const memory = initializeConversationMemory(mockState as CallState);
  console.log('Initial memory:', JSON.stringify(memory, null, 2));

  // Test style detection
  console.log('\nCommunication Style Detection:');
  console.log('- "Please help me with this" →', detectCommunicationStyle('Please help me with this'));
  console.log('- "Yeah, I need to reschedule" →', detectCommunicationStyle('Yeah, I need to reschedule'));
  console.log('- "I have an emergency situation" →', detectCommunicationStyle('I have an emergency situation'));

  // Test transitions
  console.log('\nPhase Transitions:');
  console.log('- auth → job_code:', generatePhaseTransition('phone_auth', 'collect_job_code'));
  console.log('- job_code → options:', generatePhaseTransition('confirm_job_code', 'job_options', {
    patientName: 'Maria Garcia',
    jobTitle: 'Home Visit'
  }));
}
