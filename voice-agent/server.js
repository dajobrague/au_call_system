#!/usr/bin/env node

/**
 * Unified Server for Railway
 * Runs both Next.js (web pages + API routes) and WebSocket server
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

const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

console.log('🚀 Starting Unified Server (Next.js + WebSocket)...');
console.log(`📡 Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`🌐 Port: ${port}`);
console.log(`📂 Working Directory: ${__dirname}`);
console.log('');

// Initialize Next.js app with explicit directory
const app = next({ 
  dev, 
  hostname, 
  port,
  dir: __dirname,  // Explicitly set the directory
  conf: {
    distDir: '.next'
  }
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);

  // ============================================================
  // WebSocket Server Setup
  // ============================================================
  console.log('📡 Initializing WebSocket server...');
  
  const wss = new Server({ 
    server: httpServer,
    path: '/stream',
  });

  // Import WebSocket connection handler
  const { handleWebSocketConnection } = require('./src/websocket/connection-handler');
  
  wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket connection from:', req.socket.remoteAddress);
    handleWebSocketConnection(ws, req);
  });

  wss.on('error', (error) => {
    console.error('❌ WebSocket server error:', error);
  });

  console.log('✅ WebSocket server initialized on path: /stream');

  // Initialize SMS Wave Worker
  try {
    const { initializeSMSWaveWorker } = require('./src/workers/sms-wave-worker');
    initializeSMSWaveWorker();
    console.log('✅ SMS Wave Worker initialized');
  } catch (workerError) {
    console.error('⚠️  SMS Wave Worker initialization failed:', workerError.message);
    console.error('   SMS waves will not be processed!');
  }

  // ============================================================
  // Twilio Voice Endpoints (needed for WebSocket)
  // ============================================================
  server.use(express.urlencoded({ extended: true }));
  server.use(express.json());

  const twilio = require('twilio');
  const { logger } = require('./src/lib/logger');
  const { loadCallState, saveCallState } = require('./src/fsm/state/state-manager');

  // Initial voice webhook
  server.post('/api/twilio/voice', async (req, res) => {
    try {
      const host = req.get('host') || process.env.RAILWAY_PUBLIC_DOMAIN;
      const protocol = 'https'; // Railway always uses HTTPS
      const wsProtocol = 'wss';
      
      const websocketUrl = `${wsProtocol}://${host}/stream`;
      const actionUrl = `${protocol}://${host}/api/transfer/after-connect?callSid=${req.body.CallSid}&from=${encodeURIComponent(req.body.From)}`;
      
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const response = new VoiceResponse();
      
      const connect = response.connect({ action: actionUrl });
      const stream = connect.stream({ url: websocketUrl });
      stream.parameter({ name: 'phone', value: req.body.From });
      stream.parameter({ name: 'parentCallSid', value: req.body.CallSid });
      
      response.say({ voice: 'Polly.Amy' }, 'The call has ended. Goodbye.');
      response.hangup();

      res.type('text/xml').send(response.toString());
      
      if (req.body.CallSid) {
        try {
          const { voiceMetrics } = require('./src/services/monitoring/voice-metrics');
          voiceMetrics.recordCallStart(req.body.CallSid);
        } catch (e) {}
      }
    } catch (error) {
      logger.error('Error in voice handler', { error: error.message });
      res.status(500).send('Error');
    }
  });

  // After-connect handler
  server.post('/api/transfer/after-connect', async (req, res) => {
    logger.info('After-connect endpoint called', {
      url: req.url,
      method: req.method,
      type: 'after_connect_entry'
    });
    
    try {
      const callSid = req.body.CallSid;
      const from = req.body.From;
      
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      
      if (!callSid) {
        twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Goodbye.');
        twiml.hangup();
        return res.type('text/xml').send(twiml.toString());
      }
      
      const callState = await loadCallState(callSid);
      
      if (callState && callState.pendingTransfer) {
        const host = req.get('host') || process.env.RAILWAY_PUBLIC_DOMAIN;
        const protocol = 'https';
        const APP_BASE_URL = `${protocol}://${host}`;
        
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

  // Health check
  server.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      websocket: wss.clients.size,
      nextjs: 'ready',
      timestamp: new Date().toISOString()
    });
  });

  // ============================================================
  // Next.js Handler (for all other routes including /job/[id])
  // ============================================================
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  // ============================================================
  // Start Server
  // ============================================================
  httpServer.listen(port, () => {
    console.log('');
    console.log('✅ Unified Server Started Successfully!');
    console.log(`🌐 Next.js ready: http://${hostname}:${port}`);
    console.log(`🔌 WebSocket ready: ws://${hostname}:${port}/stream`);
    console.log(`🔗 Health check: http://${hostname}:${port}/health`);
    console.log(`📱 Job pages: http://${hostname}:${port}/job/[id]`);
    console.log(`📱 SMS Wave System: Active`);
    console.log('');
    console.log('📊 Server is ready to accept connections...');
    console.log('');
  });

  // ============================================================
  // Graceful Shutdown
  // ============================================================
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    // Shutdown SMS Wave Worker
    try {
      const { shutdownSMSWaveWorker } = require('./src/workers/sms-wave-worker');
      await shutdownSMSWaveWorker();
      console.log('✅ SMS Wave Worker shut down');
    } catch (error) {
      console.error('⚠️  Error shutting down SMS Wave Worker:', error.message);
    }
    
    // Close WebSocket server
    wss.close(() => {
      console.log('✅ WebSocket server closed');
    });
    
    // Close HTTP server
    httpServer.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
