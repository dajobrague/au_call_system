const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Convert PCM16 to μ-law using GPT-5's proven G.711 algorithm
 */
function linear16ToMulaw(int16Array) {
  const BIAS = 0x84, CLIP = 32635;
  const muLaw = new Uint8Array(int16Array.length);
  
  for (let i = 0; i < int16Array.length; i++) {
    let sample = int16Array[i];
    let sign = (sample >> 8) & 0x80;
    if (sample < 0) sample = -sample;
    if (sample > CLIP) sample = CLIP;
    sample = sample + BIAS;

    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
    let mantissa = (sample >> (exponent + 3)) & 0x0F;
    let ulaw = ~(sign | (exponent << 4) | mantissa);
    muLaw[i] = ulaw & 0xFF;
  }
  return muLaw;
}

/**
 * Generate a 440Hz test tone in μ-law for testing
 */
function makeUlawTone440(durationMs = 2000) {
  const sr = 8000, n = Math.floor(sr * (durationMs / 1000));
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    pcm[i] = Math.round(Math.sin(2 * Math.PI * 440 * t) * 0x3FFF); // safe amplitude
  }
  const ulaw = linear16ToMulaw(pcm);
  return sliceInto20msFrames(ulaw);
}

/**
 * High-quality linear interpolation resampling with anti-aliasing
 */
function resampleTo8k(audioBuffer, fromSampleRate) {
  const input = new Int16Array(audioBuffer);
  const ratio = 8000 / fromSampleRate;
  const outputLength = Math.floor(input.length * ratio);
  const output = new Int16Array(outputLength);
  
  // Apply simple low-pass filter to prevent aliasing
  const filtered = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    if (i === 0) {
      filtered[i] = input[i];
    } else if (i === input.length - 1) {
      filtered[i] = input[i];
    } else {
      // Simple 3-point average for anti-aliasing
      filtered[i] = Math.round((input[i-1] + 2 * input[i] + input[i+1]) / 4);
    }
  }
  
  // Resample with linear interpolation
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i / ratio;
    const sourceIndexFloor = Math.floor(sourceIndex);
    const sourceIndexCeil = Math.min(sourceIndexFloor + 1, filtered.length - 1);
    
    if (sourceIndexFloor >= filtered.length) break;
    
    const fraction = sourceIndex - sourceIndexFloor;
    const sample1 = filtered[sourceIndexFloor] || 0;
    const sample2 = filtered[sourceIndexCeil] || 0;
    
    output[i] = Math.round(sample1 * (1 - fraction) + sample2 * fraction);
  }
  
  return output.buffer;
}

/**
 * Slice μ-law audio into 20ms frames (160 bytes at 8kHz) - GPT-5's version
 */
function sliceInto20msFrames(muBytes) {
  const frameSize = 160; // 20ms at 8kHz = 160 samples
  const frames = [];
  for (let i = 0; i + frameSize <= muBytes.length; i += frameSize) {
    frames.push(muBytes.subarray(i, i + frameSize));
  }
  return frames;
}

/**
 * Legacy function name for compatibility
 */
function sliceInto20msChunks(audioBuffer) {
  const input = new Uint8Array(audioBuffer);
  return sliceInto20msFrames(input);
}

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  console.log('📋 Loaded environment variables from .env.local');
}

// Redis client for prompt caching (using same config as main app)
const { Redis } = require('@upstash/redis');
let redisClient = null;

// Import existing FSM modules and services
const fs_promises = require('fs').promises;

// FSM Services (will be imported dynamically to handle ES modules)
let employeeService = null;
let multiProviderService = null;
let stateManager = null;
let phoneFormatter = null;

// Initialize FSM services using ts-node for TypeScript compatibility
async function initializeFSMServices() {
  try {
    // Register ts-node for TypeScript support with compatible config
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'commonjs',
        target: 'es2020',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true
      }
    });
    
    // Import TypeScript modules directly
    const employeeModule = require('./src/services/airtable/employee-service.ts');
    const multiProviderModule = require('./src/services/airtable/multi-provider-service.ts');
    const stateModule = require('./src/fsm/state/state-manager.ts');
    const phoneModule = require('./src/utils/phone-formatter.ts');
    
    employeeService = employeeModule.employeeService;
    multiProviderService = multiProviderModule.multiProviderService;
    stateManager = stateModule;
    phoneFormatter = phoneModule;
    
    console.log('✅ FSM services initialized successfully with ts-node');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize FSM services:', error);
    return false;
  }
}

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisClient;
}

