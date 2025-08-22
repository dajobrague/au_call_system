# Audit Logging

## What We Would Log
Comprehensive audit trail for security, compliance, and operational monitoring.

## Call Events
- **Call Start**: CallSid, From number, To number, timestamp
- **Call End**: Duration, disconnect reason, final stage reached
- **Stage Transitions**: From stage, to stage, trigger, user input (sanitized)
- **Validation Failures**: Invalid input attempts, field validation errors
- **Action Attempts**: All action requests, success/failure, user context

## Data Access Events
- **Job Lookups**: Client ID, job number, found/not found, response time
- **Airtable Queries**: Table accessed, record ID, operation type, latency
- **Record Updates**: Field changes, old/new values, update timestamp
- **History Appends**: New history lines added, total history length

## Security Events
- **Authentication**: Twilio signature validation results
- **Authorization**: Permission checks for job access, assignee updates
- **Input Validation**: Malformed input, injection attempts, rate limiting
- **Error Patterns**: Repeated failures, potential abuse detection

## System Events
- **API Latency**: Response times for all external services
- **Error Rates**: Failed API calls, retry attempts, circuit breaker trips
- **State Management**: Redis operations, state corruption recovery
- **Recording Pipeline**: Upload success/failure, S3 operations, URL generation

## Privacy Considerations
- **PII Masking**: Phone numbers, names, sensitive job details
- **Retention**: Audit logs retained separately from operational data
- **Access Control**: Audit log access restricted to authorized personnel
- **Anonymization**: Remove/mask identifiers for analytics

## Implementation Notes
- **Structured Logging**: JSON format for easy parsing and analysis
- **Log Levels**: INFO for normal operations, WARN for retries, ERROR for failures
- **Sampling**: High-volume events may be sampled to manage costs
- **Async Logging**: Non-blocking logging to avoid performance impact

## Can Be No-Op in Production
This audit system can be implemented as no-op stubs for simplified deployments where comprehensive auditing is not required.

## TODO
- Define log retention and archival strategy
- Implement log aggregation and monitoring
- Add alerting for security and operational anomalies
