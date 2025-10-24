/**
 * Hold Music Player
 * Manages playback of hold music over WebSocket
 */

import { generateHoldMusic } from './generators';

interface WebSocketWithMusic extends WebSocket {
  holdMusicInterval?: NodeJS.Timeout;
  streamSid?: string;
}

/**
 * Play hold music in a loop over WebSocket
 * @param ws - WebSocket connection with streamSid
 */
export function playHoldMusic(ws: WebSocketWithMusic): void {
  if (!ws || ws.readyState !== 1) {
    console.log('⚠️ WebSocket not ready for hold music');
    return;
  }
  
  console.log('🎵 Starting hold music playback...');
  
  // Generate 10 seconds of hold music
  const musicFrames = generateHoldMusic(10000);
  
  let frameIndex = 0;
  
  // Clear any existing hold music interval
  if (ws.holdMusicInterval) {
    clearInterval(ws.holdMusicInterval);
  }
  
  // Send frames at 20ms intervals (50 frames per second)
  ws.holdMusicInterval = setInterval(() => {
    if (!ws || ws.readyState !== 1) {
      clearInterval(ws.holdMusicInterval);
      console.log('🛑 Hold music stopped - WebSocket closed');
      return;
    }
    
    // Send current frame
    const frame = musicFrames[frameIndex];
    if (frame) {
      const b64 = Buffer.from(frame).toString('base64');
      ws.send(JSON.stringify({
        event: 'media',
        streamSid: ws.streamSid,
        media: { payload: b64 }
      }));
    }
    
    // Move to next frame, loop back to start if at end
    frameIndex++;
    if (frameIndex >= musicFrames.length) {
      frameIndex = 0;
      console.log('🔄 Hold music loop restarted');
    }
  }, 20); // 20ms per frame
  
  console.log(`✅ Hold music started (${musicFrames.length} frames, looping)`);
}

/**
 * Stop hold music playback
 * @param ws - WebSocket connection
 */
export function stopHoldMusic(ws: WebSocketWithMusic): void {
  if (ws && ws.holdMusicInterval) {
    clearInterval(ws.holdMusicInterval);
    ws.holdMusicInterval = undefined;
    console.log('🛑 Hold music stopped');
  }
}
