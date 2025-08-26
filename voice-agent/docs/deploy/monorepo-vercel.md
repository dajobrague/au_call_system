# Monorepo Vercel Deployment Guide

## Project Structure

This is a **monorepo** with the Next.js app located at:
```
voice-agent/apps/web/
```

**NOT** at the repository root.

## Critical Vercel Configuration

### Root Directory Setting
Vercel **MUST** be configured with:
- **Root Directory**: `voice-agent/apps/web`
- **Framework**: Next.js
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)

### Route Location
The Twilio webhook route file is at:
```
voice-agent/apps/web/app/api/twilio/voice/route.ts
```

This creates the API endpoint: `/api/twilio/voice`

## Vercel Dashboard Setup

### Method 1: UI Configuration
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`au-call-system`)
3. **Settings** → **General**
4. **Root Directory** → Change from `.` to `voice-agent/apps/web`
5. **Save**
6. **Deployments** → **Redeploy** latest deployment

### Method 2: CLI Deployment
```bash
# From repository root
cd voice-agent/apps/web
vercel link  # Select existing project
vercel --prod
```

OR

```bash
# From repository root
vercel --prod --cwd voice-agent/apps/web
```

## Deployment Verification

### Build Logs Check
After deployment, verify in build logs:
```
Route (app)                              Size     First Load JS
└ λ /api/twilio/voice                    0 B                0 B
```

### Sanity Tests

#### 1. GET Request (should return 405 Method Not Allowed)
```bash
curl -i https://au-call-system.vercel.app/api/twilio/voice
```
**Expected**: `HTTP/2 405` (Method Not Allowed - route exists but only accepts POST)

#### 2. POST Request (should return 200 with TwiML)
```bash
curl -i -X POST -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123" -d "From=+1234567890" -d "To=+1987654321" \
  https://au-call-system.vercel.app/api/twilio/voice
```
**Expected**: `HTTP/2 200` with XML TwiML response

## Twilio Configuration

Once POST returns 200 OK:

1. Go to [Twilio Console](https://console.twilio.com/)
2. **Phone Numbers** → **Manage** → **Active numbers**
3. Select your Twilio number
4. **Voice & Fax** section:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://au-call-system.vercel.app/api/twilio/voice`
   - **HTTP**: POST
5. **Save**

## Common Issues

### 404 Not Found
- **Cause**: Root Directory not set to `voice-agent/apps/web`
- **Fix**: Update Root Directory in Vercel Settings

### Route not found in build
- **Cause**: File not at `app/api/twilio/voice/route.ts`
- **Fix**: Verify exact file path and commit to correct branch

### Method Not Allowed (405) on POST
- **Cause**: Route exists but has issues with POST handler
- **Fix**: Check `export async function POST()` in route.ts

## Verification Checklist

- [ ] Root Directory set to `voice-agent/apps/web`
- [ ] Build logs show `λ /api/twilio/voice`
- [ ] GET returns 405 Method Not Allowed
- [ ] POST returns 200 with TwiML
- [ ] Twilio webhook configured
- [ ] Test call works end-to-end
