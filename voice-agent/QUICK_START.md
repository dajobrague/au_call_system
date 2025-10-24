# Quick Start Guide - New Modular WebSocket Server

## 🚀 Start the Server

```bash
cd /Users/davidbracho/auestralian_project/voice-agent
node websocket-server.js
```

## 📋 Expected Output

```
🚀 ========================================
🎙️  Voice Agent WebSocket Server
🚀 ========================================

📡 WebSocket server listening on port 3001
🔗 WebSocket URL: ws://localhost:3001/stream
💚 Health check: http://localhost:3001/health

✅ Server ready to accept connections
```

## 🔍 Health Check

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-06T22:30:00.000Z"
}
```

## 🧪 Test with ngrok

1. **Start ngrok** (in a separate terminal):
```bash
ngrok http 3001
```

2. **Copy the ngrok URL** (e.g., `https://climbing-merely-joey.ngrok-free.app`)

3. **Update Twilio webhook** to point to:
```
https://your-ngrok-url.ngrok-free.app/stream?from=+522281957913
```

4. **Make a test call** to your Twilio number

## 📊 Compare with Original

### Start Original Server
```bash
node ngrok-websocket-test.js
```

### Start New Server
```bash
node websocket-server.js
```

Both servers:
- Listen on port 3001
- Use same environment variables
- Have identical functionality
- Can be tested side-by-side

## 🐛 Troubleshooting

### Server won't start
**Check environment variables:**
```bash
echo $ELEVENLABS_API_KEY
echo $TWILIO_ACCOUNT_SID
echo $REDIS_HOST
```

**Missing variables?** Create `.env` file:
```bash
ELEVENLABS_API_KEY=your_key
ELEVENLABS_VOICE_ID=aEO01A4wXwd1O8GPgGlF
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=your_number
TWILIO_MESSAGING_SID=your_messaging_sid
REDIS_HOST=your_redis_host
REDIS_PORT=6379
```

### Port already in use
**Kill existing process:**
```bash
lsof -ti:3001 | xargs kill -9
```

### TypeScript errors
**Restart your IDE** - The @types/express package was just installed

### Connection issues
**Check Redis:**
```bash
redis-cli ping
```

Expected: `PONG`

## 📝 Logs

### Server logs
All logs use structured logging:
```json
{
  "level": "info",
  "message": "WebSocket stream started",
  "callSid": "CA123...",
  "type": "ws_stream_start",
  "timestamp": "2025-10-06T22:30:00.000Z"
}
```

### Log levels
- `info` - Normal operations
- `warn` - Warnings (non-critical)
- `error` - Errors (needs attention)
- `debug` - Detailed debugging info

## 🔄 Graceful Shutdown

Press `Ctrl+C` to stop the server gracefully:
```
🛑 SIGINT received, shutting down gracefully...
✅ Server closed
```

All active connections are closed cleanly.

## 📚 More Information

- **Full documentation**: See `MODULES_GUIDE.md`
- **Refactoring details**: See `REFACTORING_COMPLETE.md`
- **Progress tracking**: See `REFACTORING_PROGRESS.md`

## 🎯 Next Steps

1. ✅ Start the server
2. ✅ Test with a real call
3. ✅ Compare with original server
4. ✅ Deploy to production when ready

---

**Need help?** Check the documentation files or review the original `ngrok-websocket-test.js` for reference.
