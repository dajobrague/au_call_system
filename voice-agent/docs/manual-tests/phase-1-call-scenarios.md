# Phase 1 Call Scenarios - Manual Testing

## Overview
This document outlines the expected behavior for the initial Twilio voice webhook implementation (Step 1 of the voice agent setup).

## Call Flow Behavior

### Initial Call (First POST from Twilio)
**Expected Response:**
- Play welcome prompt: "Welcome. After the tone, please say your client number or enter it using the keypad, then press pound."
- Start `<Gather>` with:
  - `input="speech dtmf"`
  - `language="en-US"`
  - `timeout="10"` seconds
  - `speechTimeout="3"` seconds
  - `finishOnKey="#"`
  - Posts back to same endpoint `/api/twilio/voice`

### Successful Input (Second POST with SpeechResult or Digits)
**Trigger:** User speaks numbers or enters DTMF digits followed by #
**Expected Response:**
- Play acknowledgment: "Thank you. We received your response."
- Hang up call cleanly

**Test Cases:**
- Speaking: "one two three four five"
- DTMF: "12345#"
- Mixed: Speaking "twelve" then pressing "34#"

### No Input - First Timeout
**Trigger:** User doesn't speak or press keys within timeout
**Expected Response:**
- Play shorter reprompt: "Please say your client number or enter it using the keypad, followed by the pound key."
- Start another `<Gather>` with same settings
- This is attempt #1 (retry)

### No Input - Second Timeout
**Trigger:** User doesn't respond to reprompt
**Expected Response:**
- Play goodbye message: "We didn't receive your input. Thank you for calling. Goodbye."
- Hang up call

## Test Scenarios

### Scenario 1: Happy Path - Speech Input
1. Call Twilio number
2. Hear welcome prompt
3. Say "one two three four five" clearly
4. Hear "Thank you. We received your response."
5. Call ends

### Scenario 2: Happy Path - DTMF Input
1. Call Twilio number
2. Hear welcome prompt
3. Press "12345#" on keypad
4. Hear "Thank you. We received your response."
5. Call ends

### Scenario 3: Timeout with Recovery
1. Call Twilio number
2. Hear welcome prompt
3. Wait without speaking/pressing keys
4. Hear reprompt after ~10 seconds
5. Say "six seven eight"
6. Hear "Thank you. We received your response."
7. Call ends

### Scenario 4: Double Timeout
1. Call Twilio number
2. Hear welcome prompt
3. Wait without speaking/pressing keys
4. Hear reprompt after ~10 seconds
5. Wait again without input
6. Hear "We didn't receive your input. Thank you for calling. Goodbye."
7. Call ends

## Success Criteria

✅ **Audio Quality:** All prompts are clear and audible
✅ **Speech Recognition:** Spoken numbers are recognized reliably
✅ **DTMF Recognition:** Keypad input works correctly
✅ **Timeout Handling:** Appropriate fallbacks for no input
✅ **Call Termination:** All scenarios end cleanly without hanging calls
✅ **Webhook Logs:** Vercel logs show all POST requests with 200 OK responses
✅ **Twilio Debugger:** No errors in Twilio Console → Monitor → Debugger

## Troubleshooting Checklist

### Audio Issues
- [ ] Confirm Twilio number has Voice capability enabled
- [ ] Check webhook URL uses HTTPS
- [ ] Verify webhook points to correct endpoint `/api/twilio/voice`
- [ ] Ensure webhook method is set to POST

### Speech Recognition Issues
- [ ] Test in quiet environment
- [ ] Speak clearly and at normal pace
- [ ] Confirm `language="en-US"` in gather
- [ ] Check `input="speech"` is included

### DTMF Issues
- [ ] Verify `input="dtmf"` in gather
- [ ] Confirm `finishOnKey="#"` is set
- [ ] Test with different phones/carriers

### Webhook Issues
- [ ] Check Vercel deployment is successful
- [ ] Verify environment variables are set in Vercel
- [ ] Ensure route responds within 2 seconds
- [ ] Check for any 500 errors in logs

## Environment Setup Notes

### Required Environment Variables
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token  
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

### Twilio Number Configuration
- **Voice Webhook URL:** `https://your-app.vercel.app/api/twilio/voice`
- **HTTP Method:** POST
- **Recording:** Leave empty for now
- **Status Callback:** Leave empty for now

## Next Steps
Once all scenarios pass consistently:
1. Move to Step 2: FSM/state backbone implementation
2. Add Airtable integration for client lookup
3. Implement recording functionality
4. Add more sophisticated error handling
