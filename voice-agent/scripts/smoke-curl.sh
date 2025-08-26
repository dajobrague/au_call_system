#!/bin/bash

# Smoke test curl recipes for Voice Agent API

set -e

BASE_URL="${1:-http://localhost:3000}"
echo "Testing Voice Agent API at: $BASE_URL"

echo "🧪 Test 1: GET /api/twilio/voice (should return 405)"
curl -i "$BASE_URL/api/twilio/voice" || true
echo -e "\n"

echo "🧪 Test 2: POST /api/twilio/voice - Initial call"
curl -i -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123" \
  -d "From=+1234567890" \
  -d "To=+1987654321" \
  "$BASE_URL/api/twilio/voice"
echo -e "\n"

echo "🧪 Test 3: POST /api/twilio/voice - With speech input"
curl -i -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123" \
  -d "SpeechResult=one two three four five" \
  "$BASE_URL/api/twilio/voice"
echo -e "\n"

echo "🧪 Test 4: POST /api/twilio/voice - With DTMF input"
curl -i -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123" \
  -d "Digits=12345" \
  "$BASE_URL/api/twilio/voice"
echo -e "\n"

echo "🧪 Test 5: POST /api/twilio/voice - Timeout/retry"
curl -i -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=test123" \
  -d "GatherAttempt=1" \
  "$BASE_URL/api/twilio/voice"
echo -e "\n"

echo "✅ Smoke tests completed!"
echo "Expected results:"
echo "  Test 1: 405 Method Not Allowed"
echo "  Test 2: 200 OK with <Gather> TwiML"
echo "  Test 3: 200 OK with <Say>Thank you</Say>"
echo "  Test 4: 200 OK with <Say>Thank you</Say>"
echo "  Test 5: 200 OK with retry <Gather> TwiML"
