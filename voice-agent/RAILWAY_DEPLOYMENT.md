# Railway Deployment Guide

## Quick Setup (5 minutes)

### 1. Deploy to Railway

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will auto-detect and start deploying

### 2. Configure Environment Variables

In Railway dashboard, go to **Variables** tab and add:

```
ELEVENLABS_API_KEY=sk_your_key_here
ELEVENLABS_VOICE_ID=your_voice_id
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
AIRTABLE_API_KEY=patxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIRTABLE_BASE_ID=appxxxxxxxxxxxxxxx
NODE_ENV=production
```

Optional (if you have Redis):
```
REDIS_URL=your_redis_url
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_token
```

### 3. Get Your WebSocket URL

Once deployed, Railway gives you a public URL like:
```
https://your-service-name.up.railway.app
```

Your WebSocket endpoint will be:
```
wss://your-service-name.up.railway.app/stream
```

### 4. Update Vercel Environment

Go to your Vercel project → Settings → Environment Variables:

Add or update:
```
WEBSOCKET_URL=wss://your-service-name.up.railway.app/stream
```

Then redeploy your Vercel app for the changes to take effect.

### 5. Test Your Deployment

Test the health endpoint:
```bash
curl https://your-service-name.up.railway.app/health
```

Should return: `{"status":"ok","timestamp":"..."}`

### 6. Update Twilio (if needed)

If you're using TwiML, make sure it points to your Vercel app, which will then use the Railway WebSocket URL.

## Troubleshooting

### Check Logs
In Railway dashboard, click on your service → **Logs** tab to see real-time logs.

### Common Issues

**Build fails:**
- Make sure all dependencies are in package.json
- Check that ts-node is in dependencies (not devDependencies)

**Server won't start:**
- Check environment variables are set
- Look at the logs for missing variables

**WebSocket connection fails:**
- Make sure you're using `wss://` not `ws://`
- Check that the Railway URL is correct
- Verify environment variable is set in Vercel

## Production Checklist

- [ ] All environment variables set in Railway
- [ ] Service is deployed and running
- [ ] Health endpoint responds
- [ ] WEBSOCKET_URL updated in Vercel
- [ ] Vercel redeployed with new variable
- [ ] Test call works with real Twilio number

## Cost

Railway free tier includes:
- $5 of usage per month
- Should be enough for moderate usage
- Upgrade if needed (~$5-20/month typical)

