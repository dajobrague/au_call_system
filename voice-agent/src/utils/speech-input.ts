/**
 * Speech Input Utilities
 * Handles speech recognition for voice input collection
 */

/**
 * Generate TwiML for speech input collection
 */
export function generateSpeechTwiML(
  prompt: string, 
  timeout: number = 10,
  speechTimeout: number = 5,
  voice: string = 'Google.en-AU-Wavenet-A'
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    input="speech" 
    language="en-AU" 
    timeout="${timeout}" 
    speechTimeout="${speechTimeout}"
    action="/api/twilio/voice"
    method="POST">
    <Say voice="${voice}">${prompt}</Say>
  </Gather>
  <Say voice="${voice}">I didn't hear your response. Please try again.</Say>
  <Redirect>/api/twilio/voice</Redirect>
</Response>`;
}

/**
 * Clean and validate speech-to-text input
 */
export function cleanSpeechInput(speechResult: string): { 
  cleaned: string; 
  isValid: boolean; 
  error?: string 
} {
  if (!speechResult) {
    return { cleaned: '', isValid: false, error: 'No speech detected' };
  }
  
  // Basic cleanup
  let cleaned = speechResult.trim();
  
  // Remove common speech recognition artifacts
  cleaned = cleaned.replace(/\s+/g, ' '); // Multiple spaces to single space
  cleaned = cleaned.replace(/[^\w\s.,!?-]/g, ''); // Remove special characters except basic punctuation
  
  // Validate length
  if (cleaned.length < 3) {
    return { cleaned, isValid: false, error: 'Reason too short' };
  }
  
  if (cleaned.length > 200) {
    // Truncate if too long
    cleaned = cleaned.substring(0, 200).trim();
  }
  
  // Check for common speech recognition errors/noise
  const commonNoiseWords = ['uh', 'um', 'er', 'ah', 'hmm'];
  const words = cleaned.toLowerCase().split(' ');
  const meaningfulWords = words.filter(word => !commonNoiseWords.includes(word));
  
  if (meaningfulWords.length === 0) {
    return { cleaned, isValid: false, error: 'No meaningful content detected' };
  }
  
  return { cleaned, isValid: true };
}

/**
 * Format reason for Airtable storage
 */
export function formatReasonForAirtable(reason: string, employeeName: string): string {
  const timestamp = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `${reason} (${employeeName} - ${timestamp})`;
}

/**
 * Generate speech confirmation TwiML
 */
export function generateSpeechConfirmationTwiML(
  reason: string,
  voice: string = 'Google.en-AU-Wavenet-A'
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    input="dtmf" 
    language="en-AU" 
    timeout="15" 
    numDigits="1"
    action="/api/twilio/voice"
    method="POST">
    <Say voice="${voice}">I heard: ${reason}. Press 1 to confirm and leave the job open, or 2 to try again.</Say>
  </Gather>
  <Say voice="${voice}">Please press 1 to confirm or 2 to try again.</Say>
  <Redirect>/api/twilio/voice</Redirect>
</Response>`;
}
