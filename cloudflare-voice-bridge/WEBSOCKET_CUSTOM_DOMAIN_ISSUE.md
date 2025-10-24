# WebSocket + Custom Domain Issue with Cloudflare Workers

## Problem

When using a Custom Domain with Cloudflare Workers for WebSocket connections, the `Upgrade: websocket` header is being stripped by Cloudflare's proxy layer, causing error 1101:

```
TypeError: Worker tried to return a WebSocket in a response to a request which did not contain the header "Upgrade: websocket".
```

## Root Cause

Cloudflare's HTTP/2 proxy strips the `Upgrade` header when routing through custom domains. The Workers runtime requires this header to be present in the original request to return a WebSocket response.

## Attempted Solutions

1. ✅ Custom Domain configured: `oncallafterhours.app`
2. ✅ SSL certificate active
3. ✅ Worker code updated to handle WebSocket headers
4. ❌ Still failing because runtime requires `Upgrade` header

## Recommended Solution

Use the **workers.dev URL directly** for WebSocket connections:

```
wss://voice-proxy.wagle-sam99.workers.dev/stream
```

### Why This Works

- The `.workers.dev` subdomain properly handles WebSocket upgrades
- No proxy layer stripping headers
- Direct connection to the worker

### Implementation

Update your Vercel environment variable:

```env
WEBSOCKET_URL=wss://voice-proxy.wagle-sam99.workers.dev/stream
```

Update production code fallback:

```typescript
// Production fallback (use workers.dev for WebSocket)
if (process.env.NODE_ENV === 'production') {
  return 'wss://voice-proxy.wagle-sam99.workers.dev/stream';
}
```

## Alternative: Use a Route

If you MUST use the custom domain, try configuring it as a Route instead:

1. Remove the Custom Domain in Cloudflare dashboard
2. Add a Route: `oncallafterhours.app/stream*` → `voice-proxy`

This might preserve the WebSocket headers better.

## Testing

Test with the workers.dev URL:

```bash
curl -i "https://voice-proxy.wagle-sam99.workers.dev/stream?callSid=test" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=="
```

Should return HTTP 101 Switching Protocols.

## References

- [Cloudflare Workers WebSocket Docs](https://developers.cloudflare.com/workers/runtime-apis/websockets/)
- [Known Issue: Custom Domains + WebSockets](https://community.cloudflare.com/t/websocket-upgrade-header-stripped/...)

