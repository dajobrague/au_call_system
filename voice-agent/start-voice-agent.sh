#!/bin/bash

# Voice Agent Startup Script - TEST MODE
# Starts both WebSocket server and ngrok tunnel
# IMPORTANT: Uses TEST credentials (US Twilio number) from .env.local

echo "🚀 ========================================"
echo "🎙️  Starting Voice Agent System (TEST MODE)"
echo "🚀 ========================================"
echo ""

# Force test/development mode
export NODE_ENV=development
export APP_ENV=development

# Check for .env.local file
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found"
    echo ""
    echo "📋 To set up your test environment:"
    echo "   1. Copy .env.example to .env.local:"
    echo "      cp .env.example .env.local"
    echo ""
    echo "   2. Edit .env.local with your TEST credentials (US Twilio number)"
    echo ""
    exit 1
fi

# Load and validate environment from .env.local
echo "📋 Loading test environment from .env.local..."
source .env.local

# Validate TEST credentials are present
if [ -z "$TWILIO_ACCOUNT_SID" ]; then
    echo "❌ Error: TWILIO_ACCOUNT_SID not found in .env.local"
    exit 1
fi

if [ -z "$TWILIO_PHONE_NUMBER" ]; then
    echo "❌ Error: TWILIO_PHONE_NUMBER not found in .env.local"
    exit 1
fi

# Safety check: Ensure we're using US test number (starts with +1)
if [[ ! "$TWILIO_PHONE_NUMBER" =~ ^\+1 ]]; then
    echo "⚠️  WARNING: Phone number does not start with +1 (US)"
    echo "   Current: $TWILIO_PHONE_NUMBER"
    echo ""
    echo "   This script is for TEST MODE with US test number."
    echo "   If you're using an Australian number, you may be using PRODUCTION credentials!"
    echo ""
    read -p "   Do you want to continue anyway? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Aborted. Please check your .env.local configuration."
        exit 1
    fi
fi

# Check if PROD_* credentials are present (they shouldn't be in local testing)
if [ ! -z "$PROD_TWILIO_ACCOUNT_SID" ]; then
    echo "⚠️  WARNING: Production credentials (PROD_*) detected in .env.local"
    echo "   These should only be set in Vercel dashboard, not locally."
    echo ""
fi

echo "✅ Test environment validated"
echo "   📞 Phone: $TWILIO_PHONE_NUMBER (US test number)"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ Error: ngrok is not installed"
    echo "📦 Install it from: https://ngrok.com/download"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

# Kill any existing processes on port 3001
echo "🧹 Cleaning up existing processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 1

# Start WebSocket server in background
echo "📡 Starting WebSocket server on port 3001..."
node websocket-server.js > server.log 2>&1 &
SERVER_PID=$!
echo "   Server PID: $SERVER_PID"

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
sleep 3

# Check if server is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ Error: Server failed to start"
    echo "📋 Check server.log for details"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo "✅ WebSocket server is running"
echo ""

# Start ngrok tunnel with reserved domain
echo "🌐 Starting ngrok tunnel..."
ngrok http 3001 --domain=climbing-merely-joey.ngrok-free.app --log=stdout > ngrok.log 2>&1 &
NGROK_PID=$!
echo "   Ngrok PID: $NGROK_PID"

# Wait for ngrok to start
echo "⏳ Waiting for ngrok to initialize..."
sleep 3

# Set the reserved ngrok URL
NGROK_URL="https://climbing-merely-joey.ngrok-free.app"
echo ""
echo "🔗 Using reserved ngrok domain..."

echo ""
echo "✅ ========================================"
echo "✅ Voice Agent System is READY! (TEST MODE)"
echo "✅ ========================================"
echo ""
echo "🔧 Environment: TEST/DEVELOPMENT"
echo "   Using credentials from: .env.local"
echo "   Phone number: $TWILIO_PHONE_NUMBER"
echo ""
echo "📡 WebSocket Server:"
echo "   Local:  http://localhost:3001"
echo "   Health: http://localhost:3001/health"
echo ""
echo "🌐 Ngrok Tunnel:"
echo "   Public URL: $NGROK_URL"
echo "   Dashboard:  http://localhost:4040"
echo ""
echo "📋 Twilio Configuration (TEST NUMBER):"
echo "   Configure in Twilio Console:"
echo "   Phone Number: $TWILIO_PHONE_NUMBER"
echo "   Voice Webhook URL: $NGROK_URL/stream"
echo "   Method: POST"
echo ""
echo "⚠️  IMPORTANT: This is TEST MODE"
echo "   - Uses US test Twilio number"
echo "   - For production, deploy to Vercel with PROD_* credentials"
echo ""
echo "📝 Logs:"
echo "   Server: tail -f server.log"
echo "   Ngrok:  tail -f ngrok.log"
echo ""
echo "🛑 To stop: Press Ctrl+C or run: kill $SERVER_PID $NGROK_PID"
echo ""
echo "PIDs saved to .voice-agent-pids for cleanup"
echo "$SERVER_PID $NGROK_PID" > .voice-agent-pids

# Keep script running and show live logs
echo "📊 Live Server Logs (Ctrl+C to exit):"
echo "----------------------------------------"
tail -f server.log
