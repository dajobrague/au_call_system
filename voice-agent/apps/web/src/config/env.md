# Environment Variables Glossary

## Twilio Configuration
- `TWILIO_ACCOUNT_SID` - Account identifier for Twilio API
- `TWILIO_AUTH_TOKEN` - Authentication token for Twilio API
- `TWILIO_PHONE_NUMBER` - Phone number assigned to voice agent

## Airtable Configuration
- `AIRTABLE_API_KEY` - Personal access token for Airtable API
- `AIRTABLE_BASE_ID` - Base identifier containing Jobs and Clients tables
- `AIRTABLE_JOBS_TABLE` - Table name for job records (default: "Jobs")
- `AIRTABLE_CLIENTS_TABLE` - Table name for client records (default: "Clients")

## Airtable Field Names
- `AIRTABLE_JOB_HISTORY_FIELD` - Field for storing call history (default: "job_history")
- `AIRTABLE_JOB_NUMBER_FIELD` - Field for job number lookup (default: "job_number")
- `AIRTABLE_CLIENT_ID_FIELD` - Field for client identifier (default: "client_unique_id")
- `AIRTABLE_STATUS_FIELD` - Field for job status (default: "status")
- `AIRTABLE_SCHEDULED_DATE_FIELD` - Field for scheduled date (default: "scheduled_date")
- `AIRTABLE_ASSIGNEE_FIELD` - Field for assignee name (default: "assignee")

## State Management
- `REDIS_URL` - Connection string for Redis instance (call state storage)

## Recording Storage
- `S3_ACCESS_KEY_ID` - AWS access key for S3 operations
- `S3_SECRET_ACCESS_KEY` - AWS secret key for S3 operations
- `S3_REGION` - AWS region for S3 bucket
- `S3_BUCKET` - S3 bucket name for recording storage
- `S3_PREFIX` - Key prefix for recordings (default: "recordings/")
- `RECORDING_PUBLIC_URL` - Whether to use public URLs (default: false, uses signed URLs)
- `RECORDING_RETENTION_DAYS` - Days to retain recordings (default: 365)

## Application Settings
- `APP_URL` - Base URL for webhook callbacks
- `LANG` - Language for voice prompts (es/en, default: es)
