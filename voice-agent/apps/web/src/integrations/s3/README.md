# S3 Integration

## S3 Adapter Contract
Handles recording upload and URL generation for call recordings.

## Operations
- `uploadRecording(callSid, audioBuffer, metadata)` - Upload recording file
- `generateSignedUrl(key, expirationMinutes)` - Generate time-limited access
- `buildRecordingKey(callSid, jobNumber, date)` - Consistent key strategy
- `deleteRecording(key)` - Manual cleanup if needed

## Key Strategy
- Pattern: `{S3_PREFIX}/yyyy/mm/dd/{CallSid}-{job_number}.mp3`
- Example: `recordings/2024/03/15/CA123456-JOB789.mp3`
- Supports time-based partitioning for efficient lifecycle management

## Upload Process
1. Fetch recording from Twilio webhook
2. Validate audio format and size
3. Build timestamped S3 key
4. Upload with server-side encryption
5. Generate signed URL (15 min expiration)
6. Return URL for history append

## Security
- Server-side encryption: SSE-S3 (AES-256)
- Signed URLs: 15-minute expiration by default
- IAM permissions: Least privilege (PutObject, GetObject only)
- No public read access on bucket

## Lifecycle Management
- Retention: Configurable via RECORDING_RETENTION_DAYS
- Automatic deletion: S3 lifecycle rules handle cleanup
- Cost optimization: Transition to IA/Glacier if long retention needed

## TODO
- Implement multipart upload for large files
- Add audio format validation and conversion
- Monitor storage costs and usage patterns
