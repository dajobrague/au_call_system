# Twilio Signature Verification Notes

## Security Purpose
Verify that incoming webhook requests genuinely originate from Twilio to prevent spoofing and unauthorized access.

## Signature Validation Process
1. **Extract Signature**: Get `X-Twilio-Signature` header from request
2. **Build Expected Signature**: Create HMAC-SHA1 hash of request URL + POST body
3. **Compare Signatures**: Use secure comparison to validate authenticity
4. **Reject Invalid**: Return 403 Forbidden for failed validation

## Implementation Requirements
- Use Twilio's official signature validation library
- Include full request URL (including query parameters)
- Hash the raw POST body (before JSON parsing)
- Use constant-time comparison to prevent timing attacks

## Configuration
- **Auth Token**: Use TWILIO_AUTH_TOKEN environment variable
- **Validation**: Enable for all production webhooks
- **Development**: Optional skip for localhost testing with ngrok

## Request Components
```
Expected Signature = HMAC-SHA1(
  auth_token,
  request_url + post_body
)
```

## Error Handling
- **Missing Signature**: Log security violation, return 403
- **Invalid Signature**: Log attempted spoofing, return 403
- **Malformed Request**: Log parsing errors, return 400
- **Auth Token Missing**: Fail fast on startup

## Security Best Practices
- **Never Log**: Auth tokens or signature values
- **Rate Limiting**: Implement per-IP rate limiting
- **Monitoring**: Alert on repeated signature failures
- **Rotation**: Support auth token rotation without downtime

## Development Setup
```bash
# For local testing with ngrok
export TWILIO_SKIP_SIGNATURE_VALIDATION=true

# Production (always validate)
export TWILIO_SKIP_SIGNATURE_VALIDATION=false
```

## TODO
- Implement request replay attack prevention
- Add comprehensive security monitoring
- Document signature validation bypass for testing
