/**
 * Wave Interval Calculator
 * Calculates SMS wave intervals based on time until shift
 * TIMEZONE-AWARE: Properly handles Australian timezone for accurate timing
 */

import { logger } from '../../lib/logger';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { parse } from 'date-fns';

// Default timezone for shifts (Australia/Sydney)
const DEFAULT_TIMEZONE = 'Australia/Sydney';

/**
 * Base interval rules:
 * - Shift in 1-2 hours → 10 minutes
 * - Shift in 3 hours → 15 minutes
 * - Shift in 4 hours → 20 minutes
 * - Shift in 5 hours → 25 minutes
 * - Shift in 6-12 hours → 30 minutes
 * - Shift > 12 hours → 30 minutes (default)
 */
export function calculateWaveInterval(
  scheduledAt: string,
  timeString?: string,
  timezone: string = DEFAULT_TIMEZONE
): number {
  try {
    const now = new Date();
    
    // Combine date and time, then convert to UTC considering the timezone
    let shiftTime: Date;
    
    if (timeString) {
      // If we have a separate time field (HH:MM), combine it with the date
      const dateOnly = scheduledAt.split('T')[0]; // Extract YYYY-MM-DD
      const dateTimeString = `${dateOnly} ${timeString}`;
      
      // Parse the date and time as if they're in the provider's timezone
      // Format: "2025-09-15 14:00" → Parse as Sydney time → Convert to UTC
      const parsedDate = parse(dateTimeString, 'yyyy-MM-dd HH:mm', new Date());
      
      // Convert from the provider's timezone to UTC
      shiftTime = fromZonedTime(parsedDate, timezone);
      
      logger.info('Parsed shift time with timezone', {
        scheduledAt,
        timeString,
        timezone,
        combinedString: dateTimeString,
        parsedLocal: parsedDate.toISOString(),
        shiftTimeUTC: shiftTime.toISOString(),
        shiftTimeLocal: shiftTime.toLocaleString('en-AU', { timeZone: timezone }),
        type: 'wave_interval_timezone_parse'
      });
    } else {
      // Fallback: If no time string, try to parse scheduledAt directly
      // This handles ISO datetime strings
      shiftTime = new Date(scheduledAt);
      
      logger.warn('No time string provided, using scheduledAt as-is', {
        scheduledAt,
        shiftTime: shiftTime.toISOString(),
        type: 'wave_interval_no_time'
      });
    }
    
    // Calculate hours until shift (now in accurate UTC comparison)
    const msUntilShift = shiftTime.getTime() - now.getTime();
    const hoursUntilShift = msUntilShift / (1000 * 60 * 60);
    
    logger.info('Calculating wave interval', {
      scheduledAt,
      timeString,
      timezone,
      nowUTC: now.toISOString(),
      shiftTimeUTC: shiftTime.toISOString(),
      hoursUntilShift: hoursUntilShift.toFixed(2),
      type: 'wave_interval_calculation'
    });
    
    // If shift is in the past or very soon (< 30 minutes), use minimum interval
    if (hoursUntilShift < 0.5) {
      logger.warn('Shift is in the past or very soon', {
        scheduledAt,
        timeString,
        hoursUntilShift: hoursUntilShift.toFixed(2),
        type: 'wave_interval_past_shift'
      });
      return 5 * 60 * 1000; // 5 minutes minimum
    }
    
    // Apply interval rules
    let intervalMinutes: number;
    
    if (hoursUntilShift <= 2) {
      // 1-2 hours → 10 minutes
      intervalMinutes = 10;
    } else if (hoursUntilShift <= 3) {
      // 3 hours → 15 minutes
      intervalMinutes = 15;
    } else if (hoursUntilShift <= 4) {
      // 4 hours → 20 minutes
      intervalMinutes = 20;
    } else if (hoursUntilShift <= 5) {
      // 5 hours → 25 minutes
      intervalMinutes = 25;
    } else {
      // 6+ hours → 30 minutes
      intervalMinutes = 30;
    }
    
    const intervalMs = intervalMinutes * 60 * 1000;
    
    logger.info('Wave interval calculated', {
      scheduledAt,
      hoursUntilShift: hoursUntilShift.toFixed(2),
      intervalMinutes,
      intervalMs,
      type: 'wave_interval_calculated'
    });
    
    return intervalMs;
    
  } catch (error) {
    logger.error('Wave interval calculation error', {
      scheduledAt,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'wave_interval_error'
    });
    
    // Default fallback: 30 minutes
    return 30 * 60 * 1000;
  }
}

/**
 * Calculate when wave 2 should be sent
 */
export function calculateWave2Time(
  scheduledAt: string,
  timeString?: string,
  timezone?: string
): Date {
  const interval = calculateWaveInterval(scheduledAt, timeString, timezone);
  return new Date(Date.now() + interval);
}

/**
 * Calculate when wave 3 should be sent
 */
export function calculateWave3Time(
  scheduledAt: string,
  timeString?: string,
  timezone?: string
): Date {
  const interval = calculateWaveInterval(scheduledAt, timeString, timezone);
  return new Date(Date.now() + (interval * 2));
}

/**
 * Get interval description for logging
 */
export function getIntervalDescription(
  scheduledAt: string,
  timeString?: string,
  timezone?: string
): string {
  const interval = calculateWaveInterval(scheduledAt, timeString, timezone);
  const minutes = Math.round(interval / (60 * 1000));
  
  return `${minutes} minutes (Wave 2), ${minutes * 2} minutes (Wave 3)`;
}