// Get cached prompt for a call
async function getVoicePrompt(callSid) {
  try {
    const client = getRedisClient();
    const key = `voice_prompt:${callSid}`;
    const cached = await client.get(key);
    
    if (cached && typeof cached === 'object' && cached.prompt) {
      console.log(`📝 Retrieved cached voice prompt for ${callSid}: "${cached.prompt}"`);
      return cached.prompt;
    }
    
    console.log(`⚠️ No cached prompt found for ${callSid}`);
    return null;
  } catch (error) {
    console.error('❌ Redis error getting voice prompt:', error);
    return null;
  }
}

const app = express();
const server = http.createServer(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('OK');
});

// Handle HTTP requests to /stream - require WebSocket upgrade
app.all('/stream', (req, res) => {
  console.log(`📋 ${req.method} request to /stream:`);
  console.log('📋 URL:', req.url);
  console.log('📋 Headers:', req.headers);
  console.log('📋 Query:', req.query);
  
  // Check if this is a WebSocket upgrade attempt
  const isWebSocketUpgrade = req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket';
  const hasWebSocketHeaders = req.headers['sec-websocket-key'] && req.headers['sec-websocket-version'];
  
  if (isWebSocketUpgrade || hasWebSocketHeaders) {
    console.log('🔍 This looks like a WebSocket upgrade request - letting WebSocket server handle it');
    // Let the WebSocket server handle it
    return;
  }
  
  // For non-WebSocket requests, return 426 to signal upgrade required
  console.log('❌ Non-WebSocket request to /stream - returning 426 Upgrade Required');
  res.status(426).set('Upgrade', 'websocket').send('WebSocket upgrade required');
});

// Create WebSocket server with custom verification
const wss = new WebSocket.Server({ 
  server,
  path: '/stream',
  verifyClient: (info) => {
    console.log('🔍 WebSocket verification request:');
    console.log('📋 URL:', info.req.url);
    console.log('📋 Headers:', info.req.headers);
    console.log('📋 Method:', info.req.method);
    
    // Accept all WebSocket requests for testing
    return true;
  }
});

console.log('🚀 Starting ngrok WebSocket test server...');

