# Recording Callback Debugging Guide

## Current Issue

Call recordings are being initiated in TwiML, but the recording callback is never received. The logs show:
- ✅ Call completes normally
- ❌ No "Recording status callback received" message
- ❌ `hasRecording: false` in call log

## Root Cause Analysis

When Twilio completes a recording, it sends an HTTP POST to the `recordingStatusCallback` URL. If we're not seeing the callback, it means either:

1. **Wrong URL**: The callback URL is pointing to the wrong domain (Vercel instead of Railway)
2. **Unreachable**: Twilio can't reach the callback URL
3. **Route Issue**: The `/api/twilio/recording-status` route isn't working
4. **Recording Never Started**: The TwiML recording didn't actually start

## New Debug Logs Added

### 1. TwiML Generation Log
```typescript
logger.info('TwiML generated with recording', {
  callSid,
  recordingStatusCallback: RECORDING_STATUS_CALLBACK,  // ← This shows the callback URL
  websocketUrl: WEBSOCKET_URL,
  actionUrl,
  type: 'twiml_generated'
});
```

**What to Check:**
- Is `recordingStatusCallback` pointing to **Railway** domain?
- Should be: `https://aucallsystem-ivr-system.up.railway.app/api/twilio/recording-status`
- Should NOT be: Vercel domain, localhost, or ngrok

### 2. Recording Status Endpoint Entry Log
```typescript
logger.info('📼 Recording status endpoint called', {
  url: request.url,
  method: request.method,
  type: 'recording_status_endpoint_called'
});
```

**What to Check:**
- Does this log appear AT ALL when a call ends?
- If NO: Twilio isn't reaching the endpoint (wrong URL or firewall issue)
- If YES: The endpoint is being called, check what happens next

## Testing Steps

### Step 1: Deploy Updated Code
```bash
git add .
git commit -m "Add recording callback debug logging"
git push
```

Wait for Railway to deploy.

### Step 2: Make a Test Call

Call your Twilio number and have a conversation, then hang up.

### Step 3: Check Railway Logs

Look for these log entries:

#### Expected Log Sequence (Success):
```
[INFO] Incoming call - initiating WebSocket with recording
[INFO] TwiML generated with recording {
  "recordingStatusCallback": "https://aucallsystem-ivr-system.up.railway.app/api/twilio/recording-status",
  ...
}
[INFO] Call ended
[INFO] 📼 Recording status endpoint called  ← This confirms callback is received
[INFO] Recording status callback received
[INFO] Recording uploaded to S3 (or fallback to Twilio URL)
[INFO] Airtable updated with recording URL
```

#### Problem Scenario 1: Wrong Callback URL
```
[INFO] TwiML generated with recording {
  "recordingStatusCallback": "https://voice-agent.vercel.app/api/twilio/recording-status",  ← WRONG! Should be Railway
  ...
}
[INFO] Call ended
[NO CALLBACK RECEIVED] ← Twilio sent it to Vercel, not Railway
```

**Fix:** Set `RECORDING_STATUS_CALLBACK` environment variable in Railway to:
```
https://aucallsystem-ivr-system.up.railway.app/api/twilio/recording-status
```

#### Problem Scenario 2: Callback URL is Correct but Not Received
```
[INFO] TwiML generated with recording {
  "recordingStatusCallback": "https://aucallsystem-ivr-system.up.railway.app/api/twilio/recording-status",  ← Correct
  ...
}
[INFO] Call ended
[NO CALLBACK RECEIVED] ← Twilio can't reach Railway
```

**Fix:** Check Twilio's debugger console:
1. Go to https://console.twilio.com/us1/monitor/logs/debugger
2. Find your call
3. Look for "Recording" events
4. Check if there are any errors when Twilio tries to call the callback URL

#### Problem Scenario 3: Recording Never Started
```
[INFO] TwiML generated with recording {
  "recordingStatusCallback": "https://...",
  ...
}
[INFO] Call ended
[NO CALLBACK RECEIVED]
```

Check Twilio Console:
1. Go to https://console.twilio.com/us1/monitor/logs/calls
2. Find your call
3. Look at the TwiML that was executed
4. Verify it includes: `record="record-from-answer-dual"`

## Environment Variable Check

### On Railway:

Make sure these are set:

```bash
# Should point to Railway, NOT Vercel
RAILWAY_PUBLIC_DOMAIN=aucallsystem-ivr-system.up.railway.app

# Optional: Explicitly set callback URL
RECORDING_STATUS_CALLBACK=https://aucallsystem-ivr-system.up.railway.app/api/twilio/recording-status
```

## Common Issues

### Issue 1: Callback Going to Vercel
**Symptoms:** No callback received, TwiML shows Vercel URL  
**Cause:** Environment variables not set correctly  
**Fix:** Set `RECORDING_STATUS_CALLBACK` explicitly in Railway

### Issue 2: Callback URL is HTTP instead of HTTPS
**Symptoms:** Twilio refuses to call HTTP URLs in production  
**Cause:** Environment variable using `http://` instead of `https://`  
**Fix:** Change to `https://`

### Issue 3: Recording Not Starting at All
**Symptoms:** No errors, but no callback  
**Cause:** TwiML syntax error or missing attributes  
**Fix:** Check Twilio console for TwiML execution logs

## Manual Test of Callback Endpoint

You can manually test if the endpoint is reachable:

```bash
curl -X POST https://aucallsystem-ivr-system.up.railway.app/api/twilio/recording-status \
  -d "CallSid=test" \
  -d "RecordingSid=test" \
  -d "RecordingStatus=in-progress"
```

You should see:
```
[INFO] 📼 Recording status endpoint called
```

If you get a 404 or 500 error, the route itself has a problem.

## Expected Final State

After fixing, every call should show:

```
✅ TwiML with correct callback URL
✅ Recording starts (dual-channel)
✅ Call proceeds normally
✅ Call ends
✅ Callback received within 5-10 seconds
✅ Recording downloaded and uploaded to S3 (or Twilio fallback)
✅ Airtable updated with recording URL
✅ hasRecording: true in call log
```

## Next Steps

1. Deploy the code with new logging
2. Make a test call
3. Check Railway logs for the debug messages
4. Share the logs here if callback still isn't received
5. We'll determine the exact issue from the logs

