# Next Steps - Twilio Credential Separation

## ✅ What's Been Done

The credential separation has been **successfully implemented**:

- ✅ Environment detection and validation
- ✅ Automatic credential selection (test vs production)
- ✅ Phone number format validation (+1 US vs +61 AU)
- ✅ Safety checks to prevent credential misuse
- ✅ Enhanced start script with validations
- ✅ Comprehensive documentation

## 🚀 What You Need to Do Now

### Step 1: Create `.env.example` File

The template file couldn't be created automatically due to `.gitignore`. You need to create it manually:

```bash
cd voice-agent
```

Then create a file named `.env.example` and copy the content from `ENV_SETUP_NOTE.md` into it.

**OR** use this command (if you have the content ready):

```bash
cat > .env.example << 'EOF'
# [Copy the entire content from ENV_SETUP_NOTE.md here]
EOF
```

### Step 2: Set Up Your Local Test Environment

1. **Copy the template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local` with your TEST credentials:**
   ```bash
   # Use your US Twilio test number
   TWILIO_ACCOUNT_SID=ACxxxxxxxx...  # Your test Account SID
   TWILIO_AUTH_TOKEN=xxxxx...        # Your test Auth Token
   TWILIO_PHONE_NUMBER=+1XXXXXXXXXX  # Your US test number
   TWILIO_MESSAGING_SID=MGxxxxxxxx... # Your test Messaging SID
   
   # Plus all other required credentials:
   # - AIRTABLE_API_KEY
   # - AIRTABLE_BASE_ID
   # - REDIS_URL
   # - REDIS_TOKEN
   # - ELEVENLABS_API_KEY
   # - OPENAI_API_KEY
   # - AWS credentials
   ```

3. **Save the file**

### Step 3: Test Local Setup

1. **Start the test environment:**
   ```bash
   ./start-voice-agent.sh
   ```

2. **Look for these validation messages:**
   ```
   ✅ Test environment validated
      📞 Phone: +1XXXXXXXXXX (US test number)
   
   ✅ Twilio credentials validated: TEST mode (US number)
   
   🔐 Twilio Config: DEVELOPMENT mode
      📞 Phone: +1XXXXXXXXXX (US)
   ```

3. **If you see any errors:**
   - Check that `.env.local` exists
   - Verify all required credentials are set
   - Make sure phone number starts with `+1`
   - See `TWILIO_SETUP.md` troubleshooting section

### Step 4: Configure Twilio Console (Test Number)

1. **Go to Twilio Console:**
   https://console.twilio.com/

2. **Navigate to:**
   Phone Numbers → Manage → Active numbers

3. **Select your US test number**

4. **Under "Voice & Fax" → "A CALL COMES IN":**
   - **Webhook:** `https://climbing-merely-joey.ngrok-free.app/stream`
   - **Method:** `POST`

5. **Click Save**

### Step 5: Test with a Real Call

1. **Call your US test number**

2. **Verify:**
   - Call connects
   - You hear the recording disclaimer
   - Voice prompts work
   - System responds to your input

3. **Check logs:**
   ```bash
   tail -f voice-agent/server.log
   ```

### Step 6: Set Up Production Credentials in Vercel

1. **Go to Vercel Dashboard:**
   https://vercel.com/dashboard

2. **Select your project**

3. **Go to:** Settings → Environment Variables

4. **Add the following for "Production" environment:**
   ```
   PROD_TWILIO_ACCOUNT_SID=ACxxxxxxxx...     # Production Account SID
   PROD_TWILIO_AUTH_TOKEN=xxxxx...           # Production Auth Token
   PROD_TWILIO_PHONE_NUMBER=+61XXXXXXXXX     # Australian number
   PROD_TWILIO_MESSAGING_SID=MGxxxxxxxx...   # Production Messaging SID
   
   NODE_ENV=production
   APP_ENV=production
   
   # Plus all other required credentials (same as .env.local but production values)
   ```

5. **Important:** Make sure `PROD_TWILIO_PHONE_NUMBER` starts with `+61` (Australian)

