# S3 Key Strategy and Retention Notes

## Key Strategy
Recording files are stored with a hierarchical key structure for efficient organization and lifecycle management.

### Key Pattern
```
{S3_PREFIX}/yyyy/mm/dd/{CallSid}-{job_number}.mp3
```

### Examples
- `recordings/2024/03/15/CA1234567890abcdef-JOB789.mp3`
- `recordings/2024/12/31/CAabcdef1234567890-JOB1001.mp3`

### Benefits
- **Time-based Partitioning**: Enables efficient lifecycle rules
- **Easy Browsing**: Date-organized folder structure
- **Unique Keys**: CallSid ensures no collisions
- **Searchable**: Job number in filename for easy lookup

## Retention Strategy

### Lifecycle Rules
- **Standard Storage**: 0-90 days (immediate access)
- **Standard-IA**: 91-365 days (infrequent access)
- **Glacier**: 366+ days (archive, if extended retention needed)
- **Delete**: After RECORDING_RETENTION_DAYS (default: 365)

### Cost Optimization
- Monitor storage usage monthly
- Review retention policy quarterly
- Consider compression for long-term storage
- Archive vs delete based on compliance requirements

## Security
- **Encryption**: Server-side encryption (SSE-S3) enabled
- **Access Control**: IAM roles with least privilege
- **Signed URLs**: 15-minute expiration for privacy
- **Audit Logging**: CloudTrail enabled for access monitoring

## Performance
- **Upload**: Multipart for files >5MB
- **Download**: CloudFront CDN if high volume
- **Monitoring**: Track upload success rate and latency

## TODO
- Implement automated cost monitoring
- Add data integrity validation (checksums)
- Consider cross-region replication for critical recordings
