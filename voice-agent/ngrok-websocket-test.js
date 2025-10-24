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
 * Generate professional beep tone for speech collection
 */
function generateBeepTone(durationMs = 300) {
  const sr = 8000;
  const frequency = 800; // Professional beep frequency
  const n = Math.floor(sr * (durationMs / 1000));
  const pcm = new Int16Array(n);
  
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // Create a pleasant beep with fade in/out
    const fadeIn = Math.min(1, i / (sr * 0.05)); // 50ms fade in
    const fadeOut = Math.min(1, (n - i) / (sr * 0.05)); // 50ms fade out
    const envelope = fadeIn * fadeOut;
    
    pcm[i] = Math.round(Math.sin(2 * Math.PI * frequency * t) * 0x2000 * envelope); // Lower volume
  }
  
  const ulaw = linear16ToMulaw(pcm);
  return sliceInto20msFrames(ulaw);
}

/**
 * Generate pleasant hold music (soft melody)
 */
function generateHoldMusic(durationMs = 10000) {
  const sr = 8000;
  const n = Math.floor(sr * (durationMs / 1000));
  const pcm = new Int16Array(n);
  
  // Create a pleasant melody with multiple harmonics
  // Using a simple chord progression: C-E-G (major chord)
  const frequencies = [261.63, 329.63, 392.00]; // C4, E4, G4
  
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    
    // Mix multiple frequencies for a richer sound
    let sample = 0;
    frequencies.forEach((freq, idx) => {
      const amplitude = 0x1000 / frequencies.length; // Divide amplitude among frequencies
      sample += Math.sin(2 * Math.PI * freq * t) * amplitude;
    });
    
    // Add a slow fade in/out for smooth looping
    const fadeLength = sr * 0.5; // 0.5 second fade
    let envelope = 1;
    if (i < fadeLength) {
      envelope = i / fadeLength;
    } else if (i > n - fadeLength) {
      envelope = (n - i) / fadeLength;
    }
    
    pcm[i] = Math.round(sample * envelope);
  }
  
  const ulaw = linear16ToMulaw(pcm);
  return sliceInto20msFrames(ulaw);
}

/**
 * Play hold music in a loop over WebSocket
 */
function playHoldMusic(ws) {
  if (!ws || ws.readyState !== 1) {
    console.log('⚠️ WebSocket not ready for hold music');
    return;
  }
  
  console.log('🎵 Starting hold music playback...');
  
  // Generate 10 seconds of hold music
  const musicFrames = generateHoldMusic(10000);
  
  let frameIndex = 0;
  
  // Clear any existing hold music interval
  if (ws.holdMusicInterval) {
    clearInterval(ws.holdMusicInterval);
  }
  
  // Send frames at 20ms intervals (50 frames per second)
  ws.holdMusicInterval = setInterval(() => {
    if (!ws || ws.readyState !== 1) {
      clearInterval(ws.holdMusicInterval);
      console.log('🛑 Hold music stopped - WebSocket closed');
      return;
    }
    
    // Send current frame
    const frame = musicFrames[frameIndex];
    if (frame) {
      const b64 = Buffer.from(frame).toString('base64');
      ws.send(JSON.stringify({
        event: 'media',
        streamSid: ws.streamSid,
        media: { payload: b64 }
      }));
    }
    
    // Move to next frame, loop back to start if at end
    frameIndex++;
    if (frameIndex >= musicFrames.length) {
      frameIndex = 0;
      console.log('🔄 Hold music loop restarted');
    }
  }, 20); // 20ms per frame
  
  console.log(`✅ Hold music started (${musicFrames.length} frames, looping)`);
}

/**
 * Stop hold music playback
 */
