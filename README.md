# Australian Project - Voice Agent & Provider Portal

A comprehensive call center management system with AI-powered voice agent and provider portal.

## 📁 Project Structure

This repository contains two main components:

### 1. Voice Agent (`voice-agent/`)
AI-powered voice assistant for handling incoming calls via Twilio, with real-time voice interaction using ElevenLabs.

**Key Features:**
- Twilio Media Streams integration for real-time call handling
- Real-time voice interaction with ElevenLabs TTS/STT
- WebSocket-based audio streaming
- Airtable integration for call data management
- Redis/Upstash state management
- Automated SMS notification waves for shift coverage
- Call recording and comprehensive reporting
- Multi-provider support with dynamic configuration

**Deployment:** Railway (WebSocket server with persistent connections)

### 2. Provider Portal (`provider-portal/`)
White-labeled web portal for call center providers to manage their operations.

**Key Features:**
- Session-based authentication with Airtable
- Provider-specific data filtering
- Employee, patient, and job template management
- Real-time call logs and occurrence tracking
- Comprehensive daily reports with PDF export
- Data entry and bulk operations
- Responsive design with Tailwind CSS

**Deployment:** Vercel (Next.js serverless hosting)

## 🚀 Complete Setup Guide

### Prerequisites

Before starting, you'll need accounts and credentials for:

- **Node.js 18+** and npm
- **Twilio** account with phone number
- **Airtable** account with base configured
- **Upstash Redis** instance (free tier available)
- **AWS S3** bucket for call recordings
- **ElevenLabs** API key for voice synthesis
- **Railway** account (for voice-agent deployment)
- **Vercel** account (for provider-portal deployment)

---

## 🎯 Voice Agent Setup (Railway)

### Step 1: Local Development Setup

```bash
cd voice-agent
npm install
```

Create `.env.local` file:
```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
PROD_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PROD_TWILIO_AUTH_TOKEN=your_prod_auth_token
PROD_TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

# ElevenLabs Configuration
ELEVENLABS_API_KEY=sk_your_key_here
ELEVENLABS_VOICE_ID=your_voice_id

# Airtable Configuration
AIRTABLE_API_KEY=patxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIRTABLE_BASE_ID=appxxxxxxxxxxxxxxx

# Redis/Upstash Configuration
REDIS_URL=redis://your_redis_url
UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_REGION=us-east-1

# Application Configuration
NODE_ENV=development
WEBSOCKET_URL=ws://localhost:8080/stream
```

Run development server:
```bash
npm run dev
```

### Step 2: Deploy to Railway

1. **Create Railway Project**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository and select the `voice-agent` directory

2. **Configure Environment Variables**
   
   In Railway dashboard → Your Service → Variables, add all production variables:
   
   ```
   ELEVENLABS_API_KEY=sk_your_key_here
   ELEVENLABS_VOICE_ID=your_voice_id
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   PROD_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   PROD_TWILIO_AUTH_TOKEN=your_prod_auth_token
   PROD_TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
   AIRTABLE_API_KEY=patxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   AIRTABLE_BASE_ID=appxxxxxxxxxxxxxxx
   REDIS_URL=your_redis_url
   UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_upstash_token
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_S3_BUCKET_NAME=your_bucket_name
   AWS_REGION=us-east-1
   NODE_ENV=production
   ```

3. **Get Your Railway WebSocket URL**
   
   After deployment, Railway provides a URL like:
   ```
   https://your-service-name.up.railway.app
   ```
   
   Your WebSocket endpoint will be:
   ```
   wss://your-service-name.up.railway.app/stream
   ```

4. **Test Your Deployment**
   ```bash
   curl https://your-service-name.up.railway.app/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

5. **Configure Twilio Webhook**
   
   In Twilio Console → Phone Numbers → Your Number:
   - **Voice & Fax** → **A CALL COMES IN**: Webhook
   - URL: `https://your-service-name.up.railway.app/api/twilio/voice`
   - Method: POST

---

## 🎯 Provider Portal Setup (Vercel)

### Step 1: Local Development Setup

```bash
cd provider-portal
npm install
```

Create `.env.local` file:
```bash
# Airtable Configuration
AIRTABLE_API_KEY=patxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIRTABLE_BASE_ID=appxxxxxxxxxxxxxxx
USER_TABLE_ID=tblLiBIYIt9jDwQGT

# Session Configuration (minimum 32 characters)
SESSION_SECRET=your_very_secure_session_secret_key_min_32_characters

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Run development server:
```bash
npm run dev
```

Visit http://localhost:3000 and log in with your Airtable provider user credentials.

### Step 2: Deploy to Vercel

1. **Connect to Vercel**
   
   If you haven't connected your repository to Vercel yet:
   ```bash
   npx vercel login
   npx vercel link
   ```

2. **Configure Environment Variables**
   
   In Vercel Dashboard → Your Project → Settings → Environment Variables:
   
   Add the following for **Production**, **Preview**, and **Development**:
   ```
   AIRTABLE_API_KEY=patxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   AIRTABLE_BASE_ID=appxxxxxxxxxxxxxxx
   USER_TABLE_ID=tblLiBIYIt9jDwQGT
   SESSION_SECRET=your_very_secure_session_secret_key_min_32_characters
   NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
   ```

3. **Deploy to Production**
   ```bash
   cd provider-portal
   npx vercel --prod
   ```

4. **Verify Deployment**
   - Visit your Vercel URL
   - Test login with your provider credentials
   - Check that all dashboard sections load correctly

---

## 🔗 Connecting the Systems

After deploying both components, you need to connect them:

1. **Update Voice Agent with WebSocket URL (if self-referencing)**
   
   The voice agent on Railway needs to know its own WebSocket URL for Twilio:
   - Railway → Your Service → Variables
   - Add/Update: `WEBSOCKET_URL=wss://your-service-name.up.railway.app/stream`
   - Redeploy if necessary

