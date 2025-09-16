/**
 * Natural language date/time parser
 * Converts spoken date/time to structured format
 */

export interface DateTimeParsingResult {
  success: boolean;
  date?: string;        // YYYY-MM-DD format
  time?: string;        // HHMM format (24-hour)
  displayDateTime?: string; // Human-readable format
  confidence?: number;
  originalInput?: string;
  error?: string;
  method?: string;
  needsTime?: boolean;  // True if date was parsed but time is missing
  needsDate?: boolean;  // True if time was parsed but date is missing
}

/**
 * Parse natural language date/time input
 */
export function parseNaturalDateTime(spokenText: string): DateTimeParsingResult {
  const text = spokenText.toLowerCase().trim();
  
  console.log(`Parsing natural date/time: "${text}"`);

  // Remove common phrases
  const cleanedText = text
    .replace(/\bi want to reschedule to\b/gi, '')
    .replace(/\breschedule to\b/gi, '')
    .replace(/\bchange it to\b/gi, '')
    .replace(/\bmove it to\b/gi, '')
    .replace(/\bhow about\b/gi, '')
    .replace(/\blet's do\b/gi, '')
    .trim();

  // Try different parsing methods
  const methods = [
    { name: 'complete_datetime', func: parseCompleteDateTime },
    { name: 'relative_datetime', func: parseRelativeDateTime },
    { name: 'specific_date', func: parseSpecificDate },
    { name: 'time_only', func: parseTimeOnly },
    { name: 'day_and_time', func: parseDayAndTime },
  ];

  for (const method of methods) {
    const result = method.func(cleanedText);
    if (result.success) {
      return {
        ...result,
        originalInput: spokenText,
        method: method.name,
      };
    }
  }

  return {
    success: false,
    error: 'Could not parse date/time from speech',
    originalInput: spokenText,
  };
}

/**
 * Parse complete date/time (e.g., "next Tuesday at 2 PM")
 */
function parseCompleteDateTime(text: string): DateTimeParsingResult {
  const patterns = [
    // "next Tuesday at 2 PM"
    {
      regex: /\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b/i,
      handler: (match: RegExpMatchArray) => {
        const [, when, dayName, hour, period] = match;
        const targetDate = getNextWeekday(dayName);
        const time24 = convertTo24Hour(parseInt(hour), period);
        return {
          date: formatDate(targetDate),
          time: time24,
          displayDateTime: `${dayName} at ${hour} ${period.toUpperCase()}`,
        };
      },
    },
    // "tomorrow at 3:30 PM"
    {
      regex: /\btomorrow\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/i,
      handler: (match: RegExpMatchArray) => {
        const [, hour, minutes = '00', period] = match;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const time24 = convertTo24Hour(parseInt(hour), period, parseInt(minutes));
        return {
          date: formatDate(tomorrow),
          time: time24,
          displayDateTime: `tomorrow at ${hour}:${minutes} ${period.toUpperCase()}`,
        };
      },
    },
    // "January 15th at 2 PM"
    {
      regex: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\s+at\s+(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b/i,
      handler: (match: RegExpMatchArray) => {
        const [, monthName, day, , hour, period] = match;
        const month = getMonthNumber(monthName);
        const year = new Date().getFullYear();
        const date = new Date(year, month - 1, parseInt(day));
        const time24 = convertTo24Hour(parseInt(hour), period);
        return {
          date: formatDate(date),
          time: time24,
          displayDateTime: `${monthName} ${day} at ${hour} ${period.toUpperCase()}`,
        };
      },
    },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      try {
        const result = pattern.handler(match);
        return {
          success: true,
          ...result,
          confidence: 0.9,
        };
      } catch (error) {
        console.error('Error parsing complete datetime:', error);
      }
    }
  }

  return { success: false };
}

/**
 * Parse relative date/time (e.g., "tomorrow morning", "next week")
 */
function parseRelativeDateTime(text: string): DateTimeParsingResult {
  const patterns = [
    // "tomorrow morning/afternoon/evening"
    {
      regex: /\btomorrow\s+(morning|afternoon|evening)\b/i,
      handler: (match: RegExpMatchArray) => {
        const [, timeOfDay] = match;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const time = getTimeOfDay(timeOfDay);
        return {
          date: formatDate(tomorrow),
          time,
          displayDateTime: `tomorrow ${timeOfDay}`,
        };
      },
    },
    // "next Monday morning"
    {
      regex: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(morning|afternoon|evening)\b/i,
      handler: (match: RegExpMatchArray) => {
        const [, dayName, timeOfDay] = match;
        const targetDate = getNextWeekday(dayName);
        const time = getTimeOfDay(timeOfDay);
        return {
          date: formatDate(targetDate),
          time,
          displayDateTime: `next ${dayName} ${timeOfDay}`,
        };
      },
    },
    // "this Friday"
    {
      regex: /\b(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      handler: (match: RegExpMatchArray) => {
        const [, when, dayName] = match;
        const targetDate = getNextWeekday(dayName);
        return {
          date: formatDate(targetDate),
          displayDateTime: `${when} ${dayName}`,
          needsTime: true,
        };
      },
    },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      try {
        const result = pattern.handler(match);
        return {
          success: true,
          ...result,
          confidence: 0.85,
        };
      } catch (error) {
        console.error('Error parsing relative datetime:', error);
      }
    }
  }

  return { success: false };
}

/**
 * Parse specific date (e.g., "January 15th", "the 20th")
 */
function parseSpecificDate(text: string): DateTimeParsingResult {
  const patterns = [
    // "January 15th"
    {
      regex: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\b/i,
      handler: (match: RegExpMatchArray) => {
        const [, monthName, day] = match;
        const month = getMonthNumber(monthName);
        const year = new Date().getFullYear();
        const date = new Date(year, month - 1, parseInt(day));
        return {
          date: formatDate(date),
          displayDateTime: `${monthName} ${day}`,
          needsTime: true,
        };
      },
    },
    // "the 15th"
    {
      regex: /\bthe\s+(\d{1,2})(st|nd|rd|th)\b/i,
      handler: (match: RegExpMatchArray) => {
        const [, day] = match;
        const today = new Date();
        const targetDate = new Date(today.getFullYear(), today.getMonth(), parseInt(day));
        
        // If the date is in the past this month, move to next month
        if (targetDate < today) {
          targetDate.setMonth(targetDate.getMonth() + 1);
        }
        
        return {
          date: formatDate(targetDate),
          displayDateTime: `the ${day}${getOrdinalSuffix(parseInt(day))}`,
          needsTime: true,
        };
      },
    },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      try {
        const result = pattern.handler(match);
        return {
          success: true,
          ...result,
          confidence: 0.8,
        };
      } catch (error) {
        console.error('Error parsing specific date:', error);
      }
    }
  }

  return { success: false };
}

