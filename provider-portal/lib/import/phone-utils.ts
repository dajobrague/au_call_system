/**
 * Australian Phone Number Utilities
 * Handles: Mobile (+61 4XX XXX XXX), Landline (+61 2/3/7/8 XXXX XXXX)
 */

export interface PhoneConfig {
  countryCode: string;      // '+61'
  mobilePrefix: string[];   // ['4']
  landlinePrefixes: string[]; // ['2', '3', '7', '8']
}

export const AUSTRALIAN_PHONE_CONFIG: PhoneConfig = {
  countryCode: '+61',
  mobilePrefix: ['4'],
  landlinePrefixes: ['2', '3', '7', '8']
};

/**
 * Normalize Australian phone number to consistent format
 * Input formats supported:
 *   - 0412 345 678
 *   - +61 412 345 678
 *   - 61412345678
 *   - (02) 1234 5678
 *   - +61 2 1234 5678
 * Output: +61412345678 or +61212345678
 */
export function normalizeAustralianPhone(phone: string): string | null {
  if (!phone) return null;
  
  // Strip all non-digit characters except leading +
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Remove leading 0 or +61 or 61
  if (cleaned.startsWith('+61')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('61')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  // Validate length (9-10 digits after country code)
  if (cleaned.length < 9 || cleaned.length > 10) {
    return null; // Invalid length
  }
  
  // Validate prefix (must start with 2, 3, 4, 7, or 8)
  const firstDigit = cleaned[0];
  if (!['2', '3', '4', '7', '8'].includes(firstDigit)) {
    return null; // Invalid Australian phone
  }
  
  return `+61${cleaned}`;
}

/**
 * Format phone for display
 * +61412345678 → 0412 345 678
 * +61212345678 → (02) 1234 5678
 */
export function formatAustralianPhoneDisplay(phone: string): string {
  if (!phone) return '';
  
  const normalized = normalizeAustralianPhone(phone);
  if (!normalized) return phone; // Return original if invalid
  
  const digits = normalized.slice(3); // Remove +61
  
  if (digits[0] === '4' && digits.length === 9) {
    // Mobile: 0412 345 678
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  } else if (digits.length === 9) {
    // Landline: (02) 1234 5678
    return `(0${digits[0]}) ${digits.slice(1, 5)} ${digits.slice(5)}`;
  }
  
  return `0${digits}`; // Fallback
}

/**
 * Check if two phone numbers match (after normalization)
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const norm1 = normalizeAustralianPhone(phone1);
  const norm2 = normalizeAustralianPhone(phone2);
  
  if (!norm1 || !norm2) return false;
  return norm1 === norm2;
}

/**
 * Validate phone number format
 */
export function validateAustralianPhone(phone: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const normalized = normalizeAustralianPhone(phone);
  
  if (!normalized) {
    return {
      valid: false,
      error: 'Invalid Australian phone number format. Expected: 04XX XXX XXX or (0X) XXXX XXXX'
    };
  }
  
  return {
    valid: true,
    normalized
  };
}

