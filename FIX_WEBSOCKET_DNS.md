# Fix WebSocket DNS Configuration

## The Problem

Your WebSocket subdomain `websocket.oncallafterhours.app` is currently **Proxied** (orange cloud ☁️🟠) through Cloudflare, which strips the `Upgrade: websocket` header needed for WebSocket connections.

## The Solution

Change the DNS record to **DNS Only** (gray cloud ☁️⚪) to bypass Cloudflare's HTTP/2 proxy.

## Steps to Fix

### 1. Go to Cloudflare Dashboard

Visit: https://dash.cloudflare.com

### 2. Select Your Domain

Click on **oncallafterhours.app**

### 3. Go to DNS Settings

Click **DNS** in the left sidebar

### 4. Find the WebSocket Record

Look for the DNS record:
- **Type:** CNAME (or A)
- **Name:** websocket
- **Target:** voice-proxy.wagle-sam99.workers.dev (or similar)

### 5. Toggle the Proxy Status

Click the **orange cloud** icon next to the websocket record.

It should change from:
- 🟠 **Proxied** (orange cloud) 
  
TO:
- ⚪ **DNS Only** (gray cloud)

### 6. Save Changes

The changes apply immediately.

## Why This Works

- **Proxied (Orange Cloud):** Traffic goes through Cloudflare's edge servers
  - ❌ HTTP/2 proxy strips WebSocket headers
  - ❌ Error 1101: "Upgrade: websocket" header missing
  
- **DNS Only (Gray Cloud):** Traffic goes directly to your worker
  - ✅ WebSocket headers preserved
  - ✅ Direct connection, no proxy interference

## Testing After Change

Wait 30 seconds for DNS propagation, then test:

```bash
curl -i "https://websocket.oncallafterhours.app/stream?callSid=test" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=="
```

**Expected result:** `HTTP/1.1 101 Switching Protocols` (not HTTP/2!)

## Important Notes

- ⚠️ **Security:** DNS Only mode means you lose Cloudflare's DDoS protection for this subdomain
- ✅ **SSL Still Works:** The worker still has valid SSL from Cloudflare
- ✅ **Twilio Compatible:** Twilio can now connect to WebSockets properly

## Alternative if DNS Only Doesn't Work

If for some reason you can't use DNS Only, use the workers.dev URL directly:

```env
WEBSOCKET_URL=wss://voice-proxy.wagle-sam99.workers.dev/stream
```

This always works for WebSockets.

