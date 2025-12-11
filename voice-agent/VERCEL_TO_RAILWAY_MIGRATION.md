# Migrating from Vercel to Railway - Complete Guide

## 📊 Current vs. New Architecture

### Before (Split Deployment):
```
Vercel:
├── Next.js App (web pages)
├── /job/[id] page ← SMS links point here
└── API routes

Railway:
└── WebSocket server only (voice calls)
```

**Problem:** SMS links point to Vercel, not Railway

### After (Unified on Railway):
```
Railway (Single Service):
├── Next.js App (web pages)
├── /job/[id] page ← SMS links point here
├── API routes
├── WebSocket server (voice calls)
└── SMS Wave Worker (background jobs)
```

**Solution:** Everything on Railway, SMS links use Railway domain

## ✅ What Was Changed

### 1. Created Unified Server

**New File:** `voice-agent/server.js`

This server runs:
- ✅ Next.js (for web pages like job acceptance)
- ✅ WebSocket server (for voice calls)
- ✅ SMS Wave Worker (for background wave processing)
- ✅ All Twilio endpoints

All on a **single port** assigned by Railway.

### 2. Updated Railway Configuration

**File:** `railway.toml`

```toml
[build]
buildCommand = "cd voice-agent && npm install && npm run build"

[deploy]
startCommand = "cd voice-agent && node server.js"
```

Now starts the unified server instead of just the WebSocket server.

### 3. SMS URLs Already Updated

**File:** `voice-agent/src/services/sms/job-notification-service.ts`

```typescript
const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
  : process.env.BASE_URL || 'https://sam-voice-agent.vercel.app';
```

Will automatically use Railway domain when `RAILWAY_PUBLIC_DOMAIN` is set.

## 🚀 Migration Steps

### Step 1: Railway Environment Variables

Make sure these are set in Railway:

```bash
# Railway automatically provides these:
RAILWAY_PUBLIC_DOMAIN=your-project.up.railway.app  # Auto-set by Railway
PORT=3000  # Auto-set by Railway

# Your existing variables (should already be there):
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
TWILIO_MESSAGING_SID=...
AIRTABLE_API_KEY=...
AIRTABLE_BASE_ID=...
RAILWAY_REDIS_URL=...  # From Railway Redis service

# Optional - if you want a custom base URL:
BASE_URL=https://your-custom-domain.com
```

### Step 2: Deploy to Railway

```bash
# Commit the changes
git add .
git commit -m "Add unified server for Railway deployment"
git push origin main
```

Railway will automatically:
1. Detect the changes
2. Run `npm install && npm run build`
3. Start `node server.js`
4. Assign a public domain

### Step 3: Verify Deployment

Check Railway logs for:

```
✅ Unified Server Started Successfully!
🌐 Next.js ready: http://0.0.0.0:3000
🔌 WebSocket ready: ws://0.0.0.0:3000/stream
🔗 Health check: http://0.0.0.0:3000/health
📱 Job pages: http://0.0.0.0:3000/job/[id]
📱 SMS Wave System: Active
✅ SMS Wave Worker initialized
```

### Step 4: Test Job Acceptance Page

1. Get your Railway URL: `https://your-project.up.railway.app`
2. Test a job page: `https://your-project.up.railway.app/job/recXYZ?emp=recEMP`
3. Should see the job acceptance interface

### Step 5: Test SMS Flow

1. Call the system and leave a job open
2. Check that SMS is sent
3. SMS URL should now use Railway domain
4. Click the link → Should open on Railway
5. Accept job → Should work correctly

### Step 6: Verify WebSocket Still Works

1. Make a test call to your Twilio number
2. Should connect to WebSocket on Railway
3. Voice system should work as before

### Step 7: Decommission Vercel (Optional)

Once everything works on Railway:

1. Keep Vercel running for 24-48 hours (safety)
2. Monitor Railway for any issues
3. When confident, delete Vercel deployment
4. Update any hardcoded URLs if needed

## 🔍 What Functionality is Preserved

### ✅ Web Pages (Job Acceptance)
- `/job/[id]` page works exactly the same
- Same UI, same map integration
- Same job acceptance flow
- All Tailwind styling preserved

