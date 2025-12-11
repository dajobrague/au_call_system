/**
 * Stream End Callback Handler
 * Called by Twilio when Media Streams WebSocket ends
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/transfer/stream-end
 * Callback when stream ends
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const streamSid = formData.get('StreamSid') as string;
    
    logger.info('Stream end callback received', {
      callSid,
      streamSid,
      type: 'stream_end_callback'
    });
    
    return NextResponse.json({ status: 'ok' });
    
  } catch (error) {
    logger.error('Error in stream end callback', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'stream_end_callback_error'
    });
    
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

