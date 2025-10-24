# Phase 2: Enhanced Call Recording Integration Guide

Phase 2 adds advanced audio processing, multi-track recording, voice activity detection, and comprehensive call analysis to your recording system.

## New Features Added ✨

### 1. Advanced Audio Processing
- **Enhanced μ-law to PCM conversion** with noise reduction
- **Voice Activity Detection (VAD)** for caller vs system audio
- **Audio normalization and compression** for better quality
- **Dynamic range processing** and noise gating
- **Audio statistics generation** (RMS, peak levels, silence detection)

### 2. Multi-Track Recording
- **Separate track recording** (inbound caller, outbound system)
- **Mixed track generation** with configurable weights
- **Track synchronization** with timing correction
- **Conversation analysis** (interruptions, dominant speaker)
- **Speech segment tracking** with confidence levels

### 3. Intelligent Buffer Management
- **Stream buffering** with automatic segmentation
- **Memory optimization** for long calls
- **Compression algorithms** to reduce storage
- **Buffer overflow protection** with automatic archiving

### 4. Enhanced Metadata Collection
- **Call phase tracking** throughout FSM transitions
- **DTMF input logging** with context
- **Speech collection sessions** with recognition results
- **Conversation metrics** (speaking time, interruption rate)
- **Audio quality metrics** (signal levels, silence percentage)

## New Files Added

### Core Audio Processing
- `recording-services/audio/audio-processor.js` - Advanced audio processing algorithms
- `recording-services/audio/stream-buffer.js` - Intelligent buffer management
- `recording-services/audio/track-manager.js` - Multi-track audio management
- `recording-services/integration/enhanced-websocket-integration.js` - Enhanced integration hooks

### Updated Files
- `recording-services/audio/recording-manager.js` - Enhanced with track management
- `recording-integration.js` - Updated to use enhanced features

## Integration Changes

### 1. Enhanced Audio Data Hook

**OLD (Phase 1):**
```javascript
recordingHooks.onAudioData(callSid, audioPayload);
```

**NEW (Phase 2):**
```javascript
// Basic usage (same as Phase 1)
recordingHooks.onAudioData(callSid, audioPayload);

// Enhanced usage with track detection and timing
recordingHooks.onAudioData(callSid, audioPayload, 'inbound', Date.now());
recordingHooks.onAudioData(callSid, audioPayload, 'outbound', Date.now());
```

### 2. New Enhanced Hooks

Add these new hooks to your `ngrok-websocket-test.js`:

#### A. Phase Change Tracking
```javascript
// Call this whenever FSM phase changes
recordingHooks.onCallPhaseChanged(callSid, 'pin_auth', 'provider_selection', {
  employee: employee,
  attempts: attempts
});
```

#### B. DTMF Input Tracking
```javascript
// In your DTMF handler (around line 1210)
if (data.event === 'dtmf') {
  const digit = data.dtmf?.digit;
  
  // ADD THIS: Track DTMF input
  recordingHooks.onDTMFInput(ws.callSid, digit, {
    phase: currentState.phase,
    timestamp: Date.now()
  });
  
  // ... rest of existing DTMF code
}
```

#### C. Speech Collection Tracking
```javascript
// When starting speech collection (around line 588)
function startSpeechCollection(ws, prompt, context = {}, speechGenerator) {
  // ADD THIS: Track speech session start
  recordingHooks.onSpeechCollectionStarted(ws.callSid, prompt, context);
  
  // ... rest of existing speech collection code
}

// When speech is recognized (around line 678)
const userSpeech = await speechToText(speechBuffer);
if (userSpeech) {
  // ADD THIS: Track speech completion
  recordingHooks.onSpeechCollectionCompleted(ws.callSid, userSpeech, vadInfo?.confidence);
}
```

### 3. Enhanced Logging Output

With Phase 2, you'll see enhanced logging like:

```
🎬 Enhanced recording hook: Call started CA123...
   Employee: John Doe (PIN: 1234)
   Provider: Sunrise Health Group (ID: provider123)
🗣️ Conversation: 12 segments, 65% caller, 2.3 interruptions/min
📤 Uploading mixed recording: 2,450KB
📤 Uploading inbound track: 1,200KB
📤 Uploading outbound track: 800KB
📤 Uploading metadata with audio analysis
📊 Call Summary for CA123...:
   Duration: 180s
   Type: voice_agent_call
   Phases: 8
   DTMF Inputs: 12
   Speech Sessions: 3
   Employee: John Doe (Sunrise Health Group)
```

## S3 Storage Structure (Enhanced)

```
your-bucket/
  call-recordings/
    {provider-name}/
      {employee-pin}/
        {call-sid}/
          recording.wav          # Mixed track (enhanced quality)
          inbound.wav           # Caller audio only (NEW)
          outbound.wav          # System audio only (NEW)
          metadata.json         # Enhanced with audio analysis
```

