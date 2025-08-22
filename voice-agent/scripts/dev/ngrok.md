# How to Expose /api/twilio/* Locally

## Overview
Use ngrok to expose your local development server to Twilio webhooks for testing voice agent functionality.

## Prerequisites
- Local development server running on port 3000 (or configured port)
- ngrok installed and authenticated
- Twilio account with phone number configured

## Setup ngrok

### Install ngrok
```bash
# macOS with Homebrew
brew install ngrok

# Or download from https://ngrok.com/download
```

### Authenticate ngrok
```bash
# Get auth token from https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken YOUR_AUTHTOKEN
```

## Expose Local Server

### Start Your Application
```bash
# In your voice-agent directory
cd apps/web
npm run dev

# Verify server is running on http://localhost:3000
```

### Start ngrok Tunnel
```bash
# In a separate terminal
ngrok http 3000

# For subdomain consistency (paid plans only)
ngrok http 3000 --subdomain=voice-agent-dev
```

### Note the Public URL
ngrok will display output like:
```
Forwarding    https://abc123.ngrok.io -> http://localhost:3000
```

Use the HTTPS URL (required for Twilio webhooks).

## Configure Twilio Webhooks

### Update Phone Number Webhooks
In Twilio Console:

1. **Go to Phone Numbers → Manage → Active Numbers**
2. **Click your voice agent phone number**
3. **Update Webhook URLs**:
   - **Voice**: `https://abc123.ngrok.io/api/twilio/voice`
   - **Status Callback**: `https://abc123.ngrok.io/api/twilio/status`
   - **Recording Status Callback**: `https://abc123.ngrok.io/api/twilio/recording`

### Update Environment Variables
Update your local `.env.local`:
```bash
# Update APP_URL to match ngrok URL
APP_URL=https://abc123.ngrok.io

# Optional: Disable signature validation for easier testing
TWILIO_SKIP_SIGNATURE_VALIDATION=true
```

## Testing Workflow

### 1. Start Development Environment
```bash
# Terminal 1: Start application
cd voice-agent/apps/web
npm run dev

# Terminal 2: Start ngrok
ngrok http 3000
```

### 2. Update Twilio Configuration
- Copy ngrok HTTPS URL from terminal output
- Update Twilio webhook URLs in console
- Save configuration changes

### 3. Test Voice Call
- Call your Twilio phone number
- Monitor both application logs and ngrok request logs
- Verify webhooks are received correctly

### 4. Debug Issues
- Check ngrok request history: http://localhost:4040
- Review application logs for errors
- Verify webhook URLs are correct in Twilio console

## ngrok Best Practices

### Use Consistent Subdomains
For paid ngrok plans, use consistent subdomains:
```bash
ngrok http 3000 --subdomain=yourname-voice-agent
```

This avoids updating Twilio webhooks every time you restart ngrok.

### Monitor Request Traffic
Access ngrok web interface:
```
http://localhost:4040
```

View all incoming requests, response times, and errors.

### Handle ngrok Restarts
When ngrok restarts, the URL changes (free plan):
1. Note new ngrok URL
2. Update Twilio webhook URLs
3. Update APP_URL environment variable
4. Restart your application if needed

## Security Considerations

### Development Only
- ngrok exposes your local server to the internet
- Only use for development and testing
- Never expose production data through ngrok

### Disable Authentication Checks
For easier development, consider disabling strict validations:
```bash
# In .env.local
TWILIO_SKIP_SIGNATURE_VALIDATION=true
DISABLE_RATE_LIMITING=true
DEBUG_MODE=true
```

### Monitor Access
- Watch ngrok request logs for unexpected traffic
- Use ngrok's authentication features if needed
- Terminate ngrok when not actively testing

## Common Issues and Solutions

### ngrok URL Changes
**Problem**: Free ngrok URLs change on restart
**Solution**: Use paid plan for subdomain consistency, or update Twilio webhooks each time

### HTTPS Required
**Problem**: Twilio requires HTTPS for webhooks
**Solution**: Always use the https:// URL from ngrok output

### Signature Validation Fails
**Problem**: Twilio signature validation fails with ngrok URLs
**Solution**: 
```bash
# Temporarily disable for development
TWILIO_SKIP_SIGNATURE_VALIDATION=true
```

### Slow Response Times
**Problem**: Webhooks timeout due to slow development server
**Solution**: 
- Optimize database queries
- Use local/fast external services
- Increase Twilio webhook timeout if possible

### Port Conflicts
**Problem**: Port 3000 already in use
**Solution**:
```bash
# Use different port
npm run dev -- --port 3001

# Update ngrok command
ngrok http 3001
```

## Alternative: localtunnel

If ngrok is unavailable, use localtunnel:
```bash
# Install
npm install -g localtunnel

# Start tunnel
npx localtunnel --port 3000

# Use subdomain for consistency
npx localtunnel --port 3000 --subdomain voice-agent-dev
```

## Production-Like Testing

### Use ngrok with Custom Domain (Pro Plan)
```bash
ngrok http 3000 --hostname=voice-agent-staging.yourdomain.com
```

### Environment Variables for ngrok
```bash
# .env.ngrok
APP_URL=https://abc123.ngrok.io
TWILIO_SKIP_SIGNATURE_VALIDATION=true
DEBUG_MODE=true
LOG_LEVEL=debug
```

Load with:
```bash
# Load ngrok-specific environment
source .env.ngrok
npm run dev
```

## Cleanup

### When Finished Testing
1. **Stop ngrok**: Ctrl+C in ngrok terminal
2. **Revert Twilio Webhooks**: Point back to staging/production URLs
3. **Clear Environment**: Remove ngrok-specific environment variables
4. **Stop Development Server**: Ctrl+C in application terminal

### Reset Twilio Configuration
```bash
# Example production URLs
Voice: https://voice-agent.yourdomain.com/api/twilio/voice
Status: https://voice-agent.yourdomain.com/api/twilio/status
Recording: https://voice-agent.yourdomain.com/api/twilio/recording
```

## TODO
- Create automated script to update Twilio webhooks with current ngrok URL
- Add ngrok configuration file for consistent settings
- Implement webhook URL validation in development environment
