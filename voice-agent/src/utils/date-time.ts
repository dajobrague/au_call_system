/**
 * Date/Time Utilities
 * Smart validation and formatting for voice input collection
 */

/**
 * Validate day input (01-31)
 */
export function validateDay(day: string): { valid: boolean; error?: string } {
  if (!day || day.length !== 2) {
    return { valid: false, error: 'Day must be 2 digits' };
  }
  
  const dayNum = parseInt(day, 10);
  if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
    return { valid: false, error: 'Day must be between 01 and 31' };
  }
  
  return { valid: true };
}

/**
 * Validate month input (01-12)
 */
export function validateMonth(month: string): { valid: boolean; error?: string } {
  if (!month || month.length !== 2) {
    return { valid: false, error: 'Month must be 2 digits' };
  }
  
  const monthNum = parseInt(month, 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return { valid: false, error: 'Month must be between 01 and 12' };
  }
  
  return { valid: true };
}

/**
 * Validate time input (HH or HHMM military format)
 */
export function validateTime(time: string): { valid: boolean; error?: string; normalizedTime?: string } {
  if (!time || (time.length !== 2 && time.length !== 4)) {
    return { valid: false, error: 'Time must be 2 digits (HH) or 4 digits (HHMM)' };
  }
  
  if (time.length === 2) {
    // HH format (e.g., "19" -> "1900")
    const hour = parseInt(time, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      return { valid: false, error: 'Hour must be between 00 and 23' };
    }
    return { valid: true, normalizedTime: time + '00' };
  }
  
  if (time.length === 4) {
    // HHMM format (e.g., "1930")
    const hour = parseInt(time.substring(0, 2), 10);
    const minute = parseInt(time.substring(2, 4), 10);
    
    if (isNaN(hour) || hour < 0 || hour > 23) {
      return { valid: false, error: 'Hour must be between 00 and 23' };
    }
    
    if (isNaN(minute) || minute < 0 || minute > 59) {
      return { valid: false, error: 'Minutes must be between 00 and 59' };
    }
    
    return { valid: true, normalizedTime: time };
  }
  
  return { valid: false, error: 'Invalid time format' };
}

/**
 * Validate complete date (day + month combination)
 */
export function validateDateCombination(day: string, month: string, year?: number): { valid: boolean; error?: string } {
  const dayValidation = validateDay(day);
  if (!dayValidation.valid) {
    return dayValidation;
  }
  
  const monthValidation = validateMonth(month);
  if (!monthValidation.valid) {
    return monthValidation;
  }
  
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const currentYear = year || new Date().getFullYear();
  
  // Check if the date is valid (e.g., no February 31st)
  const testDate = new Date(currentYear, monthNum - 1, dayNum);
  
  if (testDate.getDate() !== dayNum || testDate.getMonth() !== monthNum - 1) {
    return { valid: false, error: 'Invalid date combination' };
  }
  
  return { valid: true };
}

/**
 * Format date for voice output
 */
export function formatDateTimeForVoice(day: string, month: string, time: string, year?: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const currentYear = year || new Date().getFullYear();
  
  // Get month name
  const monthName = months[monthNum - 1];
  
  // Add ordinal suffix to day
  const ordinalSuffix = getOrdinalSuffix(dayNum);
  const dayWithSuffix = `${dayNum}${ordinalSuffix}`;
  
  // Format time
  const timeFormatted = formatTimeForVoice(time);
  
  return `${monthName} ${dayWithSuffix} at ${timeFormatted}`;
}

/**
 * Get ordinal suffix for day numbers
 */
function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Format military time for voice output
 */
export function formatTimeForVoice(time: string): string {
  if (time.length !== 4) {
    return time; // Invalid format, return as-is
  }
  
  const hour = parseInt(time.substring(0, 2), 10);
  const minute = parseInt(time.substring(2, 4), 10);
  
  if (hour === 0) {
    // Midnight
    return minute === 0 ? 'midnight' : `12:${minute.toString().padStart(2, '0')} AM`;
  } else if (hour < 12) {
    // AM
    return minute === 0 ? `${hour} AM` : `${hour}:${minute.toString().padStart(2, '0')} AM`;
  } else if (hour === 12) {
    // Noon
    return minute === 0 ? 'noon' : `12:${minute.toString().padStart(2, '0')} PM`;
  } else {
    // PM
    const hour12 = hour - 12;
    return minute === 0 ? `${hour12} PM` : `${hour12}:${minute.toString().padStart(2, '0')} PM`;
  }
}

/**
 * Create full date string in YYYY-MM-DD format
 */
export function createFullDateString(day: string, month: string, year?: number): string {
  const currentYear = year || new Date().getFullYear();
  return `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Check if a date is in the future
 */
export function isFutureDate(day: string, month: string, year?: number): boolean {
  const currentYear = year || new Date().getFullYear();
  const inputDate = new Date(currentYear, parseInt(month, 10) - 1, parseInt(day, 10));
  const today = new Date();
  
  // Set time to start of day for comparison
  today.setHours(0, 0, 0, 0);
  
  return inputDate >= today;
}

/**
 * Generate auto-advancing TwiML for date/time input
 */
export function generateDateTimeTwiML(prompt: string, numDigits: number, voice: string = 'Google.en-AU-Wavenet-C'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" timeout="15" numDigits="${numDigits}">
    <Say voice="${voice}">${prompt}</Say>
  </Gather>
  <Say voice="${voice}">I didn't receive your input. Please try again.</Say>
  <Hangup/>
</Response>`;
}
