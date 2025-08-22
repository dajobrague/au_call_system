# Voice Agent

Clean, layered architecture for an Airtable-driven call agent.

## Overview

This monorepo implements a voice-driven system that:
- Receives calls via Twilio webhooks
- Updates Airtable Job records through a finite state machine
- Records every call and stores audio in S3
- Appends history to existing Job records (no new rows)

## High-Level Flow

1. **Receiver**: Twilio webhook triggers FSM entry point
2. **Interpreter**: Extracts client ID, job number, and action intent
3. **Researcher**: Looks up Job in Airtable and validates actions
4. **Responder**: Updates Job record and appends formatted history

## Architecture

- `apps/web/` - Next.js API-only app with Twilio webhooks
- `packages/domain/` - Pure business logic and types
- `packages/adapters/` - External service integrations
- `packages/playbooks/` - Configuration data (stages, prompts)

## Key Configuration

### Change Field Names
Update field mappings in `apps/web/src/config/fields.ts` and corresponding mappers in `packages/adapters/airtable/`.

### Change Prompts
Edit voice lines in `packages/playbooks/phrases.es.yaml`.

### Change Stage Flow
Modify stage progression in `packages/playbooks/flow.default.yaml`.

## Getting Started

1. Copy `apps/web/.env.example` to `apps/web/.env.local`
2. Configure Twilio, Airtable, Redis, and S3 credentials
3. Set up Twilio webhooks pointing to `/api/twilio/*` endpoints
4. Start development server

## Structure

See `docs/decisions/0001-layered-architecture.md` for architectural decisions.