### ✅ API Routes
- `/api/job/[id]` GET and POST
- All other API routes
- Same Airtable integration
- Wave cancellation on acceptance

### ✅ WebSocket Server
- Voice call handling unchanged
- Same Twilio integration
- Same call flow logic
- Recording still works

### ✅ SMS Wave System
- 3-wave notifications
- Timezone-aware intervals
- Wave cancellation
- UNFILLED_AFTER_SMS status

### ✅ Background Workers
- SMS Wave Worker
- Bull queue processing
- Redis integration

## 📦 What's Different

### Changed:
- ✅ **URL Domain:** Now uses Railway instead of Vercel
- ✅ **Single Server:** Everything runs together
- ✅ **One Port:** All services on Railway's assigned port

### Unchanged:
- ✅ **Code:** All functionality identical
- ✅ **UI:** Exact same job acceptance interface
- ✅ **Database:** Same Airtable integration
- ✅ **SMS:** Same Twilio integration
- ✅ **Logic:** All business logic preserved

## 🧪 Testing Checklist

- [ ] Railway deployment succeeds
- [ ] Health check responds: `https://your-project.up.railway.app/health`
- [ ] Job page loads: `https://your-project.up.railway.app/job/[id]?emp=[empId]`
- [ ] Job acceptance works (click "Accept Assignment")
- [ ] SMS URLs use Railway domain
- [ ] Voice calls connect successfully
- [ ] WebSocket stays connected during calls
- [ ] Wave 1 SMS sends immediately when job left open
- [ ] Wave 2 and 3 schedule in Bull queue
- [ ] Wave cancellation works when job accepted
- [ ] UNFILLED_AFTER_SMS status set after wave 3

## 🐛 Troubleshooting

### Issue: Job page returns 404

**Fix:** Check that Next.js built successfully
```bash
# In Railway logs, look for:
✓ Creating an optimized production build
✓ Compiled successfully
```

### Issue: WebSocket not connecting

**Fix:** Check Twilio webhook URL points to Railway
```
https://your-project.up.railway.app/api/twilio/voice
```

### Issue: SMS URLs still use Vercel

**Fix:** Check `RAILWAY_PUBLIC_DOMAIN` is set in Railway environment variables

### Issue: Worker not processing waves

**Fix:** Check Railway Redis is connected
```bash
# In Railway logs, look for:
✅ SMS Wave Worker initialized
✅ Bull queue initialized
```

### Issue: Next.js pages not loading

**Fix:** Make sure Next.js is built before deployment
```bash
# Railway should run:
npm install && npm run build
```

## 🔐 Security Notes

### HTTPS Everywhere
- Railway provides automatic HTTPS
- All SMS links use HTTPS
- WebSocket uses WSS (secure)

### Environment Variables
- Never commit `.env.local` to git
- Set all sensitive values in Railway dashboard
- Railway encrypts environment variables

### API Security
- Next.js API routes have security headers
- Twilio signature validation in place
- CORS configured properly

## 📊 Performance Considerations

### Single vs. Separate Services

**Current (Single Service):**
- ✅ Simpler deployment
- ✅ Lower cost (one service)
- ✅ Shared resources
- ⚠️  All features restart together

**Alternative (Separate Services):**
- Would need 2 Railway services
- Higher cost but independent scaling
- WebSocket can restart without affecting web pages

For most use cases, **single service is recommended**.

## 🎯 Success Criteria

Your migration is successful when:

1. ✅ Job acceptance pages load on Railway
2. ✅ SMS links point to Railway domain
3. ✅ Employees can accept jobs via SMS links
4. ✅ Voice calls work as before
5. ✅ 3-wave SMS system operational
6. ✅ No functionality lost from Vercel

## 📞 Support

If you encounter issues:

1. Check Railway logs first
2. Verify all environment variables set
3. Test each component individually
4. Check Twilio webhook configuration

---

**Migration Date:** December 11, 2025  
**Status:** ✅ READY TO DEPLOY  
**Estimated Downtime:** None (deploy to Railway, then switch DNS)
