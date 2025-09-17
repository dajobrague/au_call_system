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

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/stream'
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
