# Receiver Role

## Responsibility
Handles initial call setup and TwiML generation for Twilio webhooks. Initiates the finite state machine and provides the entry point for all voice interactions.

## Inputs/Outputs
- **Input**: Twilio webhook payload (CallSid, From, To, etc.)
- **Output**: TwiML response to start conversation flow
- **Side Effects**: Creates initial call state in StateStore

## Talks To
- `integrations/twilio/` - TwiML generation helpers
- `integrations/redis/` - Initial state persistence via StateStore
- `fsm/machine` - Determines first stage and transition logic

## Does NOT Do
- User input processing (that's Interpreter's job)
- Airtable lookups (that's Researcher's job)
- Record updates (that's Responder's job)
- Business logic validation

## Prompt Keys Used
- `prompts.welcome` - Initial greeting message
- `prompts.collect_client_id.ask` - First question to user
