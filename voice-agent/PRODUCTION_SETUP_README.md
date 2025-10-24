# Production WebSocket Setup - Quick Start

## 🎯 What's New

Your voice agent now supports **both local testing (ngrok) and production (Cloudflare)** with automatic environment detection.

### Key Features

✅ **Easy local testing:** `npm run local` starts everything  
✅ **Production-ready:** Uses Cloudflare Worker at `sam.netmtion.io`  
✅ **Environment-based:** Automatically uses correct WebSocket URL  
✅ **Twilio-compatible:** Custom domain works with Twilio Media Streams  

---

## 🚀 Quick Start

### Local Testing (Right Now)

```bash
# 1. Copy environment template
cp .env.example .env.local

# 2. Start local server (one command!)
npm run local
```

That's it! The system will:
- Start WebSocket server on port 3001
- Launch ngrok tunnel
- Test the connection
- Show you the URLs

### Production Deployment

Follow the complete guide in [`PRODUCTION_DEPLOYMENT_SUMMARY.md`](../PRODUCTION_DEPLOYMENT_SUMMARY.md) at the project root.

**TL;DR:**
1. Deploy Cloudflare Worker
2. Configure `sam.netmtion.io` custom domain
3. Set Vercel env var: `WEBSOCKET_URL=wss://sam.netmtion.io/stream`
4. Update Twilio webhook
5. Test!

---

## 📁 Important Files

### For You to Read

- **[`../PRODUCTION_DEPLOYMENT_SUMMARY.md`](../PRODUCTION_DEPLOYMENT_SUMMARY.md)** - Start here! Complete deployment checklist
- **[`TESTING_GUIDE.md`](./TESTING_GUIDE.md)** - How to test local and production
- **[`../cloudflare-voice-bridge/DEPLOYMENT.md`](../cloudflare-voice-bridge/DEPLOYMENT.md)** - Cloudflare deployment details

### Configuration Files

- **`.env.example`** - Template (copy to `.env.local`)
- **`.env.local`** - Your local config (git-ignored, create from example)
- **`package.json`** - Added `npm run local` script

### Modified Code Files

- `src/fsm/twiml/twiml-generator.ts` - Uses `WEBSOCKET_URL` env var
- `app/api/twilio/voice-websocket/route.ts` - Uses `WEBSOCKET_URL` env var

---

## 🔧 Commands

```bash
# Local development
npm run local              # Start local server + ngrok (recommended)
./start-voice-agent.sh     # Alternative: manual start
./stop-voice-agent.sh      # Stop local server

# Testing
curl https://climbing-merely-joey.ngrok-free.app/health  # Test local
curl https://sam.netmtion.io/health                       # Test production

# Cloudflare
cd ../cloudflare-voice-bridge
npx wrangler deploy        # Deploy worker
npx wrangler tail          # View logs
npx wrangler whoami        # Check account
```

---

## 🌍 Environment Variables

### Local (.env.local)

```env
NODE_ENV=development
WEBSOCKET_URL=wss://climbing-merely-joey.ngrok-free.app/stream
```

### Production (Vercel Dashboard)

```env
NODE_ENV=production
WEBSOCKET_URL=wss://sam.netmtion.io/stream
```

The system automatically uses the right URL based on `NODE_ENV`.

---

## ⚡ What Changed

### Before
- Hardcoded ngrok URL in code
- No easy way to switch environments
- Manual setup every time

### After
- Environment variables control WebSocket URL
- `npm run local` for instant local testing
- Production uses Cloudflare custom domain
- Automatic fallbacks if env vars not set

---

## 🎓 Learn More

**New to this setup?**
1. Read [`PRODUCTION_DEPLOYMENT_SUMMARY.md`](../PRODUCTION_DEPLOYMENT_SUMMARY.md) first
2. Try `npm run local` to test locally
3. Follow deployment steps when ready

**Ready to deploy?**
1. Go to [`cloudflare-voice-bridge/DEPLOYMENT.md`](../cloudflare-voice-bridge/DEPLOYMENT.md)
2. Switch Cloudflare account
3. Deploy worker
4. Configure custom domain

**Need help testing?**
- See [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) for complete testing procedures
- Includes troubleshooting for common issues

---

## 📊 Architecture

```
Local Development:
Twilio → ngrok (climbing-merely-joey.ngrok-free.app) → Local WebSocket Server (port 3001)

Production:
Twilio → Cloudflare Worker (sam.netmtion.io) → Durable Objects → [Backend processing]
```

---

## ✅ Ready to Go

Everything is configured and ready. You just need to:

1. **Test locally:** `npm run local`
2. **Deploy Cloudflare:** Follow `PRODUCTION_DEPLOYMENT_SUMMARY.md`
3. **Test production:** Make a real call

The code automatically handles everything else based on your environment! 🎉

---

## 🆘 Help

**Something not working?**

Check these files:
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) - Troubleshooting section
- [`../cloudflare-voice-bridge/DEPLOYMENT.md`](../cloudflare-voice-bridge/DEPLOYMENT.md) - Deployment issues
- [`../PRODUCTION_DEPLOYMENT_SUMMARY.md`](../PRODUCTION_DEPLOYMENT_SUMMARY.md) - Quick reference

**Still stuck?**
- Check Cloudflare logs: `cd ../cloudflare-voice-bridge && npx wrangler tail`
- Verify env vars: `echo $WEBSOCKET_URL`
- Test health endpoint: `curl https://sam.netmtion.io/health`



