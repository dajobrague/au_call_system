# Voice Agent - Twilio Integration

Clean, layered architecture for an Airtable-driven call agent built with Next.js and Twilio.

## 🚀 Quick Start

### 1. Environment Setup
```bash
cp .env.local.example .env.local
# Edit .env.local with your Twilio credentials
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Test Locally
```bash
./scripts/smoke-curl.sh
```

## 📋 Phase 1: Twilio Plumbing ✅

**Status**: Complete and ready for testing

### Features
- ✅ Twilio webhook handler (`/api/twilio/voice`)
- ✅ Welcome prompt with speech + DTMF input
- ✅ Retry logic for no input scenarios
- ✅ Clean TwiML response generation
- ✅ Structured logging and error handling

### Test It
1. **Local**: Run smoke tests with `./scripts/smoke-curl.sh`
2. **Production**: Deploy to Vercel and configure Twilio webhook
3. **Real Call**: Call your Twilio number to test end-to-end

## 🏗️ Architecture

```
Twilio Call → API Route → FSM → Interpreter → Airtable/S3
     ↓            ↓        ↓         ↓           ↓
  Webhook    TwiML Gen   State    Rules &    Data Store
             Response   Machine   Parsers   & Recording
```

### Directory Structure
```
voice-agent/
├─ app/                    # Next.js App Router
│  ├─ api/twilio/voice/    # Webhook endpoint ✅
│  ├─ page.tsx             # Landing page ✅
│  └─ layout.tsx           # App layout ✅
├─ src/                    # Business logic
│  ├─ config/              # Environment & telephony config ✅
│  ├─ lib/                 # Shared utilities ✅
│  ├─ fsm/                 # State machine (Phase 2)
│  ├─ adapters/            # External integrations (Phase 3)
│  ├─ interpreter/         # Business rules (Phase 4)
│  ├─ responders/          # Response builders (Phase 4)
│  ├─ services/            # External services (Phase 5-6)
│  └─ i18n/                # Internationalization (Phase 7)
├─ docs/                   # Documentation ✅
├─ scripts/                # Utility scripts ✅
└─ README.md               # This file ✅
```

## 📚 Documentation

- **[Architecture](docs/architecture.md)**: System design and phase breakdown
- **[Deployment](docs/deploy-vercel.md)**: Vercel deployment guide with sanity tests
- **[Testing](docs/manual-tests/phase-1-call-scenarios.md)**: Manual test scenarios and curl examples

## 🧪 Testing

### Automated Tests
```bash
# Smoke test all endpoints
./scripts/smoke-curl.sh

# Test production deployment
./scripts/smoke-curl.sh https://your-app.vercel.app
```

### Manual Testing
See [Phase 1 Call Scenarios](docs/manual-tests/phase-1-call-scenarios.md) for detailed test cases.

## 🚢 Deployment

### Vercel (Recommended)
```bash
npx vercel --prod
```

See [Deployment Guide](docs/deploy-vercel.md) for complete instructions.

### Local Development with ngrok
```bash
npm run dev
ngrok http 3000
# Update Twilio webhook to ngrok URL
```

See [ngrok Notes](scripts/ngrok-notes.md) for details.

## 🔮 Roadmap

- **Phase 1**: Twilio Plumbing ✅
- **Phase 2**: Finite State Machine
- **Phase 3**: Airtable Integration  
- **Phase 4**: Interpreter & Responders
- **Phase 5**: Recording Pipeline (S3)
- **Phase 6**: Redis State Store
- **Phase 7**: Internationalization

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Telephony**: Twilio Voice API
- **Database**: Airtable (Phase 3)
- **Storage**: AWS S3 (Phase 5)
- **Cache**: Redis (Phase 6)
- **Deployment**: Vercel

## 📞 Support

For issues or questions:
1. Check the [documentation](docs/)
2. Review [test scenarios](docs/manual-tests/phase-1-call-scenarios.md)
3. Run [smoke tests](scripts/smoke-curl.sh)
4. Check Vercel function logs