# Voice Agent Testing Guide

Complete guide for testing both local (ngrok) and production (Cloudflare) WebSocket configurations.

## Quick Reference

| Environment | Command | WebSocket URL |
|------------|---------|---------------|
| **Local** | `npm run local` | `wss://climbing-merely-joey.ngrok-free.app/stream` |
| **Production** | Deploy to Vercel | `wss://sam.netmtion.io/stream` |

## Local Testing (ngrok)

### Prerequisites

- ngrok installed and configured
- Reserved ngrok domain: `climbing-merely-joey.ngrok-free.app`
- Local `.env.local` file created

### Setup Steps

1. **Create .env.local (first time only)**

```bash
cd voice-agent
cp .env.example .env.local
```

Ensure `.env.local` contains:

```env
NODE_ENV=development
WEBSOCKET_URL=wss://climbing-merely-joey.ngrok-free.app/stream
```

2. **Start Local Server**

```bash
npm run local
```

This command will:
- Start the WebSocket server on port 3001
- Start ngrok tunnel with your reserved domain
- Display connection URLs and logs

You should see output like:

```
🚀 Starting Voice Agent (Local Mode)
🎯 Server running on port 3001
📡 WebSocket endpoint: ws://localhost:3001/stream
🌐 Ngrok Tunnel:
   Public URL: https://climbing-merely-joey.ngrok-free.app
   WebSocket: wss://climbing-merely-joey.ngrok-free.app/stream
```

### Testing Local WebSocket

**Test 1: Health Check**

```bash
curl https://climbing-merely-joey.ngrok-free.app/health
# Expected: OK
```

**Test 2: WebSocket Connection**

The `start-voice-agent.sh` script automatically tests the WebSocket connection. Look for:

```
✅ WebSocket Test: Connection successful
```

### Testing with Twilio (Local)

