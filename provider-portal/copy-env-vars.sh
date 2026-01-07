#!/bin/bash

# Script to copy environment variables from voice-agent to provider-portal
# This script reads voice-agent/.env.local and creates/updates provider-portal/.env.local

echo "🔧 Copying environment variables from voice-agent to provider-portal..."
echo ""

VOICE_AGENT_ENV="../voice-agent/.env.local"
PROVIDER_PORTAL_ENV=".env.local"

# Check if voice-agent .env.local exists
if [ ! -f "$VOICE_AGENT_ENV" ]; then
  echo "❌ Error: $VOICE_AGENT_ENV not found!"
  echo "Please make sure voice-agent/.env.local exists."
  exit 1
fi

# Backup existing .env.local if it exists
if [ -f "$PROVIDER_PORTAL_ENV" ]; then
  echo "📦 Backing up existing .env.local to .env.local.backup"
  cp "$PROVIDER_PORTAL_ENV" "${PROVIDER_PORTAL_ENV}.backup"
fi

# Start with header
echo "# Provider Portal Environment Variables" > "$PROVIDER_PORTAL_ENV"
echo "# Auto-generated from voice-agent/.env.local on $(date)" >> "$PROVIDER_PORTAL_ENV"
echo "" >> "$PROVIDER_PORTAL_ENV"

# Extract and copy specific variables
echo "📋 Copying AWS S3 configuration..."
echo "# AWS S3 Configuration" >> "$PROVIDER_PORTAL_ENV"
grep -E "^(AWS_REGION|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_S3_BUCKET|S3_REGION|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|S3_BUCKET)=" "$VOICE_AGENT_ENV" | while read line; do
  # Normalize S3_* to AWS_* format
  if [[ $line == S3_REGION=* ]]; then
    echo "AWS_REGION=${line#S3_REGION=}" >> "$PROVIDER_PORTAL_ENV"
  elif [[ $line == S3_ACCESS_KEY_ID=* ]]; then
    echo "AWS_ACCESS_KEY_ID=${line#S3_ACCESS_KEY_ID=}" >> "$PROVIDER_PORTAL_ENV"
  elif [[ $line == S3_SECRET_ACCESS_KEY=* ]]; then
    echo "AWS_SECRET_ACCESS_KEY=${line#S3_SECRET_ACCESS_KEY=}" >> "$PROVIDER_PORTAL_ENV"
  elif [[ $line == S3_BUCKET=* ]]; then
    echo "AWS_S3_BUCKET=${line#S3_BUCKET=}" >> "$PROVIDER_PORTAL_ENV"
  else
    echo "$line" >> "$PROVIDER_PORTAL_ENV"
  fi
done
echo "" >> "$PROVIDER_PORTAL_ENV"

echo "📋 Copying ElevenLabs configuration..."
echo "# ElevenLabs Configuration" >> "$PROVIDER_PORTAL_ENV"
grep -E "^(ELEVENLABS_API_KEY|ELEVENLABS_VOICE_ID)=" "$VOICE_AGENT_ENV" >> "$PROVIDER_PORTAL_ENV"
echo "" >> "$PROVIDER_PORTAL_ENV"

echo "📋 Copying Airtable configuration..."
echo "# Airtable Configuration" >> "$PROVIDER_PORTAL_ENV"
grep -E "^(AIRTABLE_API_KEY|AIRTABLE_BASE_ID)=" "$VOICE_AGENT_ENV" >> "$PROVIDER_PORTAL_ENV"
echo "USER_TABLE_ID=tblLiBIYIt9jDwQGT" >> "$PROVIDER_PORTAL_ENV"
echo "" >> "$PROVIDER_PORTAL_ENV"

echo "📋 Copying Redis configuration (optional)..."
echo "# Redis Configuration (optional)" >> "$PROVIDER_PORTAL_ENV"
grep -E "^(REDIS_URL|RAILWAY_REDIS_URL)=" "$VOICE_AGENT_ENV" >> "$PROVIDER_PORTAL_ENV" || echo "# REDIS_URL=your_redis_url (optional)" >> "$PROVIDER_PORTAL_ENV"
echo "" >> "$PROVIDER_PORTAL_ENV"

echo "📋 Adding session secret..."
echo "# Session Configuration" >> "$PROVIDER_PORTAL_ENV"
# Check if SESSION_SECRET already exists
if grep -q "^SESSION_SECRET=" "$VOICE_AGENT_ENV"; then
  grep "^SESSION_SECRET=" "$VOICE_AGENT_ENV" >> "$PROVIDER_PORTAL_ENV"
else
  # Generate a random 32-character session secret
  SESSION_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
  echo "SESSION_SECRET=$SESSION_SECRET" >> "$PROVIDER_PORTAL_ENV"
  echo "⚠️  Generated new SESSION_SECRET (no existing secret found in voice-agent)"
fi
echo "" >> "$PROVIDER_PORTAL_ENV"

echo "✅ Environment variables copied successfully!"
echo ""
echo "📄 Created: $PROVIDER_PORTAL_ENV"
echo ""
echo "Please review the file and ensure all values are correct."
echo "Key variables to verify:"
echo "  - AWS_REGION"
echo "  - AWS_ACCESS_KEY_ID"
echo "  - AWS_SECRET_ACCESS_KEY"
echo "  - AWS_S3_BUCKET"
echo "  - ELEVENLABS_API_KEY"
echo "  - ELEVENLABS_VOICE_ID"
echo "  - AIRTABLE_API_KEY"
echo "  - AIRTABLE_BASE_ID"
echo "  - SESSION_SECRET"
echo ""

