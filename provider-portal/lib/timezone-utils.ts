/**
 * Timezone Utility Module
 * Handles ALL date/time operations with Australian timezone awareness
 * 
 * All dates in the system should be processed through these utilities
 * to ensure consistent timezone handling regardless of user's location.
 */

import { format, parse, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

// Australian timezone (handles AEDT/AEST automatically)
export const AUSTRALIAN_TIMEZONE = 'Australia/Sydney';

/**
 * Parse Airtable date string to Date object
 * Airtable format: "DD/MM/YYYY, HH:MM:SS"
 * Returns Date object in Australian timezone
 */
export function parseAirtableDate(dateString: string): Date {
  if (!dateString) {
    throw new Error('Invalid date string');
  }
  
  try {
    // Parse "DD/MM/YYYY, HH:MM:SS" format
    const [datePart, timePart] = dateString.split(',').map(s => s.trim());
    const [day, month, year] = datePart.split('/').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    
    // Create date in Australian timezone
    const dateInAustralia = new Date(year, month - 1, day, hours, minutes, seconds);
    return fromZonedTime(dateInAustralia, AUSTRALIAN_TIMEZONE);
  } catch (error) {
    console.error('Failed to parse Airtable date:', dateString, error);
    throw error;
  }
}

/**
 * Convert Airtable date string to YYYY-MM-DD format (date only, no time)
 * Handles multiple formats:
 * - Airtable format: "DD/MM/YYYY, HH:MM:SS"
 * - ISO format: "2026-01-29T03:22:27.560Z"
 * - Simple format: "YYYY-MM-DD"
 * Returns: "YYYY-MM-DD"
 */
export function airtableDateToYYYYMMDD(dateString: string): string {
  if (!dateString) return '';
  
  try {
    // Check if it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Check if it's ISO format (e.g., "2026-01-29T03:22:27.560Z")
    if (dateString.includes('T') && (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-'))) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    // Handle Airtable format: "DD/MM/YYYY, HH:MM:SS"
    if (dateString.includes('/')) {
      const [datePart] = dateString.split(',').map(s => s.trim());
      const [day, month, year] = datePart.split('/');
      
      if (day && month && year) {
        const paddedMonth = month.padStart(2, '0');
        const paddedDay = day.padStart(2, '0');
        return `${year}-${paddedMonth}-${paddedDay}`;
      }
    }
    
    // Fallback: try to parse as a Date object
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    console.warn('Unknown date format:', dateString);
    return '';
  } catch (error) {
    console.error('Failed to convert Airtable date to YYYY-MM-DD:', dateString, error);
    return '';
  }
}

/**
 * Format a date for display in Australian timezone
 * Returns: "Wed, Dec 10, 2025" or custom format
 */
export function formatDateForDisplay(
  date: Date | string,
  formatString: string = 'EEE, MMM d, yyyy'
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, AUSTRALIAN_TIMEZONE, formatString);
  } catch (error) {
    console.error('Failed to format date for display:', date, error);
    return '';
  }
}

/**
 * Format a date for API calls (YYYY-MM-DD) in Australian timezone
 * Ensures the date is in Australian timezone before formatting
 */
export function formatDateForAPI(date: Date | string): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Failed to format date for API:', date, error);
    return '';
  }
}

/**
 * Get current date/time in Australian timezone
 */
export function getCurrentAustralianDate(): Date {
  return toZonedTime(new Date(), AUSTRALIAN_TIMEZONE);
}

/**
 * Parse a YYYY-MM-DD string as an Australian date (at midnight)
 * This prevents timezone shifts when parsing date strings
 */
export function parseYYYYMMDD(dateString: string): Date {
  if (!dateString) {
    throw new Error('Invalid date string');
  }
  
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    // Create date at midnight in Australian timezone
    return fromZonedTime(new Date(year, month - 1, day, 0, 0, 0), AUSTRALIAN_TIMEZONE);
  } catch (error) {
    console.error('Failed to parse YYYY-MM-DD:', dateString, error);
    throw error;
  }
}

/**
 * Format a YYYY-MM-DD date string for display without timezone conversion
 * Input: "2025-12-10"
 * Output: "Wed, Dec 10, 2025"
 */
export function formatYYYYMMDDForDisplay(
  dateString: string,
  formatString: string = 'EEE, MMM d, yyyy'
): string {
  if (!dateString) return '';
  
  try {
    // Parse as Australian date to avoid timezone shifts
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    // Format in Australian timezone
    return formatInTimeZone(date, AUSTRALIAN_TIMEZONE, formatString);
  } catch (error) {
    console.error('Failed to format YYYY-MM-DD for display:', dateString, error);
    return dateString;
  }
}

/**
 * Compare two date strings (YYYY-MM-DD format) safely
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDateStrings(date1: string, date2: string): number {
  return date1.localeCompare(date2);
}

/**
 * Check if a date string is within a range (inclusive)
 * All dates in YYYY-MM-DD format
 */
export function isDateInRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * Get yesterday in Australian timezone as YYYY-MM-DD
 */
export function getYesterdayAustralian(): string {
  const now = getCurrentAustralianDate();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return formatInTimeZone(yesterday, AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Get today in Australian timezone as YYYY-MM-DD
 */
export function getTodayAustralian(): string {
  return formatInTimeZone(getCurrentAustralianDate(), AUSTRALIAN_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Format timestamp for report generation (includes time)
 * Returns: "Dec 12, 2025, 3:45 PM"
 */
export function formatTimestampForReport(date: Date = new Date()): string {
  return formatInTimeZone(date, AUSTRALIAN_TIMEZONE, 'MMM d, yyyy, HH:mm');
}

