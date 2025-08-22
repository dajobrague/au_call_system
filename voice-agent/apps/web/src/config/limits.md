# Timeouts, Retries, and Limits

## Call Timeouts
- **Input Timeout**: 5 seconds for user speech input
- **Total Call Timeout**: 10 minutes maximum call duration
- **Silence Timeout**: 3 seconds of silence before prompting again
- **Stage Timeout**: 2 minutes maximum per stage

## Retry Limits
- **Invalid Input**: 3 attempts per stage before escalation
- **Airtable API**: 3 retries with exponential backoff
- **S3 Upload**: 3 retries with exponential backoff
- **Redis Operations**: 2 retries with 1-second delay

## Data Limits
- **Client ID**: 3-50 alphanumeric characters
- **Job Number**: 1-20 numeric characters
- **Notes**: 500 characters maximum per addition
- **History Line**: 1000 characters maximum
- **Recording File**: 100MB maximum size

## Rate Limits
- **Concurrent Calls**: 50 simultaneous calls (configurable)
- **Airtable API**: 5 requests per second per API key
- **S3 Operations**: 100 requests per second
- **Redis Operations**: 1000 operations per second

## Backoff Strategies
- **Initial Delay**: 1 second
- **Exponential Factor**: 2x (1s, 2s, 4s, 8s)
- **Max Delay**: 30 seconds
- **Jitter**: ±20% random variation

## Resource Limits
- **Call State TTL**: 1 hour in Redis
- **Memory per Call**: 10MB maximum
- **CPU per Call**: 100ms average processing time
- **Storage per Recording**: 50MB average size

## TODO
- Make limits configurable via environment variables
- Add monitoring and alerting for limit violations
- Implement graceful degradation when limits approached