1. **Update Twilio Webhook (Temporary)**

   Go to [Twilio Console](https://console.twilio.com) → Phone Numbers → Your Number

   Set webhook to:
   ```
   https://climbing-merely-joey.ngrok-free.app/api/twilio/voice-websocket
   ```

2. **Make a Test Call**

   Call your Twilio number from your phone

3. **Monitor Logs**

   Watch the terminal running `npm run local` for real-time logs

4. **Expected Flow**
   - ✅ Incoming call received
   - ✅ WebSocket connection established
   - ✅ Audio streaming starts
   - ✅ Call flow proceeds normally

### Stopping Local Server

```bash
# Press Ctrl+C in the terminal
# Or run:
./stop-voice-agent.sh
```

This stops both the WebSocket server and ngrok tunnel.

---

## Production Testing (Cloudflare)

### Prerequisites

- Cloudflare Worker deployed to `sam.netmtion.io`
- Custom domain configured and SSL active
- Vercel environment variables set

### Setup Steps

1. **Verify Cloudflare Deployment**

```bash
# Health check
curl https://sam.netmtion.io/health
# Expected: OK

# WebSocket endpoint
curl -i https://sam.netmtion.io/stream
# Expected: 426 Upgrade Required (this is correct for WebSocket endpoints)
```

2. **Set Vercel Environment Variables**

   In [Vercel Dashboard](https://vercel.com) → Your Project → Settings → Environment Variables:

   ```env
   WEBSOCKET_URL=wss://sam.netmtion.io/stream
   NODE_ENV=production
   ```

   After adding, redeploy your application.

3. **Update Twilio Webhook (Production)**

   Go to [Twilio Console](https://console.twilio.com) → Phone Numbers → Your Number

   Set webhook to:
   ```
   https://sam-voice-agent.vercel.app/api/twilio/voice-websocket
   ```

### Testing Production WebSocket

**Test 1: Cloudflare Worker Health**

```bash
curl https://sam.netmtion.io/health
# Expected: OK
```

**Test 2: Monitor Cloudflare Logs**

```bash
cd cloudflare-voice-bridge
npx wrangler tail
```

This streams real-time logs from your Cloudflare Worker.

**Test 3: Make a Test Call**

1. Call your Twilio number
2. Watch Cloudflare logs (from `wrangler tail`)
3. Watch Vercel logs in dashboard

**Expected Log Flow:**

**Cloudflare Worker Logs:**
```
🔗 Accepting WebSocket for call: CAxxxxxxxxx
✅ Twilio start: { callSid: 'CAxxxxxxxxx', streamSid: 'MZxxxxxxxxx' }
🎧 media frame bytes ~ 120
🎧 media frame bytes ~ 120
...
🛑 Twilio stop: { callSid: 'CAxxxxxxxxx' }
🔚 socket closed
```

**Vercel Logs:**
```
Incoming call - initiating WebSocket with recording
TwiML generated with recording
```

### Testing Production Locally (Before Deploy)

You can test the production WebSocket configuration locally before deploying:

1. **Update .env.local**

```env
NODE_ENV=production
WEBSOCKET_URL=wss://sam.netmtion.io/stream
```

2. **Run Dev Server**

```bash
npm run dev
```

3. **Test via Browser**

   Open `http://localhost:3000` and test the application

4. **Make a Test Call**

   - Temporarily update Twilio webhook to point to your ngrok tunnel OR
   - Use Twilio's test call feature

---

## Troubleshooting

### Local Testing Issues

#### Issue: "ngrok not found"

**Solution:**
```bash
brew install ngrok
# Or download from https://ngrok.com/download
```

#### Issue: "ngrok domain already in use"

**Solution:**
- Stop any other ngrok processes: `pkill ngrok`
- Run `./stop-voice-agent.sh` to clean up
- Try `npm run local` again

#### Issue: WebSocket connection fails

**Solution:**
- Check if port 3001 is already in use: `lsof -i :3001`
- Kill any process using port 3001: `kill -9 <PID>`
- Restart: `npm run local`

### Production Testing Issues

#### Issue: "426 Upgrade Required" on health check

**Solution:**
- This is EXPECTED for `/stream` endpoint
- `/health` should return 200 OK
- WebSocket endpoints always return 426 for non-WebSocket requests

#### Issue: Cloudflare Worker not receiving connections

**Check:**
1. DNS propagation: `dig sam.netmtion.io`
2. SSL certificate: `curl -v https://sam.netmtion.io/health`
3. Custom domain in Cloudflare dashboard
4. Vercel environment variables set correctly

**Solution:**
```bash
# Verify DNS
nslookup sam.netmtion.io

# Check SSL
openssl s_client -connect sam.netmtion.io:443 -servername sam.netmtion.io

# View logs
cd cloudflare-voice-bridge
npx wrangler tail
```

#### Issue: Twilio can't connect to WebSocket

**Check:**
1. Twilio webhook URL is correct
2. Custom domain SSL is active
3. Environment variables in Vercel

**Debug:**
```bash
# Test from Twilio's perspective
curl -H "Upgrade: websocket" \
     -H "Connection: Upgrade" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     -H "Sec-WebSocket-Version: 13" \
     https://sam.netmtion.io/stream?callSid=test
```

#### Issue: Audio not streaming

**Check:**
1. Cloudflare Worker logs: `npx wrangler tail`
2. MediaStream events in logs
3. ElevenLabs API key in environment variables

---

## Testing Checklist

### Before Production Deployment

- [ ] Local testing with `npm run local` works
- [ ] Health check responds: `curl https://sam.netmtion.io/health`
- [ ] Cloudflare Worker deployed successfully
- [ ] Custom domain SSL active
- [ ] Vercel environment variables set
- [ ] Twilio webhook updated to production URL
- [ ] Test call completes successfully
- [ ] Audio streaming works
- [ ] Call logs recorded correctly

### After Production Deployment

- [ ] Make 3-5 test calls
- [ ] Monitor Cloudflare logs: `npx wrangler tail`
- [ ] Check Vercel logs for errors
- [ ] Verify call recordings in S3
- [ ] Test all call flow options (reschedule, leave open, etc.)
- [ ] Test error scenarios (invalid input, timeout, etc.)

---

## Environment Variable Reference

### Local Development (.env.local)

```env
NODE_ENV=development
WEBSOCKET_URL=wss://climbing-merely-joey.ngrok-free.app/stream
```

### Production (Vercel)

```env
NODE_ENV=production
WEBSOCKET_URL=wss://sam.netmtion.io/stream
CLOUDFLARE_VOICE_PROXY_URL=wss://sam.netmtion.io/stream
```

---

## Quick Commands

```bash
# Start local development
npm run local

# Stop local development
./stop-voice-agent.sh

# Test health endpoint (local)
curl https://climbing-merely-joey.ngrok-free.app/health

# Test health endpoint (production)
curl https://sam.netmtion.io/health

# Monitor Cloudflare logs
cd cloudflare-voice-bridge && npx wrangler tail

# Deploy to Cloudflare
cd cloudflare-voice-bridge && npx wrangler deploy

# Check Cloudflare account
cd cloudflare-voice-bridge && npx wrangler whoami
```

---

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review Cloudflare Worker logs: `npx wrangler tail`
3. Review Vercel deployment logs
4. Check Twilio debugger for webhook errors
5. Verify environment variables are set correctly



