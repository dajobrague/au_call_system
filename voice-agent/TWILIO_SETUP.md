# Twilio Setup Guide - Test vs Production

This guide explains how to safely manage **two separate Twilio configurations**:
- **TEST**: US Twilio number for local development with ngrok
- **PRODUCTION**: Australian Twilio number for production deployment on Vercel

## 🚨 IMPORTANT: Credential Separation

This project uses **different Twilio credentials** for testing and production:

| Environment | Location | Phone Number | Credentials | Webhook URL |
|------------|----------|--------------|-------------|-------------|
| **TEST** | Local (ngrok) | US (+1) | `TWILIO_*` in `.env.local` | `https://climbing-merely-joey.ngrok-free.app/stream` |
| **PRODUCTION** | Vercel | Australian (+61) | `PROD_TWILIO_*` in Vercel | `https://your-app.vercel.app/api/twilio/voice` |

## 📋 Quick Start

### For Local Testing (Test Credentials)

1. **Copy environment template:**
   ```bash
   cd voice-agent
   cp .env.example .env.local
   ```

2. **Edit `.env.local` with TEST credentials:**
   ```bash
   # Use your US Twilio test number
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_test_auth_token_here
   TWILIO_PHONE_NUMBER=+1XXXXXXXXXX  # US number
   TWILIO_MESSAGING_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Start test environment:**
   ```bash
   ./start-voice-agent.sh
   ```

4. **Configure Twilio Console (TEST NUMBER):**
   - Go to: https://console.twilio.com/
   - Navigate to: Phone Numbers → Manage → Active numbers
   - Select your **US test number**
   - Under "Voice & Fax" → "A CALL COMES IN":
     - Webhook: `https://climbing-merely-joey.ngrok-free.app/stream`
     - Method: `POST`
   - Click **Save**

### For Production Deployment (Production Credentials)

1. **Set environment variables in Vercel Dashboard:**
   - Go to your Vercel project
   - Settings → Environment Variables
   - Add the following for **Production** environment:

   ```
   # Production Twilio Credentials (Australian number)
   PROD_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   PROD_TWILIO_AUTH_TOKEN=your_production_auth_token_here
   PROD_TWILIO_PHONE_NUMBER=+61XXXXXXXXX  # Australian number
   PROD_TWILIO_MESSAGING_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   
   # Environment flags
   NODE_ENV=production
   APP_ENV=production
   
   # Other required variables
   AIRTABLE_API_KEY=...
   AIRTABLE_BASE_ID=...
   REDIS_URL=...
   REDIS_TOKEN=...
   ELEVENLABS_API_KEY=...
   OPENAI_API_KEY=...
   # ... (see .env.example for complete list)
   ```

2. **Deploy to Vercel:**
   ```bash
   cd voice-agent
   npx vercel --prod
   ```

3. **Configure Twilio Console (PRODUCTION NUMBER):**
   - Go to: https://console.twilio.com/
   - Navigate to: Phone Numbers → Manage → Active numbers
   - Select your **Australian production number**
   - Under "Voice & Fax" → "A CALL COMES IN":
     - Webhook: `https://your-app.vercel.app/api/twilio/voice`
     - Method: `POST`
   - Under "Status Callback URL":
     - URL: `https://your-app.vercel.app/api/twilio/status`
   - Click **Save**

## 🔐 Credential Management

### Environment Variable Naming Convention

The system automatically detects which credentials to use based on environment:

**Development/Test Mode** (`NODE_ENV=development`):
- Uses: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, etc.
- Expected: US phone number (+1)
- Source: `.env.local` file

**Production Mode** (`NODE_ENV=production`):
- Uses: `PROD_TWILIO_ACCOUNT_SID`, `PROD_TWILIO_AUTH_TOKEN`, etc.
- Falls back to regular `TWILIO_*` if `PROD_*` not set
- Expected: Australian phone number (+61)
- Source: Vercel environment variables

### Safety Validations

The system includes multiple safety checks:

✅ **Phone Number Format Validation**
- US numbers must start with `+1`
- Australian numbers must start with `+61`

✅ **Environment Mismatch Detection**
- Warns if using Australian number in development
- **BLOCKS** if using US number in production

✅ **Credential Source Validation**
- Checks `.env.local` exists for local testing
- Warns if `PROD_*` variables found locally

✅ **Runtime Logging**
- Logs which credentials are being used
- Shows phone number and region on startup

## 📞 Twilio Console Configuration

### Test Number (US)

**Phone Number:** Your US Twilio number (+1XXXXXXXXXX)

**Voice Configuration:**
- **Webhook URL:** `https://climbing-merely-joey.ngrok-free.app/stream`
- **HTTP Method:** POST
- **Fallback URL:** (optional)

**Messaging Configuration:**
- **Messaging Service SID:** Your test messaging SID

**Usage:**
- Local development only
- Testing with ngrok
- Safe to make mistakes

### Production Number (Australian)

**Phone Number:** Your Australian Twilio number (+61XXXXXXXXX)

