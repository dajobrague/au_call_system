# Recording Operations Runbook

## Purpose
Every call is recorded in Twilio, uploaded to S3, and the URL is appended to the same Job's job_history (no new rows).

## Twilio Console Settings

### Phone Number Configuration
1. **Buy/Assign Number**: Purchase or assign phone number in Twilio Console
2. **Voice Configuration**: 
   - Set Webhook URL to: `{APP_URL}/api/twilio/voice`
   - HTTP Method: POST
   - Enable recording for all calls (single-channel recommended)
3. **Recording Status Callback**: 
   - Set to: `{APP_URL}/api/twilio/recording`
   - HTTP Method: POST
4. **Call Status Callback** (Optional):
   - Set to: `{APP_URL}/api/twilio/status`
   - HTTP Method: POST

### Recording Settings
- **Record**: Enable for all calls
- **Recording Channels**: Single channel (both parties on one track)
- **Recording Format**: MP3 (smaller file size, good quality)
- **Trim**: None (capture complete call)

## S3 Bucket Configuration

### Bucket Setup
1. **Create Bucket**: Use name documented in S3_BUCKET environment variable
2. **Region**: Must match S3_REGION environment variable
3. **Encryption**: Enable server-side encryption (SSE-S3 recommended)
4. **Versioning**: Optional (not required for recordings)
5. **Public Access**: Block all public access (use signed URLs)

### Lifecycle Policy
Create lifecycle rule for automatic cleanup:
```json
{
  "Rules": [
    {
      "ID": "RecordingRetention",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "recordings/"
      },
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

### Folder Structure
Recordings are organized by date for efficient management:
```
s3://bucket-name/
└── recordings/
    └── 2024/
        └── 03/
            └── 15/
                ├── CA1234567890abcdef-JOB456.mp3
                ├── CAabcdef1234567890-JOB789.mp3
                └── ...
```

## IAM Configuration

### Service User Policy
Create IAM user with minimal required permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::BUCKET_NAME/recordings/*"
    }
  ]
}
```

### Security Best Practices
- **Key Rotation**: Rotate access keys every 90 days
- **Principle of Least Privilege**: Only recording-related permissions
- **No Public ACLs**: Ensure bucket policy denies public ACLs
- **Monitor Access**: Enable CloudTrail for S3 access logging

## Public vs. Signed URLs

### Configuration
Set `RECORDING_PUBLIC_URL` environment variable:
- `false` (default): Use signed URLs for privacy
- `true`: Use public URLs (not recommended)

### Signed URLs (Recommended)
- **Default Expiration**: 15 minutes
- **Security**: URLs expire automatically
- **Privacy**: No public access to recordings
- **Regeneration**: Can regenerate URLs on demand

### Public URLs (Not Recommended)
- **Bucket Policy Required**: Must allow public read for recordings/ prefix
- **Security Risk**: Recordings accessible to anyone with URL
- **Compliance Issues**: May violate privacy regulations

## History Line Format
Recording URLs are appended to job_history field using this format:
```
---- | 2024-03-15 14:30:22 | Event: Recording | Source: IVR | URL: <signed_or_public_url>
```

### Example Entry
```
---- | 2024-03-15 14:30:22 | Event: Recording | Source: IVR | URL: https://bucket.s3.region.amazonaws.com/recordings/2024/03/15/CA123-JOB456.mp3?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...
```

## Failure Modes & Recovery

### Upload Failures
**Symptoms**: Recording callback received but S3 upload fails

**Recovery Steps**:
1. Check S3 credentials and permissions
2. Verify bucket exists and is accessible
3. Check network connectivity to S3
4. Review S3 service status

**Fallback Process**:
- Retry upload up to 3 times with exponential backoff
- If still failing, add history line: "Recording pending upload"
- Alert operations team for manual intervention
- Store failed upload details for later retry

### Airtable Update Failures
**Symptoms**: S3 upload succeeds but job history update fails

**Recovery Steps**:
1. Verify Airtable API credentials
2. Check job record still exists
3. Verify field names and permissions
4. Review Airtable service status

**Fallback Process**:
- Retry history update within 15 minutes
- Store update in local queue for retry
- Alert operations team if queue grows large

### Signed URL Expiration
**Symptoms**: Users report recording URLs don't work

**Resolution**:
- Regenerate signed URL on demand
- Update job history with new URL
- Consider longer expiration for important recordings

## Data Protection

### Privacy Compliance
- **PII in Recordings**: Recordings contain customer voice and job data
- **Access Control**: Limit S3 access via IAM policies
- **Audit Trail**: Log all recording access via CloudTrail
- **Retention**: Automatic deletion after RECORDING_RETENTION_DAYS
- **No Public Access**: Never expose recordings publicly

### Security Measures
- **Signed URLs Only**: Default configuration for privacy
- **Short Expiration**: 15-minute default expiration
- **Access Logging**: Monitor who accesses recordings
- **Encryption**: Server-side encryption for all recordings

## Testing

### End-to-End Test
1. **Make Test Call**: Call the voice agent number
2. **Complete Flow**: Go through full conversation flow
3. **Verify Recording**: Check that recording callback is received
4. **Check S3**: Verify file uploaded to correct location
5. **Check History**: Confirm URL appended to job history
6. **Test Access**: Verify signed URL works and expires properly

### Monitoring Setup
- **Upload Success Rate**: Monitor successful vs. failed uploads
- **Latency Metrics**: Track time from callback to history update  
- **Storage Usage**: Monitor S3 storage growth and costs
- **Error Patterns**: Alert on repeated upload failures

## Operational Procedures

### Daily Checks
- Review failed upload alerts
- Check S3 storage costs and usage
- Verify recording callback endpoint health

### Weekly Tasks
- Review recording retention and cleanup
- Check for expired access keys
- Analyze recording quality and duration patterns

### Monthly Tasks
- Rotate S3 access keys
- Review and update lifecycle policies
- Audit recording access patterns

### Emergency Procedures
If recording system fails completely:
1. Disable recording in Twilio to prevent callback errors
2. Investigate and fix underlying issue
3. Re-enable recording once confirmed working
4. Review any missed recordings and document

## Cost Optimization

### Storage Costs
- **Lifecycle Rules**: Automatic transition to cheaper storage classes
- **Compression**: Consider audio compression for long-term storage
- **Cleanup**: Ensure automated deletion after retention period

### Transfer Costs
- **Same Region**: Keep S3 bucket in same region as application
- **Minimize Downloads**: Use signed URLs efficiently
- **Monitor Usage**: Track download patterns and costs

## TODO
- Implement recording quality validation
- Add audio format conversion capabilities
- Create automated testing for recording pipeline
- Add integration with compliance monitoring systems
