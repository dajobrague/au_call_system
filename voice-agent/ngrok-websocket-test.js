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

// Speech-to-text processing with voice activity detection
let speechBuffer = Buffer.alloc(0);
let speechTimeout = null;
let lastAudioLevel = 0;
let speechDetected = false;
const SPEECH_SILENCE_TIMEOUT = 1000; // 1 second of silence to process speech
const MIN_SPEECH_DURATION = 800; // Minimum 100ms of actual speech
const MAX_SPEECH_DURATION = 8000; // Maximum 1 second of speech
const SPEECH_VOLUME_THRESHOLD = 100; // Minimum volume to consider as speech

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

// Optimized Redis state operations with minimal calls
async function getCallStateOptimized(callSid) {
  // Use cached state if available and recent (< 5 seconds old)
  if (ws.cachedState && ws.cachedState.sid === callSid && 
      (Date.now() - ws.cachedStateTime) < 5000) {
    console.log(`⚡ Using cached call state for ${callSid}`);
    return ws.cachedState;
  }
  
  // Load from Redis and cache
  const state = await stateManager.loadCallState(callSid);
  ws.cachedState = state;
  ws.cachedStateTime = Date.now();
  console.log(`📊 Loaded and cached call state for ${callSid}: phase=${state.phase}`);
  return state;
}

// Batch Redis state update (non-blocking) - needs WebSocket context
function saveCallStateOptimized(ws, newState) {
  // Update cached state immediately
  ws.cachedState = newState;
  ws.cachedStateTime = Date.now();
  
  // Save to Redis asynchronously (non-blocking)
  stateManager.saveCallState(newState).catch(error => {
    console.error('❌ Background state save error:', error);
  });
  
  console.log(`⚡ State updated instantly (cached) and saving to Redis in background`);
}

// Extract text content from TwiML (simple regex-based extraction)
function extractTextFromTwiML(twiml) {
  if (!twiml || typeof twiml !== 'string') return null;
  
  // For voice AI mode, the TwiML just contains <Connect><Stream>, no text
  // We need to extract the prompt that was cached or use the FSM logic directly
  return null; // We'll handle this differently
}

// Extract response text from FSM result (for job code and other phases)
function extractResponseText(fsmResult) {
  // For voice AI mode, we need to extract the text that would have been spoken
  // This is a simplified approach - in a full implementation, we'd need to parse
  // the specific FSM response format
  if (fsmResult && fsmResult.twiml) {
    // Try to extract any text that might be in the TwiML
    const textMatch = fsmResult.twiml.match(/<Say[^>]*>(.*?)<\/Say>/);
    if (textMatch && textMatch[1]) {
      return textMatch[1];
    }
  }
  return null;
}

// Convert μ-law audio to WAV for speech recognition
function mulawToWav(mulawBuffer) {
  // Convert μ-law to PCM16
  const pcmBuffer = new Int16Array(mulawBuffer.length);
  
  // μ-law to linear conversion (simplified)
  for (let i = 0; i < mulawBuffer.length; i++) {
    const mulaw = mulawBuffer[i];
    const sign = mulaw & 0x80 ? -1 : 1;
    const exponent = (mulaw & 0x70) >> 4;
    const mantissa = mulaw & 0x0F;
    
    let linear = (33 + 2 * mantissa) * Math.pow(2, exponent + 2) - 33;
    pcmBuffer[i] = sign * Math.min(32767, linear);
  }
  
  // Create WAV header (44 bytes) + PCM data
  const wavBuffer = Buffer.alloc(44 + pcmBuffer.length * 2);
  
  // WAV header
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + pcmBuffer.length * 2, 4);
  wavBuffer.write('WAVE', 8);
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16); // PCM format size
  wavBuffer.writeUInt16LE(1, 20);  // PCM format
  wavBuffer.writeUInt16LE(1, 22);  // Mono
  wavBuffer.writeUInt32LE(8000, 24); // Sample rate
  wavBuffer.writeUInt32LE(16000, 28); // Byte rate
  wavBuffer.writeUInt16LE(2, 32);  // Block align
  wavBuffer.writeUInt16LE(16, 34); // Bits per sample
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(pcmBuffer.length * 2, 40);
  
  // Copy PCM data
  for (let i = 0; i < pcmBuffer.length; i++) {
    wavBuffer.writeInt16LE(pcmBuffer[i], 44 + i * 2);
  }
  
  return wavBuffer;
}

