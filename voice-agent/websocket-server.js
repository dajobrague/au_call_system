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
  
  // Handle initial voice request
  app.post('/api/twilio/voice', async (req, res) => {
    try {
      const host = req.get('host') || process.env.RAILWAY_PUBLIC_DOMAIN || 'aucallsystem-ivr-system.up.railway.app';
      const protocol = host.includes('localhost') || host.includes('ngrok') ? 'http' : 'https';
      const wsProtocol = host.includes('localhost') || host.includes('ngrok') ? 'ws' : 'wss';
      
      const websocketUrl = `${wsProtocol}://${host}/stream`;
      const actionUrl = `${protocol}://${host}/api/transfer/after-connect?callSid=${req.body.CallSid}&from=${encodeURIComponent(req.body.From)}`;
      
      // Use Twilio's VoiceResponse builder for proper TwiML formatting
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const response = new VoiceResponse();
      
      const connect = response.connect({ action: actionUrl });
      const stream = connect.stream({ url: websocketUrl });
      stream.parameter({ name: 'phone', value: req.body.From });
      stream.parameter({ name: 'parentCallSid', value: req.body.CallSid });
      
      // Fallback instructions (only executed if action URL fails)
      response.say({ voice: 'Polly.Amy' }, 'The call has ended. Goodbye.');
      response.hangup();

      res.type('text/xml').send(response.toString());
      
      // Log metric
      if (req.body.CallSid) {
        try {
          const { voiceMetrics } = require('./src/services/monitoring/voice-metrics');
          voiceMetrics.recordCallStart(req.body.CallSid);
        } catch (e) {
          // Ignore metrics error
        }
      }
      
    } catch (error) {
      logger.error('Error in voice handler', { error: error.message });
      res.status(500).send('Error');
    }
  });

  app.post('/api/transfer/after-connect', async (req, res) => {
    // Log immediately to confirm Twilio is calling this endpoint
    logger.info('🔔 AFTER-CONNECT ENDPOINT CALLED BY TWILIO (standalone server)', {
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: req.body,
      type: 'after_connect_entry_standalone'
    });
    
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
        const host = req.get('host') || process.env.RAILWAY_PUBLIC_DOMAIN || 'aucallsystem-ivr-system.up.railway.app';
        const protocol = host.includes('localhost') || host.includes('ngrok') ? 'http' : 'https';
        const APP_BASE_URL = `${protocol}://${host}`;
        
        twiml.say({ voice: 'Polly.Amy' }, 'Connecting you to a representative. Please hold.');
        
        const dial = twiml.dial({
          callerId: callState.pendingTransfer.callerPhone,
          timeout: 30,
          action: `${APP_BASE_URL}/api/queue/transfer-status?callSid=${callSid}&from=${encodeURIComponent(from)}`
        });
        
        dial.number(callState.pendingTransfer.representativePhone);
        
        twiml.say({ voice: 'Polly.Amy' }, 'The representative is not available. You will be placed in the queue.');
        twiml.redirect(`${APP_BASE_URL}/api/queue/enqueue-caller?callSid=${callSid}&from=${encodeURIComponent(from)}`);
        
        callState.pendingTransfer = undefined;
        await saveCallState(callState);
        
        logger.info('Simple Dial TwiML generated (no recording)', { callSid });
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

  // Initialize SMS Wave Worker for 3-wave notification system
  try {
    const { initializeSMSWaveWorker } = require('./src/workers/sms-wave-worker');
    initializeSMSWaveWorker();
    console.log('✅ SMS Wave Worker initialized');
  } catch (workerError) {
    console.error('⚠️  SMS Wave Worker initialization failed:', workerError.message);
    console.error('   SMS waves will not be processed!');
  }

  // Initialize Outbound Call Worker (Phase 2)
  try {
    const { initializeOutboundCallWorker } = require('./src/workers/outbound-call-worker');
    initializeOutboundCallWorker();
    console.log('✅ Outbound Call Worker initialized');
  } catch (workerError) {
    console.error('⚠️  Outbound Call Worker initialization failed:', workerError.message);
    console.error('   Outbound calls will not be processed!');
  }

  server.listen(PORT, () => {
    console.log('✅ WebSocket Server Started Successfully!');
    console.log(`📡 Listening on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔌 WebSocket path: ws://localhost:${PORT}/stream`);
    console.log('📱 SMS Wave System: Active');
    console.log('');
    console.log('📊 Server is ready to accept connections...');
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    
    // Shutdown SMS Wave Worker
    try {
      const { shutdownSMSWaveWorker } = require('./src/workers/sms-wave-worker');
      await shutdownSMSWaveWorker();
      console.log('✅ SMS Wave Worker shut down');
    } catch (error) {
      console.error('⚠️  Error shutting down SMS Wave Worker:', error.message);
    }
    
    // Shutdown Outbound Call Worker (Phase 2)
    try {
      const { shutdownOutboundCallWorker } = require('./src/workers/outbound-call-worker');
      await shutdownOutboundCallWorker();
      console.log('✅ Outbound Call Worker shut down');
    } catch (error) {
      console.error('⚠️  Error shutting down Outbound Call Worker:', error.message);
    }
    
    server.close(() => {
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    
    // Shutdown SMS Wave Worker
    try {
      const { shutdownSMSWaveWorker } = require('./src/workers/sms-wave-worker');
      await shutdownSMSWaveWorker();
      console.log('✅ SMS Wave Worker shut down');
    } catch (error) {
      console.error('⚠️  Error shutting down SMS Wave Worker:', error.message);
    }
    
    // Shutdown Outbound Call Worker (Phase 2)
    try {
      const { shutdownOutboundCallWorker } = require('./src/workers/outbound-call-worker');
      await shutdownOutboundCallWorker();
      console.log('✅ Outbound Call Worker shut down');
    } catch (error) {
      console.error('⚠️  Error shutting down Outbound Call Worker:', error.message);
    }
    
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
