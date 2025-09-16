/**
 * Telephony configuration for voice calls
 * Centralized settings for TTS, STT, and call behavior with Australian English
 * Phase 2: FSM + State Management
 */

export const telephonyConfig = {
  // Voice settings (Google Australian Neural)
  voice: 'Google.en-AU-Wavenet-A' as const,
  language: 'en-AU' as const,
  
  // Gather settings
  gather: {
    input: 'speech dtmf' as const,
    language: 'en-AU' as const,
    timeout: 10, // seconds
    speechTimeout: 3, // seconds
    finishOnKey: '#' as const,
    maxRetries: 2, // First prompt + 1 retry (Phase 2 requirement)
  },
  
  // Phase 2 FSM Prompts (Australian English)
  prompts: {
    // Initial client ID collection
    welcome: 'Welcome. Please say your client number, or enter it on the keypad, then press pound.',
    reprompt_clientId: 'Sorry, I didn\'t catch that. Please say your client number, or enter it, then press pound.',
    
    // Job number collection (with personalized greeting)  
    ask_jobNumber: 'Hi David, Welcome to Healthcare Max Services, please use your keypad to enter your job code.',
    reprompt_jobNumber: 'Sorry, I didn\'t get the job code. Please use your keypad to enter it, then press pound.',
    
    // Confirmation prompts
    confirm_client_id: 'I heard client number {clientId}. Press 1 to confirm, or 2 to re-enter.',
    reprompt_confirm_client_id: 'Please press 1 to confirm client number {clientId}, or 2 to re-enter.',
    confirm_job_number: 'I heard job number {jobNumber}. Press 1 to confirm, or 2 to re-enter.',
    reprompt_confirm_job_number: 'Please press 1 to confirm job number {jobNumber}, or 2 to re-enter.',
    
    // Job action options (mock workflow)
    job_options: 'What do you want to do for Sam Wagle\'s Assignment on the 30th of August at 11:30 AM? Press 1 for re-scheduling, Press 2 to leave the job as open for someone else to take care of it, Press 3 to talk to a representative, or Press 4 to enter a different job code.',
    reprompt_job_options: 'Please choose an option. Press 1 for re-scheduling, Press 2 to leave the job open, Press 3 to talk to a representative, or Press 4 to enter a different job code.',
    
    // Workflow completion
    workflow_complete: 'This is the end of the developed workflow, more coming in the future. Thanks for calling. Goodbye.',
    
    // Legacy completion (will be replaced by workflow_complete)
    confirmed: 'Thank you. Your details have been confirmed.',
    goodbye: 'Thanks for calling. Goodbye.',
    
    // Error handling
    error: 'Sorry, there was an error processing your request. Please try again later.',
  },
  
  // Call flow settings
  flow: {
    maxCallDuration: 300, // 5 minutes
    silenceTimeout: 5, // seconds
  }
} as const;

export type TelephonyConfig = typeof telephonyConfig;