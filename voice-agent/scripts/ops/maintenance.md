# Operations Maintenance Guide

## Overview
Operational procedures for maintaining the voice agent system, including routine maintenance, key rotation, and troubleshooting.

## Daily Operations

### Health Checks
Perform these checks every business day:

#### Application Health
```bash
# Check application status
curl -f https://voice-agent.yourdomain.com/api/health

# Verify Twilio webhooks responding
curl -X POST https://voice-agent.yourdomain.com/api/twilio/voice \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test&From=%2B15551234567&To=%2B15557654321"
```

#### External Service Connectivity
```bash
# Test Airtable API access
curl -H "Authorization: Bearer $AIRTABLE_API_KEY" \
  "https://api.airtable.com/v0/$AIRTABLE_BASE_ID/$AIRTABLE_JOBS_TABLE?maxRecords=1"

# Test Redis connectivity
redis-cli -u $REDIS_URL ping

# Test S3 access
aws s3 ls s3://$S3_BUCKET/$S3_PREFIX --region $S3_REGION
```

#### Error Rate Monitoring
- Review error logs for patterns
- Check failed call percentages
- Monitor recording upload success rates
- Verify state persistence operations

### Log Review
Daily log analysis priorities:

#### Critical Errors
- Authentication failures
- Database connection errors
- S3 upload failures
- Twilio webhook signature validation failures

#### Performance Issues
- Slow API responses (>5 seconds)
- High memory usage patterns
- Excessive retry attempts
- Long-running operations

#### Security Events
- Unusual access patterns
- Failed authentication attempts
- Unexpected webhook sources
- Rate limiting triggers

## Weekly Maintenance

### Performance Analysis
Every Monday, review:

#### Call Volume Metrics
- Total calls processed
- Average call duration
- Success/failure rates by stage
- Most common error types

#### Resource Usage
- CPU and memory utilization
- Database query performance
- S3 storage growth and costs
- Redis memory usage patterns

#### User Experience
- Average time per conversation stage
- Retry rates for each input type
- User abandonment patterns
- Voice recognition accuracy

### Data Cleanup
Every Friday, perform:

#### Expired State Cleanup
```bash
# Clean up expired call states (if not auto-expired)
redis-cli --scan --pattern "call_state:*" | while read key; do
  ttl=$(redis-cli ttl "$key")
  if [ "$ttl" -eq "-1" ]; then
    echo "Manual cleanup needed for: $key"
    # Investigate and clean up if appropriate
  fi
done
```

#### Log Rotation
```bash
# Archive old logs
find /var/log/voice-agent -name "*.log" -mtime +7 -exec gzip {} \;
find /var/log/voice-agent -name "*.log.gz" -mtime +30 -delete
```

#### Temporary File Cleanup
```bash
# Clean up any temporary files
find /tmp -name "voice-agent-*" -mtime +1 -delete
```

## Monthly Maintenance

### Security Tasks

#### Key Rotation Schedule
**First Monday of each month**:

##### 1. S3 Access Keys
```bash
# Create new access key in AWS IAM
aws iam create-access-key --user-name voice-agent-s3-user

# Update environment variables with new keys
# Test new keys work correctly
# Delete old access key after verification
aws iam delete-access-key --user-name voice-agent-s3-user --access-key-id OLD_KEY_ID
```

##### 2. Airtable API Keys
```bash
# Generate new personal access token in Airtable
# Update AIRTABLE_API_KEY environment variable
# Test new key with sample request
# Revoke old token in Airtable settings
```

##### 3. Redis Authentication (if applicable)
```bash
# Update Redis AUTH password if using authentication
# Update REDIS_URL with new credentials
# Verify connectivity with new credentials
```

#### Certificate Management
```bash
# Check SSL certificate expiration
openssl s_client -connect voice-agent.yourdomain.com:443 -servername voice-agent.yourdomain.com \
  < /dev/null 2>/dev/null | openssl x509 -noout -dates

# Renew certificates if expiring within 30 days
```

### Data Maintenance

#### Storage Optimization
```bash
# Review S3 storage costs and usage
aws s3api list-objects-v2 --bucket $S3_BUCKET --prefix $S3_PREFIX \
  --query 'Contents[].{Size:Size,Key:Key}' --output table

# Verify lifecycle rules are working
aws s3api get-bucket-lifecycle-configuration --bucket $S3_BUCKET
```

#### Database Maintenance
```bash
# Analyze Airtable usage and field utilization
# Review and optimize frequently used queries
# Check for field mapping issues or inconsistencies
```

