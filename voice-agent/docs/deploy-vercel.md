# Vercel Deployment Guide

## Prerequisites

1. Vercel account
2. GitHub repository
3. Twilio account with phone number

## Deployment Steps

### 1. Environment Variables

In Vercel Dashboard → Project → Settings → Environment Variables:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
APP_ENV=production
```

### 2. Deploy

```bash
# From voice-agent directory
npx vercel --prod
```

Or connect GitHub repository for automatic deployments.

### 3. Configure Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com/)
2. Phone Numbers → Manage → Active numbers
3. Select your number
4. Voice & Fax → A CALL COMES IN:
   - **Webhook**: `https://your-app.vercel.app/api/twilio/voice`
   - **HTTP**: POST
5. Save

## Sanity Tests

### Test 1: GET (should return 405)
```bash
curl -i https://your-app.vercel.app/api/twilio/voice
```
**Expected**: `HTTP/2 405 Method Not Allowed`

### Test 2: POST (should return TwiML)
```bash
curl -i -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123" \
  -d "From=+1234567890" \
  -d "To=+1987654321" \
  https://your-app.vercel.app/api/twilio/voice
```
**Expected**: `HTTP/2 200 OK` with XML TwiML response

### Test 3: Real Phone Call
Call your Twilio number and verify:
- Welcome prompt plays
- Speech/DTMF input is accepted
- Acknowledgment is given
- Call ends gracefully

## Troubleshooting

### 404 Not Found
- Check that API route exists at `app/api/twilio/voice/route.ts`
- Verify deployment completed successfully
- Check Vercel function logs

### 500 Internal Server Error
- Check environment variables are set
- Review Vercel function logs
- Verify Twilio webhook signature (if enabled)

### No Audio/TwiML Issues
- Ensure Content-Type is `application/xml`
- Check TwiML syntax is valid
- Verify voice and language settings

## Project Structure

```
voice-agent/
├─ app/api/twilio/voice/route.ts  # Main webhook endpoint
├─ src/config/                    # Configuration
├─ src/lib/                       # Utilities
└─ docs/                          # Documentation
```

## Next Steps

After successful deployment:
1. Test with real phone calls
2. Monitor Vercel function logs
3. Set up error alerting
4. Plan Phase 2 (FSM) implementation
