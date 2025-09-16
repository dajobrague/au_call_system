/**
 * Conversation flow manager
 * Ensures seamless, natural transitions between FSM phases
 */

import type { CallState } from '../../fsm/types';

export interface ConversationTransition {
  fromPhase: string;
  toPhase: string;
  transitionMessage: string;
  context?: Record<string, any>;
}

export interface ConversationState {
  currentPhase: string;
  previousPhase?: string;
  conversationHistory: Array<{
    phase: string;
    userInput: string;
    systemResponse: string;
    timestamp: string;
  }>;
  userPreferences: {
    communicationStyle: 'formal' | 'casual' | 'empathetic';
    responseLength: 'brief' | 'detailed';
    hasExpressedFrustration: boolean;
    hasExpressedUrgency: boolean;
  };
  contextMemory: Record<string, any>;
}

/**
 * Generate natural transition between phases
 */
export function generatePhaseTransition(
  fromPhase: string,
  toPhase: string,
  context: Record<string, any> = {}
): string {
  const transitions: Record<string, Record<string, string>> = {
    phone_auth: {
      provider_selection: `Thank you for authenticating. I see you work for multiple providers.`,
      collect_job_code: `Thank you for authenticating. Now, what's your job code?`,
    },
    
    pin_auth: {
      provider_selection: `Thank you for your PIN. I see you work for multiple providers.`,
      collect_job_code: `Thank you for your PIN. Now, what's your job code?`,
    },
    
    provider_selection: {
      collect_job_code: `Perfect! Now, what's your job code for ${context.providerName || 'this provider'}?`,
    },
    
    confirm_job_code: {
      job_options: context.patientName && context.jobTitle 
        ? `Great! I found ${context.patientName}'s ${context.jobTitle}.`
        : `Perfect! I found that job.`,
    },
    
    job_options: {
      occurrence_selection: `Let me look up your upcoming appointments.`,
      workflow_complete: `I understand you'd like to speak with someone. Let me connect you.`,
    },
    
    occurrence_selection: {
      collect_day: `Perfect! When would you like to reschedule this appointment?`,
      collect_reason: `I understand you can't make it. Could you tell me why?`,
    },
    
    collect_reason: {
      confirm_leave_open: `Thank you for explaining.`,
    },
    
    confirm_datetime: {
      workflow_complete: `Excellent! Your appointment has been rescheduled.`,
    },
    
    confirm_leave_open: {
      workflow_complete: `Perfect! I've marked the appointment as open and notified the team.`,
    },
  };

  const phaseTransitions = transitions[fromPhase];
  if (phaseTransitions && phaseTransitions[toPhase]) {
    return phaseTransitions[toPhase];
  }

  // Default transitions
  const defaultTransitions: Record<string, string> = {
    collect_job_code: `Now, what's your job code?`,
    job_options: `What would you like to do?`,
    occurrence_selection: `Let me check your appointments.`,
    collect_day: `When would you like to reschedule?`,
    collect_reason: `Could you tell me why?`,
    confirm_datetime: `Let me confirm that time.`,
    confirm_leave_open: `Let me confirm that for you.`,
    workflow_complete: `Thank you! I've taken care of that.`,
  };

  return defaultTransitions[toPhase] || `Let me help you with that.`;
}

/**
 * Detect user communication style from input
 */
export function detectCommunicationStyle(input: string): 'formal' | 'casual' | 'empathetic' {
  const formalIndicators = ['please', 'thank you', 'sir', 'ma\'am', 'appreciate'];
  const casualIndicators = ['yeah', 'yep', 'ok', 'sure', 'cool'];
  const empathyNeeded = ['stress', 'emergency', 'urgent', 'problem', 'difficult'];

  const text = input.toLowerCase();
  
  if (empathyNeeded.some(word => text.includes(word))) {
    return 'empathetic';
  }
  
  if (formalIndicators.some(word => text.includes(word))) {
    return 'formal';
  }
  
  if (casualIndicators.some(word => text.includes(word))) {
    return 'casual';
  }
  
  return 'casual'; // Default to casual for natural conversation
}

/**
 * Adapt response style based on user preferences
 */
