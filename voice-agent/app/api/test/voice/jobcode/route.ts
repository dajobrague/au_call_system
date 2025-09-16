/**
 * Job code parsing testing endpoint
 * Tests voice job code recognition and phonetic processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseVoiceJobCode, validateJobCodeFormat } from '../../../../../src/services/voice/job-code-parser';
import { extractJobCodeSmart, processPhoneticSpelling } from '../../../../../src/services/voice/phonetic-processor';

export async function POST(request: NextRequest) {
  try {
    const { speech, testMode = false } = await request.json();

    if (!speech) {
      return NextResponse.json(
        { error: 'Speech parameter is required' },
        { status: 400 }
      );
    }

    console.log('Job Code Test: Parsing speech:', speech);

    // Try primary parsing method
    const primaryResult = parseVoiceJobCode(speech);
    
    // Try advanced phonetic processing
    const phoneticResult = extractJobCodeSmart(speech);
    
    // Try basic phonetic spelling
    const basicPhoneticResult = processPhoneticSpelling(speech);

    // Determine best result
    const results = [primaryResult, phoneticResult, basicPhoneticResult]
      .filter(r => r.success)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    const bestResult = results[0];

    // Validate format if we got a result
    let formatValidation;
    if (bestResult) {
      const code = (bestResult as any).jobCode || (bestResult as any).result || '';
      if (code) {
        formatValidation = {
          isValid: validateJobCodeFormat(code),
          code,
          length: code.length,
        };
      }
    }

    // If test mode, return all results
    if (testMode) {
      return NextResponse.json({
        input: speech,
        bestResult: bestResult || { success: false, error: 'No parsing method succeeded' },
        allResults: {
          primary: primaryResult,
          phonetic: phoneticResult,
          basicPhonetic: basicPhoneticResult,
        },
        formatValidation,
        timestamp: new Date().toISOString(),
      });
    }

    // Return best result
    const extractedCode = bestResult ? ((bestResult as any).jobCode || (bestResult as any).result) : undefined;
    
    return NextResponse.json({
      success: !!bestResult,
      input: speech,
      jobCode: extractedCode,
      confidence: bestResult?.confidence,
      method: (bestResult as any)?.method,
      formatValidation,
      error: bestResult ? undefined : 'Could not parse job code from speech',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Job Code Test Error:', error);
    return NextResponse.json(
      { 
        error: 'Job code parsing failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/voice/jobcode',
    method: 'POST',
    description: 'Test voice job code parsing and recognition',
    parameters: {
      speech: 'string (required) - Spoken job code to parse',
      testMode: 'boolean (optional) - Return detailed results from all parsing methods',
    },
    examples: [
      {
        speech: 'AB12',
        expectedJobCode: 'AB12',
        method: 'direct',
      },
      {
        speech: 'alpha bravo one two',
        expectedJobCode: 'AB12', 
        method: 'phonetic',
      },
      {
        speech: 'A B 1 2',
        expectedJobCode: 'AB12',
        method: 'spaced',
      },
      {
        speech: 'my job code is 1234',
        expectedJobCode: '1234',
        method: 'natural_language',
      },
    ],
    supportedFormats: [
      'Direct: "AB12", "1234"',
      'Spaced: "A B 1 2"', 
      'Phonetic: "alpha bravo one two"',
      'Natural: "my job code is AB12"',
      'Mixed: "alpha one two three"',
    ],
  });
}
