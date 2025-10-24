# Refactored Modules Guide

## Overview
This guide shows how to use all the newly extracted modules from the WebSocket server refactoring.

---

## 🎵 Audio Processing (`src/audio/`)

### Codecs
```typescript
import { linear16ToMulaw } from './src/audio/codecs';

const pcmData = new Int16Array([/* PCM16 samples */]);
const ulawData = linear16ToMulaw(pcmData);
```

### Frame Processing
```typescript
import { sliceInto20msFrames } from './src/audio/frame-processor';

const ulawAudio = new Uint8Array([/* μ-law data */]);
const frames = sliceInto20msFrames(ulawAudio); // Array of 20ms frames
```

### Resampling
```typescript
import { resampleTo8k } from './src/audio/resampler';

const audioBuffer = /* ArrayBuffer at any sample rate */;
const resampled = resampleTo8k(audioBuffer, 16000); // Resample from 16kHz to 8kHz
```

### Tone Generation
```typescript
import { generateBeepTone, generateHoldMusic } from './src/audio/generators';

// Generate a beep
const beepFrames = generateBeepTone(300); // 300ms beep

// Generate hold music
const musicFrames = generateHoldMusic(10000); // 10 seconds of music
```

### Hold Music Player
```typescript
import { playHoldMusic, stopHoldMusic } from './src/audio/hold-music-player';

// Start playing hold music
playHoldMusic(websocket);

// Stop when needed
stopHoldMusic(websocket);
```

---

## 🎤 ElevenLabs Service (`src/services/elevenlabs/`)

### Speech Generation
```typescript
import { generateSpeech } from './src/services/elevenlabs';

const result = await generateSpeech('Hello, how can I help you?', {
  apiKey: process.env.ELEVENLABS_API_KEY,
  voiceId: 'aEO01A4wXwd1O8GPgGlF', // Optional
  speed: 0.95, // Optional
  stability: 0.5 // Optional
});

if (result.success && result.frames) {
  console.log(`Generated ${result.frames.length} frames`);
}
```

### Audio Streaming
```typescript
import { streamAudioToTwilio } from './src/services/elevenlabs';

// Stream frames to Twilio WebSocket
await streamAudioToTwilio(websocket, frames, streamSid);
```

---

## 📞 Twilio Service (`src/services/twilio/`)

### Conference Transfer
```typescript
import { transferToRepresentative } from './src/services/twilio';

const result = await transferToRepresentative({
  callerCallSid: 'CA123...',
  representativePhone: '+522281957913',
  callerPhone: '+522281957913'
});

if (result.success) {
  console.log(`Conference created: ${result.conferenceName}`);
}
```

---

## 🎯 Business Logic Handlers (`src/handlers/`)

### Authentication
```typescript
import { authenticateByPhone, prefetchBackgroundData } from './src/handlers';

// Authenticate by phone
const authResult = await authenticateByPhone('+522281957913');

if (authResult.success && authResult.employee) {
  // Prefetch background data
  const backgroundData = await prefetchBackgroundData(authResult.employee);
  console.log(`Loaded ${backgroundData.employeeJobs?.length} jobs`);
}
```

### Provider Greetings
```typescript
import {
  generateSingleProviderGreeting,
  generateMultiProviderGreeting,
  generateProviderSelectionGreeting
} from './src/handlers';

// Single provider
const greeting = generateSingleProviderGreeting({
  employee: authResult.employee,
  provider: authResult.provider,
  employeeJobs: backgroundData.employeeJobs,
  hasMultipleProviders: false
});

console.log(greeting.message);

// Multiple providers
const multiGreeting = generateMultiProviderGreeting(
  authResult.employee,
  backgroundData.providers.providers
);

// After provider selection
const selectionGreeting = generateProviderSelectionGreeting(
  selectedProvider,
  filteredJobs
);
```

### Job Selection
```typescript
import {
  selectJob,
  generateJobOptionsMessage,
  filterJobsByProvider
} from './src/handlers';

// Select a job
const jobResult = selectJob(employeeJobs, 1); // Press 1

if (jobResult.success && jobResult.job) {
  // Generate job options message
  const options = generateJobOptionsMessage(jobResult.job);
  console.log(options.message);
}

// Filter jobs by provider
const filteredJobs = filterJobsByProvider(employeeJobs, 'recexHQJ13oafJkxZ');
```

### Representative Transfer
```typescript
import { handleRepresentativeTransfer, getQueueUpdateMessage } from './src/handlers';

// Attempt transfer
const transferResult = await handleRepresentativeTransfer({
  callSid: 'CA123...',
  callerPhone: '+522281957913',
  callerName: 'David Bracho',
  representativePhone: '+522281957913',
  jobInfo: {
    jobTitle: 'Initial Assessment',
    patientName: 'Smith'
  }
});

if (transferResult.status === 'transferred') {
  console.log('Call transferred successfully');
} else if (transferResult.status === 'enqueued') {
  console.log(`Enqueued at position ${transferResult.queuePosition}`);
  
  // Get periodic updates
  setInterval(async () => {
    const updateMessage = await getQueueUpdateMessage(callSid);
    if (updateMessage) {
      console.log(updateMessage);
    }
  }, 30000); // Every 30 seconds
}
```

