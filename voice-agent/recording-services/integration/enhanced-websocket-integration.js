/**
 * Enhanced WebSocket Integration for Phase 2
 * Advanced integration with separate track recording and audio analysis
 */

const { recordingService } = require('../index');

class EnhancedWebSocketRecordingIntegration {
  constructor() {
    this.initialized = false;
    this.callMetadata = new Map(); // Store call metadata for better tracking
    this.audioBuffer = new Map(); // Temporary buffer for audio synchronization
  }

  /**
   * Initialize the enhanced integration
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Enhanced WebSocket Recording Integration...');
      
      const result = await recordingService.initialize();
      this.initialized = result.success;
      
      if (this.initialized) {
        console.log('✅ Enhanced WebSocket Recording Integration ready');
        console.log('🎵 Features enabled: Multi-track recording, Voice activity detection, Audio analysis');
        return true;
      } else {
        console.log(`⚠️ Enhanced recording integration disabled: ${result.reason}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced WebSocket Recording Integration:', error);
      return false;
    }
  }

  /**
   * Enhanced Hook: Call Started with detailed metadata
   */
  async onCallStarted(callSid, startData = {}) {
    if (!this.initialized) return false;

    try {
      console.log(`🎬 Enhanced recording hook: Call started ${callSid}`);
      
      // Store enhanced call metadata
      const callMetadata = {
        callSid,
        startTime: new Date().toISOString(),
        callerNumber: startData.callerNumber || startData.from || 'unknown',
        twilioNumber: startData.twilioNumber || startData.to || 'unknown',
        accountSid: startData.accountSid || 'unknown',
        streamSid: startData.streamSid || 'unknown',
        userAgent: startData.userAgent || 'unknown',
        callDirection: this.detectCallDirection(startData),
        expectedDuration: startData.expectedDuration || null,
        callType: this.classifyCallType(startData)
      };

      this.callMetadata.set(callSid, callMetadata);
      this.audioBuffer.set(callSid, {
        lastInboundTimestamp: null,
        lastOutboundTimestamp: null,
        syncOffset: 0,
        bufferCount: 0
      });

      const started = await recordingService.startRecording(callSid, callMetadata);
      if (started) {
        console.log(`✅ Enhanced recording started for call ${callSid} (${callMetadata.callType})`);
      }
      
      return started;
    } catch (error) {
      console.error(`❌ Error in enhanced onCallStarted hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Enhanced Hook: Audio Data with track detection and timing
   */
  onAudioData(callSid, audioData, trackHint = 'mixed', timestamp = null) {
    if (!this.initialized) return false;

    try {
      const now = timestamp || Date.now();
      const audioBuffer = this.audioBuffer.get(callSid);
      
      if (audioBuffer) {
        // Detect track type if not specified
        let detectedTrack = trackHint;
        if (trackHint === 'mixed') {
          detectedTrack = this.detectAudioTrack(callSid, audioData, now);
        }
        
        // Update timing information
        if (detectedTrack === 'inbound') {
          audioBuffer.lastInboundTimestamp = now;
        } else if (detectedTrack === 'outbound') {
          audioBuffer.lastOutboundTimestamp = now;
        }
        
        audioBuffer.bufferCount++;
        
        // Add audio with enhanced timestamp
        return recordingService.addAudioChunk(callSid, audioData, detectedTrack, now);
      }
      
      return recordingService.addAudioChunk(callSid, audioData, trackHint, now);
    } catch (error) {
      // Don't log audio errors frequently to avoid spam
      return false;
    }
  }

  /**
   * Detect audio track type based on timing and patterns
   */
  detectAudioTrack(callSid, audioData, timestamp) {
    try {
      const metadata = this.callMetadata.get(callSid);
      const audioBuffer = this.audioBuffer.get(callSid);
      
      if (!metadata || !audioBuffer) {
        return 'mixed';
      }

      // Simple heuristic: if we haven't seen audio for a while, it might be a new speaker
      const timeSinceLastInbound = audioBuffer.lastInboundTimestamp ? 
        timestamp - audioBuffer.lastInboundTimestamp : Infinity;
      const timeSinceLastOutbound = audioBuffer.lastOutboundTimestamp ? 
        timestamp - audioBuffer.lastOutboundTimestamp : Infinity;

      // If it's been more than 500ms since last inbound, this might be caller
      if (timeSinceLastInbound > 500 && timeSinceLastOutbound < 200) {
        return 'inbound';
      }
      
      // If it's been more than 500ms since last outbound, this might be system
      if (timeSinceLastOutbound > 500 && timeSinceLastInbound < 200) {
        return 'outbound';
      }

      // Default to mixed if we can't determine
      return 'mixed';
    } catch (error) {
      return 'mixed';
    }
  }

  /**
   * Enhanced Hook: Employee Authenticated with detailed logging
   */
  onEmployeeAuthenticated(callSid, employee, provider) {
    if (!this.initialized) return false;

    try {
      console.log(`🔐 Enhanced recording hook: Employee authenticated ${callSid}`);
      console.log(`   Employee: ${employee.name} (PIN: ${employee.pin})`);
      console.log(`   Provider: ${provider?.name || 'unknown'}`);
      
      // Update call metadata
      const metadata = this.callMetadata.get(callSid);
      if (metadata) {
        metadata.employee = employee;
        metadata.provider = provider;
        metadata.authTime = new Date().toISOString();
        metadata.authMethod = 'employee_pin';
      }
      
      const updated = recordingService.updateCallAuth(callSid, provider, employee);
      if (updated) {
        console.log(`✅ Enhanced recording auth updated for call ${callSid}`);
        
        // Log recording quality upgrade if authentication improves folder structure
        console.log(`📁 Recording will be stored in: ${provider?.name || 'unknown'}/${employee.pin}/${callSid}/`);
      }
      
      return updated;
    } catch (error) {
      console.error(`❌ Error in enhanced onEmployeeAuthenticated hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Enhanced Hook: Provider Selected with context
   */
  onProviderSelected(callSid, provider, employee) {
    if (!this.initialized) return false;

    try {
      console.log(`🏢 Enhanced recording hook: Provider selected ${callSid}`);
      console.log(`   Provider: ${provider.name} (ID: ${provider.id})`);
      console.log(`   Employee: ${employee?.name || 'unknown'}`);
      
      // Update call metadata
      const metadata = this.callMetadata.get(callSid);
      if (metadata) {
        metadata.provider = provider;
        metadata.providerSelectionTime = new Date().toISOString();
      }
      
      const updated = recordingService.updateCallAuth(callSid, provider, employee);
      if (updated) {
        console.log(`✅ Enhanced recording provider updated for call ${callSid}`);
      }
      
      return updated;
    } catch (error) {
      console.error(`❌ Error in enhanced onProviderSelected hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Enhanced Hook: Call Phase Changed (for better audio analysis)
   */
  onCallPhaseChanged(callSid, oldPhase, newPhase, phaseData = {}) {
    if (!this.initialized) return false;

    try {
      console.log(`🔄 Enhanced recording hook: Phase changed ${callSid}: ${oldPhase} → ${newPhase}`);
      
      // Update call metadata with phase information
      const metadata = this.callMetadata.get(callSid);
      if (metadata) {
        if (!metadata.phases) {
          metadata.phases = [];
        }
        
        metadata.phases.push({
          phase: newPhase,
          timestamp: new Date().toISOString(),
          data: phaseData
        });
        
        // Special handling for certain phases
        if (newPhase === 'collect_reason' || newPhase === 'collect_day' || newPhase === 'collect_time') {
          console.log(`🎤 Enhanced recording: Entering speech collection phase (${newPhase})`);
          // Could adjust recording quality or processing for speech phases
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error in enhanced onCallPhaseChanged hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Enhanced Hook: DTMF Input (for better conversation analysis)
   */
  onDTMFInput(callSid, digit, context = {}) {
    if (!this.initialized) return false;

    try {
      // Update call metadata with DTMF input
      const metadata = this.callMetadata.get(callSid);
      if (metadata) {
        if (!metadata.dtmfInputs) {
          metadata.dtmfInputs = [];
        }
        
        metadata.dtmfInputs.push({
          digit,
          timestamp: new Date().toISOString(),
          context: context.phase || 'unknown',
          sequence: metadata.dtmfInputs.length + 1
        });
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error in enhanced onDTMFInput hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Enhanced Hook: Speech Collection Started
   */
  onSpeechCollectionStarted(callSid, prompt, context = {}) {
    if (!this.initialized) return false;

    try {
      console.log(`🎤 Enhanced recording hook: Speech collection started ${callSid}`);
      console.log(`   Prompt: "${prompt.substring(0, 50)}..."`);
      
      // Update call metadata
      const metadata = this.callMetadata.get(callSid);
      if (metadata) {
        if (!metadata.speechSessions) {
          metadata.speechSessions = [];
        }
        
        metadata.speechSessions.push({
          startTime: new Date().toISOString(),
          prompt: prompt,
          context: context,
          status: 'started'
        });
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error in enhanced onSpeechCollectionStarted hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Enhanced Hook: Speech Collection Completed
   */
  onSpeechCollectionCompleted(callSid, recognizedText, confidence = null) {
    if (!this.initialized) return false;

    try {
      console.log(`🎤 Enhanced recording hook: Speech collection completed ${callSid}`);
      console.log(`   Recognized: "${recognizedText}"`);
      
      // Update call metadata
      const metadata = this.callMetadata.get(callSid);
      if (metadata && metadata.speechSessions) {
        const lastSession = metadata.speechSessions[metadata.speechSessions.length - 1];
        if (lastSession && lastSession.status === 'started') {
          lastSession.endTime = new Date().toISOString();
          lastSession.recognizedText = recognizedText;
          lastSession.confidence = confidence;
          lastSession.status = 'completed';
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error in enhanced onSpeechCollectionCompleted hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Enhanced Hook: Call Ended with comprehensive summary
   */
  async onCallEnded(callSid, reason = 'call_ended') {
    if (!this.initialized) return false;

    try {
      console.log(`🔚 Enhanced recording hook: Call ended ${callSid} (${reason})`);
      
      // Get final call metadata
      const metadata = this.callMetadata.get(callSid);
      if (metadata) {
        metadata.endTime = new Date().toISOString();
        metadata.endReason = reason;
        metadata.totalDuration = Math.round((new Date() - new Date(metadata.startTime)) / 1000);
        
        // Log call summary
        console.log(`📊 Call Summary for ${callSid}:`);
        console.log(`   Duration: ${metadata.totalDuration}s`);
        console.log(`   Type: ${metadata.callType}`);
        console.log(`   Phases: ${metadata.phases?.length || 0}`);
        console.log(`   DTMF Inputs: ${metadata.dtmfInputs?.length || 0}`);
        console.log(`   Speech Sessions: ${metadata.speechSessions?.length || 0}`);
        
        if (metadata.employee) {
          console.log(`   Employee: ${metadata.employee.name} (${metadata.provider?.name || 'unknown provider'})`);
        }
      }
      
      const stopped = await recordingService.stopRecording(callSid, reason);
      
      // Clean up metadata
      this.callMetadata.delete(callSid);
      this.audioBuffer.delete(callSid);
      
      if (stopped) {
        console.log(`✅ Enhanced recording stopped and uploaded for call ${callSid}`);
      }
      
      return stopped;
    } catch (error) {
      console.error(`❌ Error in enhanced onCallEnded hook for ${callSid}:`, error);
      return false;
    }
  }

  /**
   * Enhanced Hook: WebSocket Error with detailed logging
   */
  async onWebSocketError(callSid, error) {
    if (!this.initialized) return false;

    try {
      console.log(`💥 Enhanced recording hook: WebSocket error ${callSid}`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Code: ${error.code || 'unknown'}`);
      
      // Update call metadata
      const metadata = this.callMetadata.get(callSid);
      if (metadata) {
        metadata.errors = metadata.errors || [];
        metadata.errors.push({
          timestamp: new Date().toISOString(),
          message: error.message,
          code: error.code
        });
      }
      
      // Stop recording due to error
      const stopped = await recordingService.stopRecording(callSid, 'websocket_error');
      
      // Clean up
      this.callMetadata.delete(callSid);
      this.audioBuffer.delete(callSid);
      
      return stopped;
    } catch (err) {
      console.error(`❌ Error in enhanced onWebSocketError hook for ${callSid}:`, err);
      return false;
    }
  }

  /**
   * Utility: Detect call direction
   */
  detectCallDirection(startData) {
    // Simple heuristic based on available data
    if (startData.direction) {
      return startData.direction;
    }
    
    // Inbound calls typically have the Twilio number as 'To'
    if (startData.to && startData.to.includes('+')) {
      return 'inbound';
    }
    
    return 'unknown';
  }

  /**
   * Utility: Classify call type
   */
  classifyCallType(startData) {
    // Could be enhanced with more sophisticated logic
    if (startData.callType) {
      return startData.callType;
    }
    
    return 'voice_agent_call';
  }

  /**
   * Get enhanced recording status
   */
  getRecordingStatus(callSid) {
    if (!this.initialized) return null;
    
    const basicStatus = recordingService.getRecordingStatus(callSid);
    const metadata = this.callMetadata.get(callSid);
    const audioBuffer = this.audioBuffer.get(callSid);
    
    if (!basicStatus) return null;
    
    return {
      ...basicStatus,
      metadata: metadata ? {
        callType: metadata.callType,
        direction: metadata.callDirection,
        phases: metadata.phases?.length || 0,
        dtmfInputs: metadata.dtmfInputs?.length || 0,
        speechSessions: metadata.speechSessions?.length || 0,
        hasErrors: !!(metadata.errors?.length)
      } : null,
      audioBuffer: audioBuffer ? {
        bufferCount: audioBuffer.bufferCount,
        lastInboundActivity: audioBuffer.lastInboundTimestamp,
        lastOutboundActivity: audioBuffer.lastOutboundTimestamp,
        syncOffset: audioBuffer.syncOffset
      } : null
    };
  }

  /**
   * Get all active recordings with enhanced information
   */
  getActiveRecordings() {
    if (!this.initialized) return [];
    
    const activeRecordings = recordingService.getActiveRecordings();
    
    return activeRecordings.map(recording => {
      const enhancedStatus = this.getRecordingStatus(recording.callSid);
      return enhancedStatus || recording;
    });
  }

  /**
   * Enhanced health check
   */
  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, reason: 'not_initialized' };
    }
    
    const basicHealth = await recordingService.healthCheck();
    
    return {
      ...basicHealth,
      enhanced: {
        activeCallMetadata: this.callMetadata.size,
        audioBuffers: this.audioBuffer.size,
        features: {
          multiTrack: true,
          voiceActivityDetection: true,
          audioAnalysis: true,
          enhancedMetadata: true
        }
      }
    };
  }
}

// Create singleton instance
const enhancedWsRecordingIntegration = new EnhancedWebSocketRecordingIntegration();

module.exports = {
  EnhancedWebSocketRecordingIntegration,
  enhancedWsRecordingIntegration
};
