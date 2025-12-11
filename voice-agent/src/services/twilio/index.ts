/**
 * Twilio Service Module
 * Centralized exports for Twilio integration
 */

// NEW: Dial-based transfer (preferred method - maintains recording, simpler)
export { dialTransferToRepresentative } from './dial-transfer';
export type { DialTransferOptions, DialTransferResult } from './dial-transfer';

// OLD: Conference-based transfer (deprecated - disconnects WebSocket)
// export { transferToRepresentative } from './conference-manager';
// export type { ConferenceTransferOptions, ConferenceTransferResult } from './conference-manager';

export { startCallRecording, stopCallRecording, getRecordingUrl } from './call-recorder';
export type { RecordingOptions, RecordingResult } from './call-recorder';
