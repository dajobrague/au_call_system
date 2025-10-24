/**
 * ElevenLabs Audio Streamer
 * Streams generated audio frames to Twilio WebSocket
 */

interface WebSocketWithStream extends WebSocket {
  streamSid?: string;
  currentAudioInterval?: NodeJS.Timeout;
}

/**
 * Stop any currently playing audio
 * @param ws - WebSocket connection
 */
export function stopCurrentAudio(ws: WebSocketWithStream): void {
  if (ws.currentAudioInterval) {
    clearInterval(ws.currentAudioInterval);
    ws.currentAudioInterval = undefined;
    console.log('🛑 Stopped current audio playback');
  }
}

/**
 * Stream audio frames to Twilio WebSocket
 * Automatically stops any currently playing audio before starting
 * @param ws - WebSocket connection
 * @param frames - Array of audio frames to stream
 * @param streamSid - Twilio stream SID
 */
export async function streamAudioToTwilio(
  ws: WebSocketWithStream,
  frames: Uint8Array[],
  streamSid: string
): Promise<void> {
  if (!ws || ws.readyState !== 1) {
    console.error('❌ WebSocket not ready for streaming');
    return;
  }
  
  // Stop any currently playing audio
  stopCurrentAudio(ws);
  
  console.log('🎵 Streaming audio to Twilio...');
  
  let frameIndex = 0;
  
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!ws || ws.readyState !== 1) {
        clearInterval(interval);
        ws.currentAudioInterval = undefined;
        console.log('🛑 Streaming stopped - WebSocket closed');
        resolve();
        return;
      }
      
      if (frameIndex >= frames.length) {
        clearInterval(interval);
        ws.currentAudioInterval = undefined;
        console.log(`✅ Streaming complete - ${frames.length} frames sent`);
        resolve();
        return;
      }
      
      const frame = frames[frameIndex];
      const b64 = Buffer.from(frame).toString('base64');
      
      ws.send(JSON.stringify({
        event: 'media',
        streamSid: streamSid,
        media: { payload: b64 }
      }));
      
      frameIndex++;
    }, 20); // 20ms per frame (50 frames per second)
    
    // Store interval reference for cancellation
    ws.currentAudioInterval = interval;
  });
}
