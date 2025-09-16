/**
 * Reason processing testing endpoint
 * Tests conversational reason collection and empathetic responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { processSpokenReason } from '../../../../../src/services/voice/reason-processor';
import { summarizeConversation, detectEmotionalDistress } from '../../../../../src/services/voice/conversation-summarizer';

export async function POST(request: NextRequest) {
  try {
    const { speech, testMode = false } = await request.json();

    if (!speech) {
      return NextResponse.json(
        { error: 'Speech parameter is required' },
        { status: 400 }
      );
    }

    console.log('Reason Test: Processing speech:', speech);

    // Process the spoken reason
    const reasonResult = processSpokenReason(speech);
    
    // Check for emotional distress
    const distressCheck = detectEmotionalDistress(speech);
    
    // Generate summary if text is long
    let summaryResult;
    if (speech.length > 50) {
      summaryResult = summarizeConversation(speech);
    }

    // If test mode, run additional test cases
    let testResults;
    if (testMode) {
      const testCases = [
        'I have a family emergency',
        'I\'m sick with the flu',
        'My car broke down',
        'Something personal came up',
        'Can\'t make it',
        'I\'m really stressed and overwhelmed with everything',
      ];
      
      testResults = testCases.map(test => ({
        input: test,
        result: processSpokenReason(test),
        distress: detectEmotionalDistress(test),
      }));
    }

    return NextResponse.json({
      success: reasonResult.success,
      input: speech,
      processed: {
        reason: reasonResult.reason,
        summary: reasonResult.summary,
        category: reasonResult.category,
        confidence: reasonResult.confidence,
        needsMoreDetail: reasonResult.needsMoreDetail,
        suggestedFollowUp: reasonResult.suggestedFollowUp,
      },
      emotionalDistress: distressCheck,
      summarization: summaryResult,
      error: reasonResult.error,
      testResults: testMode ? testResults : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Reason Test Error:', error);
    return NextResponse.json(
      { 
        error: 'Reason processing failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/voice/reason',
    method: 'POST',
    description: 'Test conversational reason collection and processing',
    parameters: {
      speech: 'string (required) - Spoken reason for missing appointment',
      testMode: 'boolean (optional) - Run additional test cases',
    },
    examples: [
      {
        speech: 'I have a family emergency and need to be out of town',
        expectedCategory: 'family_emergency',
        expectedEmpathy: 'High empathy response',
      },
      {
        speech: 'I\'m sick with the flu today',
        expectedCategory: 'illness',
        expectedEmpathy: 'Health-focused response',
      },
      {
        speech: 'My car broke down this morning',
        expectedCategory: 'transportation',
        expectedEmpathy: 'Understanding response',
      },
      {
        speech: 'Can\'t make it',
        expectedResult: 'Needs more detail',
        expectedFollowUp: 'Follow-up question',
      },
    ],
    features: [
      'Reason categorization (illness, family, work, etc.)',
      'Empathetic response generation',
      'Emotional distress detection',
      'Intelligent follow-up questions',
      'Conversation summarization',
    ],
  });
}
