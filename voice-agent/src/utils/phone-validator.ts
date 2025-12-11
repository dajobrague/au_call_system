/**
 * Phone Number Validator
 * Validates Australian and Mexican phone numbers
 */

import { logger } from '../lib/logger';

/**
 * Validate if phone number is Australian or Mexican
 * @param phone - Phone number in E.164 format (e.g., +61412345678, +525512345678)
 * @returns true if valid Australian or Mexican number
 */
export function isValidAustralianOrMexicanNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // Remove any whitespace
  const cleanPhone = phone.trim();
  
  // Australian numbers: +61 followed by 9 digits
  // Mobile: +61 4XX XXX XXX (starts with 4)
  // Landline: +61 2/3/7/8 XXXX XXXX
  const australianRegex = /^\+61[2-478]\d{8}$/;
  
  // Mexican numbers: +52 followed by 10 digits
  // Mobile: +52 1 XXX XXX XXXX or +52 XXX XXX XXXX
  // Format: +52 followed by 10 digits
  const mexicanRegex = /^\+52\d{10}$/;
  
  const isAustralian = australianRegex.test(cleanPhone);
  const isMexican = mexicanRegex.test(cleanPhone);
  
  if (isAustralian) {
    logger.debug('Valid Australian number detected', {
      phone: cleanPhone,
      type: 'phone_validation_australian'
    });
  } else if (isMexican) {
    logger.debug('Valid Mexican number detected', {
      phone: cleanPhone,
      type: 'phone_validation_mexican'
    });
  }
  
  return isAustralian || isMexican;
}

/**
 * Filter employee list to only valid Australian/Mexican numbers
 * @param employees - List of employees with phone numbers
 * @returns Filtered list with only valid numbers
 */
export function filterValidPhoneNumbers<T extends { phone: string; name: string; id: string }>(
  employees: T[]
): T[] {
  const filtered = employees.filter(employee => {
    const isValid = isValidAustralianOrMexicanNumber(employee.phone);
    
    if (!isValid) {
      logger.info('Skipping employee with invalid phone number', {
        employeeId: employee.id,
        employeeName: employee.name,
        phone: employee.phone,
        type: 'phone_validation_skipped'
      });
    }
    
    return isValid;
  });
  
  logger.info('Phone number filtering complete', {
    totalEmployees: employees.length,
    validEmployees: filtered.length,
    skipped: employees.length - filtered.length,
    type: 'phone_validation_summary'
  });
  
  return filtered;
}

/**
 * Get country code from phone number
 * @param phone - Phone number in E.164 format
 * @returns 'AU' for Australian, 'MX' for Mexican, or null
 */
export function getPhoneCountryCode(phone: string): 'AU' | 'MX' | null {
  if (!phone) return null;
  
  const cleanPhone = phone.trim();
  
  if (cleanPhone.startsWith('+61')) return 'AU';
  if (cleanPhone.startsWith('+52')) return 'MX';
  
  return null;
}

