/**
 * Twilio Service Module
 * Centralized exports for Twilio integration
 */

export { transferToRepresentative } from './conference-manager';
export type { ConferenceTransferOptions, ConferenceTransferResult } from './conference-manager';

export { startCallRecording, stopCallRecording, getRecordingUrl } from './call-recorder';
export type { RecordingOptions, RecordingResult } from './call-recorder';
