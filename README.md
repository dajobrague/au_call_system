# Australian Project - Voice Agent & Provider Portal

A comprehensive call center management system with AI-powered voice agent and provider portal.

## 📁 Project Structure

This repository contains two main components:

### 1. Voice Agent (`voice-agent/`)
AI-powered voice assistant for handling incoming calls via Twilio, with real-time voice interaction using ElevenLabs.

**Key Features:**
- Twilio Media Streams integration
- Real-time voice interaction with ElevenLabs
- WebSocket-based audio streaming (via Railway)
- Airtable integration for call data management
- Redis state management
- Automated SMS notifications
- Call recording and reporting
- Multi-provider support

**Documentation:**
- [Voice Agent README](voice-agent/README.md) - Main documentation
- [Testing Guide](voice-agent/TESTING_GUIDE.md) - Local and production testing
- [Twilio Setup](voice-agent/TWILIO_SETUP.md) - Twilio configuration
- [Railway Deployment](voice-agent/RAILWAY_DEPLOYMENT.md) - WebSocket server deployment
- [Modules Guide](voice-agent/MODULES_GUIDE.md) - Architecture documentation
- [Architecture](voice-agent/docs/architecture.md) - System design
- [Environment Setup](voice-agent/docs/environment-setup.md) - Environment variables

### 2. Provider Portal (`provider-portal/`)
White-labeled web portal for call center providers to manage their operations.

**Key Features:**
- Session-based authentication
- Provider-specific data filtering
- Employee management
- Patient management
- Job template management
- Call logs and reports
- Responsive design

**Documentation:**
- [Provider Portal README](provider-portal/README.md)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Twilio account with phone number
- Airtable account and base
- Redis instance (Upstash recommended)
- AWS S3 bucket (for recordings)
- ElevenLabs API key
- Railway account (for WebSocket server)

### Environment Setup

Each component requires its own environment configuration:

**Voice Agent:**
```bash
cd voice-agent
cp .env.example .env.local
# Edit .env.local with your credentials
```

**Provider Portal:**
```bash
cd provider-portal
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Local Development

**Voice Agent:**
```bash
cd voice-agent
npm install
npm run dev
```

**Provider Portal:**
```bash
cd provider-portal
npm install
npm run dev
```

## 📚 Documentation

### Getting Started
1. Start with [Voice Agent README](voice-agent/README.md) for system overview
2. Follow [Environment Setup Guide](voice-agent/docs/environment-setup.md)
3. Configure Twilio using [Twilio Setup Guide](voice-agent/TWILIO_SETUP.md)
4. Set up WebSocket server with [Railway Deployment](voice-agent/RAILWAY_DEPLOYMENT.md)

### Testing
- [Testing Guide](voice-agent/TESTING_GUIDE.md) - Comprehensive testing procedures for local and production

### Architecture
- [Architecture Document](voice-agent/docs/architecture.md) - System design and component interaction
- [Modules Guide](voice-agent/MODULES_GUIDE.md) - Code organization and module usage

## 🛠️ Technology Stack

**Backend:**
- Next.js 14/15 (App Router)
- TypeScript
- Node.js

**Voice & Telephony:**
- Twilio Voice API & Media Streams
- ElevenLabs (Text-to-Speech & Speech-to-Text)
- WebSocket connections

**Data & State:**
- Airtable (database)
- Redis (state management)
- AWS S3 (recordings storage)

**Infrastructure:**
- Vercel (Next.js hosting)
- Railway (WebSocket server)

**UI:**
- React
- Tailwind CSS
- Lucide React icons

## 🔐 Security Notes

- All credentials should be stored in environment variables
- Never commit `.env.local` files
- Use separate credentials for development and production
- Session secrets must be at least 32 characters
- Production should use `PROD_*` prefixed Twilio variables

## 📦 Deployment

### Voice Agent
```bash
cd voice-agent
npx vercel --prod
```

### Provider Portal
```bash
cd provider-portal
npx vercel --prod
```

### WebSocket Server
Deploy to Railway - see [Railway Deployment Guide](voice-agent/RAILWAY_DEPLOYMENT.md) for instructions.

See individual component READMEs for detailed deployment instructions.

## 📝 Environment Variables Reference

### Required for Voice Agent
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `AIRTABLE_API_KEY` - Airtable personal access token
- `AIRTABLE_BASE_ID` - Airtable base identifier
- `REDIS_URL` - Redis connection URL
- `REDIS_TOKEN` - Redis authentication token
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_S3_BUCKET_NAME` - S3 bucket for recordings
- `ELEVENLABS_API_KEY` - ElevenLabs API key
- `WEBSOCKET_URL` - WebSocket endpoint URL

### Required for Provider Portal
- `AIRTABLE_API_KEY` - Airtable personal access token
- `AIRTABLE_BASE_ID` - Airtable base identifier
- `SESSION_SECRET` - Secret for session encryption (min 32 chars)
- `NEXT_PUBLIC_APP_URL` - Application URL

See `.env.example` files in each component for complete variable lists.

## 🆘 Support

For issues or questions:
1. Check component-specific README files
2. Review documentation in `voice-agent/docs/`
3. Check testing guide for troubleshooting steps
4. Review deployment guides for production issues

## 📄 License

Proprietary - All rights reserved

