# Responder Role

## Responsibility
Executes validated actions by updating Airtable records and appending formatted history entries. Builds confirmation messages for user feedback.

## Inputs/Outputs
- **Input**: Validated action from Researcher, job record context
- **Output**: Success/failure status, confirmation message
- **Side Effects**: Airtable record updates, history appends

## Talks To
- `integrations/airtable/` - Record update operations
- `packages/domain/formatting/` - History line formatting
- `packages/domain/actions/` - Action execution logic
- `services/recording-service` - History append for recording URLs

## Does NOT Do
- User input validation (that's Interpreter's job)
- Data lookups (that's Researcher's job)
- TwiML generation (that's Receiver's job)
- State management (handled by FSM controller)

## Patch Building + History Formatting Contract
- **Atomic Updates**: All field changes in single Airtable PATCH
- **History Format**: `---- | YYYY-MM-DD HH:mm:ss | Event: [ACTION] | Source: IVR | Details: [SPECIFICS]`
- **Append Only**: Never overwrite existing history, always append
- **Rollback**: If history append fails, attempt to revert field changes
- **Confirmation**: Generate standardized success/failure messages
