/**
 * ElevenLabs connection testing endpoint
 * Tests basic connectivity and configuration
 */

import { NextResponse } from 'next/server';
import { testElevenLabsConnection, getAvailableVoices } from '../../../../services/elevenlabs/elevenlabs-service';

export async function GET() {
  try {
    console.log('Testing ElevenLabs connection...');

    // Test basic connectivity
    const connectionTest = await testElevenLabsConnection();
    
    // Get available voices
    const voicesResult = await getAvailableVoices();

    // Environment check
    const envCheck = {
      hasApiKey: !!process.env.ELEVENLABS_API_KEY,
      hasVoiceId: !!process.env.ELEVENLABS_VOICE_ID,
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB (default)',
    };

    return NextResponse.json({
      success: connectionTest.success,
      connection: connectionTest,
      environment: envCheck,
      voices: voicesResult.success ? voicesResult.voices : { error: voicesResult.error },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Connection test failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET method to test ElevenLabs connection',
    endpoint: '/api/test/voice/connection',
    method: 'GET',
  }, { status: 405 });
}
