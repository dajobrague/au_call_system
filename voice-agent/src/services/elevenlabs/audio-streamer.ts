/**
 * ElevenLabs Audio Streamer
 * Streams generated audio frames to Twilio WebSocket
 */

interface WebSocketWithStream extends WebSocket {
  streamSid?: string;
  currentAudioInterval?: NodeJS.Timeout;
  callAudioBuffers?: {
    inbound: Buffer[];
    outbound: Buffer[];
  };
  callSid?: string;
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
 * Stream audio frames to Twilio WebSocket with buffering
 * Buffers initial frames to reduce lag and improve audio quality
 * Automatically stops any currently playing audio before starting
 * @param ws - WebSocket connection
 * @param frames - Array of audio frames to stream
 * @param streamSid - Twilio stream SID
 * @param bufferSize - Number of frames to buffer before starting (default: 8)
 */
export async function streamAudioToTwilio(
  ws: WebSocketWithStream,
  frames: Uint8Array[],
  streamSid: string,
  bufferSize: number = 8
): Promise<void> {
  if (!ws || ws.readyState !== 1) {
    console.error('❌ WebSocket not ready for streaming');
    return;
  }
  
  // Stop any currently playing audio
  stopCurrentAudio(ws);
  
  console.log(`🎵 Streaming audio to Twilio (${frames.length} frames, buffer: ${bufferSize})...`);
  
  // Buffer initial frames before starting playback (reduces initial lag)
  const effectiveBufferSize = Math.min(bufferSize, frames.length);
  let frameIndex = 0;
  
  return new Promise((resolve) => {
    // Helper function to send a frame with WebSocket checks
    const sendFrame = (index: number) => {
      if (!ws || ws.readyState !== 1) {
        return false; // WebSocket not ready
      }
      
      if (index >= frames.length) {
        return false; // No more frames
      }
      
      const frame = frames[index];
      const b64 = Buffer.from(frame).toString('base64');
      
      try {
        ws.send(JSON.stringify({
          event: 'media',
          streamSid: streamSid,
          media: { payload: b64 }
        }));
        
        // CAPTURE OUTBOUND AUDIO FOR CALL RECORDING (bot audio we're sending)
        if (ws.callAudioBuffers) {
          ws.callAudioBuffers.outbound.push(Buffer.from(frame));
        }
        
        return true;
      } catch (error) {
        console.error('❌ Error sending frame:', error);
        return false;
      }
    };
    
    // Pre-send buffer frames immediately for faster start
    for (let i = 0; i < effectiveBufferSize && i < frames.length; i++) {
      if (!sendFrame(i)) {
        console.log('🛑 Streaming stopped during buffer phase');
        resolve();
        return;
      }
      frameIndex++;
    }
    
    if (frameIndex >= frames.length) {
      console.log(`✅ Streaming complete - ${frameIndex} frames sent (buffered only)`);
      resolve();
      return;
    }
    
    // Use setImmediate for consistent timing with less CPU overhead
    const streamRemaining = () => {
      if (!ws || ws.readyState !== 1) {
        ws.currentAudioInterval = undefined;
        console.log('🛑 Streaming stopped - WebSocket closed');
        resolve();
        return;
      }
      
      if (frameIndex >= frames.length) {
        ws.currentAudioInterval = undefined;
        console.log(`✅ Streaming complete - ${frames.length} frames sent`);
        resolve();
        return;
      }
      
      // Send frame
      if (!sendFrame(frameIndex)) {
        ws.currentAudioInterval = undefined;
        console.log('🛑 Streaming stopped - send failed');
        resolve();
        return;
      }
      
      frameIndex++;
      
      // Continue with next frame after 20ms
      ws.currentAudioInterval = setTimeout(streamRemaining, 20);
    };
    
    // Start streaming remaining frames after buffer
    ws.currentAudioInterval = setTimeout(streamRemaining, 20);
  });
}