**Voice Configuration:**
- **Webhook URL:** `https://your-app.vercel.app/api/twilio/voice`
- **HTTP Method:** POST
- **Status Callback:** `https://your-app.vercel.app/api/twilio/status`

**WebSocket Configuration:**
- **Media Stream URL:** `wss://your-app.vercel.app/api/twilio/voice-websocket`

**Messaging Configuration:**
- **Messaging Service SID:** Your production messaging SID

**Usage:**
- Production calls only
- Real customer interactions
- NDIS compliance requirements

## 🧪 Testing Your Setup

### Test Local Environment

1. Start the test environment:
   ```bash
   ./start-voice-agent.sh
   ```

2. Look for validation messages:
   ```
   ✅ Test environment validated
      📞 Phone: +1XXXXXXXXXX (US test number)
   
   ✅ Twilio credentials validated: TEST mode (US number)
   ```

3. Call your **US test number** and verify:
   - Call connects
   - Voice prompts play
   - System responds to input
   - Check logs in `server.log`

### Test Production Environment

1. Deploy to Vercel:
   ```bash
   npx vercel --prod
   ```

2. Check Vercel logs for validation:
   ```
   ✅ Twilio credentials validated: PRODUCTION mode (AU number)
   ```

3. Call your **Australian production number** and verify:
   - Call connects
   - Voice prompts play
   - System responds correctly
   - Check Vercel function logs

## 🚨 Troubleshooting

### Error: "PRODUCTION SAFETY ERROR: Using US test number in production!"

**Cause:** Production deployment is using test credentials

**Fix:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Ensure `PROD_TWILIO_ACCOUNT_SID`, `PROD_TWILIO_AUTH_TOKEN`, and `PROD_TWILIO_PHONE_NUMBER` are set
3. Ensure `PROD_TWILIO_PHONE_NUMBER` starts with `+61` (Australian)
4. Redeploy

### Warning: "Using Australian production number in development"

**Cause:** `.env.local` contains production credentials

**Fix:**
1. Edit `.env.local`
2. Replace with US test credentials
3. Ensure phone number starts with `+1`
4. Restart with `./start-voice-agent.sh`

### Error: ".env.local file not found"

**Cause:** No local environment file exists

**Fix:**
1. Copy template: `cp .env.example .env.local`
2. Edit `.env.local` with your TEST credentials
3. Save and restart

### Webhook Not Working

**For Local Testing:**
1. Verify ngrok is running: Check http://localhost:4040
2. Verify webhook URL in Twilio Console matches ngrok URL
3. Check ngrok logs: `tail -f ngrok.log`
4. Check server logs: `tail -f server.log`

**For Production:**
1. Verify Vercel deployment succeeded
2. Check webhook URL in Twilio Console: `https://your-app.vercel.app/api/twilio/voice`
3. Check Vercel function logs
4. Test webhook manually:
   ```bash
   curl -X POST https://your-app.vercel.app/api/twilio/voice \
     -d "CallSid=test123" \
     -d "From=+61400000000"
   ```

### Calls Going to Wrong Environment

**Symptom:** Test calls going to production or vice versa

**Fix:**
1. Check Twilio Console → Phone Numbers
2. Verify **each number** has the correct webhook:
   - US number → ngrok URL (test)
   - AU number → Vercel URL (production)
3. Update and save both configurations

## 📝 Best Practices

### Development Workflow

1. ✅ **Always use US test number locally**
2. ✅ **Never commit `.env.local`** (it's gitignored)
3. ✅ **Test thoroughly locally before deploying**
4. ✅ **Use `./start-voice-agent.sh` for local testing**
5. ✅ **Monitor server logs during testing**

### Production Deployment

1. ✅ **Always use Australian number in production**
2. ✅ **Set `PROD_*` variables in Vercel only**
3. ✅ **Never use production credentials locally**
4. ✅ **Test in production after deployment**
5. ✅ **Monitor Vercel logs for errors**

### Security

1. 🔒 **Never commit credentials to git**
2. 🔒 **Use separate Twilio accounts if possible**
3. 🔒 **Rotate credentials periodically**
4. 🔒 **Keep `.env.local` backed up securely**
5. 🔒 **Review Vercel environment variables regularly**

## 📖 Additional Resources

- [Twilio Console](https://console.twilio.com/)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [ngrok Dashboard](https://dashboard.ngrok.com/)
- [Project README](./README.md)
- [Production Deployment Guide](./docs/deploy-vercel.md)

## 🆘 Need Help?

If you encounter issues not covered here:

1. Check the logs:
   - Local: `tail -f server.log`
   - Production: Vercel Dashboard → Logs

2. Verify credentials:
   - Local: Check `.env.local`
   - Production: Check Vercel environment variables

3. Test webhook endpoints:
   - Local: `curl http://localhost:3001/health`
   - Production: `curl https://your-app.vercel.app/api/health`

4. Review this guide's troubleshooting section

---

**Last Updated:** October 2025  
**Version:** 1.0

