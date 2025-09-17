const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const url = require('url');

const app = express();
const server = http.createServer(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('OK');
});

// Handle HTTP requests to /stream - require WebSocket upgrade
app.all('/stream', (req, res) => {
  console.log(`📋 ${req.method} request to /stream:`);
  console.log('📋 URL:', req.url);
  console.log('📋 Headers:', req.headers);
  console.log('📋 Query:', req.query);
  
  // Check if this is a WebSocket upgrade attempt
  const isWebSocketUpgrade = req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket';
  const hasWebSocketHeaders = req.headers['sec-websocket-key'] && req.headers['sec-websocket-version'];
  
  if (isWebSocketUpgrade || hasWebSocketHeaders) {
    console.log('🔍 This looks like a WebSocket upgrade request - letting WebSocket server handle it');
    // Let the WebSocket server handle it
    return;
  }
  
  // For non-WebSocket requests, return 426 to signal upgrade required
  console.log('❌ Non-WebSocket request to /stream - returning 426 Upgrade Required');
  res.status(426).set('Upgrade', 'websocket').send('WebSocket upgrade required');
});

// Create WebSocket server with custom verification
const wss = new WebSocket.Server({ 
  server,
  path: '/stream',
  verifyClient: (info) => {
    console.log('🔍 WebSocket verification request:');
    console.log('📋 URL:', info.req.url);
    console.log('📋 Headers:', info.req.headers);
    console.log('📋 Method:', info.req.method);
    
    // Accept all WebSocket requests for testing
    return true;
  }
});

console.log('🚀 Starting ngrok WebSocket test server...');

wss.on('connection', (ws, request) => {
  const parsedUrl = url.parse(request.url, true);
  const callSid = parsedUrl.query.callSid || 'unknown';
  const prompt = parsedUrl.query.prompt || 'Hello';
  
  console.log('🔗 WebSocket connection established for call:', callSid);
  console.log('📋 Initial prompt:', prompt);
  console.log('📋 Request headers:');
  Object.entries(request.headers).forEach(([key, value]) => {
    console.log(`  - ${key}: ${value}`);
  });

  // Handle incoming messages from Twilio
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 Received message:', data.event, data);
      
      if (data.event === 'start') {
        console.log('✅ Twilio stream started:', {
          callSid: data.start?.callSid,
          streamSid: data.streamSid,
          media: data.media
        });
        
        // Send a simple audio response (silence for now)
        const response = {
          event: 'media',
          streamSid: data.streamSid,
          media: {
            payload: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=' // Empty WAV
          }
        };
        ws.send(JSON.stringify(response));
        
      } else if (data.event === 'media') {
        // Log media frames (don't spam too much)
        if (Math.random() < 0.01) { // Log ~1% of frames
          console.log('🎧 Media frame received, payload length:', data.media?.payload?.length || 0);
        }
        
      } else if (data.event === 'stop') {
        console.log('🛑 Twilio stream stopped:', data);
        ws.close();
      }
      
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });

  ws.on('close', (code, reason) => {
    console.log('🔚 WebSocket closed:', { callSid, code, reason: reason.toString() });
  });

  ws.on('error', (error) => {
    console.error('💥 WebSocket error:', { callSid, error });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎯 Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/stream`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 ngrok should tunnel this to: wss://climbing-merely-joey.ngrok-free.app/stream`);
});
