/**
 * Date/Time Parser using OpenAI
 * Extracts structured date/time from natural language with injection resistance
 */

import { logger } from '../../lib/logger';

export interface DateTimeExtraction {
  hasDay: boolean;
  hasTime: boolean;
  dateISO?: string;        // "2025-10-15" - actual parsed date
  timeISO?: string;        // "14:30" - actual parsed time in 24h format
  displayText?: string;    // "Monday, October 15 at 2:30 PM" - human readable
  isVagueTime: boolean;
  confidence: 'high' | 'medium' | 'low';
  needsClarification: boolean;
  clarificationNeeded?: string; // What specifically needs clarification
  originalText: string;
}

// Function schema for OpenAI function calling (enforces JSON structure)
const DATETIME_EXTRACTION_FUNCTION = {
  name: 'parse_datetime',
  description: 'Parse and normalize date/time from user speech into ISO format for healthcare appointment scheduling',
  parameters: {
    type: 'object',
    properties: {
      hasDay: {
        type: 'boolean',
        description: 'Whether a specific day was mentioned (e.g., Monday, tomorrow, January 15)'
      },
      hasTime: {
        type: 'boolean',
        description: 'Whether a specific time was mentioned (e.g., 2 PM, 14:30, two thirty)'
      },
      dateISO: {
        type: 'string',
        description: 'Parsed date in ISO format YYYY-MM-DD. Calculate from relative dates (tomorrow, next Monday). Use current date context provided. Null if day not mentioned.'
      },
      timeISO: {
        type: 'string',
        description: 'Parsed time in 24-hour format HH:MM (e.g., "14:30" for 2:30 PM). Null if time not mentioned.'
      },
      displayText: {
        type: 'string',
        description: 'Human-readable format like "Monday, October 15 at 2:30 PM". Null if incomplete.'
      },
      isVagueTime: {
        type: 'boolean',
        description: 'Whether time is vague like "morning", "afternoon", "evening" instead of specific'
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Confidence level: high = both day and specific time, medium = one missing or vague, low = unclear'
      },
      needsClarification: {
        type: 'boolean',
        description: 'Whether more information is needed from the user'
      },
      clarificationNeeded: {
        type: 'string',
        description: 'What needs clarification: "day", "time", "both", or "unclear". Null if complete.'
      }
    },
    required: ['hasDay', 'hasTime', 'isVagueTime', 'confidence', 'needsClarification']
  }
};

/**
 * Extract date/time using OpenAI with strict function calling
 * Security: User text is passed as content, never interpolated into system prompt
 */
export async function extractDateTime(userSpeech: string): Promise<DateTimeExtraction> {
  const startTime = Date.now();
  
  try {
    logger.info('Extracting date/time with OpenAI', {
      userSpeech,
      type: 'datetime_extract_start'
    });
    
    // Get current date/time for context (provider timezone would be passed here in production)
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    // System prompt - strict instructions, no user data interpolation
    const systemPrompt = `You are a date/time parser for healthcare appointment scheduling.

Your ONLY job is to parse user speech into structured date/time data.

Current context (use for relative dates):
- Today: ${currentDate} (${dayOfWeek})
- Current time: ${currentTime}

Rules:
1. Parse ONLY what the user explicitly said - never invent information
2. Convert relative dates to ISO format:
   - "tomorrow" → calculate tomorrow's date
   - "next Monday" → calculate next Monday's date
   - "Monday" (if today is Wednesday) → calculate next Monday
3. Convert times to 24-hour format:
   - "2 PM" → "14:00"
   - "2:30 PM" → "14:30"
   - "two thirty" → "14:30" (if PM context) or "02:30" (if AM context)
4. Detect vague times (morning/afternoon/evening) - set isVagueTime: true
5. Generate displayText only if you have both day and time
6. Set clarificationNeeded to specify what's missing: "day", "time", "both", or "unclear"
7. Never include explanations or any text beyond the structured data

Examples:
- "Monday at 2 PM" → dateISO: "2025-10-13", timeISO: "14:00", displayText: "Monday, October 13 at 2:00 PM", confidence: high
- "tomorrow morning" → dateISO: "2025-10-08", hasTime: false, isVagueTime: true, clarificationNeeded: "time", confidence: medium
- "2 PM" → hasDay: false, timeISO: "14:00", clarificationNeeded: "day", confidence: medium
- "uh... maybe..." → hasDay: false, hasTime: false, clarificationNeeded: "both", confidence: low`;

    // User content - kept separate, never interpolated
    const userContent = `Parse this speech into date/time: "${userSpeech}"`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        functions: [DATETIME_EXTRACTION_FUNCTION],
        function_call: { name: 'parse_datetime' }, // Force function call
        temperature: 0, // Deterministic
        max_tokens: 150
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenAI API error', {
        status: response.status,
        error: errorText,
        type: 'openai_api_error'
      });
      
      // Fallback to low confidence
      return {
        hasDay: false,
        hasTime: false,
        isVagueTime: false,
        confidence: 'low',
        needsClarification: true,
        originalText: userSpeech
      };
    }
    
    const result: any = await response.json();
    const duration = Date.now() - startTime;
    
    // Extract function call result
    const functionCall = result.choices?.[0]?.message?.function_call;
    
    if (!functionCall || functionCall.name !== 'parse_datetime') {
      logger.error('OpenAI did not return function call', {
        result,
        duration,
        type: 'openai_no_function'
      });
      
      return {
        hasDay: false,
        hasTime: false,
        isVagueTime: false,
        confidence: 'low',
        needsClarification: true,
        clarificationNeeded: 'both',
        originalText: userSpeech
      };
    }
    
    // Parse function arguments
    const args = JSON.parse(functionCall.arguments);
    
    // Validate schema compliance
    if (typeof args.hasDay !== 'boolean' || typeof args.hasTime !== 'boolean') {
      logger.error('OpenAI returned invalid schema', {
        args,
        duration,
        type: 'openai_invalid_schema'
      });
      
      return {
        hasDay: false,
        hasTime: false,
        isVagueTime: false,
        confidence: 'low',
        needsClarification: true,
        clarificationNeeded: 'both',
        originalText: userSpeech
      };
    }
    
    const extraction: DateTimeExtraction = {
      hasDay: args.hasDay,
      hasTime: args.hasTime,
      dateISO: args.dateISO || undefined,
      timeISO: args.timeISO || undefined,
      displayText: args.displayText || undefined,
      isVagueTime: args.isVagueTime || false,
      confidence: args.confidence || 'low',
      needsClarification: args.needsClarification !== false, // Default to true
      clarificationNeeded: args.clarificationNeeded || undefined,
      originalText: userSpeech
    };
    
    logger.info('Date/time extraction successful', {
      extraction,
      duration,
      type: 'datetime_extract_success'
    });
    
    return extraction;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Date/time extraction error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userSpeech,
      duration,
      type: 'datetime_extract_error'
    });
    
    // Fallback
    return {
      hasDay: false,
      hasTime: false,
      isVagueTime: false,
      confidence: 'low',
      needsClarification: true,
      clarificationNeeded: 'both',
      originalText: userSpeech
    };
  }
}