export function adaptResponseStyle(
  message: string,
  style: 'formal' | 'casual' | 'empathetic'
): string {
  switch (style) {
    case 'formal':
      return message
        .replace(/\bOK\b/g, 'Certainly')
        .replace(/\bGreat!\b/g, 'Excellent!')
        .replace(/\bSure\b/g, 'Of course');
    
    case 'empathetic':
      return message
        .replace(/\bOK\b/g, 'I understand')
        .replace(/\bGreat!\b/g, 'That sounds good')
        .replace(/\bPerfect!\b/g, 'I\'m glad we could work that out');
    
    case 'casual':
    default:
      return message; // Keep natural, casual tone
  }
}

/**
 * Generate contextual error recovery message
 */
export function generateContextualErrorRecovery(
  phase: string,
  attemptNumber: number,
  lastInput?: string
): string {
  const errorMessages: Record<string, string[]> = {
    pin_auth: [
      'I didn\'t catch your PIN clearly. Could you say each number slowly?',
      'I\'m having trouble hearing the PIN. Could you try saying it again, speaking each digit clearly?',
      'Let me try a different approach. Could you spell out each number of your PIN?',
    ],
    
    collect_job_code: [
      'I didn\'t get your job code clearly. Could you say it again?',
      'I\'m having trouble with the job code. Could you spell it out letter by letter?',
      'Let me help you with this. Could you say your job code slowly, like "A B 1 2"?',
    ],
    
    job_options: [
      'I didn\'t catch what you\'d like to do. Could you tell me again?',
      'I\'m not sure I understood your choice. Would you like to reschedule, leave it open, or talk to someone?',
      'Let me make this easier. Just say "reschedule", "leave it open", or "talk to a person".',
    ],
    
    collect_day: [
      'I didn\'t catch when you\'d like to reschedule. Could you say it again?',
      'I\'m having trouble understanding the date and time. Could you try saying it differently?',
      'Let me help you. Could you say something like "next Tuesday at 2 PM" or "tomorrow morning"?',
    ],
    
    collect_reason: [
      'I didn\'t hear your reason clearly. Could you tell me again?',
      'Could you give me a bit more detail about why you can\'t make the appointment?',
      'I\'d like to understand better so I can help the team. Could you explain a bit more?',
    ],
  };

  const phaseMessages = errorMessages[phase] || [
    'I didn\'t catch that. Could you repeat it?',
    'I\'m having trouble understanding. Could you try saying it differently?',
    'Let me help you with this. Could you say that again more clearly?',
  ];

  const messageIndex = Math.min(attemptNumber - 1, phaseMessages.length - 1);
  return phaseMessages[messageIndex];
}

/**
 * Check if user is showing frustration
 */
export function detectFrustration(input: string, attemptNumber: number): {
  isFrustrated: boolean;
  supportiveResponse?: string;
} {
  const frustrationIndicators = [
    'what', 'why', 'this is ridiculous', 'this doesn\'t work', 'frustrated',
    'annoying', 'stupid', 'terrible', 'awful', 'hate this', 'give up'
  ];

  const text = input.toLowerCase();
  const hasFrustrationWords = frustrationIndicators.some(indicator => text.includes(indicator));
  const hasMultipleAttempts = attemptNumber >= 2;

  if (hasFrustrationWords || hasMultipleAttempts) {
    const supportiveResponses = [
      'I understand this can be frustrating. Let me help make this easier for you.',
      'I know this process can be challenging. Let me connect you with someone who can assist you directly.',
      'I can hear you\'re having trouble with this. Would you prefer to speak with a representative?',
    ];

    const responseIndex = Math.min(attemptNumber - 1, supportiveResponses.length - 1);
    
    return {
      isFrustrated: true,
      supportiveResponse: supportiveResponses[responseIndex],
    };
  }

  return { isFrustrated: false };
}

/**
 * Generate conversation summary for handoff to representative
 */
