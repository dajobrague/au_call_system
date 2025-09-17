/**
 * Cloudflare Workers entry point for Twilio Media Streams bridge
 * Routes WebSocket connections to Durable Objects for call management
 */

import type { Env } from './types';

// Export the Durable Object class
export { CallSession } from './do/CallSession';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      
      // Handle WebSocket upgrade for Twilio Media Streams
      if (url.pathname === '/stream') {
        return handleStreamConnection(request, env);
      }
      
      // Health check endpoint
      if (url.pathname === '/health') {
        return handleHealthCheck(env);
      }
      
      // Default response
      return new Response('Cloudflare Voice Bridge - WebSocket endpoint available at /stream', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

/**
 * Handle WebSocket connection for Twilio Media Streams
 */
async function handleStreamConnection(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const callSid = url.searchParams.get('callSid');
  
  console.log(`🔗 WebSocket connection request for call: ${callSid}`);
  console.log('📋 Request method:', request.method);
  console.log('📋 Request URL:', request.url);
  
  // Log important headers individually (Cloudflare Workers Headers doesn't have entries())
  console.log('📋 Headers:');
  console.log('  - Upgrade:', request.headers.get('Upgrade'));
  console.log('  - Connection:', request.headers.get('Connection'));
  console.log('  - Sec-WebSocket-Key:', request.headers.get('Sec-WebSocket-Key'));
  console.log('  - Sec-WebSocket-Version:', request.headers.get('Sec-WebSocket-Version'));
  
  if (!callSid) {
    console.error('❌ Missing callSid parameter');
    return new Response('Missing callSid parameter', { status: 400 });
  }
  
  // Check for WebSocket upgrade headers
  const upgradeHeader = request.headers.get('Upgrade');
  const connectionHeader = request.headers.get('Connection');
  
  console.log(`📋 Upgrade header: "${upgradeHeader}"`);
  console.log(`📋 Connection header: "${connectionHeader}"`);
  
  // More permissive WebSocket validation
  const isWebSocketRequest = 
    upgradeHeader?.toLowerCase().includes('websocket') ||
    connectionHeader?.toLowerCase().includes('upgrade') ||
    request.headers.get('Sec-WebSocket-Key');
  
  if (!isWebSocketRequest) {
    console.error('❌ Not a WebSocket upgrade request');
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }
  
  try {
    console.log(`✅ Processing WebSocket upgrade for call: ${callSid}`);
    
    // Get Durable Object instance for this call
    const id = env.CALL_SESSIONS.idFromName(callSid);
    const callSession = env.CALL_SESSIONS.get(id);
    
    // Forward the request to the Durable Object
    return await callSession.fetch(request);
    
  } catch (error) {
    console.error('❌ Error handling stream connection:', error);
    return new Response('Failed to establish stream connection', { status: 500 });
  }
}

/**
 * Handle health check requests
 */
async function handleHealthCheck(env: Env): Promise<Response> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: {
      hasElevenLabsKey: !!env.XI_API_KEY,
      hasAgentId: !!env.ELEVENLABS_AGENT_ID,
      hasVoiceId: !!env.ELEVENLABS_VOICE_ID,
      mode: env.ELEVENLABS_MODE || 'convai',
    },
    worker: {
      version: '1.0.0',
      runtime: 'cloudflare-workers',
      durableObjects: 'enabled',
    },
  };
  
  return Response.json(health);
}
