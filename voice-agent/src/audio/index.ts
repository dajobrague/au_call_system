/**
 * Audio Processing Module
 * Centralized exports for all audio utilities
 */

// Codecs
export { linear16ToMulaw } from './codecs';

// Frame Processing
export { sliceInto20msFrames, sliceInto20msChunks } from './frame-processor';

// Resampling
export { resampleTo8k } from './resampler';

// Generators
export { makeUlawTone440, generateBeepTone, generateHoldMusic } from './generators';

// Hold Music Player
export { playHoldMusic, stopHoldMusic } from './hold-music-player';
