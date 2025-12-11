#!/usr/bin/env node

/**
 * Test WebSocket connection to Railway
 */

const WebSocket = require('ws');

const WS_URL = 'wss://aucallsystem-ivr-system.up.railway.app/stream';

console.log('🔍 Testing WebSocket connection to Railway...');
console.log(`📡 URL: ${WS_URL}`);
console.log('');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connection SUCCESSFUL!');
  console.log('🎉 Railway WebSocket server is working!');
  ws.close();
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('❌ WebSocket connection FAILED!');
  console.error('Error:', error.message);
  console.error('');
  console.error('Possible causes:');
  console.error('  1. Railway server is not running');
  console.error('  2. Railway server is not listening on 0.0.0.0');
  console.error('  3. Firewall blocking WebSocket connections');
  console.error('  4. Railway deployment failed');
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('⏱️  Connection timeout (10s)');
  console.error('❌ Railway WebSocket is not responding');
  ws.close();
  process.exit(1);
}, 10000);

