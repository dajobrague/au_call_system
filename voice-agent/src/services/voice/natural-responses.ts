/**
 * Natural language response templates
 * Converts rigid prompts to conversational language
 */

export interface ResponseTemplate {
  template: string;
  variables?: string[];
  context?: string;
}

/**
 * Natural language response templates
 */
export const RESPONSE_TEMPLATES: Record<string, ResponseTemplate> = {
  // Job options prompts
  job_options_generic: {
    template: 'What would you like to do with your appointment? You can reschedule it, leave it open for someone else, or talk to a representative.',
    context: 'Generic job options when no patient/job info available',
  },
  
  job_options_with_patient: {
    template: 'What would you like to do with {patientName}\'s {jobTitle}? You can reschedule it, leave it open for someone else, or talk to a representative.',
    variables: ['patientName', 'jobTitle'],
    context: 'Job options with patient and job details',
  },
  
  job_options_with_job: {
    template: 'What would you like to do with the {jobTitle}? You can reschedule it, leave it open for someone else, or talk to a representative.',
    variables: ['jobTitle'],
    context: 'Job options with job details only',
  },

  // Provider selection prompts
  provider_selection: {
    template: 'I see you work for multiple providers. Which one are you calling about today?',
    context: 'Multi-provider selection introduction',
  },

  // Job code prompts
  job_code_request: {
    template: 'What\'s your job code? You can say the numbers or spell it out.',
    context: 'Requesting job code in natural language',
  },
  
  job_code_confirmation: {
    template: 'I heard job code {jobCode}. Is that correct?',
    variables: ['jobCode'],
    context: 'Confirming job code',
  },

  // Date/time prompts
  reschedule_date_request: {
    template: 'When would you like to reschedule the appointment? You can say something like "next Tuesday at 2 PM" or "tomorrow morning".',
    context: 'Requesting new date/time for rescheduling',
  },
  
  reschedule_confirmation: {
    template: 'Perfect! I\'ll reschedule your appointment to {newDateTime}. Is that correct?',
    variables: ['newDateTime'],
    context: 'Confirming reschedule date/time',
  },

  // Reason collection prompts
  reason_request: {
    template: 'Can you tell me why you can\'t make the appointment for {appointmentDate}? This helps us understand and assist other team members.',
    variables: ['appointmentDate'],
    context: 'Requesting reason for leaving job open',
  },
  
  reason_confirmation: {
    template: 'I understand, {reason}. I\'ll mark this appointment as open for others and let the team know. Is that correct?',
    variables: ['reason'],
    context: 'Confirming reason and action',
  },

  // Success messages
  reschedule_success: {
    template: 'Excellent! I\'ve successfully rescheduled {patientName}\'s appointment from {oldDate} to {newDate}. You\'ll receive a confirmation message shortly.',
    variables: ['patientName', 'oldDate', 'newDate'],
    context: 'Reschedule completion',
  },
  
  leave_open_success: {
    template: 'Perfect! I\'ve marked {patientName}\'s appointment for {appointmentDate} as open, and I\'m notifying other team members right now. Your reason has been recorded.',
    variables: ['patientName', 'appointmentDate'],
    context: 'Leave open completion',
  },

  // Error and clarification messages
  clarification_needed: {
    template: 'I didn\'t catch that clearly. Could you repeat what you\'d like to do?',
    context: 'General clarification request',
  },
  
  invalid_option: {
    template: 'I didn\'t understand that option. Let me give you the choices again.',
    context: 'Invalid option selected',
  },

  // Greeting templates
  authenticated_greeting: {
    template: 'Hi {employeeName}! How can I help you today?',
    variables: ['employeeName'],
    context: 'Greeting after successful authentication',
  },
  
  provider_greeting: {
    template: 'Welcome to {providerName}. What\'s your job code?',
    variables: ['providerName'],
    context: 'Provider-specific greeting',
  },
};

/**
 * Generate natural language response from template
 */