export function generateConversationSummary(conversationState: ConversationState): string {
  const { conversationHistory, currentPhase, contextMemory } = conversationState;
  
  let summary = 'Conversation Summary:\n';
  
  // Add user info if available
  if (contextMemory.employeeName) {
    summary += `Employee: ${contextMemory.employeeName}\n`;
  }
  
  if (contextMemory.jobCode) {
    summary += `Job Code: ${contextMemory.jobCode}\n`;
  }
  
  if (contextMemory.patientName) {
    summary += `Patient: ${contextMemory.patientName}\n`;
  }
  
  // Add current issue
  summary += `Current Phase: ${currentPhase}\n`;
  
  // Add recent conversation
  if (conversationHistory.length > 0) {
    summary += 'Recent Conversation:\n';
    conversationHistory.slice(-3).forEach(entry => {
      summary += `- User: ${entry.userInput}\n`;
      summary += `- System: ${entry.systemResponse}\n`;
    });
  }
  
  return summary;
}

/**
 * Build conversation context from call state
 */
export function buildConversationState(state: CallState): ConversationState {
  return {
    currentPhase: state.phase,
    previousPhase: undefined, // Would be tracked in a full implementation
    conversationHistory: [], // Would be populated from stored history
    userPreferences: {
      communicationStyle: 'casual',
      responseLength: 'brief',
      hasExpressedFrustration: false,
      hasExpressedUrgency: false,
    },
    contextMemory: {
      employeeName: state.employee?.name,
      jobCode: state.jobCode,
      patientName: state.patient?.name,
      jobTitle: state.jobTemplate?.title,
      selectedAction: state.actionType,
    },
  };
}

/**
 * Update conversation state with new interaction
 */
export function updateConversationState(
  conversationState: ConversationState,
  userInput: string,
  systemResponse: string,
  newPhase: string
): ConversationState {
  // Detect communication style from input
  const detectedStyle = detectCommunicationStyle(userInput);
  
  // Check for frustration
  const frustrationCheck = detectFrustration(userInput, conversationState.conversationHistory.length + 1);
  
  return {
    ...conversationState,
    currentPhase: newPhase,
    previousPhase: conversationState.currentPhase,
    conversationHistory: [
      ...conversationState.conversationHistory.slice(-9), // Keep last 10 interactions
      {
        phase: conversationState.currentPhase,
        userInput,
        systemResponse,
        timestamp: new Date().toISOString(),
      }
    ],
    userPreferences: {
      ...conversationState.userPreferences,
      communicationStyle: detectedStyle,
      hasExpressedFrustration: frustrationCheck.isFrustrated || conversationState.userPreferences.hasExpressedFrustration,
    },
  };
}

/**
 * Generate personalized greeting based on context
 */
export function generatePersonalizedGreeting(
  employeeName: string,
  timeOfDay: 'morning' | 'afternoon' | 'evening',
  isReturnUser: boolean = false
): string {
  const greetings = {
    morning: [
      `Good morning, ${employeeName}!`,
      `Hi ${employeeName}, hope you're having a good morning.`,
      `Morning, ${employeeName}!`,
    ],
    afternoon: [
      `Good afternoon, ${employeeName}!`,
      `Hi ${employeeName}, hope your day is going well.`,
      `Afternoon, ${employeeName}!`,
    ],
    evening: [
      `Good evening, ${employeeName}!`,
      `Hi ${employeeName}, hope you've had a good day.`,
      `Evening, ${employeeName}!`,
    ],
  };

  const timeGreetings = greetings[timeOfDay];
  const selectedGreeting = isReturnUser ? timeGreetings[1] : timeGreetings[0];
  
  return selectedGreeting;
}

/**
 * Get current time of day
 */
export function getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Generate natural workflow completion message
 */
export function generateWorkflowCompletion(
  actionType: string,
  context: Record<string, any> = {}
): string {
  const completionMessages: Record<string, string> = {
    reschedule: context.patientName && context.newDateTime
      ? `Perfect! I've successfully rescheduled ${context.patientName}'s appointment to ${context.newDateTime}. You'll receive a confirmation message shortly. Have a great day!`
      : `Excellent! Your appointment has been rescheduled. You'll get a confirmation message. Take care!`,
    
    leave_open: context.patientName && context.appointmentDate
      ? `All done! I've marked ${context.patientName}'s appointment for ${context.appointmentDate} as open, and I'm notifying other team members right now. Your reason has been recorded. Thank you for letting us know!`
      : `Perfect! The appointment has been marked as open and the team is being notified. Thanks for the heads up!`,
    
    representative: `No problem at all! I'm connecting you with a representative who can help you directly. Please hold for just a moment.`,
    
    different_job_code: `Of course! Let's try a different job code.`,
  };

  return completionMessages[actionType] || `Thank you! I've taken care of that for you. Have a great day!`;
}

