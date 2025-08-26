# Phase 1 Call Scenarios - Manual Testing

## Test Scenarios

### Scenario 1: Happy Path (Speech Input)
1. **Call** the Twilio number
2. **Hear**: "Welcome. After the tone, please say your client number or enter it using the keypad, then press pound."
3. **Say**: "One two three four five"
4. **Hear**: "Thank you. We received your response."
5. **Result**: Call ends

**Expected**: ✅ Successful flow with speech recognition

### Scenario 2: Happy Path (DTMF Input)
1. **Call** the Twilio number
2. **Hear**: Welcome prompt
3. **Press**: `12345#`
4. **Hear**: "Thank you. We received your response."
5. **Result**: Call ends

**Expected**: ✅ Successful flow with keypad input

### Scenario 3: No Input (First Attempt)
1. **Call** the Twilio number
2. **Hear**: Welcome prompt
3. **Do**: Nothing (wait for timeout)
4. **Hear**: "We didn't receive your input. Please try again."
5. **Say**: "Six seven eight nine"
6. **Hear**: "Thank you. We received your response."
7. **Result**: Call ends

**Expected**: ✅ Retry logic works, second attempt succeeds

### Scenario 4: No Input (Both Attempts)
1. **Call** the Twilio number
2. **Hear**: Welcome prompt
3. **Do**: Nothing (wait for timeout)
4. **Hear**: "We didn't receive your input. Please try again."
5. **Do**: Nothing (wait for timeout again)
6. **Hear**: "We didn't receive your input. Goodbye."
7. **Result**: Call ends

**Expected**: ✅ Call ends after max retries

### Scenario 5: Mixed Input Types
1. **Call** the Twilio number
2. **Hear**: Welcome prompt
3. **Say**: "One two" (without pressing #)
4. **Press**: `34#`
5. **Hear**: "Thank you. We received your response."
6. **Result**: Call ends

**Expected**: ✅ Both speech and DTMF are captured

## Curl Tests (Development)

### Test 1: Initial Call
```bash
curl -X POST http://localhost:3000/api/twilio/voice \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123" \
  -d "From=+1234567890" \
  -d "To=+1987654321"
```

**Expected Response**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" language="en-US" timeout="10" speechTimeout="3" finishOnKey="#" action="/api/twilio/voice" method="POST">
    <Say voice="alice">Welcome. After the tone, please say your client number or enter it using the keypad, then press pound.</Say>
  </Gather>
  <Say voice="alice">We didn't receive your input. Please try again.</Say>
  <Redirect>/api/twilio/voice</Redirect>
</Response>
```

### Test 2: With Speech Input
```bash
curl -X POST http://localhost:3000/api/twilio/voice \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123" \
  -d "SpeechResult=one two three four five"
```

**Expected Response**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you. We received your response.</Say>
  <Hangup/>
</Response>
```

### Test 3: With DTMF Input
```bash
curl -X POST http://localhost:3000/api/twilio/voice \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123" \
  -d "Digits=12345"
```

**Expected Response**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you. We received your response.</Say>
  <Hangup/>
</Response>
```

### Test 4: Timeout/Retry
```bash
curl -X POST http://localhost:3000/api/twilio/voice \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123" \
  -d "GatherAttempt=1"
```

**Expected Response**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" language="en-US" timeout="10" speechTimeout="3" finishOnKey="#" action="/api/twilio/voice" method="POST">
    <Say voice="alice">We didn't receive your input. Please try again.</Say>
  </Gather>
  <Say voice="alice">We didn't receive your input. Goodbye.</Say>
  <Hangup/>
</Response>
```

## Success Criteria

- [ ] All 5 phone call scenarios work as expected
- [ ] All 4 curl tests return correct TwiML
- [ ] No errors in Vercel function logs
- [ ] Call audio is clear and prompts are audible
- [ ] Response times are under 2 seconds
- [ ] Webhook handles concurrent calls properly

## Notes

- Test with different phone numbers (mobile, landline)
- Test from different geographic locations
- Verify speech recognition accuracy with various accents
- Check DTMF tone detection reliability
- Monitor for any dropped calls or timeouts