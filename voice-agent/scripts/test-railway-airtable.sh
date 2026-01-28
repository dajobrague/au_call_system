#!/bin/bash

# Railway Airtable Connection Diagnostic Script
# Tests the connection from Railway to Airtable and collects statistics

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RAILWAY_URL="https://aucallsystem-ivr-system.up.railway.app"
TEST_PHONE="+61450236063"  # Sam's number
TEST_RUNS=50  # Number of tests to run
DELAY=1  # Delay between tests in seconds

# Output file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="railway-airtable-test-${TIMESTAMP}.json"
SUMMARY_FILE="railway-airtable-summary-${TIMESTAMP}.txt"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Railway Airtable Connection Diagnostic${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Railway URL: $RAILWAY_URL"
echo "  Test Phone: $TEST_PHONE"
echo "  Number of tests: $TEST_RUNS"
echo "  Delay between tests: ${DELAY}s"
echo "  Output file: $OUTPUT_FILE"
echo ""
echo -e "${YELLOW}Starting tests...${NC}"
echo ""

# Initialize counters
SUCCESS_COUNT=0
FAIL_COUNT=0
TOTAL_DURATION=0

# Clear output file
echo "[" > "$OUTPUT_FILE"

# Run tests
for i in $(seq 1 $TEST_RUNS); do
  echo -ne "Test $i/$TEST_RUNS: "
  
  # Make request and capture response
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" \
    "${RAILWAY_URL}/api/diagnose/airtable-connection?phone=${TEST_PHONE}")
  
  # Extract HTTP code and time
  HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
  CURL_TIME=$(echo "$RESPONSE" | grep "TIME_TOTAL:" | cut -d: -f2)
  JSON_RESPONSE=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d' | sed '/TIME_TOTAL:/d')
  
  # Parse success from JSON
  SUCCESS=$(echo "$JSON_RESPONSE" | grep -o '"success":[^,}]*' | cut -d: -f2 | tr -d ' ')
  EMPLOYEE_FOUND=$(echo "$JSON_RESPONSE" | grep -o '"employeeFound":[^,}]*' | cut -d: -f2 | tr -d ' ')
  DURATION=$(echo "$JSON_RESPONSE" | grep -o '"totalDuration":[^,}]*' | cut -d: -f2 | tr -d ' ')
  
  # Write to output file (add comma except for last item)
  if [ $i -lt $TEST_RUNS ]; then
    echo "$JSON_RESPONSE," >> "$OUTPUT_FILE"
  else
    echo "$JSON_RESPONSE" >> "$OUTPUT_FILE"
  fi
  
  # Update counters
  if [ "$HTTP_CODE" = "200" ] && [ "$SUCCESS" = "true" ]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo -e "${GREEN}✓ Success${NC} (${DURATION}ms)"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    ERROR_MSG=$(echo "$JSON_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo -e "${RED}✗ Failed${NC} - $ERROR_MSG"
  fi
  
  if [ -n "$DURATION" ]; then
    TOTAL_DURATION=$((TOTAL_DURATION + DURATION))
  fi
  
  # Delay between tests (except for last test)
  if [ $i -lt $TEST_RUNS ]; then
    sleep $DELAY
  fi
done

# Close JSON array
echo "]" >> "$OUTPUT_FILE"

# Calculate statistics
SUCCESS_RATE=$((SUCCESS_COUNT * 100 / TEST_RUNS))
AVG_DURATION=$((TOTAL_DURATION / TEST_RUNS))

# Print summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Results Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total Tests: $TEST_RUNS"
echo -e "${GREEN}Successes: $SUCCESS_COUNT${NC}"
echo -e "${RED}Failures: $FAIL_COUNT${NC}"
echo -e "Success Rate: ${SUCCESS_RATE}%"
echo -e "Average Duration: ${AVG_DURATION}ms"
echo ""
echo -e "${YELLOW}Detailed results saved to:${NC}"
echo -e "  $OUTPUT_FILE"
echo ""

# Save summary to file
{
  echo "========================================="
  echo "Railway Airtable Connection Test Summary"
  echo "========================================="
  echo ""
  echo "Date: $(date)"
  echo "Railway URL: $RAILWAY_URL"
  echo "Test Phone: $TEST_PHONE"
  echo ""
  echo "Total Tests: $TEST_RUNS"
  echo "Successes: $SUCCESS_COUNT"
  echo "Failures: $FAIL_COUNT"
  echo "Success Rate: ${SUCCESS_RATE}%"
  echo "Average Duration: ${AVG_DURATION}ms"
  echo ""
  echo "Detailed results: $OUTPUT_FILE"
} > "$SUMMARY_FILE"

echo -e "${YELLOW}Summary saved to:${NC}"
echo -e "  $SUMMARY_FILE"
echo ""

# Analyze errors if any
if [ $FAIL_COUNT -gt 0 ]; then
  echo -e "${RED}Error Analysis:${NC}"
  echo ""
  grep -o '"error":"[^"]*"' "$OUTPUT_FILE" | sort | uniq -c | sort -rn
  echo ""
fi

# Success/failure indicator
if [ $SUCCESS_RATE -ge 95 ]; then
  echo -e "${GREEN}✓ Connection appears stable (≥95% success rate)${NC}"
elif [ $SUCCESS_RATE -ge 80 ]; then
  echo -e "${YELLOW}⚠ Connection has issues (80-95% success rate)${NC}"
else
  echo -e "${RED}✗ Connection is unstable (<80% success rate)${NC}"
fi

echo ""