// Speech-to-text using OpenAI Whisper with robust validation
async function speechToText(audioBuffer) {
  try {
    const FormData = require('form-data');
    
    // Validate audio buffer size (prevent processing noise)
    if (audioBuffer.length < 1600) { // Less than 200ms at 8kHz
      console.log(`⚠️ Audio too short: ${audioBuffer.length} bytes`);
      return null;
    }
    
    if (audioBuffer.length > 80000) { // More than 10 seconds at 8kHz
      console.log(`⚠️ Audio too long: ${audioBuffer.length} bytes, truncating`);
      audioBuffer = audioBuffer.slice(0, 80000);
    }
    
    // Convert μ-law to WAV
    const wavBuffer = mulawToWav(new Uint8Array(audioBuffer));
    
    // Create form data for OpenAI API with strict constraints
    const form = new FormData();
    form.append('file', wavBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    form.append('model', 'whisper-1');
    form.append('language', 'en');
    form.append('temperature', '0'); // Reduce hallucination with low temperature
    form.append('prompt', 'This is a healthcare scheduling call. User is saying dates, times, or brief reasons. Common words: Monday Tuesday Wednesday Thursday Friday Saturday Sunday tomorrow next January February March April May June July August September October November December morning afternoon evening AM PM sick emergency personal family'); // Constrain vocabulary
    
    // Use node-fetch for proper multipart form handling
    const fetch = require('node-fetch');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    if (response.ok) {
      const result = await response.json();
      const text = result.text?.trim() || '';
      
      // Validate response length (prevent hallucination)
      if (text.length > 100) {
        console.log(`⚠️ Speech response too long (${text.length} chars), likely hallucination: "${text}"`);
        return null;
      }
      
      // Filter out common hallucination patterns
      const hallucinations = [
        'thank you for watching',
        'like and subscribe',
        'music playing',
        'background noise',
        'silence',
        '[music]',
        '[noise]',
        'you'
      ];
      
      const lowerText = text.toLowerCase();
      for (const hallucination of hallucinations) {
        if (lowerText.includes(hallucination)) {
          console.log(`⚠️ Detected hallucination pattern: "${text}"`);
          return null;
        }
      }
      
      // Validate that response contains relevant content
      const relevantWords = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 
                           'tomorrow', 'next', 'january', 'february', 'march', 'april', 'may', 'june',
                           'july', 'august', 'september', 'october', 'november', 'december',
                           'morning', 'afternoon', 'evening', 'am', 'pm', 'sick', 'emergency', 'personal'];
      
      const hasRelevantContent = relevantWords.some(word => lowerText.includes(word)) || /\d/.test(text);
      
      if (!hasRelevantContent && text.length > 0) {
        console.log(`⚠️ Speech doesn't contain relevant content: "${text}"`);
        return null;
      }
      
      console.log(`🎤 Speech recognized (validated): "${text}"`);
      return text;
    } else {
      const errorText = await response.text();
      console.error('❌ Speech-to-text API error:', response.status, errorText);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Speech-to-text error:', error);
    return null;
  }
}

// Simple voice activity detection
function detectVoiceActivity(audioBuffer) {
  const samples = new Uint8Array(audioBuffer);
  let totalEnergy = 0;
  let peakLevel = 0;
  
  // Calculate audio energy and peak level
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.abs(samples[i] - 128); // Center around 0
    totalEnergy += sample * sample;
    peakLevel = Math.max(peakLevel, sample);
  }
  
  const avgEnergy = totalEnergy / samples.length;
  const hasVoice = avgEnergy > SPEECH_VOLUME_THRESHOLD && peakLevel > 50;
  
  if (hasVoice) {
    console.log(`🎤 Voice detected - Energy: ${Math.round(avgEnergy)}, Peak: ${peakLevel}`);
  }
  
  return {
    hasVoice,
    energy: avgEnergy,
    peak: peakLevel
  };
}

// Parse spoken date into structured format
function parseSpokenDate(spokenText) {
  const text = spokenText.toLowerCase();
  
  // Common date patterns
  const patterns = [
    // "tomorrow" -> next day
    /\btomorrow\b/,
    // "next monday", "next tuesday", etc.
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
    // "monday", "tuesday", etc. (this week or next)
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
    // "december 15th", "january 3rd", etc.
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\b/,
    // "15th of december", "3rd of january", etc.
    /\b(\d{1,2})(st|nd|rd|th)?\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      console.log(`📅 Date pattern matched: "${match[0]}"`);
      return {
        success: true,
        originalText: spokenText,
        parsedDate: match[0],
        confidence: 'high'
      };
    }
  }
  
  // Fallback - look for any date-like words
  const dateWords = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const foundDateWord = dateWords.find(word => text.includes(word));
  
  if (foundDateWord) {
    return {
      success: true,
      originalText: spokenText,
      parsedDate: foundDateWord,
      confidence: 'medium'
    };
  }
  
  return {
    success: false,
    originalText: spokenText,
    error: 'No date pattern recognized'
  };
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

