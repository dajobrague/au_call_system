# Airtable Integration

## Adapter Contract
Thin wrapper around Airtable API with domain-specific operations.

## Operations
- `findJobByClientAndNumber(clientId, jobNumber)` - Lookup job record
- `updateJobFields(jobId, fieldUpdates)` - Atomic field updates
- `appendJobHistory(jobId, historyLine)` - Append to history field
- `validateClient(clientId)` - Check if client exists and active

## Field Mapping Notes
- All field names configured in `apps/web/src/config/fields.ts`
- Mappers in `packages/adapters/airtable/` handle domain ↔ Airtable conversion
- Use consistent field name constants to avoid hardcoded strings
- Handle field rename scenarios gracefully

## Error Handling
- Rate limiting: exponential backoff with jitter
- Network errors: retry up to 3 times
- Invalid field names: fail fast with clear error messages
- Permission errors: log and return user-friendly error

## TODO
- Implement connection pooling for high volume
- Add field validation before API calls
- Implement bulk operations if needed
