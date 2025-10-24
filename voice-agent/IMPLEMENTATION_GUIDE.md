# Twilio → S3 Recording & Daily PDF Reports Implementation Guide

## Overview

This implementation adds two major features for NDIS compliance:

1. **Twilio → S3 Recording Pipeline**: Automatically archives call recordings to AWS S3 (ap-southeast-2) with SSE-S3 encryption
2. **Daily PDF Reports**: Generates branded PDF reports of daily call logs grouped by provider

## What Was Implemented

### Phase 1: AWS S3 Recording Pipeline

#### 1.1 Configuration Updates
- **`src/config/env.ts`**: Added AWS environment variables (credentials, region, bucket)
- **`recording-services/config/aws-config.js`**: Updated default region to `ap-southeast-2` and added 24h retention config

#### 1.2 New Services Created

**`src/services/twilio/recording-downloader.ts`**
- Downloads completed recordings from Twilio API
- Supports MP3 and WAV formats
- Returns audio buffer for S3 upload

**`src/services/aws/s3-service.ts`**
- TypeScript wrapper for AWS SDK v3
- Handles uploads to S3 with SSE-S3 encryption
- Methods:
  - `uploadTwilioRecording()` - Upload call recordings
  - `uploadPdfReport()` - Upload PDF reports
  - `generatePresignedUrl()` - Generate secure access URLs

**`src/services/twilio/recording-manager.ts`**
- Manages recording lifecycle
- `deleteRecording()` - Delete recording from Twilio
- `scheduleRecordingDeletion()` - Schedule deletion after 24h retention

#### 1.3 Enhanced Recording Status Callback

**`app/api/twilio/recording-status/route.ts`**

Complete flow implementation:
1. Receives Twilio callback when recording completes
2. Downloads recording from Twilio (authenticated)
3. Uploads to S3 (ap-southeast-2) with SSE-S3 encryption
4. Finds Call Log record by CallSid
5. Updates Airtable with S3 URL (not Twilio URL)
6. Schedules Twilio recording deletion (24h retention)

**S3 Path Structure:**
```
call-recordings/{provider-name}/{employee-pin}/{call-sid}/twilio-recording.mp3
```

### Phase 2: Daily PDF Report API

#### 2.1 New Services Created

**`src/services/airtable/report-service.ts`**
- `getCallLogsByDateRange()` - Fetch calls for date range (AEST)
- `groupCallsByProvider()` - Group calls by provider with statistics
- `generateReportData()` - Complete report data generation
- `getYesterdayAEST()` - Helper to get yesterday's date in AEST

**`src/services/reports/pdf-template.ts`**
- `generateProviderReportHTML()` - Branded HTML template with:
  - Provider logo from Airtable
  - Summary statistics (call count, duration, avg duration)
  - Detailed call log table
  - Professional styling with print optimization

**`src/services/reports/pdf-generator.ts`**
- `generatePdf()` - Convert HTML to PDF using Puppeteer
- Reusable browser instance for performance
- A4 format with proper margins

#### 2.2 API Endpoint

**`app/api/reports/daily-call-summary/route.ts`**

**Endpoint:** `POST /api/reports/daily-call-summary`

**Request Body:**
```json
{
  "date": "2025-10-14",  // Optional, defaults to yesterday AEST
  "providerId": "rec123" // Optional, specific provider only
}
```

**Response:**
```json
{
  "success": true,
  "date": "2025-10-14",
  "totalCalls": 45,
  "totalDuration": 6850,
  "reports": [
    {
      "providerId": "rec123",
      "providerName": "Bay Area Family Practice",
      "pdfUrl": "https://s3.ap-southeast-2.amazonaws.com/...",
      "callCount": 15,
      "totalDuration": 2850,
      "success": true
    }
  ],
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0
  }
}
```

**S3 Path Structure for PDFs:**
```
reports/{YYYY}/{MM}/{provider-name}-{YYYY-MM-DD}.pdf
```

## Environment Variables Required

Add these to your `.env.local` file:

```env
# AWS S3 Configuration (NDIS Compliance)
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=your-bucket-name
AWS_S3_RECORDINGS_PREFIX=call-recordings/
AWS_S3_REPORTS_PREFIX=reports/
```

## Testing Guide

### Test 1: Recording Pipeline

1. **Make a test call** to your Twilio number
2. **Complete the call** - Twilio will automatically send a callback to:
   ```
   https://sam-voice-agent.vercel.app/api/twilio/recording-status
   ```
3. **Check logs** for:
   - "Recording status callback received"
   - "Recording downloaded from Twilio"
   - "Recording uploaded to S3 successfully"
   - "Airtable updated with S3 URL"
   - "Recording deletion scheduled"

4. **Verify in Airtable**:
   - Open Call Logs table
   - Find your call by CallSid
   - Check "Recording URL (Twilio/S3)" field contains S3 URL

5. **Verify in S3**:
   - Navigate to: `call-recordings/{provider}/{employee}/{callSid}/twilio-recording.mp3`
   - Confirm file exists and is downloadable
   - Check file properties show SSE-S3 encryption

### Test 2: PDF Report Generation

#### Option A: Manual API Call (Recommended for Testing)

Using curl or Postman:

```bash
# Generate report for yesterday (default)
curl -X POST https://sam-voice-agent.vercel.app/api/reports/daily-call-summary \
  -H "Content-Type: application/json"

# Generate report for specific date
curl -X POST https://sam-voice-agent.vercel.app/api/reports/daily-call-summary \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-10-14"}'

# Generate report for specific provider
curl -X POST https://sam-voice-agent.vercel.app/api/reports/daily-call-summary \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-10-14", "providerId": "rec123"}'
```

