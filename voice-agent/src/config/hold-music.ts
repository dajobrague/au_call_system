/**
 * Hold Music Configuration
 * High-quality hosted audio URLs for call queuing and transfers
 */

/**
 * Primary hold music URL
 * Twilio's hosted classical music (128kbps, professional quality)
 */
export const PRIMARY_HOLD_MUSIC_URL = 'https://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.mp3';

/**
 * Fallback hold music URLs in case primary fails
 */
export const FALLBACK_HOLD_MUSIC_URLS = [
  'https://com.twilio.music.classical.s3.amazonaws.com/ClockworkWaltz.mp3',
  'https://com.twilio.music.classical.s3.amazonaws.com/EvergreenMorning.mp3',
  'http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3'
];

/**
 * Get hold music URL with fallback logic
 * @param preferredIndex - Index of fallback URL to use (0 = primary)
 * @returns Hold music URL
 */
export function getHoldMusicURL(preferredIndex: number = 0): string {
  if (preferredIndex === 0) {
    return PRIMARY_HOLD_MUSIC_URL;
  }
  
  const fallbackIndex = preferredIndex - 1;
  if (fallbackIndex >= 0 && fallbackIndex < FALLBACK_HOLD_MUSIC_URLS.length) {
    return FALLBACK_HOLD_MUSIC_URLS[fallbackIndex];
  }
  
  // Default to primary if index out of range
  return PRIMARY_HOLD_MUSIC_URL;
}

/**
 * Hold music configuration for TwiML
 */
export const HOLD_MUSIC_CONFIG = {
  url: PRIMARY_HOLD_MUSIC_URL,
  loop: 10, // Loop up to 10 times (prevents infinite loop issues)
  fallbackUrls: FALLBACK_HOLD_MUSIC_URLS
};

