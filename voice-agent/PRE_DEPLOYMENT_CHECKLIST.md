# Pre-Deployment Checklist ✅

## Date: December 11, 2025
## Target: Railway Deployment

---

## ✅ COMPLETED FIXES

### 1. ✅ TypeScript Compilation
- **Status:** ✅ PASSED
- **Result:** `✓ Compiled successfully`
- **Linter:** No errors found
- **Build Command:** `npm run build` - Exit code 0

### 2. ✅ Removed Hardcoded Vercel URLs
All files now use Railway-first URL configuration:

#### Created Central Configuration:
- **File:** `src/config/base-url.ts`
- **Function:** `getBaseUrl()` 
- **Priority Order:**
  1. `RAILWAY_PUBLIC_DOMAIN` (Railway deployment) ✅
  2. `BASE_URL` (custom override)
  3. `APP_URL` (legacy support)
  4. `localhost:3000` (local dev)

#### Updated Files:
- ✅ `src/services/sms/job-notification-service.ts` - SMS URLs use Railway
- ✅ `src/services/sms/wave-processor.ts` - Wave SMS URLs use Railway
- ✅ `src/services/twilio/conference-manager.ts` - Conference callbacks use Railway
- ✅ `src/services/twilio/dial-transfer.ts` - Transfer callbacks use Railway
- ✅ `src/services/twilio/call-recorder.ts` - Recording callbacks use Railway
- ✅ `src/services/sms/job-url-service.ts` - Job acceptance URLs use Railway
- ✅ `src/config/production.ts` - Production config prioritizes Railway
- ✅ `src/config/deployment.ts` - Deployment config prioritizes Railway
- ✅ `app/api/twilio/voice-websocket/route.ts` - WebSocket URLs use Railway

### 3. ✅ Unified Server Created
- **File:** `voice-agent/server.js`
- **Features:**
  - ✅ Runs Next.js (web pages + API routes)
  - ✅ Runs WebSocket server (voice calls)
  - ✅ Runs SMS Wave Worker (background jobs)
  - ✅ Single port configuration
  - ✅ Graceful shutdown
  - ✅ Comprehensive logging

### 4. ✅ Railway Configuration Updated
- **File:** `railway.toml`
- **Build Command:** `cd voice-agent && npm install && npm run build`
- **Start Command:** `cd voice-agent && node server.js`
- **Status:** Ready for deployment

### 5. ✅ Dependencies Verified
All required packages installed:
- ✅ `bull@4.16.5` - Job queue
- ✅ `ioredis@5.8.2` - Redis client
- ✅ `date-fns@4.1.0` - Date manipulation
- ✅ `date-fns-tz@3.2.0` - Timezone support
- ✅ `@types/bull@4.10.4` - TypeScript types

---

## 🔧 RAILWAY ENVIRONMENT VARIABLES REQUIRED

### Critical (Must Set):
```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+61468152426
TWILIO_MESSAGING_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Airtable Configuration
AIRTABLE_API_KEY=patxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIRTABLE_BASE_ID=appxxxxxxxxxxxxxxxxx

# Redis Configuration (from Railway Redis service)
RAILWAY_REDIS_URL=redis://default:password@host:port
# OR
REDIS_URL=redis://default:password@host:port

# ElevenLabs (for voice)
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Automatically Set by Railway:
```bash
RAILWAY_PUBLIC_DOMAIN=your-project.up.railway.app  # Auto-set
PORT=3000  # Auto-set
NODE_ENV=production  # Auto-set
```

### Optional:
```bash
BASE_URL=https://your-custom-domain.com  # If using custom domain
ELEVENLABS_VOICE_ID=aGkVQvWUZi16EH8aZJvT  # Custom voice
```

---

## 🚀 DEPLOYMENT STEPS

### 1. Add Redis Service to Railway
```
Railway Dashboard → New Service → Database → Redis
```
This will automatically create `REDIS_URL` environment variable.

### 2. Set Environment Variables
In Railway dashboard:
- Go to your project
- Click "Variables" tab
- Add all required variables from above

### 3. Deploy Code
```bash
# Commit changes
git add .
git commit -m "Fix: Remove Vercel dependencies, use Railway-first configuration"
git push origin main
```

### 4. Monitor Deployment
Watch Railway logs for:
```
✅ Unified Server Started Successfully!
🌐 Next.js ready: http://0.0.0.0:3000
🔌 WebSocket ready: ws://0.0.0.0:3000/stream
📱 Job pages: http://0.0.0.0:3000/job/[id]
📱 SMS Wave System: Active
✅ SMS Wave Worker initialized
```

### 5. Update Twilio Webhooks
In Twilio Console, update phone number webhooks to:
```
Voice URL: https://your-project.up.railway.app/api/twilio/voice
Method: POST
```

---

## 🧪 POST-DEPLOYMENT TESTING

### Test 1: Health Check
```bash
curl https://your-project.up.railway.app/health
```
Expected response:
```json
{
  "status": "ok",
  "websocket": 0,
  "nextjs": "ready",
  "timestamp": "2025-12-11T04:48:19.000Z"
}
```

### Test 2: Job Acceptance Page
1. Get a real job ID from Airtable
2. Visit: `https://your-project.up.railway.app/job/recXYZ?emp=recEMP`
3. Should see:
   - ✅ Job details with patient name (FirstName L.)
   - ✅ Map with location
   - ✅ Date and time
   - ✅ "Accept Assignment" button

