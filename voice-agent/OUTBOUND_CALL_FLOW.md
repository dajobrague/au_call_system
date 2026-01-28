# Outbound Call Flow - Complete Logic Diagram

## Overview

This document visualizes the complete outbound calling flow from Wave 3 SMS completion through to job assignment or exhaustion.

---

## Full System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  WAVE 3 SMS COMPLETES (No acceptance after all 3 waves)        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                   ┌────────────────┐
                   │ Check Provider │
                   │   Settings     │
                   └────────┬───────┘
                            │
                ┌───────────┴───────────┐
                │                       │
         ┌──────▼──────┐         ┌─────▼──────┐
         │   Enabled   │         │  Disabled  │
         │   = true    │         │  = false   │
         └──────┬──────┘         └─────┬──────┘
                │                      │
                │                      ▼
                │               ┌─────────────┐
                │               │ STOP - Keep │
                │               │ job status  │
                │               └─────────────┘
                │
                ▼
     ┌─────────────────────┐
     │ Wait X minutes      │
     │ (configured value)  │
     └──────────┬──────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│  OUTBOUND CALLING PHASE BEGINS                                │
│  Queue job created with:                                      │
│  • occurrenceId                                               │
│  • staffPoolIds (in order)                                    │
│  • currentRound = 1                                           │
│  • currentStaffIndex = 0                                      │
│  • maxRounds (from provider config)                           │
│  • jobDetails (patient, date, time, etc.)                     │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  Worker picks up │
                  │  job from queue  │
                  └─────────┬────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │ Is job still     │
                  │ open?            │
                  └─────────┬────────┘
                            │
                ┌───────────┴────────────┐
                │                        │
         ┌──────▼──────┐          ┌─────▼──────┐
         │    YES      │          │     NO     │
         └──────┬──────┘          └─────┬──────┘
                │                       │
                │                       ▼
                │                ┌──────────────┐
                │                │ STOP - Job   │
                │                │ already taken│
                │                └──────────────┘
                │
                ▼
      ┌──────────────────┐
      │ Get employee     │
      │ details          │
      │ (name, phone)    │
      └─────────┬────────┘
                │
                ▼
      ┌──────────────────┐
      │ Generate audio   │
      │ with ElevenLabs  │
      │ (personalized)   │
      └─────────┬────────┘
                │
                ▼
      ┌──────────────────┐
      │ Create Call Log  │
      │ record           │
      └─────────┬────────┘
                │
                ▼
      ┌──────────────────┐
      │ Initiate Twilio  │
      │ call             │
      └─────────┬────────┘
                │
                ▼
     ┌────────────────────────┐
     │ Call Status?           │
     └────────┬───────────────┘
              │
     ┌────────┼────────┬────────────┐
     │        │        │            │
┌────▼───┐ ┌─▼───┐ ┌──▼────┐ ┌────▼────┐
│Answered│ │Busy │ │No Ans │ │ Failed  │
└────┬───┘ └──┬──┘ └───┬───┘ └────┬────┘
     │        │        │           │
     │        └────────┴───────────┤
     │                             │
     │                             ▼
     │                   ┌──────────────────┐
     │                   │ Log outcome      │
     │                   │ Schedule next    │
     │                   │ call attempt     │
     │                   └──────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  CALL ANSWERED - TwiML FLOW                                 │
│                                                             │
│  1. Play audio: "Hi {name}, we have a shift for            │
│                  {patient} on {date} at {time}..."         │
│                                                             │
│  2. Gather: "Press 1 to accept, Press 2 to decline"        │
│             Timeout: 15 seconds                            │
│             numDigits: 1                                   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  DTMF Response?   │
                    └─────────┬─────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────▼──────┐     ┌─────▼──────┐     ┌─────▼──────┐
    │  Press 1   │     │  Press 2   │     │  Timeout   │
    │  (Accept)  │     │ (Decline)  │     │ (No input) │
    └─────┬──────┘     └─────┬──────┘     └─────┬──────┘
          │                  │                   │
          ▼                  │                   │
