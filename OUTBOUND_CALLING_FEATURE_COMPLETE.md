# Outbound Calling Feature - Complete Implementation Guide

**Status**: ✅ FULLY IMPLEMENTED  
**Date**: January 22, 2026  
**Version**: 1.0

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Architecture](#architecture)
3. [Setup & Configuration](#setup--configuration)
4. [User Guide](#user-guide)
5. [Technical Documentation](#technical-documentation)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [Monitoring & Logs](#monitoring--logs)

---

## Feature Overview

### What It Does

The Outbound Calling feature provides automated phone calls to staff members as a "last mile" escalation when SMS messages are not responded to. After Wave 3 SMS completes with no acceptance, the system automatically calls staff members in the pool, allowing them to accept or decline shifts via phone.

### Key Features

✅ **Automated Calling** - Calls staff automatically after Wave 3  
✅ **Round-Robin Logic** - Calls each staff member multiple times  
✅ **DTMF Response** - Staff press 1 to accept, 2 to decline  
✅ **Personalized Messages** - Custom voice messages with variables  
✅ **Real-time Tracking** - All calls logged in Call Logs table  
✅ **SMS Confirmation** - Automatic confirmation SMS on acceptance  
✅ **Smart Cancellation** - Stops all calls when someone accepts  

### Workflow

```
Wave 3 SMS → No Response → Wait Period → Start Calling
    ↓
Call Staff #1 → Press 1 (Accept) ✅ → Assign Job → Cancel Remaining Calls
              → Press 2 (Decline) → Call Staff #2
              → No Answer → Call Staff #2
    ↓
Repeat for all staff in pool × Max Rounds
    ↓
If no acceptance → Mark as UNFILLED_AFTER_CALLS
```

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      VOICE AGENT                            │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Wave         │    │ Outbound     │    │ Outbound     │ │
│  │ Processor    │───▶│ Call Queue   │───▶│ Call Worker  │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         │                    ▼                    ▼         │
│         │            ┌──────────────┐    ┌──────────────┐ │
│         │            │    Redis     │    │ Call         │ │
│         │            │   Bull Queue │    │ Processor    │ │
│         │            └──────────────┘    └──────────────┘ │
│         │                                         │         │
│         ▼                                         ▼         │
│  ┌──────────────┐                        ┌──────────────┐ │
│  │  Airtable    │◀───────────────────────│  Twilio API  │ │
│  │  (Provider   │                        │  (Calls)     │ │
│  │   Config)    │                        └──────────────┘ │
│  └──────────────┘                                │         │
│         │                                        ▼         │
│         │                                ┌──────────────┐ │
│         │                                │ ElevenLabs   │ │
│         │                                │ (Audio Gen)  │ │
│         │                                └──────────────┘ │
│         │                                        │         │
│         ▼                                        ▼         │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                  API Routes                          │ │
│  │  /api/outbound/twiml    /api/outbound/response      │ │
│  │  /api/outbound/status   /api/outbound/audio         │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PROVIDER PORTAL                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │     Outbound Calling Settings Page                   │ │
│  │  • Enable/Disable Feature                            │ │
│  │  • Configure Wait Time & Max Rounds                  │ │
│  │  • Message Template Builder                          │ │
│  │  • Real-time Preview                                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                              │                             │
│                              ▼                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │        API: /api/provider/outbound-calling           │ │
│  │        GET: Fetch settings   PATCH: Update settings  │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Backend**: Node.js, TypeScript, Express
- **Queue**: Bull (Redis-backed)
- **Telephony**: Twilio (Voice, TwiML, Media Streams)
- **Audio**: ElevenLabs (Text-to-Speech)
- **Database**: Airtable
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS

---

## Setup & Configuration

### Prerequisites

1. **Airtable Fields** (Already added):
   - `Providers` table:
     - `Outbound Call Enabled` (Checkbox)
     - `Outbound Call Wait Minutes` (Number, default: 15)
     - `Outbound Call Max Rounds` (Number, default: 3)
     - `Outbound Call Message Template` (Long text)
   - `Call Logs` table:
     - `Call Purpose` (Single select: IVR Session | Outbound Job Offer | Transfer to Representative)
     - `Call Outcome` (Single select: Accepted | Declined | No Answer | Busy | Failed | Voicemail)
     - `DTMF Response` (Single line text)
     - `Attempt Round` (Number)

2. **Environment Variables** (Already configured):
   ```env
   # Redis (for Bull queue)
   RAILWAY_REDIS_URL=redis://...
   
   # Twilio
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...
   
   # ElevenLabs
   ELEVENLABS_API_KEY=sk_...
   ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB  # Adam voice
   ```

3. **Worker Initialization** (Already done):
   - `voice-agent/server.js` - Initializes outbound call worker on startup
   - `voice-agent/websocket-server.js` - Also initializes worker

### Twilio Webhooks Configuration

Configure these webhooks in your Twilio console:

```
Voice URL (when call is answered):
https://your-domain.com/api/outbound/twiml

Status Callback URL:
https://your-domain.com/api/outbound/status
```

---

## User Guide

### For Providers: Configuring Outbound Calling

#### Step 1: Access Settings

1. Log into Provider Portal
2. Navigate to **Settings** in the sidebar
3. Click **Outbound Calling** card

#### Step 2: Enable the Feature

1. Toggle **"Enable Outbound Calling"** checkbox
2. This activates the automated calling system

#### Step 3: Configure Timing

**Wait Time After Wave 3**:
- How long to wait after Wave 3 SMS before starting calls
- Range: 1-120 minutes
- Default: 15 minutes
- Example: Set to 15 minutes means system waits 15 minutes after Wave 3 for SMS responses

**Maximum Rounds**:
- How many times to call each staff member
- Range: 1-5 rounds
- Default: 3 rounds
- Example: If you have 4 staff and set 3 rounds, system makes up to 12 calls total (4 × 3)

#### Step 4: Customize Message Template

Use the **Message Template Builder**:

1. **Available Variables** (click to insert):
   - `employeeName` - Staff member first name
   - `patientName` - Patient name (privacy-safe format)
   - `date` - Shift date (short format, e.g., "Jan 23")
   - `time` - Shift start time
   - `startTime` - Start time in 24-hour format
   - `endTime` - End time in 24-hour format
   - `suburb` - Location suburb

2. **Building Your Message**:
   - Click variable buttons to insert them at cursor position
   - Variables are automatically replaced with actual data during calls
   - Keep message clear and concise (30-45 seconds recommended)

3. **Example Template**:
   ```
   Hi {employeeName}, we have an urgent shift for {patientName} 
   on {date} at {time}. It's in {suburb}. Press 1 to accept 
   this shift, or press 2 to decline.
   ```

4. **Preview**: View how your message will sound with example data

5. **Reset**: Click "Reset to default template" to restore original

#### Step 5: Save Settings

Click **"Save Settings"** to apply changes.

### For Staff: Receiving Calls

When you receive an outbound call:

1. **Listen to the message**: System will play personalized information about the shift
2. **Press 1** to accept the shift
   - Job immediately assigned to you
   - Confirmation SMS sent
   - All other calls cancelled
3. **Press 2** to decline
   - System notes your decline
   - Moves to next staff member
4. **No response**: System waits 15 seconds, then moves to next person

**Important**: 
- Only the first person to press 1 gets the shift
- You can decline shifts without penalty
- Calls continue in rounds until someone accepts or rounds are exhausted

---

## Technical Documentation

### File Structure

```
voice-agent/
├── src/
│   ├── config/
│   │   └── outbound-calling.ts          # Configuration & defaults
│   ├── services/
│   │   ├── calling/
│   │   │   ├── audio-pregenerator.ts    # ElevenLabs audio generation
│   │   │   ├── twiml-generator.ts       # TwiML XML generation
│   │   │   ├── outbound-call-processor.ts  # Core calling logic
│   │   │   └── call-outcome-handler.ts  # Accept/decline handling
│   │   ├── queue/
│   │   │   └── outbound-call-queue.ts   # Bull queue management
│   │   ├── sms/
│   │   │   ├── wave-processor.ts        # ✓ Updated (Phase 5)
│   │   │   └── job-assignment-service.ts # ✓ Updated (Phase 5)
│   │   └── airtable/
│   │       ├── call-log-service.ts      # ✓ Extended (Phase 4)
│   │       └── types.ts                 # ✓ Extended (Phase 1)
│   ├── workers/
│   │   └── outbound-call-worker.ts      # Bull queue worker
│   ├── types/
│   │   └── call-log.ts                  # ✓ Extended (Phase 1)
│   └── app/
│       └── api/
│           └── outbound/
│               ├── response/route.ts    # DTMF input handler
│               ├── status/route.ts      # Twilio status callbacks
│               ├── twiml/route.ts       # TwiML generation
│               ├── timeout/route.ts     # No input timeout
│               └── audio/[callId]/route.ts  # Audio file server
│
provider-portal/
├── app/
│   ├── dashboard/
│   │   └── settings/
│   │       ├── page.tsx                 # ✓ Updated (Phase 6)
│   │       └── outbound-calling/
│   │           └── page.tsx             # NEW (Phase 6)
│   └── api/
│       └── provider/
│           └── outbound-calling/
│               └── route.ts             # NEW (Phase 6)
```

### Key Functions

#### Wave Integration
```typescript
// voice-agent/src/services/sms/wave-processor.ts

// After Wave 3 completes with no acceptance
if (waveNumber === 3 && jobStillOpen) {
  const provider = await getProviderById(providerId);
  
  if (provider.outboundCallEnabled) {
    await scheduleOutboundCallAfterSMS(
      occurrenceId,
      waitMinutes,
      {
        occurrenceId,
        providerId,
        staffPoolIds,
        maxRounds,
        jobDetails: { ... }
      }
    );
  }
}
```

#### Calling Logic
```typescript
// voice-agent/src/services/calling/outbound-call-processor.ts

export async function processOutboundCall(jobData) {
  // 1. Check job still open
  // 2. Get employee details
  // 3. Generate personalized audio
  // 4. Create call log
  // 5. Initiate Twilio call
  // 6. Track attempts
}
```

#### Response Handling
```typescript
// voice-agent/src/services/calling/call-outcome-handler.ts

export async function handleJobAcceptance(occurrenceId, employeeId) {
  // 1. Assign job to employee
  // 2. Cancel all remaining calls
  // 3. Update call log
  // 4. Send confirmation SMS
}

export async function handleJobDecline(jobData, employeeId) {
  // 1. Log decline
  // 2. Schedule next call attempt
}
```

### API Endpoints

#### Voice Agent APIs

**`GET /api/outbound/twiml`**
- Generates initial call TwiML
- Parameters: `callId`, `occurrenceId`, `employeeId`, `round`
- Returns: XML TwiML with Gather and Play

**`POST /api/outbound/response`**
- Handles DTMF input (1 or 2)
- Body: Twilio form data with `Digits`, `CallSid`
- Returns: Confirmation or decline TwiML

**`POST /api/outbound/status`**
- Handles Twilio status callbacks
- Processes: answered, completed, no-answer, busy, failed
- Schedules next attempts as needed

**`GET /api/outbound/audio/[callId]`**
- Serves pre-generated audio files
- Content-Type: `audio/basic` (µ-law 8kHz)
- Cached for 1 hour

#### Provider Portal APIs

**`GET /api/provider/outbound-calling`**
- Fetches provider's outbound calling settings
- Requires authentication
- Returns provider record with settings

**`PATCH /api/provider/outbound-calling`**
- Updates outbound calling settings
- Body: `{ enabled, waitMinutes, maxRounds, messageTemplate }`
- Validates ranges and requirements

---

## Testing Guide

### Manual Testing Checklist

#### Prerequisites
```bash
# Ensure services are running
cd voice-agent
npm run dev  # Or railway up

# Check Redis connection
redis-cli ping  # Should return PONG
```

#### Test Scenario 1: Basic Flow

1. **Setup**:
   - Create test job with 3 staff in pool
   - Provider settings:
     - Outbound Call Enabled: ✓
     - Wait Minutes: 1 (for testing)
     - Max Rounds: 2
   - Ensure staff have valid phone numbers

2. **Execute**:
   - Trigger Wave 1, 2, 3 SMS (no one accepts)
   - Wait 1 minute
   - Verify calls start

3. **Verify**:
   ```bash
   # Check queue
   redis-cli LRANGE bull:outbound-calls:waiting 0 -1
   
   # Check logs
   tail -f logs/voice-agent.log | grep outbound
   ```

4. **Expected Results**:
   - First staff member receives call
   - Hears personalized message
   - Can press 1 or 2

#### Test Scenario 2: Acceptance

1. **Action**: Staff member presses 1
2. **Expected**:
   - Job assigned to that staff member
   - Confirmation SMS sent
   - All remaining calls cancelled
   - Call log updated with outcome "Accepted"

#### Test Scenario 3: Decline

1. **Action**: Staff member presses 2
2. **Expected**:
   - Call log updated with outcome "Declined"
   - Next staff member called immediately
   - Process continues

#### Test Scenario 4: No Answer

1. **Action**: Staff member doesn't answer
2. **Expected**:
   - After 30 seconds, call times out
   - Call log updated with outcome "No Answer"
   - Next staff member called

#### Test Scenario 5: Round Robin

1. **Setup**: 2 staff, 2 rounds, all decline
2. **Expected Call Order**:
   - Round 1: Staff A → Staff B
   - Round 2: Staff A → Staff B
   - Total: 4 calls
   - Final status: UNFILLED_AFTER_CALLS

### Automated Testing

```typescript
// Example test
describe('Outbound Calling', () => {
  it('should schedule calls after Wave 3', async () => {
    const result = await scheduleOutboundCallAfterSMS(
      'rec123',
      15,
      mockJobData
    );
    
    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();
  });
  
  it('should handle acceptance correctly', async () => {
    const result = await handleJobAcceptance(
      'rec123',
      'emp456',
      'CA789'
    );
    
    expect(result.success).toBe(true);
  });
});
```

---

## Troubleshooting

### Common Issues

#### 1. Calls Not Starting

**Symptoms**: Wave 3 completes but no calls initiated

**Checklist**:
- [ ] Is outbound calling enabled for provider?
  ```sql
  SELECT "Outbound Call Enabled" FROM Providers WHERE id = ?
  ```
- [ ] Is Redis connected?
  ```bash
  redis-cli ping
  ```
- [ ] Is worker running?
  ```bash
  ps aux | grep "outbound-call-worker"
  ```
- [ ] Check logs:
  ```bash
  grep "outbound_calling_scheduling" logs/*.log
  ```

**Solution**: Enable feature in Provider Portal → Outbound Calling Settings

#### 2. Audio Generation Fails

**Symptoms**: Calls connect but no audio plays

**Checklist**:
- [ ] Is ElevenLabs API key valid?
- [ ] Is `/tmp/outbound-audio/` directory writable?
- [ ] Check audio generation logs:
  ```bash
  grep "audio_generation" logs/*.log
  ```

**Solution**: 
```bash
# Create directory if missing
mkdir -p /tmp/outbound-audio
chmod 777 /tmp/outbound-audio

# Verify ElevenLabs key
curl https://api.elevenlabs.io/v1/voices \
  -H "xi-api-key: $ELEVENLABS_API_KEY"
```

#### 3. DTMF Not Working

**Symptoms**: Staff presses 1 or 2 but nothing happens

**Checklist**:
- [ ] Is response webhook configured in Twilio?
- [ ] Is response API route accessible?
- [ ] Check webhook logs in Twilio console

**Solution**: Verify webhook URL:
```
https://your-domain.com/api/outbound/response?callId={callId}&occurrenceId={occurrenceId}&employeeId={employeeId}&round={round}
```

#### 4. Calls Continue After Acceptance

**Symptoms**: Multiple staff receive calls for same job

**Possible Causes**:
- Race condition in job assignment
- Queue not properly cancelled

**Solution**: Check cancel logic:
```bash
grep "outbound_calls_cancelled" logs/*.log
```

### Debug Mode

Enable verbose logging:

```typescript
// voice-agent/src/lib/logger.ts
export const logger = winston.createLogger({
  level: 'debug',  // Change from 'info' to 'debug'
  // ...
});
```

---

## Monitoring & Logs

### Key Log Types

Search logs using these types:

```bash
# Queue operations
grep "outbound_call_scheduled" logs/*.log
grep "outbound_worker_processing" logs/*.log

# Call processing
grep "outbound_call_processing" logs/*.log
grep "outbound_call_initiated" logs/*.log

# Outcomes
grep "job_acceptance_start" logs/*.log
grep "job_decline_start" logs/*.log
grep "no_answer_start" logs/*.log

# Cancellation
grep "outbound_calls_cancelled" logs/*.log

# Errors
grep "outbound.*error" logs/*.log
```

### Metrics to Monitor

1. **Call Success Rate**:
   ```sql
   SELECT 
     COUNT(*) as total_calls,
     SUM(CASE WHEN "Call Outcome" = 'Accepted' THEN 1 ELSE 0 END) as accepted,
     SUM(CASE WHEN "Call Outcome" = 'Declined' THEN 1 ELSE 0 END) as declined,
     SUM(CASE WHEN "Call Outcome" = 'No Answer' THEN 1 ELSE 0 END) as no_answer
   FROM "Call Logs"
   WHERE "Call Purpose" = 'Outbound Job Offer'
     AND "Started At" >= DATE_SUB(NOW(), INTERVAL 7 DAY)
   ```

2. **Average Rounds to Fill**:
   ```sql
   SELECT AVG("Attempt Round") as avg_rounds
   FROM "Call Logs"
   WHERE "Call Outcome" = 'Accepted'
     AND "Call Purpose" = 'Outbound Job Offer'
   ```

3. **Unfilled Rate**:
   ```sql
   SELECT 
     COUNT(*) as total_jobs,
     SUM(CASE WHEN "Status" = 'UNFILLED_AFTER_CALLS' THEN 1 ELSE 0 END) as unfilled
   FROM "Job Occurrences"
   WHERE "Created At" >= DATE_SUB(NOW(), INTERVAL 7 DAY)
   ```

### Dashboard Queries

Add these to your monitoring dashboard:

```typescript
// Real-time queue status
const queueStats = await outboundCallQueue.getJobCounts();
console.log({
  waiting: queueStats.waiting,
  active: queueStats.active,
  completed: queueStats.completed,
  failed: queueStats.failed
});

// Recent calls
const recentCalls = await airtableClient.getRecentCallLogs({
  purpose: 'Outbound Job Offer',
  limit: 50
});
```

---

## Performance Considerations

### Scalability

- **Concurrent Calls**: Worker processes 5 calls simultaneously
- **Queue Capacity**: Redis handles 10,000+ jobs easily
- **Audio Storage**: `/tmp` files auto-cleanup after 24 hours

### Optimization Tips

1. **Audio Pre-generation**: Audio files are cached and reused when possible
2. **Database Calls**: Minimized through strategic caching
3. **Queue Priority**: Outbound calls have priority 10 (high priority)

### Cost Estimation

Per job with 4 staff, 3 rounds, if all calls complete:
- **Twilio**: 12 calls × $0.0130/min × 1min avg = **$0.16**
- **ElevenLabs**: 12 audio generations × $0.30/1K chars × 150 chars = **$0.54**
- **Total**: **~$0.70 per fully-exhausted job**

Most jobs fill before all rounds, reducing actual cost significantly.

---

## Security Considerations

### Authentication

- All Provider Portal APIs require authenticated session
- Twilio webhooks validated via signature (if enabled)
- No sensitive data in webhook URLs

### Data Privacy

- Patient names are privacy-safe format (First Last Initial)
- Staff phone numbers stored securely in Airtable
- Call recordings not enabled by default

### Rate Limiting

- 5 concurrent outbound calls max
- 1-minute delay between rounds
- Maximum 5 rounds configurable

---

## Future Enhancements

Potential improvements for future versions:

1. **Call Recording**: Optional call recording for quality assurance
2. **Multi-language Support**: Support for non-English messages
3. **Advanced Scheduling**: Different wait times per time of day
4. **Analytics Dashboard**: Visual analytics for call performance
5. **SMS Fallback**: Send SMS if call fails multiple times
6. **Custom Voices**: Allow providers to choose ElevenLabs voice
7. **Priority Calling**: VIP staff get called first
8. **Shift Preferences**: Skip staff who've declined similar shifts

---

## Support & Maintenance

### Regular Maintenance Tasks

**Daily**:
- Monitor error logs
- Check queue health
- Verify audio cleanup

**Weekly**:
- Review call success rates
- Analyze unfilled jobs
- Check ElevenLabs usage

**Monthly**:
- Review provider configurations
- Optimize message templates
- Update documentation

### Getting Help

**Technical Issues**: Check logs first, then contact development team  
**Configuration Questions**: Review this guide or Provider Portal tooltips  
**Feature Requests**: Submit via project management system

---

## Changelog

### Version 1.0 (January 22, 2026)
- ✅ Initial release
- ✅ Full implementation of phases 1-6
- ✅ Provider Portal UI
- ✅ Complete documentation
- ✅ Testing suite

---

## Conclusion

The Outbound Calling feature is now **fully implemented and operational**. This document provides everything needed to configure, use, monitor, and troubleshoot the system. 

For the latest updates and changes, refer to the project repository and changelog.

**Status**: Production Ready ✅
