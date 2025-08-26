# Voice Agent Architecture

## Overview

Clean, layered architecture for an Airtable-driven call agent built with Next.js and Twilio.

## Flow Diagram

```
Twilio Call → API Route → FSM → Interpreter → Airtable/S3
     ↓            ↓        ↓         ↓           ↓
  Webhook    TwiML Gen   State    Rules &    Data Store
             Response   Machine   Parsers   & Recording
```

## Phases

### Phase 1: Twilio Plumbing ✅
- **Goal**: Basic webhook handling
- **Components**: `/api/twilio/voice` route
- **Features**: Welcome prompt, gather input, acknowledgment
- **Status**: Complete

### Phase 2: Finite State Machine
- **Goal**: Call flow management
- **Components**: `src/fsm/`
- **Features**: State transitions, retry logic, call routing
- **Status**: Planned

### Phase 3: Airtable Integration
- **Goal**: Data persistence and retrieval
- **Components**: `src/adapters/`
- **Features**: Client lookup, job updates, field mapping
- **Status**: Planned

### Phase 4: Interpreter & Responders
- **Goal**: Business logic processing
- **Components**: `src/interpreter/`, `src/responders/`
- **Features**: Input parsing, response generation, validation
- **Status**: Planned

### Phase 5: Recording Pipeline
- **Goal**: Call recording storage
- **Components**: `src/services/recordings/`
- **Features**: S3 upload, signed URLs, metadata
- **Status**: Planned

### Phase 6: Redis State Store
- **Goal**: Session management
- **Components**: `src/services/redis/`
- **Features**: Call state persistence, caching
- **Status**: Planned

### Phase 7: Internationalization
- **Goal**: Multi-language support
- **Components**: `src/i18n/`
- **Features**: Spanish prompts, locale detection
- **Status**: Planned

## Directory Structure

```
voice-agent/
├─ app/                    # Next.js App Router
│  ├─ api/twilio/voice/    # Webhook endpoint
│  ├─ page.tsx             # Landing page
│  └─ layout.tsx           # App layout
├─ src/                    # Business logic
│  ├─ config/              # Environment & telephony config
│  ├─ lib/                 # Shared utilities
│  ├─ fsm/                 # State machine (Phase 2)
│  ├─ adapters/            # External integrations (Phase 3)
│  ├─ interpreter/         # Business rules (Phase 4)
│  ├─ responders/          # Response builders (Phase 4)
│  ├─ services/            # External services (Phase 5-6)
│  └─ i18n/                # Internationalization (Phase 7)
└─ docs/                   # Documentation
```

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Telephony**: Twilio Voice API
- **Database**: Airtable (Phase 3)
- **Storage**: AWS S3 (Phase 5)
- **Cache**: Redis (Phase 6)
- **Deployment**: Vercel

## Key Principles

1. **Layered Architecture**: Clear separation of concerns
2. **Phase-based Development**: Incremental feature delivery
3. **Type Safety**: Full TypeScript coverage
4. **Clean APIs**: Well-defined interfaces between layers
5. **Testability**: Modular, testable components
