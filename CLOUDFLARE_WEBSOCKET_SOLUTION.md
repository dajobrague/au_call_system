# Cloudflare WebSocket Solution for Twilio

## The Problem

Cloudflare's HTTP/2 proxy strips the `Upgrade: websocket` header when using custom domains, causing Error 1101.

From your logs:
```
"Upgrade header:" null  ❌
```

But we have:
```
"sec-websocket-key": "REDACTED"  ✅
"sec-websocket-version": "13"    ✅
```

The Worker runtime requires the `Upgrade` header to return a WebSocket response.

## Solution: Use Workers.dev URL Temporarily

Since custom domains have this limitation, use the workers.dev URL:

### Update Production Configuration

**In Vercel Environment Variables:**
```env
WEBSOCKET_URL=wss://voice-proxy.wagle-sam99.workers.dev/stream
```

**In Code (voice-agent/src/fsm/twiml/twiml-generator.ts):**
```typescript
// Production fallback (use workers.dev for WebSocket)
if (process.env.NODE_ENV === 'production') {
  return 'wss://voice-proxy.wagle-sam99.workers.dev/stream';
}
```

**In Code (voice-agent/app/api/twilio/voice-websocket/route.ts):**
```typescript
if (process.env.NODE_ENV === 'production') {
  // Production fallback to Cloudflare workers.dev
  return 'wss://voice-proxy.wagle-sam99.workers.dev/stream';
}
```

### Why This Works

1. ✅ Workers.dev URLs properly handle WebSocket upgrades
2. ✅ No HTTP/2 proxy stripping headers
3. ✅ Direct connection to worker
4. ✅ Twilio can connect (workers.dev has valid SSL)

### Testing

```bash
# This should work:
curl -i "https://voice-proxy.wagle-sam99.workers.dev/stream?callSid=test" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=="
```

Expected: **HTTP 101 Switching Protocols**

## Alternative: Custom Subdomain with DNS-Only

If you MUST avoid `*.workers.dev` in production:

1. Create subdomain: `ws.oncallafterhours.app`
2. Set DNS to **DNS Only** (gray cloud, not proxied)
3. Add CNAME: `ws` → `voice-proxy.wagle-sam99.workers.dev`
4. Update routes to: `wss://ws.oncallafterhours.app/stream`

This bypasses Cloudflare's proxy entirely.

## Next Steps

1. Update environment variables to use workers.dev URL
2. Redeploy to Vercel
3. Test with actual Twilio call
4. If needed, implement custom subdomain solution later