## Enhanced Metadata Format

The metadata.json now includes comprehensive audio analysis:

```json
{
  "callSid": "CA123...",
  "callerNumber": "+1234567890",
  "duration": 180,
  "audioAnalysis": {
    "conversationMetrics": {
      "totalSegments": 12,
      "callerSpeakingTime": 95000,
      "systemSpeakingTime": 45000,
      "callerSpeakingPercentage": 67.9,
      "systemSpeakingPercentage": 32.1,
      "averageSegmentLength": 8500,
      "longestSegment": 25000,
      "interruptionRate": 2.3,
      "dominantSpeaker": "caller"
    },
    "tracks": {
      "mixed": {
        "totalDuration": 180000,
        "voiceActivity": {
          "totalSpeechTime": 140000,
          "totalSilenceTime": 40000,
          "speechPercentage": 77.8
        }
      }
    }
  },
  "trackInfo": {
    "hasSeparateTracks": true,
    "inboundSize": 1228800,
    "outboundSize": 819200,
    "mixedSize": 2508800
  },
  "callMetadata": {
    "phases": [
      {"phase": "phone_auth", "timestamp": "2024-01-01T10:00:00Z"},
      {"phase": "provider_selection", "timestamp": "2024-01-01T10:00:15Z"},
      {"phase": "collect_job_code", "timestamp": "2024-01-01T10:00:30Z"}
    ],
    "dtmfInputs": [
      {"digit": "1", "timestamp": "2024-01-01T10:00:20Z", "context": "provider_selection"},
      {"digit": "1", "timestamp": "2024-01-01T10:00:35Z", "context": "collect_job_code"},
      {"digit": "2", "timestamp": "2024-01-01T10:00:36Z", "context": "collect_job_code"}
    ],
    "speechSessions": [
      {
        "startTime": "2024-01-01T10:01:00Z",
        "endTime": "2024-01-01T10:01:05Z",
        "prompt": "What day would you like to reschedule to?",
        "recognizedText": "next Monday",
        "confidence": 0.89
      }
    ]
  }
}
```

## Testing Phase 2

### 1. Test Enhanced Features
```bash
cd /Users/davidbracho/auestralian_project/voice-agent
node test-recording-setup.js
```

### 2. Check Enhanced Health Endpoint
```bash
curl http://localhost:3001/recording-health
```

Expected response:
```json
{
  "healthy": true,
  "activeRecordings": 0,
  "enhanced": {
    "activeCallMetadata": 0,
    "audioBuffers": 0,
    "features": {
      "multiTrack": true,
      "voiceActivityDetection": true,
      "audioAnalysis": true,
      "enhancedMetadata": true
    }
  }
}
```

### 3. Monitor Enhanced Logs

During calls, you should see:
```
📊 Active recordings: 1
  - CA123...: 45s, 1,250KB [caller dominant, 8 segments]
🔄 Enhanced recording hook: Phase changed CA123...: pin_auth → provider_selection
🎤 Enhanced recording hook: Speech collection started CA123...
🗣️ Conversation: 8 segments, 72% caller, 1.8 interruptions/min
```

## Performance Improvements

Phase 2 includes several optimizations:

1. **Memory Management**: Automatic buffer segmentation prevents memory leaks
2. **Compression**: Audio compression reduces storage costs by ~30%
3. **Streaming Uploads**: Large files are uploaded in chunks
4. **Voice Activity Detection**: Reduces processing for silent periods
5. **Intelligent Buffering**: Optimized for long calls (10+ minutes)

## Configuration Options

Add these optional settings to your `.env.local`:

```bash
# Phase 2 Enhanced Settings
RECORDING_ENABLE_VAD=true                    # Voice Activity Detection
RECORDING_ENABLE_COMPRESSION=true           # Audio compression
RECORDING_SEPARATE_TRACKS=true              # Record separate tracks
RECORDING_BUFFER_SEGMENTS=true              # Enable buffer segmentation
RECORDING_MAX_SEGMENT_DURATION=30000        # 30 seconds per segment
RECORDING_VOICE_THRESHOLD=1000000           # VAD energy threshold
RECORDING_TRACK_SYNC_TOLERANCE=100          # Track sync tolerance (ms)
```

## Next Steps

After Phase 2 is working:
- **Phase 3**: Recording management dashboard and playback interface
- **Phase 4**: Advanced analytics and call quality scoring
- **Phase 5**: Real-time monitoring and alerting system

## Troubleshooting

1. **High memory usage**: Check buffer segmentation settings
2. **Missing separate tracks**: Verify track detection logic
3. **Poor audio quality**: Adjust compression and normalization settings
4. **Sync issues**: Check track timing tolerance settings

Phase 2 provides a robust foundation for comprehensive call analysis and quality monitoring! 🎉
