# Phase 2 Call Scenarios - FSM + State Management

## Test Environment Setup

- **Webhook URL**: `https://your-domain.vercel.app/api/twilio/voice`
- **Voice**: ElevenLabs Australian English (`ys3XeJJA4ArWMhRpcX1D`)
- **Language**: `en-AU`
- **Redis**: Upstash for state persistence

## Manual Test Scenarios

### T-201: Happy Path (Speech + DTMF)
**Objective**: Complete flow using both speech and DTMF input

**Steps**:
1. Call Twilio number
2. **Expected**: "Welcome. Please say your client number, or enter it on the keypad, then press pound."
3. **Action**: Speak "client one two three"
4. **Expected**: "Thanks. Now say your job number, or enter it, then press pound."
5. **Action**: Enter `456#` on keypad
6. **Expected**: "Thank you. We have your client number and job number." → Hangup

**Success Criteria**:
- ✅ Australian accent throughout
- ✅ State transitions: `collect_client_id` → `collect_job_number` → `done`
- ✅ Both inputs captured and confirmed
- ✅ Call ends cleanly

---

### T-202: No Input on Client ID
**Objective**: Test retry logic for client ID collection

**Steps**:
1. Call Twilio number
2. **Expected**: "Welcome. Please say your client number, or enter it on the keypad, then press pound."
3. **Action**: Stay silent (wait for timeout)
4. **Expected**: "Sorry, I didn't catch that. Please say your client number, or enter it, then press pound."
5. **Action**: Say "client seven eight nine"
6. **Expected**: "Thanks. Now say your job number, or enter it, then press pound."
7. **Action**: Enter `123#`
8. **Expected**: Confirmation → Hangup

**Success Criteria**:
- ✅ Reprompt after first silence
- ✅ Accepts input on second attempt
- ✅ Continues to job number collection
- ✅ `attempts.clientId` incremented correctly

---

### T-203: Exceed Attempts on Client ID
**Objective**: Test max attempts behavior for client ID

**Steps**:
1. Call Twilio number
2. **Expected**: Welcome prompt
3. **Action**: Stay silent (timeout)
4. **Expected**: Reprompt for client ID
5. **Action**: Stay silent again (timeout)
6. **Expected**: "Thanks for calling. Goodbye." → Hangup

**Success Criteria**:
- ✅ Two attempts maximum (welcome + 1 retry)
- ✅ Polite goodbye after max attempts
- ✅ Call ends cleanly
- ✅ State deleted from Redis

---

### T-204: No Input on Job Number
**Objective**: Test retry logic for job number collection

**Steps**:
1. Call and provide client ID successfully
2. **Expected**: "Thanks. Now say your job number, or enter it, then press pound."
3. **Action**: Stay silent (timeout)
4. **Expected**: "Sorry, I didn't get the job number. Please say it, or enter it, then press pound."
5. **Action**: Say "job four five six"
6. **Expected**: Confirmation → Hangup

**Success Criteria**:
- ✅ Reprompt specific to job number
- ✅ Accepts input on second attempt
- ✅ `attempts.jobNumber` incremented correctly

---

### T-205: Duplicate Twilio Retry
**Objective**: Test idempotency during network issues

**Steps**:
1. Call and provide client ID
2. During job number collection, simulate network retry
3. **Expected**: Same state maintained, no double-counting

**Success Criteria**:
- ✅ State remains consistent
- ✅ No duplicate attempt increments
- ✅ Same TwiML response for duplicate requests

---

## Curl Test Commands (Local Development)

### Initial Call (No Input)
```bash
curl -X POST http://localhost:3000/api/twilio/voice \
  -d "CallSid=TEST001" \
  -d "From=+1234567890" \
  -d "To=+1987654321" \
  -H "Content-Type: application/x-www-form-urlencoded"
```
**Expected**: Welcome prompt with `<Gather>` for client ID

### Client ID Provided (DTMF)
```bash
curl -X POST http://localhost:3000/api/twilio/voice \
  -d "CallSid=TEST001" \
  -d "Digits=12345" \
  -H "Content-Type: application/x-www-form-urlencoded"
```
**Expected**: Transition to job number collection

### Job Number Provided (Speech)
```bash
curl -X POST http://localhost:3000/api/twilio/voice \
  -d "CallSid=TEST001" \
  -d "SpeechResult=job 678" \
  -H "Content-Type: application/x-www-form-urlencoded"
```
**Expected**: Confirmation and hangup

### No Input (Timeout Test)
```bash
curl -X POST http://localhost:3000/api/twilio/voice \
  -d "CallSid=TEST002" \
  -d "From=+1234567890" \
  -d "To=+1987654321" \
  -H "Content-Type: application/x-www-form-urlencoded"
```
Then immediately:
```bash
curl -X POST http://localhost:3000/api/twilio/voice \
  -d "CallSid=TEST002" \
  -H "Content-Type: application/x-www-form-urlencoded"
```
**Expected**: Reprompt for client ID

## Redis State Verification

Check state in Redis during testing:
```bash
# View current call state
redis-cli -u $REDIS_URL GET call:TEST001

# List all call keys
redis-cli -u $REDIS_URL KEYS call:*

# Check TTL
redis-cli -u $REDIS_URL TTL call:TEST001
```

## Log Analysis

Look for structured JSON logs:
```json
{
  "level": "INFO",
  "message": "FSM state transition",
  "ts": "2024-01-01T12:00:00.000Z",
  "sid": "TEST001",
  "from": "+1234567890",
  "to": "+1987654321",
  "phase": "collect_client_id",
  "hasInput": true,
  "inputSource": "dtmf",
  "attempts": {"clientId": 1, "jobNumber": 0},
  "action": "transition",
  "latencyMs": 150
}
```

## Performance Targets

- **Latency**: < 2 seconds per request
- **Redis Operations**: < 100ms per get/set
- **Memory**: Minimal state payload (< 1KB per call)
- **TTL**: 1 hour default (3600 seconds)

## Definition of Done Checklist

- [ ] All 5 test scenarios pass
- [ ] Redis state persists correctly with TTL
- [ ] Structured logs show clean transitions
- [ ] Australian voice works throughout
- [ ] Error handling graceful (fallback prompts)
- [ ] Performance targets met
- [ ] State cleanup on completion