### Test 3: Job Acceptance Flow
1. Click "Accept Assignment" on job page
2. Should see success message
3. Check Airtable - job status should be "Filled"
4. Check Railway logs - should see wave cancellation

### Test 4: Voice Call
1. Call your Twilio number
2. Should connect and hear AI voice
3. Complete authentication flow
4. Check Railway logs for WebSocket connection

### Test 5: SMS Wave System
1. Leave a job open via voice call
2. Check Wave 1 SMS is sent immediately
3. SMS URL should point to Railway (not Vercel)
4. Click SMS link - should open Railway job page
5. Check Railway logs for Wave 2 & 3 scheduling

### Test 6: Wave Cancellation
1. Leave a job open to trigger Wave 1
2. Accept job via SMS link
3. Check Railway logs - Wave 2 & 3 should be cancelled
4. Verify no additional SMS sent

---

## 🐛 KNOWN NON-ISSUES

### Build Warning (Can Ignore):
```
ERROR: Error enqueueing caller ... couldn't be rendered statically
```
**Status:** ✅ SAFE TO IGNORE
**Reason:** Next.js trying to statically generate dynamic API route at build time. The route works fine at runtime.

---

## 📊 WHAT CHANGED FROM VERCEL

### Before:
```
Vercel: Next.js pages + API routes
Railway: WebSocket server only
SMS URLs: → Vercel domain
```

### After:
```
Railway: Everything (Next.js + WebSocket + Worker)
SMS URLs: → Railway domain
```

### Preserved Functionality:
- ✅ Job acceptance pages (same UI, same logic)
- ✅ API routes (same endpoints, same behavior)
- ✅ WebSocket voice calls (same flow)
- ✅ SMS notifications (same 3-wave system)
- ✅ Wave scheduling and cancellation
- ✅ Timezone-aware intervals
- ✅ Privacy-safe patient names

### New Benefits:
- ✅ Single deployment platform
- ✅ Faster internal communication
- ✅ Lower operational cost
- ✅ Simpler configuration
- ✅ Better logging integration

---

## ⚠️ POTENTIAL ISSUES & SOLUTIONS

### Issue: Build fails on Railway
**Solution:** 
- Check Node.js version (should be 18+)
- Verify `package.json` has all dependencies
- Check Railway logs for specific error

### Issue: WebSocket not connecting
**Solution:**
- Verify Twilio webhook points to Railway
- Check `RAILWAY_PUBLIC_DOMAIN` is set
- Test health endpoint first

### Issue: SMS URLs still point to Vercel
**Solution:**
- Verify `RAILWAY_PUBLIC_DOMAIN` is set in Railway
- Check SMS logs to see what URL is being sent
- May need to clear old environment variables

### Issue: Wave worker not processing
**Solution:**
- Verify Redis connection (`RAILWAY_REDIS_URL` or `REDIS_URL`)
- Check Railway logs for "SMS Wave Worker initialized"
- Test Redis connection: `redis-cli -u $REDIS_URL ping`

### Issue: Job acceptance page 404
**Solution:**
- Verify Next.js build completed successfully
- Check Railway logs for "Next.js ready"
- Try visiting health endpoint first

---

## 🎯 SUCCESS CRITERIA

Deployment is successful when:
- ✅ Health endpoint responds
- ✅ Job acceptance pages load on Railway domain
- ✅ SMS links point to Railway domain
- ✅ Employees can accept jobs via SMS
- ✅ Voice calls connect successfully
- ✅ WebSocket stays connected during calls
- ✅ Wave 1 sends immediately
- ✅ Wave 2 & 3 schedule correctly
- ✅ Waves cancelled on job acceptance
- ✅ UNFILLED_AFTER_SMS status set after Wave 3

---

## 📞 ROLLBACK PLAN

If deployment fails:
1. Keep Vercel running as backup
2. Update Twilio webhooks back to Vercel
3. Investigate Railway logs
4. Fix issues in separate branch
5. Deploy when issues resolved

**Important:** Don't delete Vercel until Railway is stable for 24-48 hours.

---

## ✅ FINAL CHECKLIST

Before clicking "Deploy":
- [ ] All environment variables set in Railway
- [ ] Redis service added to Railway
- [ ] Code committed and pushed
- [ ] `railway.toml` configured correctly
- [ ] Vercel still running as backup
- [ ] Twilio webhook URLs noted for update

After deployment:
- [ ] Health check passes
- [ ] Job page loads
- [ ] Twilio webhooks updated
- [ ] Test voice call
- [ ] Test SMS wave flow
- [ ] Test job acceptance
- [ ] Monitor for 1 hour
- [ ] Check all logs

---

**Status:** ✅ READY FOR DEPLOYMENT
**Date:** December 11, 2025
**Confidence:** HIGH - All TypeScript errors fixed, all URLs updated, unified server tested locally
