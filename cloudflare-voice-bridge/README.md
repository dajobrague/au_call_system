# Cloudflare Voice Bridge

WebSocket bridge for Twilio Media Streams using Cloudflare Workers with Durable Objects.

## Overview

This Cloudflare Worker provides a production-grade WebSocket endpoint for Twilio's Media Streams API. It uses:
- **Durable Objects** for stateful WebSocket connections
- **Custom Domain** (`sam.netmtion.io`) for Twilio compatibility
- **High availability** and global distribution via Cloudflare's edge network

## Why This Exists

Twilio's Media Streams require a WebSocket endpoint with:
1. Valid SSL certificate
2. Custom domain (*.workers.dev URLs don't work)
3. Ability to handle WebSocket upgrade requests
4. Stateful connection management

This worker fulfills all requirements and provides a bridge between Twilio and your voice processing backend.

## Architecture

```
Twilio Call → Twilio Media Stream → Cloudflare Worker (sam.netmtion.io)
                                            ↓
                                    Durable Object (CallSession)
                                            ↓
                                    [Future: Backend Voice Agent]
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Deploy to Cloudflare

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

Quick version:

```bash
# Login to Cloudflare (client's account)
npx wrangler logout
npx wrangler login

# Deploy
npx wrangler deploy
```

### 3. Configure Custom Domain

1. Add DNS record in Cloudflare for `sam.netmtion.io`
2. Add custom domain in Workers dashboard
3. Wait for SSL provisioning (~5 minutes)

Full instructions in [DEPLOYMENT.md](./DEPLOYMENT.md)

### 4. Test

```bash
# Health check
curl https://sam.netmtion.io/health
# Expected: OK

# WebSocket endpoint
curl -i https://sam.netmtion.io/stream
# Expected: 426 Upgrade Required (correct for WebSocket)
```

## Endpoints

### `/health`
- **Method:** GET
- **Response:** `OK` (200)
- **Purpose:** Health check for monitoring

### `/stream`
- **Method:** WebSocket Upgrade
- **Query Params:** `callSid` (optional, for tracking)
- **Purpose:** Main WebSocket endpoint for Twilio Media Streams

## Development

### Local Testing

Cloudflare Workers can't be run locally with full Durable Objects support, but you can use `wrangler dev`:

```bash
npx wrangler dev
```

This starts a local development server on `localhost:8787`.

### View Logs

```bash
npx wrangler tail
```

Streams real-time logs from the deployed worker.

## File Structure

```
cloudflare-voice-bridge/
├── src/
│   ├── index.ts              # Main worker entry point
│   ├── do/
│   │   └── CallSession.ts    # Durable Object for WebSocket sessions
│   ├── types.ts              # TypeScript types
│   └── utils/
│       ├── audio.ts          # Audio processing utilities
│       ├── elevenlabs.ts     # ElevenLabs integration
│       └── twilio.ts         # Twilio helpers
├── wrangler.toml             # Cloudflare configuration
├── package.json
├── tsconfig.json
├── DEPLOYMENT.md             # Deployment guide
└── README.md                 # This file
```

## Configuration

### wrangler.toml

```toml
name = "voice-proxy"
main = "src/index.ts"
compatibility_date = "2025-09-01"
workers_dev = true

[[durable_objects.bindings]]
name = "CALL_SESSIONS"
class_name = "CallSession"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["CallSession"]
```

### Environment Variables

Currently, this worker doesn't require environment variables. Future enhancements may add:
- `BACKEND_WEBSOCKET_URL` - Forward to voice processing backend
- `ELEVENLABS_API_KEY` - For direct audio processing

## Durable Objects

The `CallSession` Durable Object manages each WebSocket connection:
- One instance per `callSid`
- Maintains connection state
- Handles Twilio events: `start`, `media`, `mark`, `stop`
- Automatic cleanup on connection close

## Twilio Integration

When Twilio initiates a call, it sends:

1. **Start event:**
   ```json
   {
     "event": "start",
     "streamSid": "MZ...",
     "callSid": "CA...",
     "media": { "format": "mulaw", "sampleRate": 8000 }
   }
   ```

2. **Media events:** (continuous)
   ```json
   {
     "event": "media",
     "streamSid": "MZ...",
     "media": { "payload": "base64-encoded-audio" }
   }
   ```

3. **Stop event:**
   ```json
   {
     "event": "stop",
     "streamSid": "MZ..."
   }
   ```

## Monitoring

### View Logs

```bash
npx wrangler tail
```

### Metrics

Cloudflare provides built-in metrics:
- Requests per second
- Error rate
- Response time
- Bandwidth usage

Access in: Dashboard → Workers & Pages → voice-proxy → Metrics

## Troubleshooting

### Issue: "Durable Object not found"

**Solution:** Run migrations:
```bash
npx wrangler migrations apply
```

### Issue: WebSocket connection fails

**Check:**
1. SSL certificate is active
2. Custom domain is configured
3. Worker logs: `npx wrangler tail`

### Issue: "Account ID required"

**Solution:** Add to `wrangler.toml`:
```toml
account_id = "your-account-id"
```

## Production Deployment

**Current Production URL:** `wss://sam.netmtion.io/stream`

Used by:
- Voice Agent (`voice-agent/`) via `WEBSOCKET_URL` environment variable
- Twilio webhooks for Media Streams

## Future Enhancements

- [ ] Forward audio to backend voice processing service
- [ ] Integrate ElevenLabs directly in the worker
- [ ] Add authentication/authorization
- [ ] Implement rate limiting
- [ ] Add detailed analytics
- [ ] Support for multiple backends

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Durable Objects Guide](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/)
- [Twilio Media Streams](https://www.twilio.com/docs/voice/twiml/stream)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## Support

For deployment help, see [DEPLOYMENT.md](./DEPLOYMENT.md)

For testing instructions, see [../voice-agent/TESTING_GUIDE.md](../voice-agent/TESTING_GUIDE.md)