### Configuration Updates

#### Environment Variable Audit
```bash
# Review all environment variables
printenv | grep -E "(AIRTABLE|TWILIO|S3|REDIS)" | sort

# Verify all required variables are set
# Check for deprecated or unused variables
# Validate field name mappings are correct
```

#### Dependency Updates
```bash
# Check for package updates
npm outdated

# Update non-breaking dependencies
npm update

# Plan major version updates for next maintenance window
```

## Quarterly Maintenance

### Comprehensive Review
**Last week of each quarter**:

#### Architecture Review
- Evaluate system performance against goals
- Review ADR decisions for relevance
- Plan architectural improvements
- Assess scalability requirements

#### Security Audit
- Review access logs for anomalies
- Validate security configurations
- Test backup and recovery procedures
- Update security documentation

#### Capacity Planning
- Analyze growth trends
- Plan infrastructure scaling
- Review cost optimization opportunities
- Update monitoring thresholds

### Disaster Recovery Testing

#### Backup Verification
```bash
# Test Airtable data export
# Verify S3 backup procedures
# Test Redis state recovery
# Validate configuration backups
```

#### Failover Testing
```bash
# Test application restart procedures
# Verify external service failover
# Test monitoring and alerting systems
# Validate escalation procedures
```

## Emergency Procedures

### Service Outage Response

#### Immediate Actions
1. **Check External Services**: Verify Twilio, Airtable, S3, Redis status
2. **Review Recent Changes**: Check recent deployments or configuration changes
3. **Monitor Logs**: Look for error patterns and root cause indicators
4. **Notify Stakeholders**: Alert relevant teams and users if needed

#### Common Issues and Solutions

##### Twilio Webhook Failures
```bash
# Check webhook URL accessibility
curl -I https://voice-agent.yourdomain.com/api/twilio/voice

# Verify SSL certificate validity
# Check application server status
# Review webhook signature validation
```

##### Airtable API Errors
```bash
# Test API connectivity
curl -H "Authorization: Bearer $AIRTABLE_API_KEY" \
  "https://api.airtable.com/v0/$AIRTABLE_BASE_ID"

# Check rate limiting status
# Verify field name mappings
# Review recent base schema changes
```

##### S3 Upload Failures
```bash
# Test S3 connectivity
aws s3 ls s3://$S3_BUCKET/ --region $S3_REGION

# Check IAM permissions
# Verify bucket configuration
# Review upload queue status
```

##### Redis Connection Issues
```bash
# Test Redis connectivity
redis-cli -u $REDIS_URL ping

# Check memory usage
redis-cli -u $REDIS_URL info memory

# Review connection limits
# Check for memory eviction issues
```

### Data Recovery Procedures

#### Corrupted Call State
```bash
# Identify affected calls
redis-cli --scan --pattern "call_state:*"

# Clear corrupted state if necessary
redis-cli del "call_state:CALL_SID"

# Gracefully handle in-progress calls
```

#### Missing Job History
```bash
# Check Airtable revision history
# Restore from backup if available
# Manually reconstruct history from logs
# Document incident for future prevention
```

## Monitoring and Alerting

### Key Metrics to Monitor

#### Application Metrics
- Response time percentiles (95th, 99th)
- Error rates by endpoint
- Call completion rates
- Recording upload success rates

#### Infrastructure Metrics
- CPU and memory utilization
- Network connectivity
- Disk space usage
- External service response times

#### Business Metrics
- Calls per hour/day
- Average call duration
- User satisfaction indicators
- Cost per call/recording

### Alert Thresholds

#### Critical Alerts (Immediate Response)
- Application down for >2 minutes
- Error rate >10% for >5 minutes
- S3 upload failures >50% for >5 minutes
- Airtable API failures >25% for >5 minutes

#### Warning Alerts (Within 1 Hour)
- Response time >95th percentile for >10 minutes
- Memory usage >80% for >15 minutes
- Recording upload failures >20% for >10 minutes
- Unusual traffic patterns

## Documentation Updates

### Maintenance Documentation
- Update runbooks based on incident learnings
- Revise procedures based on operational experience
- Document new monitoring and alerting configurations
- Update contact information and escalation procedures

### System Documentation
- Keep architecture diagrams current
- Update API documentation
- Revise deployment procedures
- Maintain troubleshooting guides

## TODO
- Automate routine health checks
- Implement automated failover procedures
- Create comprehensive monitoring dashboard
- Develop automated recovery scripts
