# Environment Setup Note

## ⚠️ IMPORTANT: .env.example File

The `.env.example` template file could not be created automatically because it's blocked by `.gitignore`.

### To Create the Template File Manually:

1. Create a new file named `.env.example` in the `voice-agent` directory

2. Copy the following content into it:

```bash
# ========================================
# AI Voice Agent - Environment Variables
# ========================================
# 
# IMPORTANT: This project uses DIFFERENT Twilio credentials for test vs production
# 
# FOR LOCAL TESTING:
#   - Copy this file to .env.local
#   - Use TEST credentials (US number)
#   - Run with: ./start-voice-agent.sh
#
# FOR PRODUCTION DEPLOYMENT:
#   - Set PRODUCTION credentials in Vercel dashboard
#   - Never commit production credentials
# ========================================

# ========================================
# TEST CREDENTIALS (Local Development)
# ========================================
# Use these for local testing with ngrok
# US Twilio Number

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_test_auth_token_here
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
TWILIO_MESSAGING_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ========================================
# PRODUCTION CREDENTIALS (Vercel Only)
# ========================================
# Set these ONLY in Vercel dashboard
# DO NOT set these in .env.local
# Australian Twilio Number
#
# PROD_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# PROD_TWILIO_AUTH_TOKEN=your_production_auth_token_here
# PROD_TWILIO_PHONE_NUMBER=+61XXXXXXXXX
# PROD_TWILIO_MESSAGING_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ========================================
# Application Environment
# ========================================
NODE_ENV=development
APP_ENV=development

# For local testing with ngrok:
# APP_URL=climbing-merely-joey.ngrok-free.app

# For production (set in Vercel):
# APP_URL=your-app.vercel.app

# ========================================
# Airtable Configuration
# ========================================
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here

# ========================================
# Redis Configuration (Upstash)
# ========================================
REDIS_URL=your_upstash_redis_url_here
REDIS_TOKEN=your_upstash_redis_token_here
STATE_TTL_SECONDS=3600

# ========================================
# AWS S3 Configuration (NDIS Compliance)
# ========================================
# Region: ap-southeast-2 (Sydney) for NDIS compliance
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=your_s3_bucket_name_here
AWS_S3_RECORDINGS_PREFIX=call-recordings/

# ========================================
# AI Services
# ========================================
# ElevenLabs (Voice Generation)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=aGkVQvWUZi16EH8aZJvT

# OpenAI (Speech Recognition)
OPENAI_API_KEY=your_openai_api_key_here

# ========================================
# Feature Flags
# ========================================
VOICE_AI_ENABLED=true
```

3. Save the file

4. Use it as a template for creating your `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

### Quick Setup

After creating `.env.example`, follow these steps:

1. **Copy to .env.local:**
   ```bash
   cd voice-agent
   cp .env.example .env.local
   ```

2. **Edit .env.local with your TEST credentials** (US Twilio number)

3. **Start testing:**
   ```bash
   ./start-voice-agent.sh
   ```

See [TWILIO_SETUP.md](./TWILIO_SETUP.md) for complete instructions.

