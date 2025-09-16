/**
 * Intent parsing testing endpoint
 * Tests natural language intent recognition
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseIntent, parseIntentWithContext } from '../../../../../src/services/intent/intent-parser';
import { generateNaturalResponse, getJobOptionsMessage } from '../../../../../src/services/voice/natural-responses';

export async function POST(request: NextRequest) {
  try {
    const { speech, context = 'general', testMode = false } = await request.json();

    if (!speech) {
      return NextResponse.json(
        { error: 'Speech parameter is required' },
        { status: 400 }
      );
    }

    console.log('Intent Test: Parsing speech:', speech, 'in context:', context);

    // Parse intent
    const result = parseIntent(speech, context);

    // If test mode, run additional tests
    let testResults;
    if (testMode) {
      testResults = {
        job_options: parseIntent(speech, 'job_options'),
        confirmation: parseIntent(speech, 'confirmation'),
        provider_selection: parseIntent(speech, 'provider_selection'),
        occurrence_selection: parseIntent(speech, 'occurrence_selection'),
      };
    }

    return NextResponse.json({
      success: result.success,
      input: speech,
      context,
      intent: result.intent,
      confidence: result.confidence,
      interpretedAs: result.context,
      error: result.error,
      testResults: testMode ? testResults : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Intent Test Error:', error);
    return NextResponse.json(
      { 
        error: 'Intent parsing failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/voice/intent',
    method: 'POST',
    description: 'Test natural language intent recognition',
    parameters: {
      speech: 'string (required) - User speech to parse',
      context: 'string (optional) - Conversation context (job_options, confirmation, etc.)',
      testMode: 'boolean (optional) - Run tests across all contexts',
    },
    examples: [
      {
        speech: 'I want to reschedule my appointment',
        context: 'job_options',
        expectedIntent: '1',
      },
      {
        speech: 'I can\'t make it, leave it open',
        context: 'job_options',
        expectedIntent: '2',
      },
      {
        speech: 'Yes, that\'s correct',
        context: 'confirmation',
        expectedIntent: '1',
      },
      {
        speech: 'No, that\'s wrong',
        context: 'confirmation',
        expectedIntent: '2',
      },
    ],
    contexts: [
      'job_options',
      'confirmation', 
      'provider_selection',
      'occurrence_selection',
      'general',
    ],
  });
}
