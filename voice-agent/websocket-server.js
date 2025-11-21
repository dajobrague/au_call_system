/**
 * WebSocket Server Entry Point
 * Production entry point for Railway deployment
 */

// Register TypeScript loader with server-specific config
require('ts-node').register({
  project: './tsconfig.server.json',
  transpileOnly: true // Faster startup, skip type checking
});

// Load environment variables
require('dotenv').config();

const { createWebSocketServer } = require('./src/websocket/server');
const { logger } = require('./src/lib/logger');

const PORT = process.env.WEBSOCKET_PORT || process.env.PORT || 3001;

logger.info('Starting unified HTTP + WebSocket server...', {
  port: PORT,
  nodeEnv: process.env.NODE_ENV,
  type: 'server_startup'
});

try {
  // Create WebSocket server (creates its own Express app)
  const { app, server, wss } = createWebSocketServer(PORT);
  
  logger.info('WebSocket server created', {
    type: 'ws_server_created'
  });
  
  // Add HTTP routes to the same app
  const express = require('express');
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  
  // Import and register HTTP routes
  const { loadCallState, saveCallState } = require('./src/fsm/state/state-manager');
  const twilio = require('twilio');
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const REPRESENTATIVE_PHONE = process.env.REPRESENTATIVE_PHONE || '+61490550941';
  const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || 'aucallsystem-ivr-system.up.railway.app';
  const APP_BASE_URL = `https://${RAILWAY_PUBLIC_DOMAIN}`;
  
  // Register after-connect endpoint
  app.post('/api/transfer/after-connect', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const callSid = req.body.CallSid;
      const from = req.body.From;
      const callStatus = req.body.CallStatus;

      logger.info('After-connect handler called', {
        callSid,
        from,
        callStatus,
        type: 'after_connect_start'
      });

      const twiml = new VoiceResponse();

      if (!callSid) {
        logger.error('Missing CallSid in after-connect request', {
          type: 'after_connect_missing_callsid'
        });
        twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Goodbye.');
        twiml.hangup();
        return res.type('text/xml').send(twiml.toString());
      }

      const callState = await loadCallState(callSid);

      if (callState && callState.pendingTransfer) {
        logger.info('Pending transfer found - generating Dial TwiML', {
          callSid,
          representativePhone: callState.pendingTransfer.representativePhone,
          type: 'after_connect_transfer_found'
        });

        const representativePhone = callState.pendingTransfer.representativePhone;
        const callerPhone = callState.pendingTransfer.callerPhone;
        
        twiml.say({ voice: 'Polly.Amy' }, 'Connecting you to a representative. Please hold.');
        
        const dial = twiml.dial({
          callerId: callerPhone,
          timeout: 30,
          record: 'record-from-answer',
          action: `${APP_BASE_URL}/api/queue/transfer-status?callSid=${callSid}&from=${encodeURIComponent(from)}`
        });
        
        dial.number(representativePhone);

        twiml.say({ voice: 'Polly.Amy' }, 'The representative is not available. You will be placed in the queue.');
        twiml.redirect(`${APP_BASE_URL}/api/queue/enqueue-caller?callSid=${callSid}&from=${encodeURIComponent(from)}`);

        callState.pendingTransfer = undefined;
        await saveCallState(callState);

        logger.info('Dial TwiML generated for transfer', {
          callSid,
          representativePhone,
          duration: Date.now() - startTime,
          type: 'after_connect_dial_twiml'
        });

      } else {
        logger.info('No pending transfer - ending call', {
          callSid,
          type: 'after_connect_normal_end'
        });
        
        twiml.say({ voice: 'Polly.Amy' }, 'Thank you for calling. Goodbye.');
        twiml.hangup();
      }

      const duration = Date.now() - startTime;
      logger.info('After-connect handler complete', {
        callSid,
        duration,
        type: 'after_connect_complete'
      });

      return res.type('text/xml').send(twiml.toString());

    } catch (error) {
      logger.error('Error in after-connect handler', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: 'after_connect_error'
      });

      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please try again later.');
      twiml.hangup();

      return res.type('text/xml').send(twiml.toString());
    }
  });
  
  logger.info('HTTP routes registered', {
    type: 'http_routes_ready'
  });
  
  // Start listening on all interfaces (0.0.0.0) for Railway
  server.listen(PORT, '0.0.0.0', () => {
    logger.info('WebSocket server started successfully', {
      port: PORT,
      host: '0.0.0.0',
      timestamp: new Date().toISOString(),
      type: 'server_ready'
    });
    
    console.log(`✅ WebSocket server running on port ${PORT}`);
    console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully', {
      type: 'server_shutdown'
    });
    
    server.close(() => {
      logger.info('Server closed', { type: 'server_closed' });
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully', {
      type: 'server_shutdown'
    });
    
    server.close(() => {
      logger.info('Server closed', { type: 'server_closed' });
      process.exit(0);
    });
  });
  
} catch (error) {
  logger.error('Failed to start WebSocket server', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    type: 'server_startup_error'
  });
  
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}