┌──────────────────┐         │                   │
│ ACCEPTANCE FLOW  │         │                   │
│                  │         │                   │
│ 1. Check job     │         │                   │
│    still open    │         │                   │
│                  │         │                   │
│ 2. Assign job to │         │                   │
│    employee      │         │                   │
│                  │         │                   │
│ 3. Cancel ALL    │         │                   │
│    remaining     │         │                   │
│    calls in      │         │                   │
│    queue         │         │                   │
│                  │         │                   │
│ 4. Update call   │         │                   │
│    log:          │         │                   │
│    outcome =     │         │                   │
│    "Accepted"    │         │                   │
│    dtmf = "1"    │         │                   │
│                  │         │                   │
│ 5. Send          │         │                   │
│    confirmation  │         │                   │
│    SMS           │         │                   │
│                  │         │                   │
│ 6. Play TwiML:   │         │                   │
│    "Thank you!"  │         │                   │
└────────┬─────────┘         │                   │
         │                   │                   │
         ▼                   ▼                   ▼
    ┌────────┐      ┌────────────────┐  ┌────────────────┐
    │  DONE  │      │ DECLINE FLOW   │  │ TIMEOUT FLOW   │
    │        │      │                │  │                │
    │Job     │      │ 1. Update call │  │ 1. Update call │
    │assigned│      │    log:        │  │    log:        │
    └────────┘      │    outcome =   │  │    outcome =   │
                    │    "Declined"  │  │    "No Answer" │
                    │    dtmf = "2"  │  │                │
                    │                │  │ 2. Schedule    │
                    │ 2. Schedule    │  │    next call   │
                    │    next call   │  │                │
                    │                │  │ 3. Play TwiML: │
                    │ 3. Play TwiML: │  │    "No response│
                    │    "Thank you" │  │     received"  │
                    └────────┬───────┘  └────────┬───────┘
                             │                   │
                             └─────────┬─────────┘
                                       │
                                       ▼
                             ┌──────────────────┐
                             │ Schedule Next    │
                             │ Call Attempt     │
                             └─────────┬────────┘
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │ Increment staff index: │
                          │ currentStaffIndex++    │
                          └────────┬───────────────┘
                                   │
                       ┌───────────┴────────────┐
                       │                        │
              ┌────────▼────────┐      ┌───────▼────────┐
              │ More staff in   │      │ Reached end of │
              │ current round?  │      │ staff list?    │
              └────────┬────────┘      └───────┬────────┘
                       │                       │
                  ┌────▼────┐                  ▼
                  │   YES   │         ┌─────────────────┐
                  └────┬────┘         │ Increment round:│
                       │              │ currentRound++  │
                       │              │ Reset index: 0  │
                       │              └────────┬────────┘
                       │                       │
                       │              ┌────────▼────────┐
                       │              │ currentRound <= │
                       │              │ maxRounds?      │
                       │              └────────┬────────┘
                       │                       │
                       │              ┌────────┴────────┐
                       │              │                 │
                       │         ┌────▼────┐      ┌────▼────┐
                       │         │   YES   │      │    NO   │
                       │         └────┬────┘      └────┬────┘
                       │              │                │
                       └──────────────┴────────┐       │
                                               │       │
                                               ▼       ▼
                                    ┌──────────────────────┐
                                    │ Call next staff      │
                                    │ member in round      │
                                    │ (loop back to top)   │
                                    └──────────────────────┘
                                               │
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │ ALL ROUNDS EXHAUSTED │
                                    │                      │
                                    │ Mark job as:         │
                                    │ UNFILLED_AFTER_CALLS │
                                    │                      │
                                    │ Set reason:          │
                                    │ "No response after   │
                                    │  X rounds (Y calls   │
                                    │  to Z staff)"        │
                                    └──────────────────────┘
```

---

## Call Attempt Tracking

### Example Scenario:
```
Provider Config:
  • Wait Minutes: 15
  • Max Rounds: 3
  • Enabled: true

Staff Pool (in order):
  1. Alice (rec001)
  2. Bob (rec002)
  3. Charlie (rec003)
  4. Diana (rec004)
```

### Call Sequence:

```
┌─────────┬────────┬─────────────┬──────────┬────────┬──────────┐
│ Round   │ Staff  │ Phone       │ Outcome  │ DTMF   │ Next     │
├─────────┼────────┼─────────────┼──────────┼────────┼──────────┤
│ Round 1 │ Alice  │ +61401...   │ Decline  │ "2"    │ Bob      │
│ Round 1 │ Bob    │ +61402...   │ No Ans   │ -      │ Charlie  │
│ Round 1 │ Charlie│ +61403...   │ Decline  │ "2"    │ Diana    │
│ Round 1 │ Diana  │ +61404...   │ No Ans   │ -      │ Round 2  │
├─────────┼────────┼─────────────┼──────────┼────────┼──────────┤
│ Round 2 │ Alice  │ +61401...   │ No Ans   │ -      │ Bob      │
│ Round 2 │ Bob    │ +61402...   │ Accept   │ "1"    │ STOP!    │
└─────────┴────────┴─────────────┴──────────┴────────┴──────────┘

Result:
  ✅ Job assigned to Bob
  ❌ Cancelled: Charlie Round 2, Diana Round 2, All Round 3 calls
  📊 Total calls made: 6
  📊 Total calls avoided: 6 (cancelled after accept)
```

---

## Integration Points (Phase 5)

### 1. Wave 3 Completion Hook
```typescript
// In wave-processor.ts after Wave 3 completes

