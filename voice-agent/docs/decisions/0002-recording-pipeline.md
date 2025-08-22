# ADR-0002: Recording Pipeline Architecture

## Status
Accepted

## Context
Every voice call must be recorded for compliance and quality purposes. We need to decide how to store these recordings, provide access to them, manage retention, and maintain security while integrating with our Airtable-based job management system.

## Decision
We will implement a recording pipeline using:

- **Storage**: Amazon S3 with server-side encryption
- **Access**: Signed URLs with 15-minute expiration (default)
- **Integration**: URLs appended to existing Job records in Airtable
- **Retention**: Lifecycle rules for automatic cleanup after configurable period
- **Pipeline**: Asynchronous processing from Twilio webhook to S3 to Airtable

## Architecture Overview

### Recording Flow
```
Call Start → Twilio Recording → Recording Available Webhook → 
Fetch from Twilio → Upload to S3 → Generate Signed URL → 
Append to Job History → Cleanup Twilio Recording
```

### Key Components
- **Twilio**: Automatic call recording
- **S3**: Persistent storage with encryption
- **Webhook Handler**: Processes recording availability
- **Job History**: Append-only audit trail in Airtable
- **Lifecycle Rules**: Automatic retention management

## Detailed Decisions

### Storage Solution: Amazon S3

#### Why S3?
- **Durability**: 99.999999999% (11 9's) durability
- **Scalability**: Unlimited storage capacity
- **Security**: Server-side encryption, IAM access control
- **Cost Effective**: Lifecycle policies for cost optimization
- **Integration**: Well-supported by AWS SDKs

#### S3 Configuration
- **Encryption**: SSE-S3 (AES-256) for all recordings
- **Bucket Policy**: Private bucket, no public read access
- **Lifecycle Rules**: Automatic transition and deletion
- **Region**: Same region as application for reduced latency

#### Alternative Considered: Twilio's Built-in Storage
**Rejected**: Limited retention options, higher cost for long-term storage, less control over access patterns.

### Access Method: Signed URLs

#### Why Signed URLs?
- **Security**: URLs expire automatically, no permanent public access
- **Privacy**: Recordings not publicly accessible
- **Flexibility**: Can regenerate URLs with different expiration times
- **Audit Trail**: Can log URL generation for access tracking

#### Configuration Options
- **Default Expiration**: 15 minutes (configurable)
- **Regeneration**: On-demand URL regeneration possible
- **Access Control**: IAM permissions control who can generate URLs

#### Alternative Considered: Public URLs
**Rejected**: Security risk, compliance issues, no access control.

#### Alternative Considered: Pre-authenticated URLs via Application
**Rejected**: Adds complexity, requires authentication system, still needs URL expiration.

### Integration Strategy: Append to Existing Job Records

#### Why Append to Existing Records?
- **Data Integrity**: Keep all job-related data together
- **Audit Trail**: Recording becomes part of job history
- **Simplicity**: No new tables or complex relationships
- **Query Efficiency**: All job data accessible in single record

#### History Format
```
---- | YYYY-MM-DD HH:mm:ss | Event: Recording | Source: IVR | URL: <signed_url>
```

#### Alternative Considered: Separate Recordings Table
**Rejected**: Adds complexity, requires JOIN operations, splits related data.

#### Alternative Considered: File Attachment Field
**Rejected**: Airtable attachment limitations, higher storage costs, less control.

### Retention Strategy: Lifecycle Rules

#### Retention Tiers
- **Standard Storage**: 0-90 days (immediate access)
- **Standard-IA**: 91-365 days (infrequent access, lower cost)
- **Deletion**: After RECORDING_RETENTION_DAYS (default 365 days)

#### Why Tiered Storage?
- **Cost Optimization**: Significant savings for long-term storage
- **Access Patterns**: Recent recordings accessed more frequently
- **Compliance**: Configurable retention for different requirements

#### Alternative Considered: Manual Cleanup
**Rejected**: Operational overhead, risk of missed cleanups, inconsistent retention.

### Pipeline Architecture: Asynchronous Processing

#### Why Asynchronous?
- **Reliability**: Failures don't affect call experience
- **Performance**: Recording processing doesn't block call flow
- **Retry Logic**: Can retry failed uploads without user impact
- **Scalability**: Can handle multiple concurrent recordings

#### Error Handling
- **Upload Failures**: Retry with exponential backoff
- **Airtable Failures**: Queue for later retry
- **Permanent Failures**: Alert operations team
- **Partial Failures**: Graceful degradation with status notes

## Implementation Details

### S3 Key Strategy
```
{S3_PREFIX}/yyyy/mm/dd/{CallSid}-{job_number}.mp3
```

**Benefits**:
- **Time Partitioning**: Efficient for lifecycle rules
- **Easy Browsing**: Date-organized folder structure  
- **Unique Keys**: CallSid prevents collisions
- **Searchable**: Job number in filename

### Security Configuration

#### IAM Policy (Minimal Permissions)
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

#### Bucket Policy (Deny Public Access)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::BUCKET_NAME",
        "arn:aws:s3:::BUCKET_NAME/*"
      ],
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalServiceName": [
            "application-service-principal"
          ]
        }
      }
    }
  ]
}
```

### Monitoring and Alerting

#### Key Metrics
- **Upload Success Rate**: Percentage of successful uploads
- **Processing Latency**: Time from webhook to history update
- **Storage Usage**: Track storage growth and costs
- **Access Patterns**: Monitor URL generation and access

#### Alerting Thresholds
- **Upload Failures**: >5% failure rate in 5-minute window
- **Processing Delays**: >2 minutes average processing time
- **Storage Costs**: >20% increase month-over-month
- **Access Anomalies**: Unusual access patterns

## Trade-offs and Considerations

### Advantages
- **Security**: Strong encryption and access control
- **Cost Efficiency**: Lifecycle rules minimize long-term costs
- **Scalability**: S3 scales automatically with usage
- **Integration**: Seamless integration with existing job records
- **Compliance**: Configurable retention for regulatory requirements

### Disadvantages
- **Complexity**: More complex than simple file storage
- **Dependencies**: Relies on AWS services
- **URL Management**: Signed URLs require regeneration if expired
- **Storage Costs**: S3 costs can accumulate with high call volume

### Risk Mitigation
- **Multi-Region**: Consider cross-region replication for critical recordings
- **Backup Strategy**: Regular exports for compliance backups
- **Vendor Lock-in**: Design abstractions to allow storage provider changes
- **Access Monitoring**: Comprehensive logging and anomaly detection

## Configuration Options

### Environment Variables
```bash
# S3 Configuration
S3_ACCESS_KEY_ID=<access_key>
S3_SECRET_ACCESS_KEY=<secret_key>
S3_REGION=us-east-1
S3_BUCKET=voice-agent-recordings
S3_PREFIX=recordings/

