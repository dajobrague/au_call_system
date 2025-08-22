# Researcher Role

## Responsibility
Performs Airtable lookups to validate user input and retrieve job information. Provides data context for confirmation and action validation.

## Inputs/Outputs
- **Input**: Client ID, Job Number from Interpreter
- **Output**: Job record data, validation results
- **Side Effects**: Read-only Airtable queries

## Talks To
- `integrations/airtable/` - Job and Client record lookups
- `packages/domain/selectors/` - Determines which fields to present for confirmation
- `packages/domain/actions/` - Validates if requested actions are allowed

## Does NOT Do
- User input processing (that's Interpreter's job)
- Record updates (that's Responder's job)
- TwiML generation (that's Receiver's job)
- Speech processing

## Airtable Lookups & Confirm Projections
- **Job Lookup**: Find job by client_id + job_number combination
- **Client Validation**: Verify client exists and is active
- **Field Projection**: Select relevant fields for user confirmation
- **Action Validation**: Check if requested updates are permitted
- **Status Constraints**: Validate status transitions are allowed
