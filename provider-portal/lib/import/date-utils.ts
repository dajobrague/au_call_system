/**
 * Flexible Date Parser for CSV Imports
 * Supports multiple formats and auto-detection
 */

import { parse, isValid, format } from 'date-fns';

export interface DateConfig {
  formats: string[];           // Supported formats in order of preference
  outputFormat: string;        // Standard output format for Airtable
  timezone: string;            // Default timezone
}

export const DATE_CONFIG: DateConfig = {
  formats: [
    'dd/MM/yyyy',    // Australian standard: 25/12/2024
    'yyyy-MM-dd',    // ISO: 2024-12-25
    'dd-MM-yyyy',    // Alt dash: 25-12-2024
    'MM/dd/yyyy',    // US format: 12/25/2024
    'd/M/yyyy',      // No leading zeros: 5/3/2024
    'dd/MM/yy',      // Short year: 25/12/24
    'yyyy/MM/dd',    // Alt ISO: 2024/12/25
    'dd MMM yyyy',   // Text month: 25 Dec 2024
    'dd MMMM yyyy',  // Full month: 25 December 2024
  ],
  outputFormat: 'yyyy-MM-dd',
  timezone: 'Australia/Sydney'
};

/**
 * Parse date from various formats
 * Returns ISO string or null
 */
export function parseFlexibleDate(dateString: string): string | null {
  if (!dateString) return null;
  
  const trimmed = dateString.trim();
  
  // Try each format
  for (const formatStr of DATE_CONFIG.formats) {
    try {
      const parsed = parse(trimmed, formatStr, new Date());
      if (isValid(parsed)) {
        return format(parsed, DATE_CONFIG.outputFormat);
      }
    } catch {
      // Try next format
      continue;
    }
  }
  
  // Try native Date parsing as fallback
  try {
    const nativeDate = new Date(trimmed);
    if (isValid(nativeDate)) {
      return format(nativeDate, DATE_CONFIG.outputFormat);
    }
  } catch {
    // Failed
  }
  
  return null;
}

/**
 * Validate date string
 */
export function validateDateString(dateString: string): {
  valid: boolean;
  parsed?: string;
  detectedFormat?: string;
  error?: string;
} {
  if (!dateString) {
    return {
      valid: false,
      error: 'Date is required'
    };
  }
  
  const trimmed = dateString.trim();
  
  // Try to detect format
  for (const formatStr of DATE_CONFIG.formats) {
    try {
      const parsed = parse(trimmed, formatStr, new Date());
      if (isValid(parsed)) {
        return {
          valid: true,
          parsed: format(parsed, DATE_CONFIG.outputFormat),
          detectedFormat: formatStr
        };
      }
    } catch {
      continue;
    }
  }
  
  return {
    valid: false,
    error: `Could not parse date. Supported formats: ${DATE_CONFIG.formats.slice(0, 3).join(', ')}`
  };
}

/**
 * Parse time string (HH:mm or H:mm)
 */
export function parseTimeString(timeString: string): string | null {
  if (!timeString) return null;
  
  const trimmed = timeString.trim();
  
  // Match HH:mm or H:mm
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  
  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  // Return in HH:mm format
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Parse datetime string and extract both date and time
 * Handles formats like: "2025-12-16 09:30:00 +1000" or "2025-12-16 09:30:00"
 */
export function parseDateTimeString(datetimeString: string): {
  date: string | null;
  time: string | null;
} {
  if (!datetimeString) return { date: null, time: null };
  
  const trimmed = datetimeString.trim();
  
  // Remove timezone suffix if present (e.g., " +1000", " +10:00", " AEST")
  const cleanedString = trimmed.replace(/\s+[+-]\d{2}:?\d{2}$/, '').replace(/\s+[A-Z]{3,4}$/, '');
  
  // Try native Date parsing first (handles ISO formats well)
  try {
    const parsed = new Date(cleanedString);
    if (isValid(parsed)) {
      const dateStr = format(parsed, 'yyyy-MM-dd');
      const timeStr = format(parsed, 'HH:mm');
      return { date: dateStr, time: timeStr };
    }
  } catch {
    // Continue to manual parsing
  }
  
  // Try manual parsing for common formats: "YYYY-MM-DD HH:mm:ss" or "DD/MM/YYYY HH:mm:ss"
  const isoMatch = cleanedString.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  if (isoMatch) {
    const [, year, month, day, hour, minute] = isoMatch;
    return {
      date: `${year}-${month}-${day}`,
      time: `${hour.padStart(2, '0')}:${minute}`
    };
  }
  
  const dmyMatch = cleanedString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (dmyMatch) {
    const [, day, month, year, hour, minute] = dmyMatch;
    return {
      date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      time: `${hour.padStart(2, '0')}:${minute}`
    };
  }
  
  return { date: null, time: null };
}