# Access Control
RECORDING_PUBLIC_URL=false
RECORDING_URL_EXPIRATION_MINUTES=15

# Retention
RECORDING_RETENTION_DAYS=365
RECORDING_LIFECYCLE_IA_DAYS=90

# Processing
RECORDING_UPLOAD_RETRIES=3
RECORDING_UPLOAD_TIMEOUT_SECONDS=30
```

## Future Considerations

### Potential Enhancements
- **Audio Analysis**: Speech-to-text transcription for searchability
- **Quality Metrics**: Audio quality analysis and reporting
- **Compression**: Audio compression for storage optimization
- **Multiple Formats**: Support for different audio formats

### Scalability Improvements
- **CDN Integration**: CloudFront for global access optimization
- **Batch Processing**: Bulk operations for efficiency
- **Parallel Uploads**: Concurrent processing for high volume
- **Load Balancing**: Distribute processing across multiple instances

### Compliance Features
- **Data Residency**: Region-specific storage for compliance
- **Audit Logging**: Comprehensive access and modification logs
- **Encryption**: Customer-managed encryption keys (CMK)
- **Legal Hold**: Suspend deletion for legal requirements

## Success Criteria

### Performance Targets
- **Upload Success Rate**: >99.5%
- **Processing Time**: <60 seconds average
- **URL Generation**: <1 second response time
- **Storage Costs**: <$0.10 per recording per year

### Operational Goals
- **Zero Data Loss**: No recordings lost due to system failures
- **Compliance**: Meet all retention and access requirements
- **Monitoring**: Complete visibility into pipeline health
- **Recovery**: <4 hour recovery time for pipeline failures

## Decision Record
- **Date**: 2024-03-15
- **Participants**: Architecture Team, Security Team, Operations Team
- **Dependencies**: ADR-0001 (Layered Architecture)
- **Next Review**: 2024-06-15 (3 months)
- **Implementation Target**: 2024-04-01
