#!/bin/bash
# Test script to verify recording is in TwiML

echo "🧪 Testing if Railway is returning TwiML with recording..."
echo ""

# Simulate a Twilio webhook call
RESPONSE=$(curl -s -X POST https://aucallsystem-ivr-system.up.railway.app/api/twilio/voice \
  -d "CallSid=TEST123" \
  -d "From=+522281957913" \
  -d "To=+61468152426" \
  -d "CallStatus=ringing" \
  -d "Direction=inbound")

echo "📋 TwiML Response:"
echo "$RESPONSE" | xmllint --format - 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if recording attributes are present
if echo "$RESPONSE" | grep -q 'record="true"'; then
  echo "✅ PASS: record=\"true\" found!"
else
  echo "❌ FAIL: record=\"true\" NOT found!"
fi

if echo "$RESPONSE" | grep -q 'recordingStatusCallback'; then
  echo "✅ PASS: recordingStatusCallback found!"
else
  echo "❌ FAIL: recordingStatusCallback NOT found!"
fi

echo ""
echo "Expected: <Connect action=\"...\" record=\"true\" recordingStatusCallback=\"https://...\">"

