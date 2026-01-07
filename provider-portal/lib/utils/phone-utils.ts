/**
 * Phone number utilities for Australian numbers
 */

/**
 * Normalize Australian phone number to +61 format without spaces
 * Accepts formats like:
 * - +61412345678
 * - 0412345678
 * - 04 1234 5678
 * - (02) 1234 5678
 * - +61 2 1234 5678
 */
export function normalizeAustralianPhone(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all spaces, hyphens, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // If starts with +61, keep it
  if (cleaned.startsWith('+61')) {
    return cleaned;
  }
  
  // If starts with 61, add +
  if (cleaned.startsWith('61')) {
    return '+' + cleaned;
  }
  
  // If starts with 0, replace with +61
  if (cleaned.startsWith('0')) {
    return '+61' + cleaned.substring(1);
  }
  
  // Otherwise, assume it's missing country code
  return '+61' + cleaned;
}

/**
 * Validate Australian phone number format
 */
export function validateAustralianPhone(phone: string): boolean {
  if (!phone) return false;
  
  const normalized = normalizeAustralianPhone(phone);
  if (!normalized) return false;
  
  // Australian phone numbers should be:
  // Mobile: +61 4XX XXX XXX (10 digits after +61)
  // Landline: +61 2/3/7/8 XXXX XXXX (9 digits after +61)
  
  // Check if it matches +61 followed by 9 or 10 digits
  const mobilePattern = /^\+614\d{8}$/; // Mobile
  const landlinePattern = /^\+61[2378]\d{8}$/; // Landline
  
  return mobilePattern.test(normalized) || landlinePattern.test(normalized);
}

/**
 * Format phone number for display (with spaces)
 */
export function formatAustralianPhoneForDisplay(phone: string): string {
  const normalized = normalizeAustralianPhone(phone);
  if (!normalized) return phone;
  
  // +61 4XX XXX XXX (mobile)
  if (normalized.match(/^\+614\d{8}$/)) {
    return normalized.replace(/^\+61(\d{3})(\d{3})(\d{3})$/, '+61 $1 $2 $3');
  }
  
  // +61 X XXXX XXXX (landline)
  if (normalized.match(/^\+61[2378]\d{8}$/)) {
    return normalized.replace(/^\+61(\d)(\d{4})(\d{4})$/, '+61 $1 $2 $3');
  }
  
  return normalized;
}

