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
const { createHttpRoutes } = require('./src/http/server');
const { logger } = require('./src/lib/logger');

const PORT = process.env.WEBSOCKET_PORT || process.env.PORT || 3001;

logger.info('Starting unified HTTP + WebSocket server...', {
  port: PORT,
  nodeEnv: process.env.NODE_ENV,
  type: 'server_startup'
});

try {
  // Create HTTP routes first (includes /api/transfer/after-connect)
  const httpApp = createHttpRoutes();
  
  logger.info('HTTP routes initialized', {
    type: 'http_routes_ready'
  });
  
  // Create and start the WebSocket server with HTTP routes
  const { app, server, wss } = createWebSocketServer(PORT, httpApp);
  
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