---

## 🔄 Queue Services (`src/services/queue/`)

### Call Queue Management
```typescript
import { callQueueService } from './src/services/queue/call-queue-service';

// Enqueue a call
const result = await callQueueService.enqueueCall(
  'CA123...',
  '+522281957913',
  'David Bracho',
  { jobTitle: 'Initial Assessment', patientName: 'Smith' }
);

console.log(`Position: ${result.position}, Queue size: ${result.queueSize}`);

// Get queue position
const position = await callQueueService.getCallPosition('CA123...');

// Get estimated wait time
const waitSeconds = await callQueueService.getEstimatedWaitTime(position);

// Dequeue next caller
const nextCall = await callQueueService.dequeueCall();

// Remove from queue
await callQueueService.removeFromQueue('CA123...');
```

### Phone Availability
```typescript
import { checkPhoneAvailability } from './src/services/queue/twilio-availability';

const availability = await checkPhoneAvailability('+522281957913');

if (availability.isAvailable) {
  console.log('Phone is available');
} else {
  console.log(`Phone is busy (${availability.activeCallsCount} active calls)`);
}
```

---

## 🛠️ Utilities (`src/utils/`)

### Text Extraction
```typescript
import { extractResponseText } from './src/utils/text-extractor';

const twimlResult = {
  twiml: '<Response><Say>Hello world</Say></Response>'
};

const text = extractResponseText(twimlResult);
console.log(text); // "Hello world"
```

---

## 📦 Complete Example: Full Call Flow

```typescript
import { authenticateByPhone, prefetchBackgroundData } from './src/handlers';
import { generateSingleProviderGreeting } from './src/handlers';
import { selectJob, generateJobOptionsMessage } from './src/handlers';
import { handleRepresentativeTransfer } from './src/handlers';
import { generateSpeech, streamAudioToTwilio } from './src/services/elevenlabs';
import { playHoldMusic, stopHoldMusic } from './src/audio';

// 1. Authenticate
const authResult = await authenticateByPhone('+522281957913');

if (authResult.success) {
  // 2. Load background data
  const backgroundData = await prefetchBackgroundData(authResult.employee);
  
  // 3. Generate greeting
  const greeting = generateSingleProviderGreeting({
    employee: authResult.employee,
    provider: authResult.provider,
    employeeJobs: backgroundData.employeeJobs,
    hasMultipleProviders: false
  });
  
  // 4. Speak greeting
  const speechResult = await generateSpeech(greeting.message, {
    apiKey: process.env.ELEVENLABS_API_KEY
  });
  
  if (speechResult.success && speechResult.frames) {
    await streamAudioToTwilio(websocket, speechResult.frames, streamSid);
  }
  
  // 5. User selects job (DTMF: 1)
  const jobResult = selectJob(backgroundData.employeeJobs, 1);
  
  if (jobResult.success) {
    // 6. Generate job options
    const options = generateJobOptionsMessage(jobResult.job);
    
    // 7. Speak options
    const optionsSpeech = await generateSpeech(options.message, {
      apiKey: process.env.ELEVENLABS_API_KEY
    });
    
    if (optionsSpeech.success && optionsSpeech.frames) {
      await streamAudioToTwilio(websocket, optionsSpeech.frames, streamSid);
    }
    
    // 8. User presses 3 (talk to representative)
    const transferResult = await handleRepresentativeTransfer({
      callSid: 'CA123...',
      callerPhone: '+522281957913',
      callerName: authResult.employee.name,
      representativePhone: '+522281957913',
      jobInfo: {
        jobTitle: options.jobTitle,
        patientName: options.patientName
      }
    });
    
    // 9. Announce transfer status
    const transferSpeech = await generateSpeech(transferResult.message, {
      apiKey: process.env.ELEVENLABS_API_KEY
    });
    
    if (transferSpeech.success && transferSpeech.frames) {
      await streamAudioToTwilio(websocket, transferSpeech.frames, streamSid);
    }
    
    // 10. If enqueued, play hold music
    if (transferResult.status === 'enqueued') {
      playHoldMusic(websocket);
    }
  }
}
```

---

## 🎯 Benefits of Modular Architecture

1. **Testability**: Each module can be unit tested independently
2. **Reusability**: Audio functions can be used in other projects
3. **Maintainability**: Each file is < 200 lines
4. **Type Safety**: Full TypeScript support
5. **Clear Separation**: Business logic, services, and utilities are separate
6. **Easy Debugging**: Clear module boundaries make issues easier to track
7. **Team Collaboration**: Multiple developers can work on different modules

---

## 📚 Module Dependencies

```
handlers/
├── authentication-handler → services/airtable/
├── provider-handler → (no dependencies)
├── job-handler → (no dependencies)
└── transfer-handler → services/queue/, services/twilio/

services/
├── elevenlabs/ → audio/
├── twilio/ → config/twilio
└── queue/ → config/twilio

audio/
└── (no dependencies - pure functions)
```

---

## 🚀 Next Steps

1. Update `ngrok-websocket-test.js` to use these modules
2. Create unit tests for each module
3. Add integration tests for complete flows
4. Document API endpoints
5. Create WebSocket server wrapper (Phase 4)
