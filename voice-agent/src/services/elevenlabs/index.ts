/**
 * ElevenLabs Service Module
 * Centralized exports for ElevenLabs integration
 */

export { generateSpeech } from './speech-generator';
export type { SpeechGenerationOptions, SpeechGenerationResult } from './speech-generator';

export { streamAudioToTwilio, stopCurrentAudio } from './audio-streamer';