2. **Test End-to-End**
   - Call your Twilio number
   - Voice agent should answer and interact
   - Check Airtable for call logs
   - View call logs in Provider Portal

---

## 🛠️ Technology Stack

**Backend:**
- Next.js 16 (App Router)
- TypeScript
- Node.js 18+

**Voice & Telephony:**
- Twilio Voice API & Media Streams
- ElevenLabs (Text-to-Speech & Speech-to-Text)
- WebSocket connections (ws library)

**Data & State:**
- Airtable (primary database)
- Upstash Redis (call state management)
- AWS S3 (call recordings storage)

**Infrastructure:**
- Railway (WebSocket server for voice-agent)
- Vercel (Next.js hosting for provider-portal)

**UI:**
- React 19
- Tailwind CSS 4
- Lucide React icons

---

## 📚 Additional Documentation

### Voice Agent
- [Voice Agent README](voice-agent/README.md) - Detailed voice agent documentation
- [Railway Deployment](voice-agent/RAILWAY_DEPLOYMENT.md) - Railway-specific deployment guide
- [Testing Guide](voice-agent/TESTING_GUIDE.md) - Local and production testing procedures
- [Twilio Setup](voice-agent/TWILIO_SETUP.md) - Twilio configuration details
- [Modules Guide](voice-agent/MODULES_GUIDE.md) - Code architecture and organization
- [Architecture](voice-agent/docs/architecture.md) - System design and flow
- [Environment Setup](voice-agent/docs/environment-setup.md) - All environment variables explained

### Provider Portal
- [Provider Portal README](provider-portal/README.md) - Detailed portal documentation
- [Daily Reports Feature](provider-portal/DAILY_REPORTS_FEATURE.md) - Reports functionality

---

## 🔐 Security Best Practices

- **Never commit `.env.local` files** - Add to `.gitignore`
- **Use strong session secrets** - Minimum 32 characters, randomly generated
- **Separate dev/prod credentials** - Use different Twilio/AWS credentials for each environment
- **Rotate API keys regularly** - Especially for production environments
- **HTTPS only in production** - Enforce secure connections
- **Use PROD_ prefixed variables** - Voice agent automatically uses these in production

---

## 🧪 Testing Your Setup

### Voice Agent Health Check
```bash
curl https://your-railway-url.up.railway.app/health
# Expected: {"status":"ok","timestamp":"2024-..."}
```

### Test a Live Call
1. Call your Twilio number
2. Voice agent should answer with greeting
3. Test various interactions (transfer, messages, etc.)
4. Check Airtable for call log entry
5. Verify call recording in S3

### Provider Portal Check
1. Log in at your Vercel URL
2. Navigate to Call Logs
3. Verify recent calls appear
4. Test daily reports generation
5. Check PDF export functionality

---

## 🐛 Troubleshooting

### Voice Agent Issues

**"WebSocket connection failed"**
- Verify `WEBSOCKET_URL` uses `wss://` (not `ws://`)
- Check Railway service is running
- Test health endpoint

**"No audio during call"**
- Check ElevenLabs API key is valid
- Verify ElevenLabs voice ID exists
- Check Railway logs for errors

**"Call doesn't connect"**
- Verify Twilio webhook points to Railway URL
- Check Twilio credentials (use PROD_ prefix in production)
- Ensure Railway service is publicly accessible

### Provider Portal Issues

**"Login fails"**
- Verify Airtable API key has read access
- Check user exists in User table
- Verify SESSION_SECRET is set (min 32 chars)

**"No data showing"**
- Check user is linked to a provider in Airtable
- Verify AIRTABLE_BASE_ID is correct
- Check browser console for API errors

**"Reports won't generate"**
- Verify call logs exist for the date range
- Check browser console for errors
- Ensure provider has call data in Airtable

---

## 💰 Estimated Costs

- **Railway**: Free tier ($5/month credit) - typically sufficient for moderate usage
- **Vercel**: Free tier (Hobby plan) - includes unlimited deployments
- **Upstash Redis**: Free tier (10K commands/day) - sufficient for most use cases
- **Twilio**: Pay-as-you-go (varies by usage)
- **ElevenLabs**: Subscription-based (varies by plan)
- **AWS S3**: Pay-as-you-go (typically $1-5/month for recordings)
- **Airtable**: Free tier (1,200 records/base) or paid plans

**Total monthly estimate**: $10-30 for small to moderate usage

---

## 🆘 Support

For issues or questions:
1. Check component-specific README files
2. Review documentation in `voice-agent/docs/`
3. Check [Testing Guide](voice-agent/TESTING_GUIDE.md) for troubleshooting
4. Review deployment logs in Railway/Vercel dashboards
5. Check Airtable API status and rate limits

---

## 📄 License

Proprietary - All rights reserved
