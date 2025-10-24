/**
 * Twilio Call Recorder
 * Manages call recording for the entire call duration
 */

import { twilioConfig } from '../../config/twilio';
import { logger } from '../../lib/logger';

// Use require for twilio to avoid TypeScript import issues
const twilio = require('twilio');

const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);

export interface RecordingOptions {
  callSid: string;
  recordingStatusCallback?: string;
  recordingChannels?: 'mono' | 'dual';
  trim?: 'trim-silence' | 'do-not-trim';
}

export interface RecordingResult {
  success: boolean;
  recordingSid?: string;
  error?: string;
}

/**
 * Start recording a call
 * Records from the moment this is called until the call ends
 * Includes any transfers or conferences
 */
export async function startCallRecording(options: RecordingOptions): Promise<RecordingResult> {
  const {
    callSid,
    recordingStatusCallback = 'https://sam-voice-agent.vercel.app/api/twilio/recording-status',
    recordingChannels = 'dual',
    trim = 'do-not-trim'
  } = options;
  
  const startTime = Date.now();
  
  try {
    logger.info('Starting call recording', {
      callSid,
      recordingChannels,
      type: 'recording_start'
    });
    
    // Create a recording for this call
    const recording = await twilioClient.calls(callSid)
      .recordings
      .create({
        recordingStatusCallback,
        recordingStatusCallbackEvent: ['completed'],
        recordingChannels,
        trim
      });
    
    logger.info('Call recording started', {
      callSid,
      recordingSid: recording.sid,
      duration: Date.now() - startTime,
      type: 'recording_started'
    });
    
    return {
      success: true,
      recordingSid: recording.sid
    };
    
  } catch (error) {
    logger.error('Failed to start call recording', {
      callSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'recording_start_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Stop recording a call
 * @param callSid - Call SID
 * @param recordingSid - Recording SID to stop
 */
export async function stopCallRecording(callSid: string, recordingSid: string): Promise<RecordingResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Stopping call recording', {
      callSid,
      recordingSid,
      type: 'recording_stop'
    });
    
    await twilioClient.calls(callSid)
      .recordings(recordingSid)
      .update({ status: 'stopped' });
    
    logger.info('Call recording stopped', {
      callSid,
      recordingSid,
      duration: Date.now() - startTime,
      type: 'recording_stopped'
    });
    
    return {
      success: true,
      recordingSid
    };
    
  } catch (error) {
    logger.error('Failed to stop call recording', {
      callSid,
      recordingSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      type: 'recording_stop_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export interface RecordingUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Get recording URL for a completed recording
 * @param recordingSid - Recording SID
 */
export async function getRecordingUrl(recordingSid: string): Promise<RecordingUrlResult> {
  try {
    const recording = await twilioClient.recordings(recordingSid).fetch();
    
    if (recording.uri) {
      // Convert relative URI to full URL
      const baseUrl = `https://api.twilio.com`;
      const url = `${baseUrl}${recording.uri.replace('.json', '.mp3')}`;
      
      return {
        success: true,
        url
      };
    }
    
    return {
      success: false,
      error: 'Recording URI not available'
    };
  } catch (error) {
    logger.error('Failed to get recording URL', {
      recordingSid,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'recording_url_error'
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
