# Railway SMS Wave System Setup Guide

This guide explains how to deploy and configure the 3-wave SMS notification system on Railway.

## Prerequisites

- Railway account
- Railway CLI installed (optional)
- Voice agent project deployed on Railway

## Step 1: Add Redis Service to Railway

### Via Railway Dashboard:

1. Go to your Railway project dashboard
2. Click **"New Service"** → **"Database"** → **"Add Redis"**
3. Railway will automatically:
   - Deploy a Redis instance
   - Generate a `REDIS_URL` environment variable
   - Link it to your voice-agent service

### Via Railway CLI:

```bash
railway add redis
```

## Step 2: Configure Environment Variables

Add/update these environment variables in Railway:

### Required Variables:

```bash
# Railway Redis (automatically set by Railway when you add Redis service)
RAILWAY_REDIS_URL=redis://default:[password]@[host]:[port]

# Alternative: If using different Redis naming
REDIS_URL=redis://default:[password]@[host]:[port]

# Railway Public Domain (set automatically by Railway)
RAILWAY_PUBLIC_DOMAIN=your-project.railway.app

# Existing Twilio credentials (should already be set)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
TWILIO_MESSAGING_SID=your_messaging_service_sid

# Airtable credentials (should already be set)
AIRTABLE_API_KEY=your_api_key
AIRTABLE_BASE_ID=your_base_id
```

### Optional Variables:

```bash
# Custom base URL (if not using Railway domain)
BASE_URL=https://your-custom-domain.com

# State TTL for Redis (default: 3600 seconds = 1 hour)
STATE_TTL_SECONDS=3600

# Max call duration (default: 600 seconds = 10 minutes)
MAX_CALL_DURATION_SECONDS=600
```

## Step 3: Update Airtable Status Field

Add a new status value to your Job Occurrences table:

1. Open your Airtable base
2. Go to **Job Occurrences** table
3. Click on the **Status** field (single select)
4. Add new option: **UNFILLED_AFTER_SMS**
5. Choose a color (e.g., red/orange to indicate attention needed)

## Step 4: Deploy

### Automatic Deployment:

If you have GitHub integration enabled, push your code:

```bash
git add .
git commit -m "Add 3-wave SMS notification system"
git push origin main
```

Railway will automatically detect changes and deploy.

### Manual Deployment:

Using Railway CLI:

```bash
railway up
```

## Step 5: Verify Deployment

### Check Logs:

Look for these messages in Railway logs:

```
✅ SMS Wave Worker initialized
✅ WebSocket Server Started Successfully!
📱 SMS Wave System: Active
```

### Test the System:

1. Call your Twilio number
2. Authenticate with your PIN
3. Select a job and leave it open
4. Check SMS delivery to provider employees

## How the System Works

### Wave Timing:

The system sends 3 waves of SMS based on shift timing:

| Time Until Shift | Base Interval | Wave 2 After | Wave 3 After |
|------------------|---------------|--------------|--------------|
| 1-2 hours        | 10 minutes    | 10 min       | 20 min       |
| 3 hours          | 15 minutes    | 15 min       | 30 min       |
| 4 hours          | 20 minutes    | 20 min       | 40 min       |
| 5 hours          | 25 minutes    | 25 min       | 50 min       |
| 6-12 hours       | 30 minutes    | 30 min       | 60 min       |
| >12 hours        | 30 minutes    | 30 min       | 60 min       |

### SMS Format (Privacy-Safe):

```
JOB AVAILABLE: Oliver S., Oct 30 12:00. Reply or view: https://your-domain/job/recXYZ?emp=recEMP
```

- Only shows **FirstName LastInitial** (e.g., "Oliver S.")
- No sensitive patient information
- Includes clickable link to view full details

### Wave Flow:

1. **Wave 1** (Immediate): Sent when employee leaves job open
2. **Wave 2** (After interval): Sent if job still open
3. **Wave 3** (After 2x interval): Sent if job still open
4. **UNFILLED_AFTER_SMS**: Status set if job still open after Wave 3

### Cancellation:

Waves are automatically cancelled when:
- Employee accepts job via SMS link
- Job is assigned through any other means
- Job status changes from "Open"

## Monitoring

### Queue Statistics:

Check Bull queue statistics in logs:

```
Wave job completed: jobId=wave-2-recXYZ, waveNumber=2
```

### Failed Jobs:

Failed wave jobs are retried up to 3 times with exponential backoff.

Check logs for:
```
Wave job failed permanently: jobId=wave-2-recXYZ
```

### Redis Health:

Verify Redis connection:
- Check Railway Redis service status
- Look for "Redis connection established" in logs

## Troubleshooting

### Issue: SMS not sending

**Check:**
1. Twilio credentials are correct
2. Twilio Geo Permissions enabled for target countries
3. Phone numbers are in valid format (+61... for Australia)

### Issue: Waves not scheduled

**Check:**
1. Redis service is running on Railway
2. `RAILWAY_REDIS_URL` or `REDIS_URL` is set
3. Bull queue worker initialized (check logs for "SMS Wave Worker initialized")

### Issue: Waves sending even after job assigned

**Check:**
1. Job acceptance API is cancelling waves correctly
2. Wave cancellation logs show waves being cancelled
3. Redis connection is stable

### Issue: UNFILLED_AFTER_SMS not being set

**Check:**
1. Status field in Airtable has "UNFILLED_AFTER_SMS" option
2. Wave 3 is completing (check logs)
3. Job is still "Open" after Wave 3

## Testing

### Test with Short Intervals:

For testing, you can modify the intervals in:
`voice-agent/src/services/sms/wave-interval-calculator.ts`

Change:
```typescript
if (hoursUntilShift <= 2) {
  intervalMinutes = 10;  // Production: 10 minutes
}
```

To:
```typescript
if (hoursUntilShift <= 2) {
  intervalMinutes = 2;  // Testing: 2 minutes
}
```

**Remember to revert after testing!**

### Manual Test:

1. Create a test job with scheduled time 1 hour from now
2. Call the system and leave the job open
3. Verify Wave 1 sends immediately
4. Wait for calculated interval (e.g., 10 minutes)
5. Verify Wave 2 sends
6. Wait for 2x interval (e.g., 20 minutes total)
7. Verify Wave 3 sends
8. Verify UNFILLED_AFTER_SMS status is set

## Performance Considerations

### Redis Memory:

- Wave jobs are stored temporarily in Redis
- Completed jobs auto-delete after 24 hours
- Failed jobs auto-delete after 48 hours

### Concurrency:

- Worker processes 2 waves concurrently
- Adjust in `voice-agent/src/workers/sms-wave-worker.ts`:
  ```typescript
  smsWaveQueue.process(2, async (job) => {
    // Change "2" to desired concurrency
  ```

### Scalability:

- System can handle thousands of concurrent wave jobs
- Redis on Railway scales automatically
- Bull queue handles job persistence across restarts

## Support

For issues:
1. Check Railway logs first
2. Verify all environment variables
3. Test Redis connection
4. Review Airtable field configurations
