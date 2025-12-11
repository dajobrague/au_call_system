/**
 * Hold Music Player
 * Provides high-quality hosted audio URLs for hold music
 * Replaces generated µ-law audio with hosted MP3 for better quality
 */

import { PRIMARY_HOLD_MUSIC_URL, FALLBACK_HOLD_MUSIC_URLS, getHoldMusicURL } from '../config/hold-music';

interface WebSocketWithMusic extends WebSocket {
  holdMusicInterval?: NodeJS.Timeout;
  streamSid?: string;
}

/**
 * Get hold music URL for use in TwiML
 * This replaces the generated hold music with hosted audio
 * 
 * @param preferredIndex - Index of fallback URL to use (0 = primary)
 * @returns Hold music URL
 */
export function getHoldMusicForTwiML(preferredIndex: number = 0): string {
  return getHoldMusicURL(preferredIndex);
}

/**
 * Play hold music in a loop over WebSocket (DEPRECATED)
 * 
 * NOTE: This function is deprecated in favor of TwiML-based hold music.
 * WebSocket-based hold music causes choppiness due to µ-law encoding and frame timing.
 * Use getHoldMusicForTwiML() instead and play via Twilio's native audio system.
 * 
 * @param ws - WebSocket connection with streamSid
 * @deprecated Use TwiML <Play> with hosted audio URLs instead
 */
export function playHoldMusic(ws: WebSocketWithMusic): void {
  console.log('⚠️ playHoldMusic called but is deprecated - use TwiML <Play> instead');
  console.log(`Recommended hold music URL: ${PRIMARY_HOLD_MUSIC_URL}`);
  
  // For backward compatibility, we log but don't actually play anything
  // The proper way is to use TwiML to play hosted audio
}

/**
 * Stop hold music playback (DEPRECATED)
 * @param ws - WebSocket connection
 * @deprecated No longer needed with TwiML-based hold music
 */
export function stopHoldMusic(ws: WebSocketWithMusic): void {
  if (ws && ws.holdMusicInterval) {
    clearInterval(ws.holdMusicInterval);
    ws.holdMusicInterval = undefined;
    console.log('🛑 Hold music stopped');
  }
}

/**
 * Get all available hold music URLs
 * @returns Array of hold music URLs (primary + fallbacks)
 */
export function getAllHoldMusicURLs(): string[] {
  return [PRIMARY_HOLD_MUSIC_URL, ...FALLBACK_HOLD_MUSIC_URLS];
}
