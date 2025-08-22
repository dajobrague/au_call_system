# Adapters Package

External service integration adapters that keep external concerns separate from domain logic.

## Purpose
Provides thin adapters for external services (Airtable, Redis, Twilio, S3) that translate between domain models and external service APIs.

## Design Principles
- **Thin Adapters**: Minimal logic, focus on data transformation
- **Domain Isolation**: Keep domain models independent of external schemas
- **Error Translation**: Convert external errors to domain-appropriate messages
- **Testable**: Easy to mock and test in isolation

## Adapter Types

### Data Adapters
- **Airtable**: Job and client record persistence
- **Redis**: Temporary state storage for call sessions

### Service Adapters  
- **Twilio**: TwiML generation and voice interaction helpers
- **S3**: Recording storage and URL management

## Mapping Strategy
Each adapter includes bidirectional mappers:

### Domain → External
Transform domain models to external service format:
- Field name mapping (domain fields → external fields)
- Value transformation (enums → strings, dates → ISO format)
- Structure adaptation (flat → nested, single → multiple records)

### External → Domain
Transform external data to domain models:
- Field name reverse mapping
- Value parsing and validation  
- Structure normalization
- Error handling and validation

## Error Handling
Adapters provide consistent error handling:
- **Network Errors**: Retry logic with exponential backoff
- **Validation Errors**: Clear field-level error messages
- **Authorization Errors**: User-friendly permission messages
- **Rate Limiting**: Automatic throttling and queuing

## Configuration
Adapters use environment-based configuration:
- **Connection Settings**: URLs, credentials, timeouts
- **Field Mappings**: Customizable field name mappings
- **Retry Policies**: Configurable retry counts and delays
- **Feature Flags**: Enable/disable specific adapter features

## Testing Strategy
- **Unit Tests**: Test mappers with various data scenarios
- **Integration Tests**: Test against real external services (dev/staging)
- **Mock Adapters**: In-memory implementations for fast testing
- **Contract Tests**: Verify external service compatibility

## Usage Examples
```typescript
// Using Airtable adapter
const jobAdapter = new AirtableJobAdapter(config);
const job = await jobAdapter.findByClientAndNumber('ABC123', '456');
await jobAdapter.updateStatus(job.id, 'COMPLETED');

// Using state adapter  
const stateAdapter = new RedisStateAdapter(config);
await stateAdapter.saveCallState(callSid, state);
const state = await stateAdapter.getCallState(callSid);
```
