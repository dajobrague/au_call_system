/**
 * Natural language date/time parsing test endpoint
 * Tests conversational scheduling functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseNaturalDateTime } from '../../../../../src/services/voice/datetime-parser';
import { validateAndSuggestSchedule } from '../../../../../src/services/voice/schedule-validator';

export async function POST(request: NextRequest) {
  try {
    const { speech, testMode = false } = await request.json();

    if (!speech) {
      return NextResponse.json(
        { error: 'Speech parameter is required' },
        { status: 400 }
      );
    }

    console.log('DateTime Test: Parsing speech:', speech);

    // Parse natural language date/time
    const parseResult = parseNaturalDateTime(speech);
    
    // Validate if we got complete date/time
    let validationResult;
    if (parseResult.success && parseResult.date && parseResult.time) {
      validationResult = validateAndSuggestSchedule(parseResult.date, parseResult.time, speech);
    }

    // If test mode, run additional test cases
    let testResults;
    if (testMode) {
      const additionalTests = [
        'next Tuesday at 2 PM',
        'tomorrow morning',
        'January 15th at 3:30 PM',
        'Monday at 10 AM',
        'this Friday afternoon',
      ];
      
      testResults = additionalTests.map(test => ({
        input: test,
        result: parseNaturalDateTime(test),
      }));
    }

    return NextResponse.json({
      success: parseResult.success,
      input: speech,
      parsed: {
        date: parseResult.date,
        time: parseResult.time,
        displayDateTime: parseResult.displayDateTime,
        confidence: parseResult.confidence,
        method: parseResult.method,
        needsTime: parseResult.needsTime,
        needsDate: parseResult.needsDate,
      },
      validation: validationResult,
      error: parseResult.error,
      testResults: testMode ? testResults : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('DateTime Test Error:', error);
    return NextResponse.json(
      { 
        error: 'DateTime parsing failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/voice/datetime',
    method: 'POST',
    description: 'Test natural language date/time parsing for scheduling',
    parameters: {
      speech: 'string (required) - Natural language date/time input',
      testMode: 'boolean (optional) - Run additional test cases',
    },
    examples: [
      {
        speech: 'next Tuesday at 2 PM',
        expectedResult: 'Complete date and time',
      },
      {
        speech: 'tomorrow morning',
        expectedResult: 'Date with default morning time',
      },
      {
        speech: 'January 15th at 3:30 PM',
        expectedResult: 'Specific date and time',
      },
      {
        speech: 'this Friday',
        expectedResult: 'Date only, will need time',
      },
      {
        speech: 'at 2 PM',
        expectedResult: 'Time only, will need date',
      },
    ],
    supportedFormats: [
      'Complete: "next Tuesday at 2 PM"',
      'Relative: "tomorrow morning"',
      'Specific: "January 15th at 3:30 PM"',
      'Day + Time: "Monday at 10 AM"',
      'Date only: "this Friday"',
      'Time only: "at 2 PM"',
    ],
  });
}
