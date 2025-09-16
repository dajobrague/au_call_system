/**
 * Speech-to-Text testing endpoint
 * Tests ElevenLabs STT functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { STTService } from '../../../../../src/services/elevenlabs/elevenlabs-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    console.log('STT Test: Transcribing audio file:', audioFile.name, audioFile.size, 'bytes');

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const result = await STTService.transcribeAudio(audioBuffer);

    if (result.success) {
      return NextResponse.json({
        success: true,
        text: result.text,
        confidence: result.confidence,
        duration: result.duration,
        audioSize: audioBuffer.length,
        audioName: audioFile.name,
      });
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: 'STT transcription failed', 
          details: result.error,
          duration: result.duration,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('STT Test Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/voice/stt',
    method: 'POST',
    description: 'Test ElevenLabs Speech-to-Text functionality',
    contentType: 'multipart/form-data',
    parameters: {
      audio: 'File (required) - Audio file to transcribe (WAV, MP3, etc.)',
    },
    example: 'curl -X POST -F "audio=@test.wav" http://localhost:3000/api/test/voice/stt',
    supportedFormats: ['wav', 'mp3', 'mp4', 'm4a', 'ogg', 'flac'],
  });
}