/**
 * Parse time only (e.g., "at 2 PM", "3:30 in the afternoon")
 */
function parseTimeOnly(text: string): DateTimeParsingResult {
  const patterns = [
    // "at 2 PM", "2:30 PM"
    {
      regex: /\bat\s+(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/i,
      handler: (match: RegExpMatchArray) => {
        const [, hour, minutes = '00', period] = match;
        const time24 = convertTo24Hour(parseInt(hour), period, parseInt(minutes));
        return {
          time: time24,
          displayDateTime: `${hour}:${minutes} ${period.toUpperCase()}`,
          needsDate: true,
        };
      },
    },
    // "3 o'clock"
    {
      regex: /\b(\d{1,2})\s*o'?clock\b/i,
      handler: (match: RegExpMatchArray) => {
        const [, hour] = match;
        const time24 = convertTo24Hour(parseInt(hour), 'PM'); // Assume PM for business hours
        return {
          time: time24,
          displayDateTime: `${hour} o'clock`,
          needsDate: true,
        };
      },
    },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      try {
        const result = pattern.handler(match);
        return {
          success: true,
          ...result,
          confidence: 0.75,
        };
      } catch (error) {
        console.error('Error parsing time only:', error);
      }
    }
  }

  return { success: false };
}

/**
 * Parse day and time together (e.g., "Monday at 2 PM")
 */
function parseDayAndTime(text: string): DateTimeParsingResult {
  const dayTimePattern = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/i;
  const match = text.match(dayTimePattern);
  
  if (match) {
    try {
      const [, dayName, hour, minutes = '00', period] = match;
      const targetDate = getNextWeekday(dayName);
      const time24 = convertTo24Hour(parseInt(hour), period, parseInt(minutes));
      
      return {
        success: true,
        date: formatDate(targetDate),
        time: time24,
        displayDateTime: `${dayName} at ${hour}:${minutes} ${period.toUpperCase()}`,
        confidence: 0.85,
      };
    } catch (error) {
      console.error('Error parsing day and time:', error);
    }
  }

  return { success: false };
}

/**
 * Get next occurrence of a weekday
 */
function getNextWeekday(dayName: string): Date {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName.toLowerCase());
  
  if (targetDay === -1) {
    throw new Error(`Invalid day name: ${dayName}`);
  }
  
  const today = new Date();
  const currentDay = today.getDay();
  let daysUntilTarget = targetDay - currentDay;
  
  // If target day is today or in the past, get next week's occurrence
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntilTarget);
  
  return targetDate;
}

/**
 * Convert 12-hour time to 24-hour format
 */
