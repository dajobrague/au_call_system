# Interpreter Role

## Responsibility
Extracts structured data from user speech input and classifies user intent. Validates input format and determines appropriate actions based on current conversation stage.

## Inputs/Outputs
- **Input**: Raw speech transcription from Twilio, current call stage
- **Output**: Structured slots (client_id, job_number, action_type, values)
- **Side Effects**: None (pure function)

## Talks To
- `utils/validators` - Input format validation
- `utils/text` - Text cleaning and normalization
- No external services (keeps this role pure)

## Does NOT Do
- Airtable queries (that's Researcher's job)
- State persistence (handled by FSM controller)
- TwiML generation (that's Receiver's job)
- Record updates (that's Responder's job)

## Slot Extraction & Action Classification Rules
- **Client ID**: Alphanumeric identifier validation
- **Job Number**: Numeric format validation
- **Actions**: Maps phrases to action types (update_status, update_date, etc.)
- **Confirmation**: Recognizes yes/no/affirmative responses
- **Values**: Extracts dates, names, status values from natural speech
