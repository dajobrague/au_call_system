/**
 * Schedule validation and smart suggestions
 * Validates scheduling requests and provides intelligent suggestions
 */

import { parseNaturalDateTime, type DateTimeParsingResult } from './datetime-parser';

export interface ScheduleValidationResult {
  isValid: boolean;
  date?: string;
  time?: string;
  displayDateTime?: string;
  error?: string;
  suggestion?: string;
  alternativeSuggestions?: string[];
}

/**
 * Validate and suggest schedule improvements
 */
export function validateAndSuggestSchedule(
  date?: string,
  time?: string,
  originalInput?: string
): ScheduleValidationResult {
  // Basic validation
  if (!date || !time) {
    return {
      isValid: false,
      error: 'Both date and time are required',
      suggestion: 'Please provide both a date and time for the appointment.',
    };
  }

  try {
    const dateObj = new Date(date);
    const [hours, minutes] = [time.substring(0, 2), time.substring(2, 4)];
    dateObj.setHours(parseInt(hours), parseInt(minutes));
    
    const now = new Date();
    
    // Check if in the future
    if (dateObj <= now) {
      return {
        isValid: false,
        error: 'The appointment time must be in the future',
        suggestion: 'Please choose a future date and time.',
        alternativeSuggestions: generateFutureSuggestions(),
      };
    }
    
    // Check if it's a reasonable business hour
    const hour24 = parseInt(hours);
    if (hour24 < 7 || hour24 > 18) {
      return {
        isValid: false,
        error: 'Appointment time should be during business hours',
        suggestion: 'Please choose a time between 7 AM and 6 PM.',
        alternativeSuggestions: generateBusinessHourSuggestions(date),
      };
    }
    
    // Check if it's a weekend
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        isValid: false,
        error: 'Appointments are not available on weekends',
        suggestion: 'Please choose a weekday (Monday through Friday).',
        alternativeSuggestions: generateWeekdaySuggestions(),
      };
    }
    
    // Generate display format
    const displayDateTime = formatDateTimeForDisplay(dateObj);
    
    return {
      isValid: true,
      date,
      time,
      displayDateTime,
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid date/time format',
      suggestion: 'Please provide a valid date and time.',
    };
  }
}

/**
 * Generate future date/time suggestions
 */
function generateFutureSuggestions(): string[] {
  const suggestions = [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Next few weekdays
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  for (let i = 0; i < 5; i++) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + i + 1);
    
    if (futureDate.getDay() >= 1 && futureDate.getDay() <= 5) { // Weekday
      const dayName = weekdays[futureDate.getDay() - 1];
      suggestions.push(`${dayName} at 9 AM`);
      suggestions.push(`${dayName} at 2 PM`);
    }
  }
  
  return suggestions.slice(0, 4); // Return top 4 suggestions
}

/**
 * Generate business hour suggestions for a specific date
 */
function generateBusinessHourSuggestions(date: string): string[] {
  const dateObj = new Date(date);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  
  return [
    `${dayName} at 9 AM`,
    `${dayName} at 11 AM`, 
    `${dayName} at 2 PM`,
    `${dayName} at 4 PM`,
  ];
}

/**
 * Generate weekday suggestions
 */
function generateWeekdaySuggestions(): string[] {
  const suggestions = [];
  const today = new Date();
  
  // Find next 4 weekdays
  for (let i = 1; i <= 10; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + i);
    
    if (futureDate.getDay() >= 1 && futureDate.getDay() <= 5) { // Weekday
      const dayName = futureDate.toLocaleDateString('en-US', { weekday: 'long' });
      suggestions.push(`${dayName} at 10 AM`);
      
      if (suggestions.length >= 4) break;
    }
  }
  
  return suggestions;
}

/**
 * Format date/time for natural display
 */
function formatDateTimeForDisplay(date: Date): string {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  return `${dayName}, ${monthDay} at ${time}`;
}

/**
 * Check if date is too far in the future
 */
export function isTooFarInFuture(date: string): boolean {
  const dateObj = new Date(date);
  const today = new Date();
  const diffTime = dateObj.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 90; // More than 3 months
}

/**
 * Generate natural scheduling confirmation
 */
export function generateSchedulingConfirmation(
  oldDate: string,
  newDate: string,
  newTime: string,
  patientName?: string
): string {
  const newDateTime = formatDateTimeForDisplay(new Date(`${newDate}T${newTime.substring(0,2)}:${newTime.substring(2,4)}`));
  
  if (patientName) {
    return `Excellent! I'll reschedule ${patientName}'s appointment to ${newDateTime}. Is that correct?`;
  } else {
    return `Perfect! I'll reschedule your appointment to ${newDateTime}. Is that correct?`;
  }
}

/**
 * Handle ambiguous time input
 */
export function handleAmbiguousTime(input: string): {
  needsClarification: boolean;
  question?: string;
  suggestions?: string[];
} {
  // Check for ambiguous patterns
  if (/\b(morning|afternoon|evening)\b/i.test(input) && !/\d/.test(input)) {
    return {
      needsClarification: true,
      question: 'What time in the morning would you prefer?',
      suggestions: ['9 AM', '10 AM', '11 AM'],
    };
  }
  
  if (/\b\d{1,2}\b/.test(input) && !/\b(am|pm)\b/i.test(input)) {
    const hourMatch = input.match(/\b(\d{1,2})\b/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1]);
      if (hour >= 1 && hour <= 12) {
        return {
          needsClarification: true,
          question: `Did you mean ${hour} AM or ${hour} PM?`,
          suggestions: [`${hour} AM`, `${hour} PM`],
        };
      }
    }
  }
  
  return { needsClarification: false };
}

/**
 * Smart date/time extraction with context
 */
export function extractDateTimeWithContext(
  input: string,
  currentDate?: string,
  currentTime?: string
): DateTimeParsingResult {
  const result = parseNaturalDateTime(input);
  
  // For now, return the basic parsing result
  // In a full implementation, this would include more sophisticated context handling
  return result;
}

/**
 * Test schedule validation
 */
export function testScheduleValidation() {
  console.log('Testing schedule validation:');
  console.log('===========================');

  const testCases = [
    { date: '2025-01-15', time: '1400', description: 'Valid future appointment' },
    { date: '2024-01-15', time: '1400', description: 'Past date (should fail)' },
    { date: '2025-01-15', time: '0600', description: 'Too early (should fail)' },
    { date: '2025-01-18', time: '1400', description: 'Weekend (should fail if Saturday)' },
  ];

  testCases.forEach(testCase => {
    const result = validateAndSuggestSchedule(testCase.date, testCase.time);
    console.log(`${testCase.description}:`);
    console.log(`  ${result.isValid ? '✅' : '❌'} ${testCase.date} ${testCase.time}`);
    if (!result.isValid) {
      console.log(`  Error: ${result.error}`);
      console.log(`  Suggestion: ${result.suggestion}`);
    }
    console.log('');
  });
}
