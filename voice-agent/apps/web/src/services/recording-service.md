# Recording Service

## S3 Upload + History Append Flow
Manages the complete recording pipeline from Twilio webhook to Airtable history.

## Pipeline Steps
1. **Receive Webhook**: Twilio posts recording availability notification
2. **Resolve Job**: Lookup job record using call state (CallSid → client_id + job_number)
3. **Fetch Recording**: Download audio file from Twilio's RecordingUrl
4. **Upload to S3**: Store with timestamped key and encryption
5. **Generate URL**: Create signed URL for secure access
6. **Update History**: Append recording URL to job_history field

## Input Requirements
- CallSid: Links to call state for job resolution
- Twilio Recording metadata: RecordingUrl, Duration, FileSize
- Job context: Either jobRecordId or (clientId + jobNumber) for lookup

## S3 Key Strategy
- Pattern: `{S3_PREFIX}/yyyy/mm/dd/{CallSid}-{job_number}.mp3`
- Enables time-based partitioning for lifecycle management
- Includes job number for easy identification

## History Line Format
```
---- | 2024-03-15 14:30:25 | Event: Recording | Source: IVR | URL: <signed_url>
```

## Error Handling & Recovery
- **Upload Failure**: Retry up to 3 times with exponential backoff
- **Still Failing**: Add "Recording pending upload" history line, alert ops
- **History Append Failure**: Retry history update, queue for later if needed
- **Signed URL Expiry**: Regenerate on-demand when accessed

## Retry Policy
- Initial retry: 1 second delay
- Subsequent retries: exponential backoff (2s, 4s, 8s)
- Max retries: 3 attempts total
- Permanent failure: Log error and create ops alert

## TODO
- Implement recording quality validation
- Add audio format conversion if needed
- Monitor storage costs and optimize retention policies
