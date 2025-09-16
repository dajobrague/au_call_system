/**
 * Complete conversation flow testing endpoint
 * Tests end-to-end conversation flow and context management
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePhaseTransition, detectFrustration, adaptResponseStyle } from '../../../../../src/services/voice/conversation-flow';
import { initializeConversationMemory, updateConversationMemory } from '../../../../../src/services/voice/context-manager';

export async function POST(request: NextRequest) {
  try {
    const { 
      speech, 
      currentPhase = 'job_options',
      previousPhase = 'phone_auth',
      context = {},
      testMode = false 
    } = await request.json();

    if (!speech) {
      return NextResponse.json(
        { error: 'Speech parameter is required' },
        { status: 400 }
      );
    }

    console.log('Conversation Test: Processing speech:', speech, 'in phase:', currentPhase);

    // Test phase transition generation
    const transition = generatePhaseTransition(previousPhase, currentPhase, context);
    
    // Test communication style adaptation
    const baseResponse = 'I\'ll take care of that for you.';
    const adaptedResponses = {
      formal: adaptResponseStyle(baseResponse, 'formal'),
      casual: adaptResponseStyle(baseResponse, 'casual'),
      empathetic: adaptResponseStyle(baseResponse, 'empathetic'),
    };
    
    // Test frustration detection
    const frustrationCheck = detectFrustration(speech, 1);
    
    // Mock conversation memory for testing
    const mockMemory = {
      employeeInfo: { name: context.employeeName || 'David' },
      jobInfo: { 
        patientName: context.patientName || 'Maria',
        title: context.jobTitle || 'Home Visit',
        code: context.jobCode || 'AB12'
      },
      userBehavior: {
        communicationStyle: 'casual' as const,
        hasExpressedFrustration: false,
        hasExpressedUrgency: false,
        preferredResponseLength: 'brief' as const,
        totalAttempts: 1,
        successfulInteractions: 0,
      },
      conversationFlow: {
        startTime: new Date().toISOString(),
        currentPhase,
        previousPhases: [previousPhase],
        phaseTransitions: [],
      },
      errorRecovery: {
        totalErrors: 0,
        errorsByPhase: {},
        recoveryStrategies: [],
      },
    };

    // If test mode, run comprehensive tests
    let testResults;
    if (testMode) {
      testResults = {
        transitions: {
          'phone_auth → collect_job_code': generatePhaseTransition('phone_auth', 'collect_job_code'),
          'confirm_job_code → job_options': generatePhaseTransition('confirm_job_code', 'job_options', {
            patientName: 'Maria Garcia',
            jobTitle: 'Home Visit'
          }),
          'job_options → occurrence_selection': generatePhaseTransition('job_options', 'occurrence_selection'),
        },
        styleAdaptations: adaptedResponses,
        frustrationTests: [
          { input: 'This is frustrating', result: detectFrustration('This is frustrating', 1) },
          { input: 'Why doesn\'t this work', result: detectFrustration('Why doesn\'t this work', 2) },
          { input: 'I give up', result: detectFrustration('I give up', 3) },
        ],
      };
    }

    return NextResponse.json({
      input: speech,
      currentPhase,
      previousPhase,
      analysis: {
        transition,
        adaptedResponses,
        frustrationCheck,
        conversationMemory: mockMemory,
      },
      testResults: testMode ? testResults : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Conversation Test Error:', error);
    return NextResponse.json(
      { 
        error: 'Conversation flow test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/voice/conversation',
    method: 'POST',
    description: 'Test complete conversation flow and context management',
    parameters: {
      speech: 'string (required) - User speech input',
      currentPhase: 'string (optional) - Current FSM phase',
      previousPhase: 'string (optional) - Previous FSM phase',
      context: 'object (optional) - Additional context (employeeName, patientName, etc.)',
      testMode: 'boolean (optional) - Run comprehensive tests',
    },
    examples: [
      {
        speech: 'I want to reschedule',
        currentPhase: 'job_options',
        previousPhase: 'confirm_job_code',
        context: { patientName: 'Maria Garcia', jobTitle: 'Home Visit' },
      },
      {
        speech: 'This is really frustrating',
        currentPhase: 'collect_job_code',
        expectedResult: 'Frustration detected with supportive response',
      },
    ],
    features: [
      'Natural phase transitions',
      'Communication style adaptation',
      'Frustration and urgency detection',
      'Context-aware personalization',
      'Conversation memory management',
    ],
  });
}