if (wave === 3 && acceptedCount === 0) {
  // Check if provider has outbound calling enabled
  const provider = await getProvider(providerId);
  
  if (provider.outboundCallEnabled) {
    // Schedule outbound calls
    await scheduleOutboundCallAfterSMS(
      occurrenceId,
      providerId,
      staffPoolIds,
      jobDetails,
      provider.outboundCallWaitMinutes || 15
    );
    
    logger.info('Outbound calls scheduled after Wave 3');
  }
}
```

### 2. Job Assignment Cancellation Hook
```typescript
// In job-assignment-service.ts when job is assigned

async function assignJob(occurrenceId: string, employeeId: string) {
  // ... existing assignment logic ...
  
  // Cancel any pending outbound calls
  await cancelOutboundCalls(occurrenceId);
  
  logger.info('Cancelled outbound calls for assigned job');
}
```

---

## Error Handling

### Graceful Failures:
```
┌─────────────────────────────────┐
│ Error Scenario                  │ Action Taken
├─────────────────────────────────┼───────────────────────────────┐
│ Job already assigned            │ Stop, don't call              │
│ Employee not found              │ Skip, move to next staff      │
│ Employee has no phone           │ Skip, move to next staff      │
│ Audio generation fails          │ Skip, move to next staff      │
│ Twilio call fails               │ Log, schedule next call       │
│ ElevenLabs API error            │ Skip, move to next staff      │
│ Redis connection lost           │ Worker pauses, retries        │
│ Call log creation fails         │ Warn, continue (non-critical) │
│ SMS sending fails               │ Warn, continue (non-critical) │
└─────────────────────────────────┴───────────────────────────────┘
```

---

## Call Log Fields

### Created at call initiation:
```typescript
{
  callSid: 'CA123...', // Twilio Call SID
  direction: 'Outbound',
  startedAt: '2026-01-22T10:30:00Z',
  providerId: 'rec123...',
  employeeId: 'rec456...',
  callPurpose: 'Outbound Job Offer',
  attemptRound: 2, // Which round (1, 2, or 3)
}
```

### Updated after call completes:
```typescript
{
  endedAt: '2026-01-22T10:30:45Z',
  seconds: 45,
  callOutcome: 'Accepted', // or Declined, No Answer, etc.
  dtmfResponse: '1', // or '2', or undefined
  relatedOccurrenceId: 'rec789...',
  notes: 'Job accepted via outbound call',
  rawPayload: '{"action":"accepted",...}'
}
```

---

## Queue Job Data Structure

```typescript
{
  occurrenceId: 'rec123456',
  providerId: 'rec789012',
  staffPoolIds: ['recEMP1', 'recEMP2', 'recEMP3'],
  currentRound: 1,
  currentStaffIndex: 0,
  maxRounds: 3,
  callAttemptsByStaff: {
    'recEMP1': 1, // Alice called 1 time
    'recEMP2': 2, // Bob called 2 times
    'recEMP3': 0  // Charlie not called yet
  },
  jobDetails: {
    patientName: 'John Smith',
    patientFirstName: 'John',
    patientLastInitial: 'S',
    scheduledDate: '2026-01-23',
    displayDate: 'January 23rd, 2026',
    startTime: '9:00 AM',
    endTime: '5:00 PM',
    suburb: 'Sydney CBD',
    messageTemplate: 'Hi {employeeName}, we have a shift...'
  }
}
```

---

## Configuration Reference

### Provider Table Fields:
- **Outbound Call Wait Minutes**: How long to wait after Wave 3 (default: 15)
- **Outbound Call Max Rounds**: How many rounds to call each staff (default: 3)
- **Outbound Call Message Template**: Custom message with variables
- **Outbound Call Enabled**: Enable/disable the feature (default: false)

### System Defaults:
```typescript
OUTBOUND_CALL_DEFAULTS = {
  waitMinutes: 15,
  maxRounds: 3,
  enabled: false
}
```

---

## Monitoring & Logging

### Key Log Points:
1. **Queue job created** - After Wave 3, scheduled with delay
2. **Worker picks up job** - Starting call processing
3. **Job status check** - Before making call
4. **Employee details retrieved** - Name and phone
5. **Audio generated** - ElevenLabs success
6. **Twilio call initiated** - Call SID logged
7. **Call answered** - TwiML served
8. **DTMF received** - Accept/decline
9. **Job assigned** - On acceptance
10. **Calls cancelled** - Remaining calls stopped
11. **Next call scheduled** - On decline/no-answer
12. **All rounds exhausted** - Job marked unfilled

### Log Type Field:
All logs include `type: 'outbound_...'` for easy filtering.

---

## Summary

✅ **Complete call flow from SMS to assignment**  
✅ **Round-robin calling with configurable rounds**  
✅ **DTMF handling for accept/decline**  
✅ **Graceful error handling at every step**  
✅ **Comprehensive logging for debugging**  
✅ **Race condition protection (job status checks)**  
✅ **Automatic cleanup after acceptance**  

**Ready for Phase 5 integration!** 🚀
