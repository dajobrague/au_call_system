# Call Recording Integration Guide

This guide shows how to integrate the call recording system with your existing `ngrok-websocket-test.js` file.

## Phase 1: Environment Setup Completed ✅

The following files have been created for call recording:

### Core Services
- `recording-services/config/aws-config.js` - AWS S3 and recording configuration
- `recording-services/aws/s3-service.js` - S3 upload and management service
- `recording-services/audio/recording-manager.js` - Audio buffering and recording lifecycle
- `recording-services/index.js` - Main recording service interface
- `recording-services/integration/websocket-integration.js` - WebSocket integration hooks

### Integration Files
- `recording-integration.js` - Simple integration hooks for existing WebSocket server
- `test-recording-setup.js` - Test script to verify setup

## Environment Variables

Add these to your `.env.local` file:

```bash
# AWS S3 Configuration for Call Recording
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-west-2
AWS_S3_BUCKET=your-call-recordings-bucket
AWS_S3_RECORDINGS_PREFIX=call-recordings/

# Recording Configuration
RECORDING_ENABLED=true
RECORDING_FORMAT=wav
RECORDING_SAMPLE_RATE=8000
RECORDING_MAX_DURATION=600000
RECORDING_BUFFER_SIZE=1048576
```

## Integration Steps

### Step 1: Add Recording Import
At the top of `ngrok-websocket-test.js`, add:

```javascript
// Add this import near the top with other requires
const { initializeRecording, recordingHooks } = require('./recording-integration');
```

### Step 2: Initialize Recording Services
In the server startup section (around line 857), add:

```javascript
// Add this after the existing initializeFSMServices() call
initializeRecording().then(success => {
  if (success) {
    console.log('🎬 Call recording services ready');
  } else {
    console.log('⚠️ Call recording services disabled');
  }
}).catch(error => {
  console.error('❌ Recording initialization error:', error);
});
```

### Step 3: Add Recording Hooks
In the WebSocket connection handler (around line 869), add these hooks:

#### A. When stream starts (around line 995):
```javascript
if (data.event === 'start') {
  streamSid = data.streamSid;
  ws.callSid = data.start?.callSid;
  ws.streamSid = data.streamSid;
  
  // ADD THIS: Start recording
  recordingHooks.onCallStarted(data.start?.callSid, {
    callerNumber: parsedUrl.query.from,
    twilioNumber: data.start?.to,
    accountSid: data.start?.accountSid,
    streamSid: data.streamSid
  });
  
  // ... rest of existing code
}
```

#### B. When receiving media (around line 1594):
```javascript
} else if (data.event === 'media') {
  // ADD THIS: Record audio data
  if (ws.callSid) {
    recordingHooks.onAudioData(ws.callSid, data.media.payload);
  }
  
  // Professional speech collection - only record during active recording state
  // ... rest of existing code
}
```

#### C. When employee authenticated (around line 1059):
```javascript
if (authResult.success && authResult.employee) {
  console.log(`✅ Authenticated employee: ${authResult.employee.name}`);
  
  // ADD THIS: Update recording with auth data
  recordingHooks.onEmployeeAuthenticated(callSid, authResult.employee, authResult.provider);
  
  // ... rest of existing code
}
```

#### D. When provider selected (around line 1246):
```javascript
if (selectedProvider) {
  console.log(`✅ Provider selected: ${selectedProvider.name}`);
  
  // ADD THIS: Update recording with provider
  recordingHooks.onProviderSelected(ws.callSid, selectedProvider, currentState.employee);
  
  // ... rest of existing code
}
```

#### E. When stream stops (around line 1610):
```javascript
} else if (data.event === 'stop') {
  console.log('🛑 Twilio stream stopped:', data);
  
  // ADD THIS: Stop recording
  if (ws.callSid) {
    recordingHooks.onCallEnded(ws.callSid, 'stream_stopped');
  }
  
  // ... rest of existing code
}
```

#### F. When WebSocket closes (around line 1624):
```javascript
ws.on('close', (code, reason) => {
  console.log('🔚 WebSocket closed:', { callSid, code, reason: reason.toString() });
  
  // ADD THIS: Ensure recording stops
  if (callSid) {
    recordingHooks.onCallEnded(callSid, 'websocket_closed');
  }
  
  // ... rest of existing code
});
```

#### G. When WebSocket errors (around line 1634):
```javascript
ws.on('error', (error) => {
  console.error('💥 WebSocket error:', { callSid, error });
  
  // ADD THIS: Stop recording on error
  if (callSid) {
    recordingHooks.onWebSocketError(callSid, error);
  }
  
  // ... rest of existing code
});
```

### Step 4: Add Health Check Endpoint
Add this new endpoint to your Express app (around line 808):

```javascript
// Add this after the existing /health endpoint
app.get('/recording-health', async (req, res) => {
  try {
    const health = await recordingHooks.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ healthy: false, error: error.message });
  }
});
```

## Testing

1. **Test the setup:**
   ```bash
   cd /Users/davidbracho/auestralian_project/voice-agent
   node test-recording-setup.js
   ```

2. **Check recording health:**
   ```bash
   curl http://localhost:3001/recording-health
   ```

3. **Make a test call** and check the console for recording messages like:
   - `🎙️ Recording started for call CA123...`
   - `🔐 Recording auth updated: Employee Name @ Provider`
   - `🔚 Recording stopped and uploaded for call CA123...`

## S3 Folder Structure

Recordings will be stored in S3 with this structure:
```
your-bucket/
  call-recordings/
    {provider-name}/
      {employee-pin}/
        {call-sid}/
          recording.wav      # Main recording
          metadata.json      # Call metadata
          inbound.wav       # Optional: caller audio only
          outbound.wav      # Optional: system audio only
```

## Troubleshooting

1. **Recording not starting:** Check AWS credentials and bucket permissions
2. **No audio data:** Verify media event hooks are properly placed
3. **Missing auth data:** Ensure authentication hooks are called after employee/provider detection
4. **Upload failures:** Check S3 bucket exists and credentials have write permissions

## Next Steps

After Phase 1 is working:
- Phase 2: Advanced audio processing and separate track recording
- Phase 3: Recording management dashboard
- Phase 4: Playback and analysis features
- Phase 5: Production monitoring and alerting
