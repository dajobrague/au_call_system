# Voice Agent - Twilio Integration

A clean, layered architecture for an Airtable-driven call agent built with Next.js and Twilio.

## Phase 1: Twilio Plumbing ✅

The basic Twilio voice webhook is now implemented and ready for testing.

### What's Working

- ✅ **Voice Webhook**: `/api/twilio/voice` endpoint handles incoming calls
- ✅ **English Prompts**: Clear welcome message and instructions
- ✅ **Speech Recognition**: Accepts spoken numbers in English
- ✅ **DTMF Support**: Keypad input with # to finish
- ✅ **Timeout Handling**: Reprompts once, then politely ends call
- ✅ **Error Handling**: Graceful error responses in TwiML format

### Quick Start

1. **Set up environment variables**:
   Create a `.env.local` file in the project root with:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
   ```

2. **Install dependencies**:
   ```bash
   cd voice-agent/apps/web
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Test locally** (optional):
   ```bash
   # Test initial call
   curl -X POST http://localhost:3000/api/twilio/voice \
     -d "CallSid=test" -d "From=+1234567890" -d "To=+1987654321"
   
   # Test with speech input
   curl -X POST http://localhost:3000/api/twilio/voice \
     -d "CallSid=test" -d "SpeechResult=one two three"
   ```

### Call Flow

1. **Initial Call**: Plays welcome prompt and starts gathering input
2. **User Input**: Accepts speech or DTMF digits followed by #
3. **Success**: Acknowledges input and hangs up
4. **Timeout**: Reprompts once, then ends call politely

### Next Steps

1. **Deploy to Vercel**: Follow `docs/deployment/vercel-setup.md`
2. **Configure Twilio**: Point your number to the webhook URL
3. **Test with real calls**: Use the scenarios in `docs/manual-tests/phase-1-call-scenarios.md`
4. **Move to Phase 2**: Implement FSM state management

### Project Structure

```
voice-agent/
├── apps/web/                          # Next.js web application
│   ├── app/api/twilio/voice/          # Twilio webhook endpoints
│   └── package.json                   # Web app dependencies
├── docs/
│   ├── deployment/                    # Deployment guides
│   └── manual-tests/                  # Test scenarios
└── packages/                          # Shared packages (future)
```

### Testing

- **Manual Tests**: See `docs/manual-tests/phase-1-call-scenarios.md`
- **Local Testing**: Webhook responds correctly to all scenarios
- **Deployment**: Ready for Vercel with environment variables

### Troubleshooting

Common issues and solutions are documented in:
- `docs/deployment/vercel-setup.md` - Deployment issues
- `docs/manual-tests/phase-1-call-scenarios.md` - Call flow issues

---

**Status**: Phase 1 Complete ✅  
**Next**: Phase 2 - FSM/State Management