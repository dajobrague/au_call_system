#!/bin/bash

# Voice Agent Stop Script
# Stops both WebSocket server and ngrok tunnel

echo "🛑 Stopping Voice Agent System..."
echo ""

# Read PIDs from file if it exists
if [ -f .voice-agent-pids ]; then
    PIDS=$(cat .voice-agent-pids)
    echo "📋 Found saved PIDs: $PIDS"
    kill $PIDS 2>/dev/null
    rm .voice-agent-pids
    echo "✅ Stopped processes from PID file"
fi

# Kill any process on port 3001
echo "🧹 Cleaning up port 3001..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Kill any ngrok processes
echo "🧹 Stopping ngrok..."
pkill -f ngrok 2>/dev/null || true

echo ""
echo "✅ Voice Agent System stopped"
echo ""
