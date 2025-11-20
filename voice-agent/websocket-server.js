#!/usr/bin/env node

/**
 * Standalone WebSocket Server for Local Testing
 * Starts the WebSocket server on port 3001 for local development
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
require('dotenv').config({ path: '.env.local' });

// Import the WebSocket server creator (TypeScript file)
const { createWebSocketServer } = require('./src/websocket/server');

const PORT = process.env.WEBSOCKET_PORT || 3001;

console.log('🚀 Starting Voice Agent WebSocket Server...');
console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`📞 Twilio Number: ${process.env.TWILIO_PHONE_NUMBER}`);
console.log('');

try {
  // Create and start the WebSocket server
  const { app, server, wss } = createWebSocketServer(PORT);

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

