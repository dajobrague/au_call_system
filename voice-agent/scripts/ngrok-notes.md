# ngrok Local Tunneling (Optional)

## When to Use ngrok

Use ngrok for local development and testing when:
- Vercel deployment issues need debugging
- Testing webhook locally before deployment
- Rapid iteration without deployment delays
- Testing with real Twilio phone numbers

## Setup

### 1. Install ngrok
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/
```

### 2. Start Local Server
```bash
cd voice-agent
npm run dev
# Server starts on http://localhost:3000
```

### 3. Start ngrok Tunnel
```bash
ngrok http 3000
```

Output will show:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### 4. Update Twilio Webhook
In Twilio Console:
- **Webhook URL**: `https://abc123.ngrok.io/api/twilio/voice`
- **Method**: POST

## Testing

### Smoke Test
```bash
./scripts/smoke-curl.sh https://abc123.ngrok.io
```

### Real Phone Call
Call your Twilio number to test the full flow.

## Advantages

✅ **Instant Updates**: No deployment delays  
✅ **Real Debugging**: Full access to logs and debugger  
✅ **Rapid Iteration**: Change code, test immediately  
✅ **Real Webhooks**: Test with actual Twilio requests  

## Disadvantages

❌ **Temporary URLs**: ngrok URLs change on restart  
❌ **Local Only**: Only works while your machine is running  
❌ **Rate Limits**: Free ngrok has connection limits  

## Best Practices

1. **Use for Development**: Perfect for building and testing
2. **Switch to Production**: Use Vercel for final deployment
3. **Keep URLs Updated**: Remember to update Twilio webhook when ngrok restarts
4. **Monitor Logs**: Watch terminal for real-time webhook calls

## Security Note

ngrok URLs are publicly accessible. Don't use in production or share URLs containing sensitive data.

## Cleanup

When done testing:
1. Stop ngrok (Ctrl+C)
2. Update Twilio webhook back to production URL
3. Stop local dev server
