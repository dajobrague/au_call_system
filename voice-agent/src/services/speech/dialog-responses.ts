/**
 * Dialog Response Generator
 * Generates appropriate responses based on date/time extraction results
 */

import { DateTimeExtraction } from './datetime-parser';
import { SpeechCollectionContext } from './speech-state-manager';

/**
 * Generate dialog response based on extraction results
 */
export function generateDialogResponse(
  extraction: DateTimeExtraction,
  context: SpeechCollectionContext
): string {
  const { hasDay, hasTime, dateISO, timeISO, displayText, isVagueTime, clarificationNeeded } = extraction;
  
  // Complete: both day and specific time
  if (hasDay && hasTime && !isVagueTime && displayText) {
    return `Perfect! I heard ${displayText}. Is that correct? Press 1 for yes, or 2 for no.`;
  }
  
  // Has day but needs time
  if (hasDay && !hasTime && dateISO) {
    // Format date nicely (avoid timezone issues)
    const [year, month, day] = dateISO.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const dayText = `${dayName}, ${monthDay}`;
    return `Great! What time on ${dayText} works for you?`;
  }
  
  // Has time but needs day
  if (!hasDay && hasTime && timeISO) {
    // Format time in 12-hour format
    const [hours, minutes] = timeISO.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const timeText = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    return `Got it, ${timeText}. What day would you like?`;
  }
  
  // Has day and vague time
  if (hasDay && hasTime && isVagueTime && dateISO) {
    const dayText = displayText || dateISO;
    return `What exact time would you like? For example, 2 PM or 4 PM`;
  }
  
  // Unclear or no information
  if (clarificationNeeded === 'both' || (!hasDay && !hasTime)) {
    return `I didn't catch that clearly. Please say the day and time, like "Monday at 2 PM"`;
  }
  
  // Default fallback
  return `Please tell me when you'd like to reschedule. Say the day and time, like "Monday at 2 PM"`;
}

/**
 * Check if we should continue collecting speech (incomplete data)
 */
export function shouldContinueCollection(extraction: DateTimeExtraction): boolean {
  // Continue if we need clarification
  if (extraction.needsClarification) {
    return true;
  }
  
  // Continue if missing day or time
  if (!extraction.hasDay || !extraction.hasTime) {
    return true;
  }
  
  // Continue if time is vague
  if (extraction.isVagueTime) {
    return true;
  }
  
  // We have everything - stop collecting
  return false;
}

/**
 * Generate initial prompt for speech collection
 */
export function generateInitialPrompt(context: SpeechCollectionContext): string {
  if (context.phase === 'collect_day') {
    return `When would you like to reschedule your appointment? You can say something like "next Tuesday at 2 PM" or "tomorrow morning"`;
  }
  
  if (context.phase === 'collect_time') {
    return `What time works for you? You can say something like "2 PM", "3:30 in the afternoon", or "10 AM"`;
  }
  
  if (context.phase === 'collect_reason') {
    return `Please tell me the reason why you cannot take this job. Speak clearly after the tone`;
  }
  
  return `Please speak after the tone`;
}

/**
 * Generate error response for speech collection failures
 */
export function generateErrorResponse(errorType: 'too_short' | 'hallucination' | 'no_speech' | 'timeout' | 'max_attempts'): string {
  switch (errorType) {
    case 'too_short':
      return `I didn't hear anything. Please speak clearly after the tone`;
    
    case 'hallucination':
    case 'no_speech':
      return `I didn't catch that. Please speak clearly after the tone`;
    
    case 'timeout':
      return `I didn't receive your input in time. Please speak after the tone`;
    
    case 'max_attempts':
      return `I'm having trouble understanding. Would you like to talk to a representative instead? Press 1 for yes, or 2 to try again.`;
    
    default:
      return `I'm having trouble with that. Please try again.`;
  }
}