### Step 7: Deploy to Production

1. **Deploy to Vercel:**
   ```bash
   cd voice-agent
   npx vercel --prod
   ```

2. **Check deployment logs for validation:**
   - Look for: `✅ Twilio credentials validated: PRODUCTION mode (AU number)`
   - Should NOT see any safety errors

### Step 8: Configure Twilio Console (Production Number)

1. **Go to Twilio Console:**
   https://console.twilio.com/

2. **Navigate to:**
   Phone Numbers → Manage → Active numbers

3. **Select your Australian production number**

4. **Under "Voice & Fax" → "A CALL COMES IN":**
   - **Webhook:** `https://your-app.vercel.app/api/twilio/voice`
   - **Method:** `POST`

5. **Under "Status Callback URL":**
   - **URL:** `https://your-app.vercel.app/api/twilio/status`

6. **Click Save**

### Step 9: Test Production

1. **Call your Australian production number**

2. **Verify:**
   - Call connects
   - Voice prompts work correctly
   - System functions as expected

3. **Check Vercel logs:**
   - Vercel Dashboard → Your Project → Logs
   - Look for any errors or warnings

## 📋 Quick Reference

### Local Testing
```bash
cd voice-agent
./start-voice-agent.sh
# Uses: US test number (+1)
# From: .env.local
# Via: ngrok tunnel
```

### Production Deployment
```bash
cd voice-agent
npx vercel --prod
# Uses: Australian number (+61)
# From: Vercel environment variables
# Via: Vercel deployment
```

### Checking Credentials in Use

The system will log which credentials are being used on startup:

**Test Mode:**
```
✅ Twilio credentials validated: TEST mode (US number)
🔐 Twilio Config: DEVELOPMENT mode
   📞 Phone: +1XXXXXXXXXX (US)
```

**Production Mode:**
```
✅ Twilio credentials validated: PRODUCTION mode (AU number)
🔐 Twilio Config: PRODUCTION mode
   📞 Phone: +61XXXXXXXXX (AU)
```

## ⚠️ Important Reminders

1. **Never commit `.env.local`** - It's gitignored for security
2. **Never use production credentials locally** - System will warn you
3. **Always test locally before deploying** - Use the test number
4. **Check phone number format** - US (+1) for test, AU (+61) for production
5. **Monitor logs** - Both local and Vercel logs for errors

## 📖 Documentation

- **Complete Setup Guide:** `TWILIO_SETUP.md`
- **Implementation Details:** `CREDENTIAL_SEPARATION_SUMMARY.md`
- **Environment Template:** `ENV_SETUP_NOTE.md` (content for `.env.example`)
- **Troubleshooting:** See `TWILIO_SETUP.md` troubleshooting section

## 🆘 If Something Goes Wrong

1. **Check the documentation:**
   - Start with `TWILIO_SETUP.md`
   - Review troubleshooting section

2. **Verify credentials:**
   - Local: Check `.env.local` file
   - Production: Check Vercel environment variables

3. **Check phone numbers:**
   - Test: Should start with `+1`
   - Production: Should start with `+61`

4. **Review logs:**
   - Local: `tail -f voice-agent/server.log`
   - Production: Vercel Dashboard → Logs

5. **Common errors and fixes:**
   - `.env.local not found` → Create it from `.env.example`
   - `Wrong phone format` → Check +1 vs +61
   - `Missing credentials` → Add all required env vars
   - `Webhook not working` → Verify URL in Twilio Console

## ✅ Success Checklist

- [ ] `.env.example` file created manually
- [ ] `.env.local` created with US test credentials
- [ ] Local test environment starts successfully
- [ ] US test number configured in Twilio Console
- [ ] Test call to US number works
- [ ] Production credentials set in Vercel
- [ ] Deployed to Vercel successfully
- [ ] Australian number configured in Twilio Console
- [ ] Test call to Australian number works

---

You're all set! The system is now safely configured to keep test and production credentials separate. 🎉