console.log('🚀 Starting optimized ngrok WebSocket server...');
console.log('⚡ Performance optimizations enabled:');
console.log('  - Eliminated redundant Twilio API calls');
console.log('  - Parallel background data prefetching');
console.log('  - ElevenLabs streaming latency optimization');
console.log('  - Redis operation caching and batching');
console.log('  - Clean terminal output (no audio chunk spam)');

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
      model_id: "eleven_turbo_v2_5", // More natural and faster model
      voice_settings: {
        speed: 0.95, // Slightly slower for more natural pace
        stability: 0.5, // Lower stability for more emotion and variation
        similarity_boost: 0.9, // Higher similarity for more authentic voice
        style: 0.2, // Add slight style variation for naturalness
        use_speaker_boost: true // Boost similarity to original speaker
      },
      optimize_streaming_latency: 3 // Maximum latency optimization for fastest response
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
        ws.callSid = data.start?.callSid; // Store callSid on WebSocket for DTMF handling
        
        console.log('✅ Twilio stream started:', {
          callSid: data.start?.callSid,
          streamSid: streamSid,
          media: data.media
        });
        
        // Run phone authentication directly within WebSocket
        const callSid = data.start?.callSid;
        if (callSid && employeeService) {
          console.log(`🔍 Running phone authentication for call ${callSid}...`);
          
          // Extract caller phone from URL parameters (passed from Vercel webhook)
          const parsedUrl = url.parse(request.url, true);
          let callerPhone = parsedUrl.query.from || null;
          
          console.log(`📞 Caller phone from URL: ${callerPhone}`);
          
          // If no phone in URL, use Twilio API as fallback (should be rare after Vercel deployment)
          if (!callerPhone || callerPhone === 'unknown') {
            console.log(`⚠️ No phone in URL, using Twilio API fallback for call ${callSid}...`);
            try {
              const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
              const call = await twilioClient.calls(callSid).fetch();
              callerPhone = call.from;
              console.log(`📞 Fallback: Fetched caller phone from Twilio API: ${callerPhone}`);
            } catch (error) {
              console.error('❌ Failed to fetch call details from Twilio:', error);
              callerPhone = 'unknown';
            }
          } else {
            console.log(`✅ Phone number available instantly from URL: ${callerPhone}`);
          }
          
          try {
            // Load or create call state
            let callState = await stateManager.loadCallState(callSid);
            console.log(`📊 Call state loaded: phase=${callState.phase}`);
            
            // Run phone authentication using existing FSM logic
            const authResult = await employeeService.authenticateByPhone(callerPhone);
            console.log(`🔐 Auth result: success=${authResult.success}, employee=${authResult.employee?.name}`);
            
            if (authResult.success && authResult.employee) {
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
              
              // OPTIMIZATION: Start comprehensive background data prefetching
              console.log('🚀 Starting comprehensive background data prefetching...');
              const backgroundDataPromise = Promise.all([
                multiProviderService.getEmployeeProviders(authResult.employee),
                // Prefetch job templates for this employee (for faster job code validation)
                employeeService.getEmployeeJobTemplates ? employeeService.getEmployeeJobTemplates(authResult.employee) : Promise.resolve([]),
                // Prefetch recent patient data (for context)
                employeeService.getRecentPatients ? employeeService.getRecentPatients(authResult.employee) : Promise.resolve([])
              ]).then(([providerResult, jobTemplates, recentPatients]) => {
                // Cache all results on the WebSocket for instant access
                ws.cachedData = {
                  providers: providerResult,
                  jobTemplates: jobTemplates || [],
                  recentPatients: recentPatients || [],
                  loadedAt: Date.now()
                };
                console.log(`✅ Background data loaded: ${providerResult?.providers?.length || 0} providers, ${jobTemplates?.length || 0} job templates, ${recentPatients?.length || 0} patients`);
                return ws.cachedData;
              }).catch(error => {
                console.error('❌ Background data loading error:', error);
                ws.cachedData = null;
                return null;
              });
              
              // Continue with provider selection phase using existing FSM logic
              console.log('🔄 Running provider selection phase...');
              
              try {
                // Wait for background data if it's still loading, or use cached data
                let providerResult = ws.cachedData?.providers;
                
                if (!providerResult) {
                  console.log('🔄 Waiting for background data to complete...');
                  // Wait for background promise to complete
                  const backgroundData = await backgroundDataPromise;
                  providerResult = backgroundData?.providers || await multiProviderService.getEmployeeProviders(authResult.employee);
                }
                console.log(`🏢 Provider check: hasMultiple=${providerResult.hasMultipleProviders}, total=${providerResult.totalProviders}`);
                
                if (!providerResult.hasMultipleProviders) {
                  // Single provider - use provider greeting + ask for job code
                  const provider = providerResult.providers[0];
                  const providerGreeting = provider?.greeting || 'Welcome to Healthcare Services';
                  const fullGreeting = `Hi ${authResult.employee.name}. ${providerGreeting}. Please use your keypad to enter your job code followed by the pound key.`;
                  
                  console.log(`🎤 Single provider greeting: "${fullGreeting}"`);
                  
                  // Update state to provider_greeting phase
                  callState = {
                    ...callState,
                    provider: provider ? {
                      id: provider.id,
                      name: provider.name,
                      greeting: provider.greeting
                    } : null,
                    phase: 'provider_greeting',
                    updatedAt: new Date().toISOString()
                  };
                  
                  saveCallStateOptimized(ws, callState);
                  generateElevenLabsSpeech(fullGreeting);
                  
                  // OPTIMIZATION: Prefetch job templates while greeting plays
                  if (authResult.employee.jobTemplateIds && authResult.employee.jobTemplateIds.length > 0) {
                    console.log('🚀 Prefetching job templates while greeting plays...');
                    setTimeout(async () => {
                      try {
                        const jobService = require('./src/services/airtable/job-service.ts');
                        const jobTemplates = await jobService.getJobTemplatesByIds(authResult.employee.jobTemplateIds);
                        ws.cachedJobTemplates = jobTemplates;
                        console.log(`✅ Prefetched ${jobTemplates?.length || 0} job templates`);
                      } catch (error) {
                        console.error('❌ Job template prefetch error:', error);
                      }
                    }, 100); // Start immediately while audio plays
                  }
                  
                } else {
                  // Multiple providers - ask for selection
                  console.log(`🏢 Multiple providers found:`, providerResult.providers);
                  
                  const selectionMessage = multiProviderService.generateProviderSelectionMessage(providerResult.providers);
                  const fullMessage = `Hi ${authResult.employee.name}. ${selectionMessage}`;
                  
                  console.log(`🎤 Multi-provider selection: "${fullMessage}"`);
                  
                  // Update state with available providers
                  callState = {
                    ...callState,
                    availableProviders: providerResult.providers.map(p => ({
                      id: p.id,
                      name: p.name,
                      greeting: p.greeting,
                      selectionNumber: p.selectionNumber
                    })),
                    phase: 'provider_selection',
                    attempts: { ...callState.attempts, clientId: 1 },
                    updatedAt: new Date().toISOString()
                  };
                  
                  saveCallStateOptimized(ws, callState);
                  generateElevenLabsSpeech(fullMessage);
                }
                
              } catch (error) {
                console.error('❌ Provider selection phase error:', error);
                const fallbackGreeting = `Hi ${authResult.employee.name}, how can I help you today?`;
                generateElevenLabsSpeech(fallbackGreeting);
              }
              
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
        
      } else if (data.event === 'dtmf') {
        // Handle DTMF input (keypad presses)
        const digit = data.dtmf?.digit;
        console.log(`🎹 DTMF received: ${digit}`);
        
        if (digit && employeeService && stateManager) {
          try {
            // Use the stored callSid from the start event
            const callSid = ws.callSid || data.streamSid;
            console.log(`🔍 Loading state for callSid: ${callSid}`);
            
            const currentState = await getCallStateOptimized(callSid);
            console.log(`📊 Processing DTMF for phase: ${currentState.phase}`);
            
            // Initialize job code collection if not exists
            if (!ws.jobCodeDigits) {
              ws.jobCodeDigits = '';
            }
            
            if (currentState.phase === 'provider_selection' && currentState.availableProviders) {
              // Handle provider selection
              const selectionNum = parseInt(digit, 10);
              const selectedProvider = currentState.availableProviders.find(p => p.selectionNumber === selectionNum);
              
              if (selectedProvider) {
                console.log(`✅ Provider selected: ${selectedProvider.name}`);
                
                // Update state with selected provider and move to provider greeting
                const updatedState = {
                  ...currentState,
                  provider: {
                    id: selectedProvider.id,
                    name: selectedProvider.name,
                    greeting: selectedProvider.greeting
                  },
                  phase: 'provider_greeting',
                  updatedAt: new Date().toISOString()
                };
                
                await stateManager.saveCallState(updatedState);
                
                // Generate provider greeting + job code request
                const providerGreeting = selectedProvider.greeting || `Welcome to ${selectedProvider.name}`;
                const fullGreeting = `${providerGreeting}. Please use your keypad to enter your job code followed by the pound key.`;
                
                console.log(`🎤 Provider greeting: "${fullGreeting}"`);
                generateElevenLabsSpeech(fullGreeting);
                
              } else {
                console.log(`❌ Invalid provider selection: ${digit}`);
                generateElevenLabsSpeech("Invalid selection. Please press 1 for Sunrise Health Group or 2 for Pacific Wellness.");
              }
              
            } else if (currentState.phase === 'provider_greeting' || currentState.phase === 'collect_job_code') {
              // Handle job code collection
              if (digit === '#') {
                // Job code complete - process it
                const jobCode = ws.jobCodeDigits;
                console.log(`🔢 Job code collected: "${jobCode}"`);
                
                if (jobCode.length > 0) {
                  try {
                    // Import and use existing job code validation logic
                    const jobCodePhase = require('./src/fsm/phases/job-code-phase.ts');
                    
                    // Update state to job code collection phase
                    const updatedState = {
                      ...currentState,
                      phase: 'collect_job_code',
                      jobCode: jobCode,
                      updatedAt: new Date().toISOString()
                    };
                    
                    // Process job code using existing FSM logic
                    const jobCodeResult = await jobCodePhase.processJobCodePhase(updatedState, jobCode, true, 'dtmf');
                    console.log(`🏢 Job code result: action=${jobCodeResult.result.action}`);
                    
                    // Save the new state
                    await stateManager.saveCallState(jobCodeResult.newState);
                    
                    // Generate response based on job code validation
                    if (jobCodeResult.result.action === 'transition') {
                      // Job code valid - create personalized response with patient info
                      const jobTemplate = jobCodeResult.newState.jobTemplate;
                      const patient = jobCodeResult.newState.patient;
                      
                      let personalizedResponse;
                      if (jobTemplate && patient) {
                        personalizedResponse = `Perfect! Your job code is correct. You're scheduled for ${jobTemplate.title} with ${patient.name}. What would you like to do?`;
                      } else {
                        personalizedResponse = `Great! Your job code is valid. What would you like to do with this appointment?`;
                      }
                      
                      console.log(`✅ Job code accepted with patient info: "${personalizedResponse}"`);
                      generateElevenLabsSpeech(personalizedResponse);
                      
                      // Continue to job options immediately - no delay for more natural flow
                      setTimeout(async () => {
                        try {
                          console.log(`🔄 Continuing to job options phase...`);
                          
                          // Import job options phase
                          const jobOptionsPhase = require('./src/fsm/phases/job-options-phase.ts');
                          
                          // Load the updated state
                          const latestState = await stateManager.loadCallState(callSid);
                          console.log(`📊 Latest state phase: ${latestState.phase}`);
                          
                          // Process job options phase
                          const jobOptionsResult = await jobOptionsPhase.processJobOptionsPhase(latestState, '', false, 'none');
                          console.log(`🎯 Job options result: action=${jobOptionsResult.result.action}`);
                          
                          // Save the new state
                          await stateManager.saveCallState(jobOptionsResult.newState);
                          
                          // Generate more natural job options response
                          let optionsText = extractResponseText(jobOptionsResult.result);
                          if (!optionsText) {
                            // Create natural options text
                            optionsText = "You can press 1 to reschedule this appointment, press 2 if you can't make it and want to leave it open for someone else, press 3 to speak with a representative, or press 4 to enter a different job code.";
                          }
                          
                          console.log(`🎤 Job options: "${optionsText}"`);
                          generateElevenLabsSpeech(optionsText);
                          
                        } catch (error) {
                          console.error('❌ Job options phase error:', error);
                          generateElevenLabsSpeech("Let me get your options for this appointment.");
                        }
                      }, 500); // Shorter delay for more natural conversation flow
                      
                    } else {
                      // Job code invalid - ask for retry
                      const errorText = extractResponseText(jobCodeResult.result) || `I couldn't find job code ${jobCode}. Please try again.`;
                      console.log(`❌ Job code rejected: "${errorText}"`);
                      generateElevenLabsSpeech(errorText);
                    }
                    
                    // Reset job code collection
                    ws.jobCodeDigits = '';
                    
                  } catch (error) {
                    console.error('❌ Job code processing error:', error);
                    generateElevenLabsSpeech(`I couldn't process job code ${jobCode}. Please try again.`);
                    ws.jobCodeDigits = '';
                  }
                } else {
                  console.log(`❌ Empty job code`);
                  generateElevenLabsSpeech("Please enter your job code followed by the pound key.");
                }
                
              } else if (digit >= '0' && digit <= '9') {
                // Collect job code digits
                ws.jobCodeDigits += digit;
                console.log(`🔢 Collecting job code: "${ws.jobCodeDigits}"`);
                
                // Optional: Provide feedback for long job codes
                if (ws.jobCodeDigits.length === 5) {
                  console.log(`🔢 Job code length reached 5 digits: "${ws.jobCodeDigits}"`);
                }
              } else {
                console.log(`❌ Invalid job code digit: ${digit}`);
              }
              
            } else if (currentState.phase === 'confirm_job_code') {
              // Handle job options selection (1=reschedule, 2=leave open, 3=representative, 4=new job code)
              console.log(`🎯 Job options selection: ${digit}`);
              
              if (digit === '1') {
                // Reschedule - transition to occurrence selection
                console.log(`🔄 Option 1: Reschedule selected`);
                
                try {
                  // Import occurrence phase
                  const occurrencePhase = require('./src/fsm/phases/occurrence-phase.ts');
                  
                  // Update state to occurrence selection with reschedule action
                  const updatedState = {
                    ...currentState,
                    phase: 'occurrence_selection',
                    selectedOption: '1',
                    actionType: 'reschedule', // Critical: Set action type for reschedule flow
                    updatedAt: new Date().toISOString()
                  };
                  
                  // Process occurrence selection
                  const occurrenceResult = await occurrencePhase.processOccurrenceSelectionPhase(updatedState, '', false);
                  console.log(`📅 Occurrence result: action=${occurrenceResult.result.action}`);
                  
                  await stateManager.saveCallState(occurrenceResult.newState);
                  
                  const occurrenceText = extractResponseText(occurrenceResult.result) || "You have multiple appointments available. Please select one.";
                  console.log(`🎤 Occurrence options: "${occurrenceText}"`);
                  generateElevenLabsSpeech(occurrenceText);
                  
                } catch (error) {
                  console.error('❌ Occurrence phase error:', error);
                  generateElevenLabsSpeech("I'm having trouble getting your appointment options. Please try again.");
                }
                
              } else if (digit === '2') {
                // Leave job open - transition to reason collection
                console.log(`🔄 Option 2: Leave job open selected`);
                
                try {
                  // Update state to reason collection with leave open action
                  const updatedState = {
                    ...currentState,
                    phase: 'collect_reason',
                    selectedOption: '2',
                    actionType: 'leave_open', // Critical: Set action type for leave open flow
                    updatedAt: new Date().toISOString()
                  };
                  
                  await stateManager.saveCallState(updatedState);
                  
                  const reasonPrompt = "Please tell me the reason why you cannot take this job. Speak clearly after the tone.";
                  console.log(`🎤 Reason collection: "${reasonPrompt}"`);
                  generateElevenLabsSpeech(reasonPrompt);
                  
                } catch (error) {
                  console.error('❌ Reason collection setup error:', error);
                  generateElevenLabsSpeech("I'm having trouble with the reason collection. Please try again.");
                }
                
              } else if (digit === '3') {
                // Transfer to representative
                console.log(`🔄 Option 3: Transfer to representative selected`);
                
                const transferMessage = "I'm connecting you with a representative. Please hold.";
                console.log(`🎤 Transfer message: "${transferMessage}"`);
                generateElevenLabsSpeech(transferMessage);
                
                // In a real implementation, this would transfer the call
                
              } else if (digit === '4') {
                // Enter different job code
                console.log(`🔄 Option 4: Different job code selected`);
                
                // Reset job code collection and go back to job code phase
                ws.jobCodeDigits = '';
                
                const updatedState = {
                  ...currentState,
                  phase: 'collect_job_code',
                  jobCode: null,
                  updatedAt: new Date().toISOString()
                };
                
                await stateManager.saveCallState(updatedState);
                
                const newJobCodePrompt = "Please enter a different job code followed by the pound key.";
                console.log(`🎤 New job code request: "${newJobCodePrompt}"`);
                generateElevenLabsSpeech(newJobCodePrompt);
                
              } else {
                console.log(`❌ Invalid job option: ${digit}`);
                generateElevenLabsSpeech("Invalid selection. Please press 1 for rescheduling, 2 to leave the job open, 3 for a representative, or 4 to enter a different job code.");
              }
              
            } else if (currentState.phase === 'occurrence_selection') {
              // Handle appointment selection
              console.log(`📅 Appointment selection: ${digit}`);
              
              try {
                // Import occurrence phase
                const occurrencePhase = require('./src/fsm/phases/occurrence-phase.ts');
                
                // Process the selection
                const occurrenceResult = await occurrencePhase.processOccurrenceSelectionPhase(currentState, digit, true);
                console.log(`📅 Occurrence selection result: action=${occurrenceResult.result.action}`);
                
                await stateManager.saveCallState(occurrenceResult.newState);
                
                const responseText = extractResponseText(occurrenceResult.result) || "Appointment selection processed.";
                console.log(`🎤 Occurrence response: "${responseText}"`);
                generateElevenLabsSpeech(responseText);
                
              } catch (error) {
                console.error('❌ Occurrence selection error:', error);
                generateElevenLabsSpeech("I'm having trouble with your appointment selection. Please try again.");
              }
              
            } else if (currentState.phase === 'collect_day' || currentState.phase === 'collect_month' || currentState.phase === 'collect_time') {
              // Handle date/time collection
              console.log(`📅 Date/time input: ${digit} for phase ${currentState.phase}`);
              
              try {
                // Import datetime phase
                const datetimePhase = require('./src/fsm/phases/datetime-phase.ts');
                
                let phaseResult;
                if (currentState.phase === 'collect_day') {
                  phaseResult = datetimePhase.processCollectDayPhase(currentState, digit, true);
                } else if (currentState.phase === 'collect_month') {
                  phaseResult = datetimePhase.processCollectMonthPhase(currentState, digit, true);
                } else if (currentState.phase === 'collect_time') {
                  phaseResult = datetimePhase.processCollectTimePhase(currentState, digit, true);
                }
                
                if (phaseResult) {
                  console.log(`📅 DateTime result: action=${phaseResult.result.action}`);
                  await stateManager.saveCallState(phaseResult.newState);
                  
                  const responseText = extractResponseText(phaseResult.result) || "Date/time processed.";
                  console.log(`🎤 DateTime response: "${responseText}"`);
                  generateElevenLabsSpeech(responseText);
                }
                
              } catch (error) {
                console.error('❌ Date/time processing error:', error);
                generateElevenLabsSpeech("I'm having trouble with the date and time. Please try again.");
              }
              
            } else if (currentState.phase === 'confirm_datetime' || currentState.phase === 'confirm_leave_open') {
              // Handle confirmations (1=yes, 2=no)
              console.log(`✅ Confirmation input: ${digit} for phase ${currentState.phase}`);
              
              if (digit === '1') {
                // Yes - confirm
                console.log(`✅ Confirmation: YES`);
                
                try {
                  if (currentState.phase === 'confirm_datetime') {
                    const datetimePhase = require('./src/fsm/phases/datetime-phase.ts');
                    const confirmResult = await datetimePhase.processConfirmDateTimePhase(currentState, '1', true);
                    
                    await stateManager.saveCallState(confirmResult.newState);
                    const responseText = extractResponseText(confirmResult.result) || "Appointment confirmed. Thank you!";
                    generateElevenLabsSpeech(responseText);
                    
                  } else if (currentState.phase === 'confirm_leave_open') {
                    const reasonPhase = require('./src/fsm/phases/reason-phase.ts');
                    const confirmResult = await reasonPhase.processConfirmLeaveOpenPhase(currentState, '1', true);
                    
                    await stateManager.saveCallState(confirmResult.newState);
                    const responseText = extractResponseText(confirmResult.result) || "Job marked as open. Thank you!";
                    generateElevenLabsSpeech(responseText);
                  }
                  
                } catch (error) {
                  console.error('❌ Confirmation processing error:', error);
                  generateElevenLabsSpeech("Confirmation processed. Thank you!");
                }
                
              } else if (digit === '2') {
                // No - go back or ask for clarification
                console.log(`❌ Confirmation: NO`);
                generateElevenLabsSpeech("Let me help you with a different option. Please hold while I get your choices.");
                
              } else {
                console.log(`❌ Invalid confirmation: ${digit}`);
                generateElevenLabsSpeech("Please press 1 for yes or 2 for no.");
              }
              
            } else {
              console.log(`🔍 DTMF received in phase: ${currentState.phase} - not handled yet`);
            }
            
          } catch (error) {
            console.error('❌ DTMF processing error:', error);
          }
        }
        
      } else if (data.event === 'media') {
        // Handle audio for speech recognition in date collection phases
        const callSid = ws.callSid;
        
        if (callSid && stateManager) {
          // Check if we're in a speech collection phase
          const currentState = await stateManager.loadCallState(callSid);
          
          if (currentState.phase === 'collect_day' || currentState.phase === 'collect_month' || 
              currentState.phase === 'collect_time' || currentState.phase === 'collect_reason') {
            
            // Decode audio and check for voice activity
            const audioData = Buffer.from(data.media.payload, 'base64');
            const voiceActivity = detectVoiceActivity(audioData);
            
            // Only buffer audio if voice is detected
            if (voiceActivity.hasVoice) {
              speechBuffer = Buffer.concat([speechBuffer, audioData]);
              speechDetected = true;
              
              // Prevent buffer from getting too large
              if (speechBuffer.length > MAX_SPEECH_DURATION) {
                console.log(`⚠️ Speech buffer too large (${speechBuffer.length} bytes), processing early`);
                // Process immediately if buffer gets too large
                processCollectedSpeech();
                return;
              }
            }
            
            // Reset speech timeout when voice is detected
            if (voiceActivity.hasVoice) {
              if (speechTimeout) {
                clearTimeout(speechTimeout);
              }
              
              // Process speech after silence
              speechTimeout = setTimeout(processCollectedSpeech, SPEECH_SILENCE_TIMEOUT);
            }
            
            // Define speech processing function
            async function processCollectedSpeech() {
              if (speechBuffer.length > MIN_SPEECH_DURATION && speechDetected) { // At least 100ms of actual speech
                console.log(`🎤 Processing ${speechBuffer.length} bytes of speech for ${currentState.phase}`);
                
                try {
                  const spokenText = await speechToText(speechBuffer);
                  
                  if (spokenText) {
                    // Parse the spoken input based on current phase
                    if (currentState.phase === 'collect_day' || currentState.phase === 'collect_month' || currentState.phase === 'collect_time') {
                      // Parse date/time input
                      const dateResult = parseSpokenDate(spokenText);
                      
                      if (dateResult.success) {
                        console.log(`📅 Date parsed: "${dateResult.parsedDate}"`);
                        
                        // Process through datetime phase
                        const datetimePhase = require('./src/fsm/phases/datetime-phase.ts');
                        let phaseResult;
                        
                        if (currentState.phase === 'collect_day') {
                          phaseResult = datetimePhase.processCollectDayPhase(currentState, dateResult.parsedDate, true);
                        } else if (currentState.phase === 'collect_month') {
                          phaseResult = datetimePhase.processCollectMonthPhase(currentState, dateResult.parsedDate, true);
                        } else if (currentState.phase === 'collect_time') {
                          phaseResult = datetimePhase.processCollectTimePhase(currentState, dateResult.parsedDate, true);
                        }
                        
                        if (phaseResult) {
                          await stateManager.saveCallState(phaseResult.newState);
                          const responseText = extractResponseText(phaseResult.result) || `I heard ${dateResult.parsedDate}. Is that correct?`;
                          generateElevenLabsSpeech(responseText);
                        }
                        
                      } else {
                        console.log(`❌ Could not parse date from: "${spokenText}"`);
                        generateElevenLabsSpeech("I didn't catch that date. Could you say it again? For example, say 'next Monday' or 'December 15th'.");
                      }
                      
                    } else if (currentState.phase === 'collect_reason') {
                      // Process reason input
                      console.log(`💬 Reason collected: "${spokenText}"`);
                      
                      const reasonPhase = require('./src/fsm/phases/reason-phase.ts');
                      const reasonResult = reasonPhase.processCollectReasonPhase(currentState, spokenText, true, 'speech');
                      
                      await stateManager.saveCallState(reasonResult.newState);
                      const responseText = extractResponseText(reasonResult.result) || "Thank you for letting me know. I'll mark this job as open.";
                      generateElevenLabsSpeech(responseText);
                    }
                  } else {
                    console.log(`❌ No speech recognized`);
                    generateElevenLabsSpeech("I didn't hear anything. Could you please repeat that?");
                  }
                  
                } catch (error) {
                  console.error('❌ Speech processing error:', error);
                  generateElevenLabsSpeech("I'm having trouble understanding. Could you please repeat that?");
                }
                
                // Reset speech buffer and detection flag
                speechBuffer = Buffer.alloc(0);
                speechDetected = false;
              } else {
                console.log(`⚠️ Speech buffer too small or no voice detected: ${speechBuffer.length} bytes`);
                speechBuffer = Buffer.alloc(0);
                speechDetected = false;
              }
            }
          }
        }
        
        // Media frames processed silently (no logging for performance)
        
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
