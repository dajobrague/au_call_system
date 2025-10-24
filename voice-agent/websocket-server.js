#!/usr/bin/env node
/**
 * WebSocket Server Entry Point
 * Clean, production-ready WebSocket server using refactored modules
 * 
 * This is the new modular implementation.
 * The original ngrok-websocket-test.js is kept as reference.
 */

require('dotenv').config({ path: '.env.local' });

// Register ts-node to handle TypeScript files
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true
  }
});

const { createWebSocketServer } = require('./src/websocket/server.ts');
const { logger } = require('./src/lib/logger.ts');

const PORT = process.env.WEBSOCKET_PORT || 3001;

// Validate required environment variables
const requiredEnvVars = [
  'ELEVENLABS_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  process.exit(1);
}

// Warn about optional variables
if (!process.env.REDIS_URL && !process.env.UPSTASH_REDIS_REST_URL) {
  console.warn('⚠️  Redis not configured - state persistence will be limited');
}

// Validate Redis token if URL is present
if ((process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL) && 
    !process.env.REDIS_TOKEN && !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error('❌ Redis URL is set but token is missing');
  process.exit(1);
}

// Create and start server
try {
  const { app, server, wss } = createWebSocketServer(PORT);

  server.listen(PORT, () => {
    console.log('');
    console.log('🚀 ========================================');
    console.log('🎙️  Voice Agent WebSocket Server');
    console.log('🚀 ========================================');
    console.log('');
    console.log(`📡 WebSocket server listening on port ${PORT}`);
    console.log(`🔗 WebSocket URL: ws://localhost:${PORT}/stream`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
    console.log('');
    console.log('✅ Server ready to accept connections');
    console.log('');
    
    logger.info('WebSocket server started', {
      port: PORT,
      type: 'server_start'
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('');
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    
    wss.clients.forEach(client => {
      client.close();
    });
    
    server.close(() => {
      console.log('✅ Server closed');
      logger.info('WebSocket server stopped', {
        type: 'server_stop'
      });
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('');
    console.log('🛑 SIGINT received, shutting down gracefully...');
    
    wss.clients.forEach(client => {
      client.close();
    });
    
    server.close(() => {
      console.log('✅ Server closed');
      logger.info('WebSocket server stopped', {
        type: 'server_stop'
      });
      process.exit(0);
    });
  });

} catch (error) {
  console.error('❌ Failed to start server:', error);
  logger.error('Server startup error', {
    error: error instanceof Error ? error.message : 'Unknown error',
    type: 'server_startup_error'
  });
  process.exit(1);
}
