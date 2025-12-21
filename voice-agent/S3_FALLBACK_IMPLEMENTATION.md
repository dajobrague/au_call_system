# S3 Fallback Recording URL Implementation

## Overview

This implementation adds a fallback mechanism to ensure that call recordings are never lost. When S3 upload fails (due to network issues, S3 downtime, or credential problems), the system now stores the Twilio recording URL in Airtable and preserves the recording on Twilio instead of deleting it.

## Changes Made

### 1. Recording Status Webhook Handler
**File:** `voice-agent/app/api/twilio/recording-status/route.ts`

**Changes:**
- Wrapped S3 upload logic in try-catch block
- On S3 success: Uses S3 presigned URL, schedules Twilio deletion (original behavior)
- On S3 failure: Uses Twilio recording URL as fallback, skips Twilio deletion
- Added new logging types for better observability

**Key Logic:**
```typescript
let finalRecordingUrl: string;
let shouldDeleteFromTwilio = false;
let uploadedToS3 = false;

try {
  // Attempt S3 upload
  await s3Client.send(putCommand);
  finalRecordingUrl = s3Url;
  shouldDeleteFromTwilio = true;
  uploadedToS3 = true;
} catch (s3Error) {
  // Fallback to Twilio URL
  finalRecordingUrl = twilioFullUrl;
  shouldDeleteFromTwilio = false;
  uploadedToS3 = false;
}

// Always update Airtable with whichever URL we have
await airtableClient.updateRecord(/*...*/);

// Only delete from Twilio if S3 succeeded
if (shouldDeleteFromTwilio) {
  scheduleRecordingDeletion(recordingSid, 24);
}
```

### 2. WebSocket Connection Handler
**File:** `voice-agent/src/websocket/connection-handler.ts`

**Changes:**
- Modified `scheduleRecordingTransferToS3` function with same fallback pattern
- On S3 success: Uses S3 presigned URL, deletes from Twilio (original behavior)
- On S3 failure: Fetches Twilio URL using `getRecordingUrl()`, preserves Twilio recording
- Added new logging types for better observability

**Key Logic:**
Same pattern as above, but uses `getRecordingUrl()` from `call-recorder.ts` to fetch the Twilio URL when S3 fails.

## New Log Types

The following log types have been added for monitoring:

- `recording_s3_fallback_to_twilio` - When S3 upload fails and system falls back to Twilio URL
- `recording_saved_to_airtable_s3` - When S3 URL is successfully saved to Airtable
- `recording_saved_to_airtable_twilio` - When Twilio URL is saved as fallback
- `twilio_recording_preserved` - When Twilio recording is kept (not deleted) due to S3 failure
- `twilio_deletion_scheduled` - When Twilio deletion is scheduled after successful S3 upload

## Benefits

1. **Zero Data Loss**: Every recording is guaranteed to have a URL stored in Airtable
2. **Transparent Fallback**: Logs clearly indicate when fallback mechanism is used
3. **Cost Optimization**: Only keeps Twilio recordings when S3 fails (Twilio storage is more expensive)
4. **Operational Visibility**: Easy to identify S3 issues through logs and take corrective action

## Testing Scenarios

### Scenario 1: Normal Flow (S3 Working)
**Expected Behavior:**
- Recording uploads to S3 successfully
- Airtable stores S3 presigned URL
- Twilio recording is deleted after 24 hours
- Logs show: `recording_s3_upload_success`, `recording_saved_to_airtable_s3`, `twilio_deletion_scheduled`

**How to Test:**
1. Ensure S3 credentials are properly configured in environment
2. Make a test call through the system
3. Check logs for successful S3 upload
4. Verify Airtable has S3 URL in "Recording URL (Twilio/S3)" field
5. Verify Twilio recording deletion is scheduled

### Scenario 2: S3 Credentials Invalid
**Expected Behavior:**
- S3 upload fails with authentication error
- System falls back to Twilio URL
- Airtable stores Twilio recording URL
- Twilio recording is preserved (not deleted)
- Logs show: `recording_s3_fallback_to_twilio`, `recording_saved_to_airtable_twilio`, `twilio_recording_preserved`

**How to Test:**
1. Temporarily set invalid AWS credentials in environment
2. Make a test call through the system
3. Check logs for S3 fallback message
4. Verify Airtable has Twilio URL in "Recording URL (Twilio/S3)" field
5. Verify Twilio recording is NOT deleted

### Scenario 3: S3 Bucket Doesn't Exist
**Expected Behavior:**
- Same as Scenario 2 (fallback to Twilio URL)

**How to Test:**
1. Temporarily set non-existent bucket name in environment
2. Follow same steps as Scenario 2

### Scenario 4: Network Timeout to S3
**Expected Behavior:**
- Same as Scenario 2 (fallback to Twilio URL)

**How to Test:**
1. Simulate network issues (if possible)
2. Follow same steps as Scenario 2

### Scenario 5: Airtable Update Fails
**Expected Behavior:**
- Error is logged but process doesn't crash
- Recording URL is lost (this is an edge case)

**Note:** This scenario is rare and would require Airtable API to be down or credentials to be invalid.

## Manual Testing Steps

### Prerequisites
1. Server must be running: `cd voice-agent && npm run dev` or `node server.js`
2. Twilio webhook must be configured to point to your server
3. Environment variables must be set (see `.env` file)

### Test 1: Verify Normal S3 Flow
```bash
# 1. Ensure S3 credentials are valid
# 2. Make a test call
# 3. Check logs in terminal
# 4. Verify Airtable record has S3 URL
```

### Test 2: Verify S3 Fallback
```bash
# 1. Temporarily modify environment to break S3
# Option A: Invalid credentials
export AWS_ACCESS_KEY_ID="invalid"
export AWS_SECRET_ACCESS_KEY="invalid"

# Option B: Invalid bucket
export AWS_S3_BUCKET="non-existent-bucket-12345"

# 2. Restart server
# 3. Make a test call
# 4. Check logs for fallback message
# 5. Verify Airtable record has Twilio URL (starts with https://api.twilio.com)
# 6. Verify Twilio recording still exists (not deleted)
```

## Monitoring in Production

After deployment, monitor these metrics:

1. **S3 Upload Success Rate**: Count of `recording_s3_upload_success` vs `recording_s3_fallback_to_twilio`
2. **Fallback Frequency**: If fallbacks are frequent, investigate S3 connectivity or credentials
3. **Airtable Update Failures**: Count of `airtable_update_error` logs
4. **Preserved Twilio Recordings**: Track how many recordings are kept on Twilio (cost implications)

## Rollback Plan

If issues arise, the changes can be safely rolled back:

1. The modified files are:
   - `voice-agent/app/api/twilio/recording-status/route.ts`
   - `voice-agent/src/websocket/connection-handler.ts`

2. Revert to previous versions using git:
   ```bash
   git checkout HEAD~1 -- voice-agent/app/api/twilio/recording-status/route.ts
   git checkout HEAD~1 -- voice-agent/src/websocket/connection-handler.ts
   ```

3. Restart the server

## Future Enhancements

1. **Retry Mechanism**: Add automatic retry for S3 uploads before falling back to Twilio
2. **Background Job**: Create a background job to migrate Twilio URLs to S3 when S3 becomes available
3. **Alerting**: Set up alerts when fallback rate exceeds threshold
4. **Metrics Dashboard**: Create dashboard to visualize S3 upload success rate