#### Option B: Test Locally

```bash
cd voice-agent

# Start the development server
npm run dev

# In another terminal, call the API
curl -X POST http://localhost:3000/api/reports/daily-call-summary \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-10-14"}'
```

#### What to Check:

1. **Response** should contain:
   - `success: true`
   - List of providers with PDF URLs
   - Call counts and durations

2. **Logs** should show:
   - "Generating daily call summary report"
   - "Report data fetched"
   - "Processing provider report" (for each provider)
   - "PDF generated successfully"
   - "PDF report uploaded to S3"
   - "Provider report completed"

3. **S3** should contain:
   - PDFs at: `reports/2025/10/{provider-name}-2025-10-14.pdf`
   - Files should be accessible via returned URLs

4. **PDF Content** should include:
   - Provider logo (if available in Airtable)
   - Summary statistics
   - Detailed call table with all calls for that day

### Test 3: Airtable Automation Setup

To automate daily report generation:

1. **Create Airtable Automation**:
   - Trigger: "At scheduled time" - Daily at 00:05 AEST
   - Action: "Run script"

2. **Automation Script**:
```javascript
// Airtable Automation Script
let response = await fetch('https://sam-voice-agent.vercel.app/api/reports/daily-call-summary', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    // No date = yesterday by default
  })
});

let data = await response.json();

// Log results
console.log('Report generation:', data.success ? 'SUCCESS' : 'FAILED');
console.log('Providers processed:', data.summary.total);
console.log('Successful reports:', data.summary.successful);

// You can add additional logic here to:
// - Create records in a "Reports" table
// - Link PDFs to providers
// - Send notifications
```

3. **Store PDFs in Airtable** (Optional):
   - Create a "Reports" table with fields:
     - Provider (link to Providers table)
     - Report Date (date field)
     - PDF URL (URL field)
     - Call Count (number field)
   - Update automation script to create records

## Key Features

### NDIS Compliance
- ✅ All recordings stored in Australia (ap-southeast-2)
- ✅ SSE-S3 encryption at rest
- ✅ Controlled retention (24h on Twilio, permanent on S3)
- ✅ Full audit trail via logging
- ✅ Direct ownership of encryption keys

### Recording Pipeline
- ✅ Dual recording system (Twilio + WebSocket both active)
- ✅ Automatic archival to S3 on completion
- ✅ Airtable updated with S3 URLs
- ✅ 24-hour Twilio retention for testing
- ✅ No changes to existing call flow

### PDF Reports
- ✅ Branded with provider logos
- ✅ Professional styling
- ✅ Timezone-aware (AEST)
- ✅ Batch processing for multiple providers
- ✅ Stored in organized S3 structure
- ✅ Ready for Airtable automation

## Troubleshooting

### Recording Not Uploaded to S3

**Check:**
1. AWS credentials in `.env.local`
2. S3 bucket exists and is in `ap-southeast-2`
3. IAM permissions allow `s3:PutObject`
4. Logs for specific error messages

### PDF Generation Fails

**Common Issues:**
1. **Puppeteer not installed**: Run `npm install` in voice-agent folder
2. **No calls found**: Verify date range has call logs in Airtable
3. **Provider logo fails to load**: Check logo URL in Airtable is accessible
4. **Timeout**: Large reports may need increased timeout

### Timezone Issues

The system uses AEST (Australia/Sydney) timezone:
- Reports default to yesterday 00:00-23:59 AEST
- Call log timestamps are converted to AEST for display
- API accepts dates in YYYY-MM-DD format (AEST)

## File Changes Summary

### Modified Files
- `voice-agent/src/config/env.ts` - Added AWS config
- `voice-agent/recording-services/config/aws-config.js` - Updated region
- `voice-agent/app/api/twilio/recording-status/route.ts` - Complete implementation
- `voice-agent/package.json` - Added dependencies

### New Files
- `voice-agent/src/services/twilio/recording-downloader.ts`
- `voice-agent/src/services/twilio/recording-manager.ts`
- `voice-agent/src/services/aws/s3-service.ts`
- `voice-agent/src/services/airtable/report-service.ts`
- `voice-agent/src/services/reports/pdf-template.ts`
- `voice-agent/src/services/reports/pdf-generator.ts`
- `voice-agent/app/api/reports/daily-call-summary/route.ts`

### Unchanged (As Required)
- WebSocket recording system (remains active)
- Twilio native recording initiation
- Existing call flow state machine
- Authentication or FSM phases

## Next Steps

1. **Add AWS credentials** to `.env.local`
2. **Test recording pipeline** with a live call
3. **Test PDF generation** with manual API call
4. **Set up Airtable automation** for daily reports
5. **Create Reports table** in Airtable (optional)
6. **Adjust retention period** from 24h to immediate after testing

## Production Deployment Checklist

- [ ] AWS credentials configured in production environment
- [ ] S3 bucket created in ap-southeast-2
- [ ] IAM permissions verified (PutObject, GetObject)
- [ ] Twilio webhook points to production URL
- [ ] Test call completed successfully
- [ ] Recording appears in S3 with correct path
- [ ] Airtable updated with S3 URL
- [ ] PDF report generated successfully
- [ ] Airtable automation configured
- [ ] First scheduled report runs successfully
- [ ] Adjust Twilio retention to 0h after testing (immediate deletion)

## Support

For issues or questions:
1. Check logs in Vercel dashboard
2. Verify environment variables
3. Test individual components (download → upload → update)
4. Review this guide's troubleshooting section