export function generateNaturalResponse(
  templateKey: string,
  variables?: Record<string, string>
): string {
  const template = RESPONSE_TEMPLATES[templateKey];
  
  if (!template) {
    console.warn(`Template not found: ${templateKey}`);
    return 'I\'m here to help. What would you like to do?';
  }

  let response = template.template;

  // Replace variables in template
  if (variables && template.variables) {
    for (const variable of template.variables) {
      const value = variables[variable];
      if (value) {
        const placeholder = `{${variable}}`;
        response = response.replace(new RegExp(placeholder, 'g'), value);
      }
    }
  }

  console.log(`Generated response: "${response}" (template: ${templateKey})`);
  return response;
}

/**
 * Get conversational job options message
 */
export function getJobOptionsMessage(
  jobTemplate?: { title: string },
  patient?: { name: string }
): string {
  if (jobTemplate && patient) {
    return generateNaturalResponse('job_options_with_patient', {
      patientName: patient.name,
      jobTitle: jobTemplate.title,
    });
  } else if (jobTemplate) {
    return generateNaturalResponse('job_options_with_job', {
      jobTitle: jobTemplate.title,
    });
  } else {
    return generateNaturalResponse('job_options_generic');
  }
}

/**
 * Get conversational provider selection message
 */
export function getProviderSelectionMessage(providers: Array<{ name: string; selectionNumber: number }>): string {
  const baseMessage = generateNaturalResponse('provider_selection');
  
  // Add provider options
  const options = providers.map(p => `Say "${p.selectionNumber}" for ${p.name}`).join(', ');
  
  return `${baseMessage} ${options}.`;
}

/**
 * Convert confirmation response to natural language
 */
export function getConfirmationResponse(
  confirmed: boolean,
  context: string,
  details?: Record<string, string>
): string {
  if (confirmed) {
    switch (context) {
      case 'reschedule':
        return details ? generateNaturalResponse('reschedule_success', details) : 'Great! I\'ll process that reschedule for you.';
      case 'leave_open':
        return details ? generateNaturalResponse('leave_open_success', details) : 'Perfect! I\'ll mark that as open for others.';
      case 'job_code':
        return 'Excellent! Let me look up that job for you.';
      default:
        return 'Perfect! Let me take care of that for you.';
    }
  } else {
    return 'No problem, let\'s try that again.';
  }
}

/**
 * Get error response in natural language
 */
export function getErrorResponse(errorType: string, context?: string): string {
  const errorResponses: Record<string, string> = {
    unclear_speech: 'I didn\'t catch that clearly. Could you repeat what you said?',
    no_match: 'I didn\'t understand that. Let me give you the options again.',
    low_confidence: 'I\'m not sure I understood correctly. Could you say that again?',
    timeout: 'I didn\'t hear anything. Are you still there?',
    system_error: 'I\'m having a technical issue. Let me connect you with someone who can help.',
    max_attempts: 'I\'m having trouble understanding. Let me connect you with a representative who can help.',
  };

  return errorResponses[errorType] || errorResponses.system_error;
}

/**
 * Test natural response generation
 */
export function testNaturalResponses() {
  console.log('Testing natural response generation:');
  console.log('===================================');

  // Test job options
  console.log('Job Options:');
  console.log('- Generic:', getJobOptionsMessage());
  console.log('- With job:', getJobOptionsMessage({ title: 'Home Visit' }));
  console.log('- With patient:', getJobOptionsMessage({ title: 'Home Visit' }, { name: 'Maria Garcia' }));
  console.log('');

  // Test confirmations
  console.log('Confirmations:');
  console.log('- Reschedule confirmed:', getConfirmationResponse(true, 'reschedule'));
  console.log('- Leave open confirmed:', getConfirmationResponse(true, 'leave_open'));
  console.log('- Rejected:', getConfirmationResponse(false, 'any'));
  console.log('');

  // Test error responses
  console.log('Error Responses:');
  console.log('- Unclear speech:', getErrorResponse('unclear_speech'));
  console.log('- No match:', getErrorResponse('no_match'));
  console.log('- Low confidence:', getErrorResponse('low_confidence'));
}
