import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/services/elevenlabs-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Validate text length
    if (text.length > 150) {
      return NextResponse.json(
        { error: 'Text must be 150 characters or less' },
        { status: 400 }
      );
    }

    // Generate speech
    const result = await generateSpeech(text);

    if (!result.success || !result.audioBuffer) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate speech' },
        { status: 500 }
      );
    }

    // Return audio as base64
    const audioBase64 = result.audioBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      audioBase64,
    });
  } catch (error) {
    console.error('Generate greeting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

