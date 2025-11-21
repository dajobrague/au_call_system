#!/usr/bin/env node

/**
 * Standalone WebSocket Server for Production
 * Starts the WebSocket server for Railway deployment
 */

// Register ts-node for TypeScript support
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    resolveJsonModule: true,
  }
});

// Load environment variables
require('dotenv').config();

// Import the WebSocket server creator (TypeScript file)
const { createWebSocketServer } = require('./src/websocket/server');

const PORT = process.env.WEBSOCKET_PORT || process.env.PORT || 3001;

console.log('🚀 Starting Voice Agent WebSocket Server...');
console.log(`📡 Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`📞 Twilio Number: ${process.env.TWILIO_PHONE_NUMBER}`);
console.log('');

try {
  // Create and start the WebSocket server
  const { app, server, wss } = createWebSocketServer(PORT);

  // Add transfer endpoint
  const express = require('express');
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  const { loadCallState, saveCallState } = require('./src/fsm/state/state-manager');
  const twilio = require('twilio');
  const { logger } = require('./src/lib/logger');
  
  app.post('/api/transfer/after-connect', async (req, res) => {
    try {
      const callSid = req.body.CallSid;
      const from = req.body.From;
      
      logger.info('After-connect handler called', { callSid, from });
      
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      
      if (!callSid) {
        twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Goodbye.');
        twiml.hangup();
        return res.type('text/xml').send(twiml.toString());
      }
      
      const callState = await loadCallState(callSid);
      
      if (callState && callState.pendingTransfer) {
        const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || 'aucallsystem-ivr-system.up.railway.app';
        const APP_BASE_URL = `https://${RAILWAY_PUBLIC_DOMAIN}`;
        
        twiml.say({ voice: 'Polly.Amy' }, 'Connecting you to a representative. Please hold.');
        
        const dial = twiml.dial({
          callerId: callState.pendingTransfer.callerPhone,
          timeout: 30,
          record: 'record-from-answer',
          action: `${APP_BASE_URL}/api/queue/transfer-status?callSid=${callSid}&from=${encodeURIComponent(from)}`
        });
        
        dial.number(callState.pendingTransfer.representativePhone);
        
        twiml.say({ voice: 'Polly.Amy' }, 'The representative is not available. You will be placed in the queue.');
        twiml.redirect(`${APP_BASE_URL}/api/queue/enqueue-caller?callSid=${callSid}&from=${encodeURIComponent(from)}`);
        
        callState.pendingTransfer = undefined;
        await saveCallState(callState);
        
        logger.info('Dial TwiML generated', { callSid });
      } else {
        twiml.say({ voice: 'Polly.Amy' }, 'Thank you for calling. Goodbye.');
        twiml.hangup();
      }
      
      return res.type('text/xml').send(twiml.toString());
    } catch (error) {
      logger.error('Error in after-connect', { error: error.message });
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please try again later.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }
  });

  server.listen(PORT, () => {
    console.log('✅ WebSocket Server Started Successfully!');
    console.log(`📡 Listening on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔌 WebSocket path: ws://localhost:${PORT}/stream`);
    console.log('');
    console.log('📊 Server is ready to accept connections...');
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.close(() => {
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    server.close(() => {
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
  });

} catch (error) {
  console.error('❌ Failed to start WebSocket server:');
  console.error(error);
  process.exit(1);
}
