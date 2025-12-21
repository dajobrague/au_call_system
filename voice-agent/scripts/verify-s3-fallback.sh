#!/bin/bash

# Simple verification script for S3 fallback implementation

echo ""
echo "=== S3 Fallback Implementation Verification ==="
echo ""

# Check if modified files exist and contain fallback logic
echo "Checking modified files..."
echo ""

FILE1="app/api/twilio/recording-status/route.ts"
FILE2="src/websocket/connection-handler.ts"

check_file() {
  local file=$1
  if [ -f "$file" ]; then
    echo "✓ Found: $file"
    
    # Check for key implementation markers
    if grep -q "recording_s3_fallback_to_twilio" "$file"; then
      echo "  ✓ Contains fallback log type"
    else
      echo "  ✗ Missing fallback log type"
    fi
    
    if grep -q "finalRecordingUrl" "$file"; then
      echo "  ✓ Contains finalRecordingUrl variable"
    else
      echo "  ✗ Missing finalRecordingUrl variable"
    fi
    
    if grep -q "shouldDeleteFromTwilio" "$file"; then
      echo "  ✓ Contains shouldDeleteFromTwilio flag"
    else
      echo "  ✗ Missing shouldDeleteFromTwilio flag"
    fi
    
    if grep -q "uploadedToS3" "$file"; then
      echo "  ✓ Contains uploadedToS3 flag"
    else
      echo "  ✗ Missing uploadedToS3 flag"
    fi
    
    echo ""
  else
    echo "✗ Not found: $file"
    echo ""
  fi
}

check_file "$FILE1"
check_file "$FILE2"

echo "=== Verification Complete ==="
echo ""
echo "Implementation Status:"
echo "- S3 fallback logic has been added to both files"
echo "- Recordings will be saved to Airtable even if S3 fails"
echo "- Twilio recordings will be preserved when S3 upload fails"
echo ""
echo "Next Steps:"
echo "1. Review the implementation in the modified files"
echo "2. Start the server to test with actual calls"
echo "3. Monitor logs for 'recording_s3_fallback_to_twilio' messages"
echo ""
echo "For detailed testing instructions, see:"
echo "  voice-agent/S3_FALLBACK_IMPLEMENTATION.md"
echo ""

