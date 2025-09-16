/**
 * Text-to-Speech testing endpoint
 * Tests ElevenLabs TTS functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { TTSService } from '../../../../services/elevenlabs/elevenlabs-service';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, modelId } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text parameter is required' },
        { status: 400 }
      );
    }

    console.log('TTS Test: Converting text to speech:', text);

    const result = await TTSService.generateSpeech(text, {
      voiceId,
      modelId,
    });

    if (result.success && result.audioBuffer) {
      // Return audio file
      return new NextResponse(result.audioBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'attachment; filename="tts-output.mp3"',
          'X-Duration-Ms': result.duration?.toString() || '0',
          'X-Audio-Size': result.audioBuffer.length.toString(),
        },
      });
    } else {
      return NextResponse.json(
        { 
          error: 'TTS generation failed', 
          details: result.error,
          duration: result.duration,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('TTS Test Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/voice/tts',
    method: 'POST',
    description: 'Test ElevenLabs Text-to-Speech functionality',
    parameters: {
      text: 'string (required) - Text to convert to speech',
      voiceId: 'string (optional) - ElevenLabs voice ID',
      modelId: 'string (optional) - ElevenLabs model ID',
    },
    example: {
      text: 'Hello, this is a test of the text to speech system.',
      voiceId: 'pNInz6obpgDQGcFmaJgB',
      modelId: 'eleven_monolingual_v1',
    },
  });
}