// Initialize FSM services asynchronously
initializeFSMServices().then(success => {
  if (success) {
    console.log('🎯 FSM integration ready - personalized greetings enabled');
  } else {
    console.log('⚠️ FSM integration failed - using fallback greetings');
  }
}).catch(error => {
  console.error('❌ FSM initialization error:', error);
  console.log('⚠️ FSM integration failed - using fallback greetings');
});

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

  // ElevenLabs WebSocket connection
  let elevenLabsWS = null;
  let streamSid = null;
  
  // Generate speech using ElevenLabs HTTP streaming API
  function generateElevenLabsSpeech(text) {
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'aGkVQvWUZi16EH8aZJvT';
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      console.error('❌ Missing ELEVENLABS_API_KEY');
      return;
    }
    
    console.log('🎤 Generating speech with ElevenLabs HTTP API...');
    console.log('📋 Text:', text);
    console.log('📋 Voice ID:', voiceId);
    
    const postData = JSON.stringify({
      text: text,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        speed: 1,
        stability: 0.5,
        similarity_boost: 0.8
      }
    });
    
    // Use μ-law 8kHz directly from ElevenLabs - no conversion needed!
    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'xi-api-key': apiKey
      }
    };
    
    const req = https.request(options, (res) => {
      console.log('✅ ElevenLabs response status:', res.statusCode);
      
      if (res.statusCode === 200) {
        console.log('🎵 Streaming audio from ElevenLabs...');
        
        let totalChunksProcessed = 0;
        let totalBytesSent = 0;
        
        let totalRawBytes = 0;
        
        res.on('data', (chunk) => {
          if (streamSid) {            
            try {
              totalRawBytes += chunk.length;
              console.log(`🎵 Raw chunk: ${chunk.length} bytes (total: ${totalRawBytes})`);
              
              // TEMP: Send raw chunks directly to see if ngrok/chunking is the issue
              const base64Chunk = chunk.toString('base64');
              totalBytesSent += chunk.length;
              
              const twilioMessage = {
                event: 'media',
                streamSid: streamSid,
                media: {
                  payload: base64Chunk
                }
              };
              
              ws.send(JSON.stringify(twilioMessage));
              console.log(`🎵 Sent raw chunk: ${chunk.length} bytes`);
              
            } catch (error) {
              console.error('❌ Audio processing error:', error);
            }
          }
        });
        
        res.on('end', () => {
          console.log(`✅ ElevenLabs streaming complete - Processed ${totalChunksProcessed} chunks (${totalBytesSent} bytes)`);
        });
        
      } else {
        console.error('❌ ElevenLabs API error:', res.statusCode);
      }
    });
    
    req.on('error', (error) => {
      console.error('❌ ElevenLabs request error:', error);
    });
    
    req.write(postData);
    req.end();
  }

  // Handle incoming messages from Twilio
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Only log important events, not every media frame
      if (data.event !== 'media') {
        console.log('📨 Received message:', data.event, data);
      }
      
      if (data.event === 'start') {
        streamSid = data.streamSid;
        console.log('✅ Twilio stream started:', {
          callSid: data.start?.callSid,
          streamSid: streamSid,
          media: data.media
        });
        
        // Run phone authentication directly within WebSocket
        const callSid = data.start?.callSid;
        if (callSid && employeeService) {
          console.log(`🔍 Running phone authentication for call ${callSid}...`);
          
          // Extract caller phone from URL parameters or fetch from Twilio API
          const parsedUrl = url.parse(request.url, true);
          let callerPhone = parsedUrl.query.from || null;
          
          // If no phone in URL, fetch from Twilio API using callSid
          if (!callerPhone || callerPhone === 'unknown') {
            console.log(`🔍 No phone in URL, fetching from Twilio API for call ${callSid}...`);
            try {
              const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
              const call = await twilioClient.calls(callSid).fetch();
              callerPhone = call.from;
              console.log(`📞 Fetched caller phone from Twilio API: ${callerPhone}`);
            } catch (error) {
              console.error('❌ Failed to fetch call details from Twilio:', error);
              callerPhone = 'unknown';
            }
          }
          
          console.log(`📞 Final caller phone: ${callerPhone}`);
          
          try {
            // Load or create call state
            let callState = await stateManager.loadCallState(callSid);
            console.log(`📊 Call state loaded: phase=${callState.phase}`);
            
            // Run phone authentication using existing FSM logic
            const authResult = await employeeService.authenticateByPhone(callerPhone);
            console.log(`🔐 Auth result: success=${authResult.success}, employee=${authResult.employee?.name}`);
            
            if (authResult.success && authResult.employee) {
              // Known employee - personalized greeting
              const personalizedGreeting = `Hi ${authResult.employee.name}, how can I help you today?`;
              console.log(`✅ Authenticated employee: ${authResult.employee.name}`);
              
              // Update call state with employee info
              callState = {
                ...callState,
                phase: 'provider_selection',
                employee: authResult.employee,
                provider: authResult.provider,
                authMethod: 'phone',
                updatedAt: new Date().toISOString()
              };
              
              await stateManager.saveCallState(callState);
              generateElevenLabsSpeech(personalizedGreeting);
              
            } else {
              // Unknown number - PIN request
              const pinPrompt = "Welcome. I don't recognize your phone number. Please use your keypad to enter your employee PIN followed by the pound key.";
              console.log(`❌ Phone not found, requesting PIN`);
              
              // Update call state for PIN authentication
              callState = {
                ...callState,
                phase: 'pin_auth',
                updatedAt: new Date().toISOString()
              };
              
              await stateManager.saveCallState(callState);
              generateElevenLabsSpeech(pinPrompt);
            }
            
          } catch (error) {
            console.error('❌ Phone authentication error:', error);
            generateElevenLabsSpeech("Hello, how can I help you today?");
          }
          
        } else {
          console.log('⚠️ FSM services not initialized or no callSid, using fallback');
          generateElevenLabsSpeech("Hello, how can I help you today?");
        }
        
      } else if (data.event === 'media') {
        // Log media frames (don't spam too much)
        if (Math.random() < 0.01) { // Log ~1% of frames
          console.log('🎧 Media frame received, payload length:', data.media?.payload?.length || 0);
        }
        
      } else if (data.event === 'stop') {
        console.log('🛑 Twilio stream stopped:', data);
        
        // ElevenLabs HTTP requests will close automatically
        console.log('📴 Call ended - ElevenLabs requests completed');
        
        ws.close();
      }
      
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });

  ws.on('close', (code, reason) => {
    console.log('🔚 WebSocket closed:', { callSid, code, reason: reason.toString() });
    
    // Clean up ElevenLabs connection
    if (elevenLabsWS && elevenLabsWS.readyState === WebSocket.OPEN) {
      elevenLabsWS.close();
      console.log('📴 Cleaned up ElevenLabs connection');
    }
  });

  ws.on('error', (error) => {
    console.error('💥 WebSocket error:', { callSid, error });
    
    // Clean up ElevenLabs connection on error
    if (elevenLabsWS && elevenLabsWS.readyState === WebSocket.OPEN) {
      elevenLabsWS.close();
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎯 Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/stream`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 ngrok should tunnel this to: wss://climbing-merely-joey.ngrok-free.app/stream`);
});
