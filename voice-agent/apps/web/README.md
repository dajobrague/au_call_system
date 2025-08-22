# Voice Agent Web App

Next.js API-only application that handles Twilio webhooks for the voice agent system.

## API Endpoints

- `/api/twilio/voice` - Initial call handler (TwiML entry point)
- `/api/twilio/handle-gather` - Main FSM loop for user input processing
- `/api/twilio/status` - Call status callbacks from Twilio
- `/api/twilio/recording` - Recording availability callbacks

## Setup

1. Copy `.env.example` to `.env.local`
2. Configure all required environment variables
3. Set up Twilio webhooks to point to these endpoints
4. Start development server

## Architecture

This app orchestrates the four main roles:
- **Receiver**: Handles initial call setup
- **Interpreter**: Extracts user intent and slots
- **Researcher**: Validates against Airtable data
- **Responder**: Updates records and provides feedback