function convertTo24Hour(hour: number, period: string, minutes: number = 0): string {
  let hour24 = hour;
  
  if (period.toLowerCase().includes('pm') && hour !== 12) {
    hour24 += 12;
  } else if (period.toLowerCase().includes('am') && hour === 12) {
    hour24 = 0;
  }
  
  return `${hour24.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
}

/**
 * Get default time for time of day
 */
function getTimeOfDay(timeOfDay: string): string {
  const timeMap: Record<string, string> = {
    'morning': '0900',
    'afternoon': '1400', 
    'evening': '1800',
    'night': '2000',
  };
  
  return timeMap[timeOfDay.toLowerCase()] || '0900';
}

/**
 * Get month number from name
 */
function getMonthNumber(monthName: string): number {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  const monthIndex = months.indexOf(monthName.toLowerCase());
  return monthIndex === -1 ? 1 : monthIndex + 1;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get ordinal suffix for day
 */
function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd'; 
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Generate natural confirmation for date/time
 */
export function generateDateTimeConfirmation(
  date?: string, 
  time?: string, 
  displayDateTime?: string
): string {
  if (displayDateTime) {
    return `Perfect! I'll reschedule your appointment to ${displayDateTime}. Is that correct?`;
  }
  
  if (date && time) {
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const timeFormatted = formatTimeForSpeech(time);
    
    return `Perfect! I'll reschedule your appointment to ${dayName}, ${monthDay} at ${timeFormatted}. Is that correct?`;
  }
  
  return 'I have the scheduling information. Is that correct?';
}

/**
 * Format time for speech (HHMM -> "2:30 PM")
 */
function formatTimeForSpeech(time: string): string {
  if (time.length !== 4) return time;
  
  const hour = parseInt(time.substring(0, 2));
  const minutes = time.substring(2, 4);
  
  if (hour === 0) {
    return `12:${minutes} AM`;
  } else if (hour < 12) {
    return `${hour}:${minutes} AM`;
  } else if (hour === 12) {
    return `12:${minutes} PM`;
  } else {
    return `${hour - 12}:${minutes} PM`;
  }
}

/**
 * Generate natural scheduling request
 */
export function generateSchedulingRequest(): string {
  return 'When would you like to reschedule your appointment? You can say something like "next Tuesday at 2 PM", "tomorrow morning", or "January 15th at 3:30".';
}

/**
 * Generate follow-up questions for incomplete information
 */
export function generateSchedulingFollowUp(
  hasDate: boolean, 
  hasTime: boolean, 
  parsedInfo?: Partial<DateTimeParsingResult>
): string {
  if (hasDate && !hasTime) {
    const displayDate = parsedInfo?.displayDateTime || 'that day';
    return `Great! What time on ${displayDate}? You can say something like "2 PM" or "morning".`;
  }
  
  if (hasTime && !hasDate) {
    const displayTime = parsedInfo?.displayDateTime || 'that time';
    return `Got it, ${displayTime}. What day would you like? You can say "tomorrow", "next Tuesday", or a specific date.`;
  }
  
  return 'I need both a date and time. When would you like to reschedule?';
}

/**
 * Validate if date/time is in the future
 */
export function validateFutureDateTime(date: string, time: string): {
  isValid: boolean;
  error?: string;
} {
  try {
    const dateObj = new Date(date);
    const [hours, minutes] = [time.substring(0, 2), time.substring(2, 4)];
    dateObj.setHours(parseInt(hours), parseInt(minutes));
    
    const now = new Date();
    
    if (dateObj <= now) {
      return {
        isValid: false,
        error: 'The appointment time must be in the future.',
      };
    }
    
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid date/time format.',
    };
  }
}

/**
 * Test natural date/time parsing
 */
export function testDateTimeParsing() {
  const testCases = [
    'next Tuesday at 2 PM',
    'tomorrow at 3:30 PM',
    'January 15th at 9 AM',
    'tomorrow morning',
    'next Monday afternoon',
    'this Friday',
    'at 2 PM',
    'Monday at 3 PM',
    'the 20th at 4:30 PM',
  ];

  console.log('Testing natural date/time parsing:');
  console.log('=================================');
  
  testCases.forEach(testCase => {
    const result = parseNaturalDateTime(testCase);
    console.log(`"${testCase}"`);
    if (result.success) {
      console.log(`  ✅ Date: ${result.date || 'N/A'}, Time: ${result.time || 'N/A'}`);
      console.log(`  Display: ${result.displayDateTime}`);
      console.log(`  Confidence: ${result.confidence}, Method: ${result.method}`);
      if (result.needsTime) console.log(`  ⚠️ Needs time`);
      if (result.needsDate) console.log(`  ⚠️ Needs date`);
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
    }
    console.log('');
  });
}