function stopHoldMusic(ws) {
  if (ws && ws.holdMusicInterval) {
    clearInterval(ws.holdMusicInterval);
    ws.holdMusicInterval = null;
    console.log('🛑 Hold music stopped');
  }
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

// Professional speech collection system
let speechBuffer = Buffer.alloc(0);
let speechTimeout = null;
const SPEECH_STATES = {
  IDLE: 'idle',
  PROMPT_PLAYING: 'prompt_playing',
  WAITING_FOR_BEEP: 'waiting_for_beep', 
  BEEP_PLAYING: 'beep_playing',
  RECORDING: 'recording',
  PROCESSING: 'processing'
};

// Speech collection settings
const MIN_SPEECH_DURATION = 800; // Minimum 100ms of actual speech
const MAX_SPEECH_DURATION = 80000; // Maximum 10 seconds of speech
const RECORDING_TIMEOUT = 10000; // Auto-stop recording after 10 seconds

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
async function getCallStateOptimized(ws, callSid) {
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
    
    // Use dynamic import for node-fetch (ESM module)
    const { default: fetch } = await import('node-fetch');
    
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

// AI response classification for safety
function classifyAIResponse(aiResponse) {
  const questionIndicators = [
    'what time', 'when', 'which day', '?', 'for example',
    'please clarify', 'could you', 'would you', 'can you specify',
    'what day', 'which time', 'more specific'
  ];
  
  const confirmationIndicators = [
    'perfect', 'great', 'excellent', 'confirmed', 'scheduled',
    'i heard', 'got it', 'understood', 'all set'
  ];
  
  const lowerResponse = aiResponse.toLowerCase();
  
  const hasQuestion = questionIndicators.some(indicator => 
    lowerResponse.includes(indicator)
  );
  
  const hasConfirmation = confirmationIndicators.some(indicator => 
    lowerResponse.includes(indicator)
  );
  
  return {
    isQuestion: hasQuestion,
    isConfirmation: hasConfirmation,
    needsMoreInfo: hasQuestion && !hasConfirmation,
    isComplete: hasConfirmation && !hasQuestion,
    originalResponse: aiResponse
  };
}

// Extract and validate actual date/time from user speech
function extractAndValidateDateTime(userSpeech) {
  const text = userSpeech.toLowerCase();
  
  // Date patterns
  const datePatterns = [
    { pattern: /\btomorrow\b/, type: 'relative' },
    { pattern: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/, type: 'next_weekday' },
    { pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/, type: 'weekday' },
    { pattern: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\b/, type: 'month_day' }
  ];
  
  // Time patterns
  const timePatterns = [
    { pattern: /\b(\d{1,2})\s*(am|pm)\b/, type: 'hour_ampm' },
    { pattern: /\b(\d{1,2}):(\d{2})\s*(am|pm)\b/, type: 'hour_minute_ampm' },
    { pattern: /\b(morning|afternoon|evening)\b/, type: 'period' }
  ];
  
  const dayMatch = datePatterns.find(p => text.match(p.pattern));
  const timeMatch = timePatterns.find(p => text.match(p.pattern));
  
  const hasValidDay = !!dayMatch;
  const hasValidTime = timeMatch && timeMatch.type !== 'period'; // Exclude vague periods
  const hasVagueTime = timeMatch && timeMatch.type === 'period';
  
  return {
    isValid: hasValidDay && hasValidTime,
    hasDay: hasValidDay,
    hasTime: hasValidTime,
    hasVagueTime: hasVagueTime,
    dayText: dayMatch ? text.match(dayMatch.pattern)[0] : null,
    timeText: timeMatch ? text.match(timeMatch.pattern)[0] : null,
    originalText: userSpeech,
    confidence: (hasValidDay && hasValidTime) ? 'high' : 'partial'
  };
}

// Generate AI-powered intelligent response using existing conversation services
async function generateIntelligentDateTimeResponse(userSpeech, context) {
  try {
    // Use dynamic import for node-fetch (ESM module)
    const { default: fetch } = await import('node-fetch');
    
    const prompt = `You are a healthcare scheduling assistant. The user is trying to reschedule an appointment.

Context:
- Patient: ${context.patientName || 'the patient'}
- Current appointment: ${context.appointmentDate || 'an appointment'}
- Job type: ${context.jobTitle || 'healthcare service'}
- User said: "${userSpeech}"

Task: Analyze what the user said and respond appropriately:

If complete (day + time like "Monday 2 PM"): Confirm → "Perfect! I heard [day] at [time]. Is that correct?"
If day only (like "Monday" or "tomorrow"): Ask for time → "Great! What time on [day] works for you?"
If vague time (like "Monday afternoon"): Ask for specifics → "What time [day] [timeperiod]? For example, 2 PM or 4 PM?"
If unclear or incomplete: Ask for clarification → "I didn't catch that clearly. Please say the day and time, like 'Monday 2 PM'."

Keep response under 20 words, professional but friendly tone, always end with instruction to "speak after the tone and press pound when finished" if asking for more input.

Response:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      const aiResponse = result.choices[0].message.content.trim();
      console.log(`🤖 AI response generated: "${aiResponse}"`);
      return aiResponse;
    } else {
      console.error('❌ OpenAI API error:', response.status);
      return null;
    }
    
  } catch (error) {
    console.error('❌ AI response generation error:', error);
    return null;
  }
}

// Professional speech collection functions
function startSpeechCollection(ws, prompt, context = {}, speechGenerator) {
  console.log(`🎤 Starting speech collection: "${prompt}"`);
  
  // Store speech generator function on WebSocket for access
  ws.generateSpeech = speechGenerator;
  
  // Initialize speech collection state
  ws.speechState = SPEECH_STATES.PROMPT_PLAYING;
  ws.speechContext = context;
  speechBuffer = Buffer.alloc(0);
  
  // Play instruction with beep cue
  const fullPrompt = prompt.includes('speak after the tone') 
    ? prompt 
    : `${prompt} Please speak after the tone and press pound when finished.`;
  
  speechGenerator(fullPrompt);
  
  // Schedule beep after prompt finishes
  setTimeout(() => {
    if (ws.speechState === SPEECH_STATES.PROMPT_PLAYING) {
      playBeepAndStartRecording(ws);
    }
  }, estimateAudioDuration(fullPrompt) + 500); // Add 500ms buffer
}

function playBeepAndStartRecording(ws) {
  console.log('🔔 Playing beep tone...');
  ws.speechState = SPEECH_STATES.BEEP_PLAYING;
  
  // Generate and play beep
  const beepFrames = generateBeepTone(300);
  beepFrames.forEach((frame, index) => {
    const twilioMessage = {
      event: 'media',
      streamSid: ws.streamSid, // Use WebSocket-stored streamSid
      media: {
        payload: Buffer.from(frame).toString('base64')
      }
    };
    
    setTimeout(() => {
      ws.send(JSON.stringify(twilioMessage));
    }, index * 20);
  });
  
  // Start recording after beep
  setTimeout(() => {
    console.log('🎙️ Recording started - speak now!');
    ws.speechState = SPEECH_STATES.RECORDING;
    
    // Auto-stop recording after timeout
    ws.recordingTimeout = setTimeout(() => {
      if (ws.speechState === SPEECH_STATES.RECORDING) {
        console.log('⏰ Recording timeout - processing speech');
        stopRecordingAndProcess(ws);
      }
    }, RECORDING_TIMEOUT);
    
  }, 400); // 300ms beep + 100ms buffer
}

function stopRecordingAndProcess(ws) {
  if (ws.speechState !== SPEECH_STATES.RECORDING) return;
  
  console.log('🛑 Recording stopped - processing speech...');
  ws.speechState = SPEECH_STATES.PROCESSING;
  
  // Clear timeout
  if (ws.recordingTimeout) {
    clearTimeout(ws.recordingTimeout);
    ws.recordingTimeout = null;
  }
  
  // Process collected speech
  processSpeechWithAI(ws);
}

// Process speech with AI and safety validation
async function processSpeechWithAI(ws) {
  if (speechBuffer.length < MIN_SPEECH_DURATION) {
    console.log(`⚠️ Speech too short: ${speechBuffer.length} bytes`);
    ws.speechState = SPEECH_STATES.IDLE;
    ws.generateSpeech("I didn't hear anything. Please try again.");
    return;
  }
  
  try {
    console.log(`🎤 Processing ${speechBuffer.length} bytes of speech...`);
    
    // Convert speech to text
    const userSpeech = await speechToText(speechBuffer);
    
    if (!userSpeech) {
      console.log(`❌ No speech recognized`);
      ws.speechState = SPEECH_STATES.IDLE;
      ws.generateSpeech("I didn't catch that. Please speak clearly after the tone and press pound when finished.");
      return;
    }
    
    console.log(`🎤 User said: "${userSpeech}"`);
    
    // Generate AI response with context
    const context = {
      patientName: ws.speechContext?.patientName || 'the patient',
      appointmentDate: ws.speechContext?.appointmentDate || 'the appointment',
      jobTitle: ws.speechContext?.jobTitle || 'healthcare service'
    };
    
    const aiResponse = await generateIntelligentDateTimeResponse(userSpeech, context);
    
    if (!aiResponse) {
      console.log(`❌ AI response generation failed`);
      ws.speechState = SPEECH_STATES.IDLE;
      ws.generateSpeech("I'm having trouble processing that. Please say the day and time clearly.");
      return;
    }
    
    // CRITICAL: Classify AI response for safety
    const classification = classifyAIResponse(aiResponse);
    console.log(`🔍 AI response classification:`, classification);
    
    if (classification.needsMoreInfo) {
      // AI is asking for more information - continue conversation
      console.log(`🤖 AI requesting more info: "${aiResponse}"`);
      ws.speechState = SPEECH_STATES.IDLE;
      
      // Start new speech collection for follow-up
      setTimeout(() => {
        startSpeechCollection(ws, aiResponse, context, ws.generateSpeech);
      }, 500);
      
    } else if (classification.isComplete) {
      // AI confirmed - validate actual user data
      console.log(`✅ AI confirmed data: "${aiResponse}"`);
      
      const validation = extractAndValidateDateTime(userSpeech);
      console.log(`🔍 Data validation:`, validation);
      
      if (validation.isValid) {
        // SAFE: Valid date/time data extracted from user speech
        console.log(`✅ Valid date/time: ${validation.dayText} ${validation.timeText}`);
        ws.speechState = SPEECH_STATES.IDLE;
        
        // Continue with FSM using validated data
        await continueWithValidatedDateTime(ws, validation, aiResponse);
        
      } else {
        // Invalid data - ask for clarification
        console.log(`❌ Invalid date/time data, asking for clarification`);
        ws.speechState = SPEECH_STATES.IDLE;
        
        const clarificationPrompt = "I need both the day and time. Please say something like 'Monday 2 PM' or 'Tomorrow at 3 PM'.";
        setTimeout(() => {
          startSpeechCollection(ws, clarificationPrompt, context, ws.generateSpeech);
        }, 500);
      }
      
    } else {
      // Unclear AI response - safe fallback
      console.log(`⚠️ Unclear AI response: "${aiResponse}"`);
      ws.speechState = SPEECH_STATES.IDLE;
      ws.generateSpeech("Let me help you with that. Please say the day and time you'd like, like 'Monday 2 PM'.");
    }
    
  } catch (error) {
    console.error('❌ Speech processing error:', error);
    ws.speechState = SPEECH_STATES.IDLE;
    ws.generateSpeech("I'm having trouble with that. Please try again.");
  } finally {
    // Always reset speech buffer
    speechBuffer = Buffer.alloc(0);
  }
}

// Continue FSM with validated date/time data
async function continueWithValidatedDateTime(ws, validation, aiResponse) {
  try {
    // Load current state
    const callSid = ws.callSid;
    const currentState = await getCallStateOptimized(ws, callSid);
    
    // Generate confirmation response
    ws.generateSpeech(aiResponse);
    
    // Update state with collected date/time (would integrate with existing FSM phases)
    const updatedState = {
      ...currentState,
      dateTimeInput: {
        day: validation.dayText,
        time: validation.timeText,
        originalSpeech: validation.originalText
      },
      phase: 'confirm_datetime', // Move to confirmation phase
      updatedAt: new Date().toISOString()
    };
    
    saveCallStateOptimized(ws, updatedState);
    console.log(`✅ Date/time data safely collected and stored`);
    
  } catch (error) {
    console.error('❌ Error continuing with validated data:', error);
    ws.generateSpeech("I've noted that information. Let me continue with your request.");
  }
}

// Estimate audio duration for timing (rough calculation)
function estimateAudioDuration(text) {
  // Rough estimate: ~150 words per minute, ~2.5 chars per word
  const wordsPerMinute = 150;
  const charsPerWord = 2.5;
  const estimatedWords = text.length / charsPerWord;
  const durationMs = (estimatedWords / wordsPerMinute) * 60 * 1000;
  return Math.max(1000, Math.min(10000, durationMs)); // Between 1-10 seconds
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
    // Stop hold music before speaking
    stopHoldMusic(ws);
    
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
        if (res.statusCode === 401) {
          console.error('❌ ElevenLabs authentication failed - check API key');
        }
        // Try to read error response
        res.on('data', (chunk) => {
          console.error('❌ ElevenLabs error details:', chunk.toString());
        });
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
        ws.streamSid = data.streamSid; // Store streamSid on WebSocket for speech collection
        
        console.log('✅ Twilio stream started:', {
          callSid: data.start?.callSid,
          streamSid: streamSid,
          media: data.media
        });
        
        // FIRST: Play recording disclaimer message
        console.log('📢 Playing recording disclaimer message...');
        const disclaimerText = 'This call may be recorded for quality and compliance purposes.';
        generateElevenLabsSpeech(disclaimerText);
        
        // Run phone authentication in the background while disclaimer plays
        console.log('🔍 Starting background authentication during disclaimer...');
        
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
              
              saveCallStateOptimized(ws, callState);
              
              // OPTIMIZATION: Start comprehensive background data prefetching
              console.log('🚀 Starting comprehensive background data prefetching...');
              const jobServiceModule = require('./src/services/airtable/job-service.ts');
              const jobService = jobServiceModule.jobService;
              
              const backgroundDataPromise = Promise.all([
                multiProviderService.getEmployeeProviders(authResult.employee),
                // Prefetch employee's job list (NEW - replaces job code entry)
                // Pass provider ID if available to filter jobs by provider
                jobService.getEmployeeJobs(authResult.employee, authResult.employee.providerId)
              ]).then(([providerResult, employeeJobsResult]) => {
                // Cache all results on the WebSocket for instant access
                ws.cachedData = {
                  providers: providerResult,
                  employeeJobs: employeeJobsResult.jobs || [],
                  loadedAt: Date.now()
                };
                console.log(`✅ Background data loaded: ${providerResult?.providers?.length || 0} providers, ${employeeJobsResult.jobs?.length || 0} jobs`);
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
                  // Single provider - use provider greeting + present job list
                  const provider = providerResult.providers[0];
                  const providerGreeting = provider?.greeting || 'Welcome to Healthcare Services';
                  
                  // Get employee jobs from cached data
                  const employeeJobs = ws.cachedData?.employeeJobs || [];
                  
                  if (employeeJobs.length === 0) {
                    console.error('❌ No jobs found for employee');
                    const errorGreeting = `Hi ${authResult.employee.name}. ${providerGreeting}. You currently have no assigned jobs in the system. Please contact your supervisor.`;
                    generateElevenLabsSpeech(errorGreeting);
                    return;
                  }
                  
                  // Generate job list message with last name only and job title
                  let jobListMessage = '';
                  if (employeeJobs.length === 1) {
                    const job = employeeJobs[0];
                    const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
                    jobListMessage = `You have one job: ${job.jobTemplate.title} for ${patientLastName}. Press 1 to select this job.`;
                  } else {
                    jobListMessage = `You have ${employeeJobs.length} jobs. `;
                    employeeJobs.forEach((job, index) => {
                      const number = index + 1;
                      const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
                      jobListMessage += `Press ${number} for ${job.jobTemplate.title} for ${patientLastName}. `;
                    });
                  }
                  
                  const fullGreeting = `Hi ${authResult.employee.name}. ${providerGreeting}. ${jobListMessage}`;
                  
                  console.log(`🎤 Single provider greeting with job list: "${fullGreeting}"`);
                  
                  // Update state to job_selection phase with job list
                  callState = {
                    ...callState,
                    provider: provider ? {
                      id: provider.id,
                      name: provider.name,
                      greeting: provider.greeting
                    } : null,
                    phase: 'job_selection',
                    employeeJobs: employeeJobs.map((job, index) => ({
                      index: index + 1,
                      jobTemplate: {
                        id: job.jobTemplate.id,
                        jobCode: job.jobTemplate.jobCode,
                        title: job.jobTemplate.title,
                        serviceType: job.jobTemplate.serviceType,
                        patientId: job.jobTemplate.patientId,
                        occurrenceIds: job.jobTemplate.occurrenceIds || []
                      },
                      patient: job.patient ? {
                        id: job.patient.id,
                        name: job.patient.name,
                        patientId: job.patient.patientId
                      } : null
                    })),
                    updatedAt: new Date().toISOString()
                  };
                  
                  saveCallStateOptimized(ws, callState);
                  generateElevenLabsSpeech(fullGreeting);
                  
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
              
              saveCallStateOptimized(ws, callState);
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
            // Handle # key for speech recording control
            if (digit === '#' && ws.speechState === SPEECH_STATES.RECORDING) {
              console.log('🛑 # pressed - stopping speech recording');
              stopRecordingAndProcess(ws);
              return;
            }
            
            // Use the stored callSid from the start event
            const callSid = ws.callSid || data.streamSid;
            console.log(`🔍 Loading state for callSid: ${callSid}`);
            
            const currentState = await getCallStateOptimized(ws, callSid);
            console.log(`📊 Processing DTMF for phase: ${currentState.phase}`);
            
            // Initialize job code collection if not exists
            if (!ws.jobCodeDigits) {
              ws.jobCodeDigits = '';
            }
            
            // Initialize speech state if not exists
            if (!ws.speechState) {
              ws.speechState = SPEECH_STATES.IDLE;
            }
            
            if (currentState.phase === 'provider_selection' && currentState.availableProviders) {
              // Handle provider selection
              const selectionNum = parseInt(digit, 10);
              const selectedProvider = currentState.availableProviders.find(p => p.selectionNumber === selectionNum);
              
              if (selectedProvider) {
                console.log(`✅ Provider selected: ${selectedProvider.name}`);
                
                // Fetch jobs for this employee and provider
                const employeeJobs = ws.cachedData?.employeeJobs || [];
                
                // Filter jobs by selected provider
                const providerJobs = employeeJobs.filter(job => 
                  job.jobTemplate.providerId === selectedProvider.id
                );
                
                console.log(`📋 Found ${providerJobs.length} jobs for provider ${selectedProvider.name}`);
                
                if (providerJobs.length === 0) {
                  const errorGreeting = `${selectedProvider.greeting || `Welcome to ${selectedProvider.name}`}. You currently have no assigned jobs for this provider. Please contact your supervisor.`;
                  generateElevenLabsSpeech(errorGreeting);
                  return;
                }
                
                // Generate job list message with last name only and job title
                let jobListMessage = '';
                if (providerJobs.length === 1) {
                  const job = providerJobs[0];
                  const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
                  jobListMessage = `You have one job: ${job.jobTemplate.title} for ${patientLastName}. Press 1 to select this job.`;
                } else {
                  jobListMessage = `You have ${providerJobs.length} jobs. `;
                  providerJobs.forEach((job, index) => {
                    const number = index + 1;
                    const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
                    jobListMessage += `Press ${number} for ${job.jobTemplate.title} for ${patientLastName}. `;
                  });
                }
                
                const providerGreeting = selectedProvider.greeting || `Welcome to ${selectedProvider.name}`;
                const fullGreeting = `${providerGreeting}. ${jobListMessage}`;
                
                // Update state with selected provider and job list
                const updatedState = {
                  ...currentState,
                  provider: {
                    id: selectedProvider.id,
                    name: selectedProvider.name,
                    greeting: selectedProvider.greeting
                  },
                  phase: 'job_selection',
                  employeeJobs: providerJobs.map((job, index) => ({
                    index: index + 1,
                    jobTemplate: {
                      id: job.jobTemplate.id,
                      jobCode: job.jobTemplate.jobCode,
                      title: job.jobTemplate.title,
                      serviceType: job.jobTemplate.serviceType,
                      patientId: job.jobTemplate.patientId,
                      occurrenceIds: job.jobTemplate.occurrenceIds || []
                    },
                    patient: job.patient ? {
                      id: job.patient.id,
                      name: job.patient.name,
                      patientId: job.patient.patientId
                    } : null
                  })),
                  updatedAt: new Date().toISOString()
                };
                
                saveCallStateOptimized(ws, updatedState);
                
                console.log(`🎤 Provider greeting with job list: "${fullGreeting}"`);
                generateElevenLabsSpeech(fullGreeting);
                
              } else {
                console.log(`❌ Invalid provider selection: ${digit}`);
                generateElevenLabsSpeech("Invalid selection. Please press 1 for Sunrise Health Group or 2 for Pacific Wellness.");
              }
              
            } else if (currentState.phase === 'job_selection' && currentState.employeeJobs) {
              // Handle job selection
              const selectionNum = parseInt(digit, 10);
              const selectedJob = currentState.employeeJobs.find(j => j.index === selectionNum);
              
              if (selectedJob) {
                console.log(`✅ Job selected: ${selectedJob.jobTemplate.jobCode} - ${selectedJob.jobTemplate.title}`);
                
                // Update state with selected job and move to job options
                const updatedState = {
                  ...currentState,
                  phase: 'job_options',
                  jobTemplate: selectedJob.jobTemplate,
                  patient: selectedJob.patient || undefined,
                  updatedAt: new Date().toISOString()
                };
                
                saveCallStateOptimized(ws, updatedState);
                
                // Generate job options message with last name only
                const patientLastName = selectedJob.patient?.name ? selectedJob.patient.name.split(' ').pop() : 'the patient';
                const jobTitle = selectedJob.jobTemplate.title;
                const optionsMessage = `You selected ${jobTitle} for ${patientLastName}. What would you like to do? Press 1 to reschedule, Press 2 to leave the job open for someone else, Press 3 to talk to a representative, or Press 4 to select a different job.`;
                
                console.log(`🎤 Job options: "${optionsMessage}"`);
                generateElevenLabsSpeech(optionsMessage);
                
              } else {
                console.log(`❌ Invalid job selection: ${digit}`);
                const maxJobs = currentState.employeeJobs.length;
                generateElevenLabsSpeech(`Invalid selection. Please press a number from 1 to ${maxJobs} to select your job.`);
              }
              
            } else if (currentState.phase === 'job_options') {
              // Handle job options selection (1, 2, 3, or 4)
              console.log(`🎯 Job option selected: ${digit}`);
              
              if (digit === '3') {
                // Transfer to representative with queue
                console.log(`📞 Transferring to representative with queue system...`);
                
                // Update state to representative_transfer phase
                const updatedState = {
                  ...currentState,
                  phase: 'representative_transfer',
                  selectedOption: '3',
                  updatedAt: new Date().toISOString()
                };
                
                saveCallStateOptimized(ws, updatedState);
                
                // Generate transfer message
                generateElevenLabsSpeech("Let me connect you to a representative. Please hold.");
                
                // Use real queue system
                setTimeout(async () => {
                  try {
                    console.log(`🔄 Checking representative availability...`);
                    
                    // Import queue services
                    const { checkPhoneAvailability } = require('./src/services/queue/twilio-availability.ts');
                    const { callQueueService } = require('./src/services/queue/call-queue-service.ts');
                    
                    const REPRESENTATIVE_PHONE = '+522281957913';
                    
                    // Check if representative is available
                    const availability = await checkPhoneAvailability(REPRESENTATIVE_PHONE);
                    console.log(`📊 Availability check: ${availability.isAvailable ? 'Available' : 'Busy'} (${availability.activeCallsCount} active calls)`);
                    
                    if (availability.isAvailable) {
                      // Representative is available - transfer immediately using Twilio API
                      console.log(`✅ Representative available - initiating in-call transfer`);
                      generateElevenLabsSpeech("A representative is available. Transferring you now. Please hold while I connect your call.");
                      
                      // Wait for speech to complete, then create outbound call to representative
                      setTimeout(async () => {
                        try {
                          console.log(`🔄 Creating outbound call to representative...`);
                          
                          // Import Twilio client
                          const twilio = require('twilio');
                          const { twilioConfig } = require('./src/config/twilio.ts');
                          const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);
                          
                          // Create an outbound call to the representative
                          const outboundCall = await twilioClient.calls.create({
                            to: REPRESENTATIVE_PHONE,
                            from: twilioConfig.phoneNumber,
                            twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">You have an incoming call from an employee. Connecting now.</Say>
  <Dial>
    <Conference 
      beep="false"
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      statusCallback="https://sam-voice-agent.vercel.app/api/queue/conference-status"
      statusCallbackEvent="start end join leave"
    >transfer-${callSid}</Conference>
  </Dial>
</Response>`,
                            statusCallback: 'https://sam-voice-agent.vercel.app/api/queue/transfer-status',
                            statusCallbackEvent: ['answered', 'completed'],
                            timeout: 30
                          });
                          
                          console.log(`📞 Outbound call created: ${outboundCall.sid}`);
                          
                          // Wait a moment for representative to be connected, then join the caller
                          setTimeout(async () => {
                            try {
                              console.log(`🔗 Joining caller to conference...`);
                              
                              // Update the original call to join the conference
                              await twilioClient.calls(callSid).update({
                                twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Connecting you now.</Say>
  <Dial>
                    <Conference 
                      beep="false"
                      startConferenceOnEnter="true"
                      endConferenceOnExit="true"
                    >transfer-${callSid}</Conference>
                  </Dial>
                  <Say voice="Polly.Amy">The call has ended. Thank you.</Say>
                  <Hangup/>
</Response>`
                              });
                              
                              console.log(`✅ Caller joined conference - transfer complete!`);
                              
                            } catch (error) {
                              console.error('❌ Error joining caller to conference:', error.message);
                              generateElevenLabsSpeech("I'm having trouble completing the transfer. Please try again later.");
                            }
                          }, 2000); // Wait 2 seconds for representative to join conference
                          
                        } catch (error) {
                          console.error('❌ Error creating outbound call:', error.message);
                          if (error.stack) {
                            console.error('Stack:', error.stack);
                          }
                          generateElevenLabsSpeech("I'm having trouble connecting you to a representative. Please try again later.");
                        }
                      }, 5000); // Wait 5 seconds for speech to complete
                      
                    } else {
                      // Representative busy - enqueue the caller
                      console.log(`⏳ Representative busy - enqueueing caller`);
                      
                      const jobTitle = currentState.jobTemplate?.title || 'Unknown Job';
                      const patientName = currentState.patient?.name || 'Unknown Patient';
                      const callerPhone = currentState.employee?.phone || 'Unknown';
                      const callerName = currentState.employee?.name;
                      
                      const queueResult = await callQueueService.enqueueCall(
                        callSid,
                        callerPhone,
                        callerName,
                        { jobTitle, patientName }
                      );
                      
                      console.log(`✅ Added to queue - Position: ${queueResult.position}, Queue size: ${queueResult.queueSize}`);
                      
                      // Calculate estimated wait time
                      const estimatedWaitSeconds = await callQueueService.getEstimatedWaitTime(queueResult.position);
                      const estimatedWaitMinutes = Math.ceil(estimatedWaitSeconds / 60);
                      
                      // Announce queue position
                      let queueMessage;
                      if (queueResult.position === 1) {
                        queueMessage = "All representatives are currently assisting other callers. You are next in line. A representative will be with you shortly. Please stay on the line.";
                      } else {
                        queueMessage = `All representatives are currently assisting other callers. You are number ${queueResult.position} in the queue. Your estimated wait time is approximately ${estimatedWaitMinutes} ${estimatedWaitMinutes === 1 ? 'minute' : 'minutes'}. Please stay on the line. Your call is important to us.`;
                      }
                      
                      generateElevenLabsSpeech(queueMessage);
                      
                      // Play hold music after announcement
                      setTimeout(() => {
                        console.log(`🎵 Playing hold music...`);
                        // Play hold music in a loop
                        playHoldMusic(ws);
                        
                        // Periodic queue updates every 30 seconds
                        const queueUpdateInterval = setInterval(async () => {
                          try {
                            const currentPosition = await callQueueService.getCallPosition(callSid);
                            
                            if (currentPosition === null) {
                              // Call removed from queue (transferred or disconnected)
                              console.log(`📞 Call removed from queue`);
                              clearInterval(queueUpdateInterval);
                              return;
                            }
                            
                            console.log(`📊 Queue update - Current position: ${currentPosition}`);
                            
                            if (currentPosition === 1) {
                              generateElevenLabsSpeech("You are next in line. A representative will be with you shortly. Thank you for your patience.");
                            } else {
                              const waitTime = await callQueueService.getEstimatedWaitTime(currentPosition);
                              const waitMinutes = Math.ceil(waitTime / 60);
                              generateElevenLabsSpeech(`You are number ${currentPosition} in the queue. Estimated wait time is ${waitMinutes} ${waitMinutes === 1 ? 'minute' : 'minutes'}. Thank you for your patience.`);
                            }
                            
                            // Resume hold music after announcement
                            setTimeout(() => {
                              playHoldMusic(ws);
                            }, 5000);
                            
                          } catch (error) {
                            console.error('❌ Queue update error:', error);
                          }
                        }, 30000); // Update every 30 seconds
                        
                        // Store interval ID on WebSocket for cleanup
                        ws.queueUpdateInterval = queueUpdateInterval;
                      }, 5000); // Start hold music 5 seconds after queue announcement
                    }
                    
                  } catch (error) {
                    console.error('❌ Queue system error:', error);
                    generateElevenLabsSpeech("I'm having trouble connecting you to a representative. Please try again later.");
                  }
                }, 1000);
                
              } else if (digit === '1' || digit === '2' || digit === '4') {
                // Handle other job options
                console.log(`🎯 Processing job option ${digit}...`);
                
                try {
                  const jobOptionsPhase = require('./src/fsm/phases/job-options-phase.ts');
                  const jobOptionsResult = await jobOptionsPhase.processJobOptionsPhase(currentState, digit, true, 'dtmf');
                  
                  console.log(`📊 Job options result: action=${jobOptionsResult.result.action}, phase=${jobOptionsResult.newState.phase}`);
                  
                  // Save the new state
                  saveCallStateOptimized(ws, jobOptionsResult.newState);
                  
                  // Generate response
                  const responseText = extractResponseText(jobOptionsResult.result);
                  if (responseText) {
                    generateElevenLabsSpeech(responseText);
                  }
                  
                } catch (error) {
                  console.error('❌ Job options processing error:', error);
                  generateElevenLabsSpeech("I'm having trouble processing that option. Please try again.");
                }
                
              } else {
                console.log(`❌ Invalid job option: ${digit}`);
                generateElevenLabsSpeech("Invalid selection. Please press 1 to reschedule, 2 to leave open, 3 to talk to a representative, or 4 to select a different job.");
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
                    saveCallStateOptimized(ws, jobCodeResult.newState);
                    
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
                          saveCallStateOptimized(ws, jobOptionsResult.newState);
                          
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
                  
                  saveCallStateOptimized(ws, occurrenceResult.newState);
                  
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
                  
                  saveCallStateOptimized(ws, updatedState);
                  
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
                
                saveCallStateOptimized(ws, updatedState);
                
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
                
                saveCallStateOptimized(ws, occurrenceResult.newState);
                
                const responseText = extractResponseText(occurrenceResult.result) || "Appointment selection processed.";
                console.log(`🎤 Occurrence response: "${responseText}"`);
                
                // Check if this transitions to date collection (speech input needed)
                if (occurrenceResult.newState.phase === 'collect_day' || 
                    occurrenceResult.newState.phase === 'collect_month' || 
                    occurrenceResult.newState.phase === 'collect_time') {
                  
                  // Use professional speech collection for date/time input
                  const speechContext = {
                    patientName: occurrenceResult.newState.patient?.name || 'the patient',
                    appointmentDate: occurrenceResult.newState.selectedOccurrence?.displayDate || 'the appointment',
                    jobTitle: occurrenceResult.newState.jobTemplate?.title || 'healthcare service'
                  };
                  
                  console.log(`🎤 Starting professional speech collection for ${occurrenceResult.newState.phase}`);
                  startSpeechCollection(ws, responseText, speechContext, generateElevenLabsSpeech);
                  
                } else {
                  // Regular response for non-speech phases
                  generateElevenLabsSpeech(responseText);
                }
                
              } catch (error) {
                console.error('❌ Occurrence selection error:', error);
                generateElevenLabsSpeech("I'm having trouble with your appointment selection. Please try again.");
              }
              
            } else if (currentState.phase === 'collect_day' || currentState.phase === 'collect_month' || currentState.phase === 'collect_time') {
              // These phases should use speech collection, not DTMF
              console.log(`🎤 Date/time phase detected: ${currentState.phase} - should use speech collection`);
              
              // If we get DTMF in a speech phase, guide user to speech input
              const speechPrompt = currentState.phase === 'collect_day' 
                ? "What day would you like to reschedule to? Please speak after the tone and press pound when finished."
                : currentState.phase === 'collect_time'
                ? "What time works for you? Please speak after the tone and press pound when finished."
                : "Please tell me the date and time. Speak after the tone and press pound when finished.";
              
              const speechContext = {
                patientName: currentState.patient?.name || 'the patient',
                appointmentDate: currentState.selectedOccurrence?.displayDate || 'the appointment',
                jobTitle: currentState.jobTemplate?.title || 'healthcare service'
              };
              
              console.log(`🎤 Redirecting to professional speech collection`);
              startSpeechCollection(ws, speechPrompt, speechContext, generateElevenLabsSpeech);
              
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
                    
                    saveCallStateOptimized(ws, confirmResult.newState);
                    const responseText = extractResponseText(confirmResult.result) || "Appointment confirmed. Thank you!";
                    generateElevenLabsSpeech(responseText);
                    
                  } else if (currentState.phase === 'confirm_leave_open') {
                    const reasonPhase = require('./src/fsm/phases/reason-phase.ts');
                    const confirmResult = await reasonPhase.processConfirmLeaveOpenPhase(currentState, '1', true);
                    
                    saveCallStateOptimized(ws, confirmResult.newState);
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
        // Professional speech collection - only record during active recording state
        if (ws.speechState === SPEECH_STATES.RECORDING) {
          // Decode and buffer audio during active recording
          const audioData = Buffer.from(data.media.payload, 'base64');
          speechBuffer = Buffer.concat([speechBuffer, audioData]);
          
          // Prevent buffer from getting too large
          if (speechBuffer.length > MAX_SPEECH_DURATION) {
            console.log(`⚠️ Speech buffer reached maximum size, auto-stopping recording`);
            stopRecordingAndProcess(ws);
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

  ws.on('close', async (code, reason) => {
    console.log('🔚 WebSocket closed:', { callSid, code, reason: reason.toString() });
    
    // Clean up hold music
    stopHoldMusic(ws);
    
    // Clean up queue update interval
    if (ws.queueUpdateInterval) {
      clearInterval(ws.queueUpdateInterval);
      ws.queueUpdateInterval = null;
      console.log('🛑 Queue update interval cleared');
    }
    
    // Remove from queue if present
    try {
      const { callQueueService } = require('./src/services/queue/call-queue-service.ts');
      const removed = await callQueueService.removeFromQueue(callSid);
      if (removed) {
        console.log('📞 Call removed from queue on disconnect');
      }
    } catch (error) {
      console.error('❌ Error removing call from queue:', error);
    }
    
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
