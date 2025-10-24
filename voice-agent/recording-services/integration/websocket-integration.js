/**
 * WebSocket Integration for Call Recording
 * Provides hooks for integrating recording with existing WebSocket server
 */

const { recordingService } = require('../index');

/**
 * WebSocket Recording Integration Class
 */
class WebSocketRecordingIntegration {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the integration
   */
  async initialize() {
    try {
      console.log('🔌 Initializing WebSocket Recording Integration...');
      
      const result = await recordingService.initialize();
      this.initialized = result.success;
      
      if (this.initialized) {
        console.log('✅ WebSocket Recording Integration ready');
        return true;
      } else {
        console.log(`⚠️ Recording integration disabled: ${result.reason}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket Recording Integration:', error);
      return false;
    }
  }

  /**
   * Hook: Call Started
   * Called when a Twilio WebSocket connection starts
   */
  async onCallStarted(callSid, startData = {}) {
    if (!this.initialized) return false;

    try {
      console.log(`🎬 Recording hook: Call started ${callSid}`);
      
      const callData = {
        callerNumber: startData.callerNumber || startData.from || 'unknown',
        twilioNumber: startData.twilioNumber || startData.to || 'unknown',
        accountSid: startData.accountSid,
        streamSid: startData.streamSid
      };

      const started = await recordingService.startRecording(callSid, callData);
      if (started) {
        console.log(`✅ Recording started for call ${callSid}`);
      }
      
      return started;
    } catch (error) {
      console.error(`❌ Error in onCallStarted hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Hook: Audio Data Received
   * Called when audio data is received from Twilio
   */
  onAudioData(callSid, audioData, track = 'mixed') {
    if (!this.initialized) return false;

    try {
      return recordingService.addAudioChunk(callSid, audioData, track);
    } catch (error) {
      console.error(`❌ Error in onAudioData hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Hook: Employee Authenticated
   * Called when employee authentication is successful
   */
  onEmployeeAuthenticated(callSid, employee, provider) {
    if (!this.initialized) return false;

    try {
      console.log(`🔐 Recording hook: Employee authenticated ${callSid} - ${employee.name} (${provider?.name || 'unknown'})`);
      
      const updated = recordingService.updateCallAuth(callSid, provider, employee);
      if (updated) {
        console.log(`✅ Recording auth updated for call ${callSid}`);
      }
      
      return updated;
    } catch (error) {
      console.error(`❌ Error in onEmployeeAuthenticated hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Hook: Provider Selected
   * Called when provider is selected (for multi-provider employees)
   */
  onProviderSelected(callSid, provider, employee) {
    if (!this.initialized) return false;

    try {
      console.log(`🏢 Recording hook: Provider selected ${callSid} - ${provider.name}`);
      
      const updated = recordingService.updateCallAuth(callSid, provider, employee);
      if (updated) {
        console.log(`✅ Recording provider updated for call ${callSid}`);
      }
      
      return updated;
    } catch (error) {
      console.error(`❌ Error in onProviderSelected hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Hook: Call Ended
   * Called when a call ends or WebSocket closes
   */
  async onCallEnded(callSid, reason = 'call_ended') {
    if (!this.initialized) return false;

    try {
      console.log(`🔚 Recording hook: Call ended ${callSid} (${reason})`);
      
      const stopped = await recordingService.stopRecording(callSid, reason);
      if (stopped) {
        console.log(`✅ Recording stopped and uploaded for call ${callSid}`);
      }
      
      return stopped;
    } catch (error) {
      console.error(`❌ Error in onCallEnded hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Hook: WebSocket Error
   * Called when WebSocket encounters an error
   */
  async onWebSocketError(callSid, error) {
    if (!this.initialized) return false;

    try {
      console.log(`💥 Recording hook: WebSocket error ${callSid} - ${error.message}`);
      
      // Stop recording due to error
      const stopped = await recordingService.stopRecording(callSid, 'websocket_error');
      return stopped;
    } catch (err) {
      console.error(`❌ Error in onWebSocketError hook for ${callSid}:`, err);
      return false;
    }
  }

  /**
   * Get recording status for a call
   */
  getRecordingStatus(callSid) {
    if (!this.initialized) return null;
    return recordingService.getRecordingStatus(callSid);
  }

  /**
   * Get all active recordings
   */
  getActiveRecordings() {
    if (!this.initialized) return [];
    return recordingService.getActiveRecordings();
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, reason: 'not_initialized' };
    }
    return await recordingService.healthCheck();
  }

  /**
   * Get bucket statistics
   */
  async getBucketStats() {
    if (!this.initialized) return null;
    return await recordingService.getBucketStats();
  }
}

// Create singleton instance
const wsRecordingIntegration = new WebSocketRecordingIntegration();

/**
 * Helper function to add recording hooks to existing WebSocket server
 */
function addRecordingHooks(ws, callSid) {
  if (!wsRecordingIntegration.initialized) {
    return false;
  }

  // Store original event handlers
  const originalOnMessage = ws.onmessage;
  const originalOnClose = ws.onclose;
  const originalOnError = ws.onerror;

  // Add recording status to WebSocket
  ws.recordingStatus = {
    callSid,
    isRecording: false,
    startTime: null
  };

  // Override message handler to capture audio
  ws.onmessage = function(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Capture media frames for recording
      if (data.event === 'media' && data.media && data.media.payload) {
        wsRecordingIntegration.onAudioData(callSid, data.media.payload);
      }
      
      // Call original handler
      if (originalOnMessage) {
        originalOnMessage.call(this, event);
      }
    } catch (error) {
      console.error('❌ Error in recording message handler:', error);
      if (originalOnMessage) {
        originalOnMessage.call(this, event);
      }
    }
  };

  // Override close handler
  ws.onclose = function(event) {
    wsRecordingIntegration.onCallEnded(callSid, 'websocket_closed');
    
    if (originalOnClose) {
      originalOnClose.call(this, event);
    }
  };

  // Override error handler
  ws.onerror = function(error) {
    wsRecordingIntegration.onWebSocketError(callSid, error);
    
    if (originalOnError) {
      originalOnError.call(this, error);
    }
  };

  return true;
}

module.exports = {
  WebSocketRecordingIntegration,
  wsRecordingIntegration,
  addRecordingHooks
};
