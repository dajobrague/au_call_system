/**
 * Recording Integration for ngrok-websocket-test.js
 * Enhanced integration hooks with multi-track recording and audio analysis
 */

const { wsRecordingIntegration } = require('./recording-services/integration/websocket-integration');
const { enhancedWsRecordingIntegration } = require('./recording-services/integration/enhanced-websocket-integration');

// Use enhanced integration for Phase 2 features
const activeIntegration = enhancedWsRecordingIntegration;

/**
 * Initialize recording services
 * Call this once at server startup
 */
async function initializeRecording() {
  try {
    console.log('🎬 Initializing enhanced call recording services...');
    const success = await activeIntegration.initialize();
    
    if (success) {
      console.log('✅ Call recording services ready');
      
        // Display enhanced recording stats periodically
        setInterval(async () => {
          try {
            const activeRecordings = activeIntegration.getActiveRecordings();
          if (activeRecordings.length > 0) {
            console.log(`📊 Active recordings: ${activeRecordings.length}`);
            activeRecordings.forEach(recording => {
              const voiceInfo = recording.voiceActivity ? 
                ` [${recording.voiceActivity.dominantSpeaker || 'unknown'} dominant, ${recording.voiceActivity.totalSegments} segments]` : '';
              console.log(`  - ${recording.callSid}: ${recording.duration}s, ${Math.round(recording.bufferSize / 1024)}KB${voiceInfo}`);
            });
          }
        } catch (error) {
          console.error('❌ Error getting recording stats:', error);
        }
      }, 30000); // Every 30 seconds
      
    } else {
      console.log('⚠️ Call recording services disabled or failed to initialize');
    }
    
    return success;
  } catch (error) {
    console.error('❌ Failed to initialize recording services:', error);
    return false;
  }
}

/**
 * Recording hooks to be called from ngrok-websocket-test.js
 */
const recordingHooks = {
  /**
   * Call when Twilio stream starts
   */
  onCallStarted: async (callSid, startData) => {
    try {
      const started = await activeIntegration.onCallStarted(callSid, startData);
      if (started) {
        console.log(`🎙️ Recording started for call ${callSid}`);
      }
      return started;
    } catch (error) {
      console.error(`❌ Recording start error for ${callSid}:`, error);
      return false;
    }
  },

  /**
   * Call when receiving audio data from Twilio
   */
  onAudioData: (callSid, audioPayload, trackHint = 'mixed', timestamp = null) => {
    try {
      return activeIntegration.onAudioData(callSid, audioPayload, trackHint, timestamp);
    } catch (error) {
      // Don't log audio errors frequently to avoid spam
      return false;
    }
  },

  /**
   * Call when employee is authenticated
   */
  onEmployeeAuthenticated: (callSid, employee, provider) => {
    try {
      const updated = activeIntegration.onEmployeeAuthenticated(callSid, employee, provider);
      if (updated) {
        console.log(`🔐 Recording auth updated: ${employee.name} @ ${provider?.name || 'unknown'}`);
      }
      return updated;
    } catch (error) {
      console.error(`❌ Recording auth error for ${callSid}:`, error);
      return false;
    }
  },

  /**
   * Call when provider is selected
   */
  onProviderSelected: (callSid, provider, employee) => {
    try {
      const updated = activeIntegration.onProviderSelected(callSid, provider, employee);
      if (updated) {
        console.log(`🏢 Recording provider updated: ${provider.name}`);
      }
      return updated;
    } catch (error) {
      console.error(`❌ Recording provider error for ${callSid}:`, error);
      return false;
    }
  },

  /**
   * Call when call/stream ends
   */
  onCallEnded: async (callSid, reason = 'call_ended') => {
    try {
      const stopped = await activeIntegration.onCallEnded(callSid, reason);
      if (stopped) {
        console.log(`🔚 Recording stopped and uploaded for call ${callSid}`);
      }
      return stopped;
    } catch (error) {
      console.error(`❌ Recording stop error for ${callSid}:`, error);
      return false;
    }
  },

  /**
   * Call when WebSocket encounters an error
   */
  onWebSocketError: async (callSid, error) => {
    try {
      return await activeIntegration.onWebSocketError(callSid, error);
    } catch (err) {
      console.error(`❌ Recording WebSocket error for ${callSid}:`, err);
      return false;
    }
  },

  /**
   * Get enhanced recording status
   */
  getRecordingStatus: (callSid) => {
    try {
      return activeIntegration.getRecordingStatus(callSid);
    } catch (error) {
      console.error(`❌ Error getting recording status for ${callSid}:`, error);
      return null;
    }
  },

  /**
   * Enhanced health check endpoint
   */
  healthCheck: async () => {
    try {
      return await activeIntegration.healthCheck();
    } catch (error) {
      console.error('❌ Recording health check error:', error);
      return { healthy: false, error: error.message };
    }
  },

  /**
   * NEW: Call when FSM phase changes
   */
  onCallPhaseChanged: (callSid, oldPhase, newPhase, phaseData = {}) => {
    try {
      return activeIntegration.onCallPhaseChanged(callSid, oldPhase, newPhase, phaseData);
    } catch (error) {
      console.error(`❌ Recording phase change error for ${callSid}:`, error);
      return false;
    }
  },

  /**
   * NEW: Call when DTMF input is received
   */
  onDTMFInput: (callSid, digit, context = {}) => {
    try {
      return activeIntegration.onDTMFInput(callSid, digit, context);
    } catch (error) {
      console.error(`❌ Recording DTMF error for ${callSid}:`, error);
      return false;
    }
  },

  /**
   * NEW: Call when speech collection starts
   */
  onSpeechCollectionStarted: (callSid, prompt, context = {}) => {
    try {
      return activeIntegration.onSpeechCollectionStarted(callSid, prompt, context);
    } catch (error) {
      console.error(`❌ Recording speech start error for ${callSid}:`, error);
      return false;
    }
  },

  /**
   * NEW: Call when speech collection completes
   */
  onSpeechCollectionCompleted: (callSid, recognizedText, confidence = null) => {
    try {
      return activeIntegration.onSpeechCollectionCompleted(callSid, recognizedText, confidence);
    } catch (error) {
      console.error(`❌ Recording speech completion error for ${callSid}:`, error);
      return false;
    }
  }
};

module.exports = {
  initializeRecording,
  recordingHooks
};
