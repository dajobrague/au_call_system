/**
 * Phone Number Formatting Utilities
 * Handles E.164 format conversion and validation for Twilio integration
 */

/**
 * Normalize phone number to E.164 format
 * Twilio provides phone numbers in E.164 format (+61280001077)
 * Airtable stores them in various formats (+61 2 8000 1077, 555-1077, etc.)
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except the leading +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +
  if (!normalized.startsWith('+')) {
    // If it doesn't start with +, assume it's an Australian number and add +61
    if (normalized.startsWith('61')) {
      normalized = '+' + normalized;
    } else if (normalized.startsWith('0')) {
      // Australian local format (0x xxxx xxxx) -> +61x xxxx xxxx
      normalized = '+61' + normalized.substring(1);
    } else if (normalized.length === 10) {
      // US format without country code
      normalized = '+1' + normalized;
    } else {
      // Default to +61 for other formats
      normalized = '+61' + normalized;
    }
  }
  
  return normalized;
}

/**
 * Format phone number for display
 * Converts E.164 format to human-readable format
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';
  
  const normalized = normalizePhoneNumber(phone);
  
  // Australian numbers: +61 2 8000 1077
  if (normalized.startsWith('+61')) {
    const digits = normalized.substring(3);
    if (digits.length >= 9) {
      return `+61 ${digits.substring(0, 1)} ${digits.substring(1, 5)} ${digits.substring(5)}`;
    }
  }
  
  // US numbers: +1 (415) 555-2671
  if (normalized.startsWith('+1')) {
    const digits = normalized.substring(2);
    if (digits.length === 10) {
      return `+1 (${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
    }
  }
  
  // Default: return as-is
  return normalized;
}

/**
 * Check if phone number is valid E.164 format
 */
export function isValidE164(phone: string): boolean {
  if (!phone) return false;
  
  // E.164 format: + followed by up to 15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Extract country code from E.164 phone number
 */
export function getCountryCode(phone: string): string | null {
  if (!isValidE164(phone)) return null;
  
  const digits = phone.substring(1); // Remove the +
  
  // Common country codes
  if (digits.startsWith('1')) return '+1';    // US/Canada
  if (digits.startsWith('61')) return '+61';  // Australia
  if (digits.startsWith('44')) return '+44';  // UK
  if (digits.startsWith('33')) return '+33';  // France
  if (digits.startsWith('49')) return '+49';  // Germany
  
  // For other countries, try to extract based on known patterns
  // This is a simplified approach - in production, you'd use a proper library
  if (digits.length >= 10) {
    return '+' + digits.substring(0, 2);
  }
  
  return null;
}

/**
 * Compare two phone numbers for equality
 * Normalizes both numbers before comparison
 */
export function phoneNumbersEqual(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false;
  
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  
  return normalized1 === normalized2;
}

/**
 * Validate Australian phone number format
 * Specific validation for Australian numbers
 */
export function isValidAustralianNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  
  if (!normalized.startsWith('+61')) return false;
  
  const digits = normalized.substring(3);
  
  // Australian mobile: starts with 4, total 9 digits after +61
  // Australian landline: starts with 2, 3, 7, 8, total 9 digits after +61
  if (digits.length !== 9) return false;
  
  const firstDigit = digits.charAt(0);
  return ['2', '3', '4', '7', '8'].includes(firstDigit);
}

/**
 * Generate cache key for phone number lookups
 */
export function generatePhoneCacheKey(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return `employee:phone:${normalized}`;
}

/**
 * Extract phone number from Twilio webhook data
 * Twilio provides phone numbers in the 'From' field in E.164 format
 */
export function extractTwilioPhoneNumber(twilioFrom: string): string {
  // Twilio provides phone numbers in E.164 format
  // Just validate and return as-is
  if (isValidE164(twilioFrom)) {
    return twilioFrom;
  }
  
  // If not valid E.164, try to normalize
  return normalizePhoneNumber(twilioFrom);
}