/**
 * Enhance system response with conversational elements
 */
export function enhanceSystemResponse(
  baseResponse: string,
  conversationState: ConversationState,
  context: Record<string, any> = {}
): string {
  let enhanced = baseResponse;
  
  // Add conversational connectors
  if (conversationState.previousPhase && conversationState.currentPhase !== conversationState.previousPhase) {
    const transition = generatePhaseTransition(
      conversationState.previousPhase,
      conversationState.currentPhase,
      context
    );
    
    if (transition && !enhanced.toLowerCase().includes(transition.toLowerCase().substring(0, 10))) {
      enhanced = `${transition} ${enhanced}`;
    }
  }
  
  // Adapt style based on user preferences
  enhanced = adaptResponseStyle(enhanced, conversationState.userPreferences.communicationStyle);
  
  // Add empathy if user has expressed frustration
  if (conversationState.userPreferences.hasExpressedFrustration) {
    enhanced = addEmpathyToResponse(enhanced);
  }
  
  // Add urgency acknowledgment if needed
  if (conversationState.userPreferences.hasExpressedUrgency) {
    enhanced = addUrgencyAcknowledgment(enhanced);
  }
  
  return enhanced;
}

/**
 * Add empathy to response for frustrated users
 */
function addEmpathyToResponse(response: string): string {
  const empathyPhrases = [
    'I understand this can be challenging.',
    'I know this process can be frustrating.',
    'I appreciate your patience.',
  ];
  
  // Don't add empathy if already present
  if (empathyPhrases.some(phrase => response.toLowerCase().includes(phrase.toLowerCase()))) {
    return response;
  }
  
  const randomEmpathy = empathyPhrases[Math.floor(Math.random() * empathyPhrases.length)];
  return `${randomEmpathy} ${response}`;
}

/**
 * Add urgency acknowledgment
 */
function addUrgencyAcknowledgment(response: string): string {
  if (!response.toLowerCase().includes('quickly') && !response.toLowerCase().includes('right away')) {
    return `I'll take care of this right away. ${response}`;
  }
  return response;
}

/**
 * Generate natural error message with helpful guidance
 */
export function generateNaturalErrorMessage(
  errorType: string,
  phase: string,
  attemptNumber: number
): string {
  const baseMessages: Record<string, string> = {
    unclear_speech: 'I didn\'t catch that clearly.',
    no_match: 'I didn\'t understand that.',
    timeout: 'I didn\'t hear anything.',
    system_error: 'I\'m having a technical issue.',
    max_attempts: 'I\'m having trouble understanding.',
  };

  const baseMessage = baseMessages[errorType] || baseMessages.unclear_speech;
  const contextualHelp = generateContextualErrorRecovery(phase, attemptNumber);
  
  return `${baseMessage} ${contextualHelp}`;
}

/**
 * Test conversation flow functionality
 */
export function testConversationFlow() {
  console.log('Testing conversation flow:');
  console.log('========================');

  // Test transitions
  console.log('Phase Transitions:');
  console.log('- phone_auth → collect_job_code:', generatePhaseTransition('phone_auth', 'collect_job_code'));
  console.log('- confirm_job_code → job_options:', generatePhaseTransition('confirm_job_code', 'job_options', {
    patientName: 'Maria Garcia',
    jobTitle: 'Home Visit'
  }));
  
  // Test communication style detection
  console.log('\nCommunication Style Detection:');
  console.log('- "Please help me" →', detectCommunicationStyle('Please help me'));
  console.log('- "Yeah, sure" →', detectCommunicationStyle('Yeah, sure'));
  console.log('- "I have an emergency" →', detectCommunicationStyle('I have an emergency'));
  
  // Test response adaptation
  console.log('\nResponse Adaptation:');
  const baseResponse = 'Great! I\'ll take care of that.';
  console.log('- Formal:', adaptResponseStyle(baseResponse, 'formal'));
  console.log('- Casual:', adaptResponseStyle(baseResponse, 'casual'));
  console.log('- Empathetic:', adaptResponseStyle(baseResponse, 'empathetic'));
}
