# Environment Variables - Copy Complete ✅

## Summary

All environment variables have been automatically copied from `voice-agent/.env.local` to `provider-portal/.env.local`.

## What Was Copied

### ✅ AWS S3 Configuration
- `AWS_REGION` - AWS region for S3
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_S3_BUCKET` - S3 bucket name

**Note**: The script normalized `S3_*` variables to `AWS_*` format for consistency.

### ✅ ElevenLabs Configuration
- `ELEVENLABS_API_KEY` - API key for text-to-speech
- `ELEVENLABS_VOICE_ID` - Voice ID for TTS generation

### ✅ Airtable Configuration
- `AIRTABLE_API_KEY` - Airtable API key
- `AIRTABLE_BASE_ID` - Airtable base ID
- `USER_TABLE_ID` - Set to `tblLiBIYIt9jDwQGT`

### ✅ Redis Configuration (Optional)
- `REDIS_URL` or `RAILWAY_REDIS_URL` - Redis connection URL

### ✅ Session Configuration
- `SESSION_SECRET` - Auto-generated 32-character secure key

## Script Used

The environment variables were copied using the automated script:
```bash
./copy-env-vars.sh
```

This script:
1. Reads `voice-agent/.env.local`
2. Extracts relevant variables
3. Normalizes variable names
4. Creates/updates `provider-portal/.env.local`
5. Backs up existing `.env.local` to `.env.local.backup`
6. Generates new SESSION_SECRET if not found

## Backup

Your previous `.env.local` was backed up to:
```
provider-portal/.env.local.backup
```

## Verification

To verify the environment variables are correct:

```bash
cd provider-portal
cat .env.local
```

All sensitive values should be present and match those in `voice-agent/.env.local`.

## What to Check

1. **AWS Credentials** - Ensure they have write access to the S3 bucket
2. **ElevenLabs API Key** - Ensure it's valid and has available quota
3. **Airtable Credentials** - Ensure they have write access to the base
4. **Session Secret** - Auto-generated, no action needed

## Troubleshooting

### If variables are missing:
Run the script again:
```bash
cd provider-portal
./copy-env-vars.sh
```

### If you need to manually add variables:
Edit `.env.local` directly:
```bash
cd provider-portal
nano .env.local
```

### If you want to restore the backup:
```bash
cd provider-portal
cp .env.local.backup .env.local
```

## Status

✅ **All environment variables copied successfully!**

The wizard is now ready to test at: **http://localhost:3000/wizard**

