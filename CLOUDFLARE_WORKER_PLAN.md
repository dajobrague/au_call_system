# Cloudflare Worker Migration Plan

## The Problem
- Your WebSocket server (`websocket-server.js`) was running locally with ngrok
- Vercel doesn't support long-running WebSocket servers
- Need to move WebSocket handling to Cloudflare Workers

## The Solution
Move WebSocket logic to Cloudflare Worker Durable Object:

### What the Worker Needs to Do:
1. **Accept Twilio WebSocket** ✅ Already working
2. **Process Twilio audio events** ✅ Already working  
3. **Call ElevenLabs API** for speech generation ⚠️ Need to add
4. **Call Vercel API routes** for business logic ⚠️ Need to add
5. **Stream audio back to Twilio** ⚠️ Need to add

### Architecture:
```
Twilio Media Stream
    ↓
Cloudflare Worker (Durable Object)
    ↓
    ├── ElevenLabs HTTP API (TTS)
    ├── Vercel API Routes (FSM/Auth/DB)
    └── Stream audio back to Twilio
```

## Quick Implementation Steps:

1. **Add environment variables to Worker:**
   - `ELEVENLABS_API_KEY`
   - `VERCEL_API_URL` (your Vercel deployment URL)
   - `AIRTABLE_API_KEY` (if calling directly)

2. **Implement in CallSession Durable Object:**
   - Audio buffer management
   - ElevenLabs TTS calls
   - Audio frame generation
   - Streaming to Twilio

3. **Keep complex logic on Vercel:**
   - FSM state machine
   - Authentication
   - Database operations
   - Create API endpoints that Worker can call

## Estimated Time:
- 30-45 minutes to implement core functionality
- Will be simpler than local server (stateless HTTP calls)

## Next Step:
Implement the ElevenLabs + Vercel API integration in the Cloudflare Worker.

