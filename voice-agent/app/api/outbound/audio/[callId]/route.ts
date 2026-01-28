/**
 * Outbound Call Audio Server
 * Phase 4: Serves pre-generated audio files for TwiML <Play> element
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAudioFilePath } from '../../../../../src/services/calling/audio-pregenerator';
import { logger } from '../../../../../src/lib/logger';
import fs from 'fs';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const callId = params.callId;
    
    logger.info('Serving outbound call audio', {
      callId,
      type: 'outbound_audio_request'
    });
    
    // Get audio file path
    const audioPath = getAudioFilePath(callId);
    
    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      logger.error('Audio file not found', {
        callId,
        audioPath,
        type: 'outbound_audio_not_found'
      });
      
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }
    
    // Read audio file
    const audioBuffer = fs.readFileSync(audioPath);
    
    logger.info('Audio file served', {
      callId,
      audioPath,
      sizeBytes: audioBuffer.length,
      type: 'outbound_audio_served'
    });
    
    // Return audio with proper headers for Twilio
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/basic', // µ-law format
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      }
    });
    
  } catch (error) {
    logger.error('Audio serving error', {
      callId: params.callId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'outbound_audio_error'
    });
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
