# Recording Timing Fix

## Issue
Call recordings were failing with a 404 error from Twilio:
```
ERROR: Failed to start call recording
error: "The requested resource /2010-04-01/Accounts/.../Calls/.../Recordings.json was not found"
```

## Root Cause
**Race condition**: The system was attempting to start the recording only 15ms after the WebSocket stream connected, but Twilio's API hadn't fully registered the call yet.

### Timeline from logs:
```
04:45:55.273Z - WebSocket stream started
04:45:55.288Z - Attempted to start recording (15ms later) ❌
04:45:55.609Z - Recording failed with 404 error
```

When using Twilio's `<Connect><Stream>` for WebSocket connections, there's a brief moment where:
1. The WebSocket connection is established
2. The call SID is available in the stream
3. BUT Twilio's REST API hasn't fully registered the call yet

This creates a race condition where the Recordings API returns 404 because it can't find the call.

## Solution
Added a **1-second delay** before starting the recording to ensure Twilio has fully registered the call in their system.

### Files Modified:
1. **`src/websocket/server.ts`** (TypeScript WebSocket server)
2. **`server.js`** (JavaScript WebSocket server)

### Change:
```typescript
// BEFORE: Started immediately
startCallRecording({
  callSid: ws.parentCallSid!,
  recordingChannels: 'dual',
  trim: 'do-not-trim'
}).then(...)

// AFTER: Started after 1-second delay
setTimeout(() => {
  startCallRecording({
    callSid: ws.parentCallSid!,
    recordingChannels: 'dual',
    trim: 'do-not-trim'
  }).then(...)
}, 1000); // 1 second delay
```

## Impact
- **Positive**: Recording will start successfully after Twilio registers the call
- **Neutral**: 1-second delay doesn't affect user experience (disclaimer is already playing)
- **No impact**: This fix is independent of the S3 fallback feature

## Testing
After deployment, verify:
1. Recordings start successfully (no more 404 errors)
2. Recording SID is captured and stored
3. S3 fallback mechanism still works correctly
4. Call logs show `recording_success` instead of `recording_start_error`

## Expected Log Sequence (After Fix)
```
[INFO] WebSocket stream started
[INFO] Starting call recording (after 1s delay)
[INFO] Call recording started successfully ✅
[INFO] Recording SID captured
```

## Why 1 Second?
- **Too short (< 500ms)**: May still hit the race condition
- **1 second**: Safe buffer that ensures Twilio has registered the call
- **Too long (> 2s)**: Might miss the beginning of important audio

1 second is the sweet spot - it's long enough to avoid the race condition but short enough that the disclaimer audio covers the delay, so users never notice.

## Related Features
This fix works in conjunction with the **S3 Fallback** feature:
1. Recording starts successfully (after 1s delay) ✅
2. Recording completes and triggers callback webhook
3. System downloads from Twilio and uploads to S3
4. **If S3 fails**: Falls back to Twilio URL (zero data loss)
5. **If S3 succeeds**: Deletes from Twilio after 24h

## Deployment Notes
- No configuration changes needed
- No environment variables changed
- Compatible with existing deployment
- Can be deployed independently

