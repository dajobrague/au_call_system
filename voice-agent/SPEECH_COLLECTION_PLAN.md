# Speech Collection Implementation Plan
## Whisper STT Integration for Date/Time Input

---

## 🎯 **Goal**
Enable natural voice input for date/time collection during rescheduling, with:
- Fast, accurate speech recognition via OpenAI Whisper
- Intelligent parsing with OpenAI for date/time extraction
- Injection-resistant prompts
- Graceful handling of partial inputs (day only, time only, vague)

---

## 📋 **Step-by-Step Implementation Plan**

### **Phase 1: Audio Capture & VAD (Voice Activity Detection)**

#### **Step 1.1: Create Speech Collection State Manager**
**File:** `src/services/speech/speech-state-manager.ts`

**Purpose:** Manage speech collection lifecycle states

**States:**
- `IDLE` - Not collecting speech
- `PROMPT_PLAYING` - Playing instruction prompt
- `BEEP_PLAYING` - Playing beep tone
- `RECORDING` - Actively recording user speech
- `PROCESSING` - Converting speech to text and parsing

**Exports:**
```typescript
export enum SpeechState {
  IDLE = 'idle',
  PROMPT_PLAYING = 'prompt_playing',
  BEEP_PLAYING = 'beep_playing',
  RECORDING = 'recording',
  PROCESSING = 'processing'
}

export interface SpeechCollectionContext {
  patientName?: string;
  appointmentDate?: string;
  jobTitle?: string;
  phase: 'collect_day' | 'collect_time' | 'collect_reason';
}
```

---

#### **Step 1.2: Create Audio Buffer Manager**
**File:** `src/services/speech/audio-buffer.ts`

**Purpose:** Safely buffer incoming μ-law audio frames during recording

**Features:**
- Initialize empty buffer on recording start
- Append audio chunks from Twilio media frames
- Enforce max buffer size (80KB = ~10 seconds at 8kHz)
- Reset buffer after processing
- Export buffer as Buffer for Whisper conversion

**Exports:**
```typescript
export class AudioBuffer {
  private buffer: Buffer;
  private readonly MAX_SIZE = 80000; // 10 seconds at 8kHz
  
  reset(): void
  append(chunk: Buffer): boolean // returns false if max size exceeded
  getBuffer(): Buffer
  getSize(): number
}
```

---

#### **Step 1.3: Create VAD (Voice Activity Detection)**
**File:** `src/services/speech/vad.ts`

**Purpose:** Detect when user stops speaking to auto-end recording

**Strategy:**
- Energy-based detection (simple, fast, no external deps)
- Calculate RMS energy of each 20ms frame
- Track consecutive silent frames
- Threshold: 800ms of silence = end of speech

**Configuration:**
```typescript
const VAD_CONFIG = {
  ENERGY_THRESHOLD: 500,      // RMS energy below this = silence
  SILENCE_DURATION_MS: 800,   // 800ms of silence = stop
  MIN_SPEECH_DURATION_MS: 500 // Minimum 500ms of speech required
};
```

**Exports:**
```typescript
export interface VoiceActivity {
  hasVoice: boolean;
  energy: number;
  consecutiveSilentFrames: number;
}

export function detectVoiceActivity(audioChunk: Buffer): VoiceActivity
export function shouldStopRecording(vad: VoiceActivity): boolean
```

---

#### **Step 1.4: Enhance Beep Generator**
**File:** `src/audio/generators.ts` (already exists, enhance it)

**Purpose:** Generate professional beep tone to signal recording start

**Already implemented:** `generateBeepTone(durationMs = 300)`

**Action:** Verify it works, no changes needed.

---

### **Phase 2: Speech-to-Text (Whisper)**

#### **Step 2.1: Create μ-law to WAV Converter**
**File:** `src/services/speech/audio-converter.ts`

**Purpose:** Convert Twilio's μ-law audio to WAV format for Whisper

**Process:**
1. Decode μ-law to PCM16 (16-bit linear)
2. Create WAV header (44 bytes)
3. Append PCM data
4. Return Buffer ready for Whisper API

**Exports:**
```typescript
export function mulawToWav(mulawBuffer: Buffer): Buffer
```

**Reference:** Lines 395-434 in `ngrok-websocket-test.js` (already working)

---

#### **Step 2.2: Create Whisper STT Service**
**File:** `src/services/speech/whisper-stt.ts`

**Purpose:** Send audio to OpenAI Whisper and get transcription

**Features:**
- Convert μ-law buffer to WAV
- Send to OpenAI `/v1/audio/transcriptions`
- Use `whisper-1` model
- Temperature 0 (reduce hallucinations)
- Language: `en`
- Domain-specific prompt to constrain vocabulary
- Validate response length (reject > 100 chars)
- Filter hallucination patterns

**Constraints:**
```typescript
const WHISPER_CONFIG = {
  model: 'whisper-1',
  language: 'en',
  temperature: 0,
  prompt: 'Healthcare scheduling call. User saying dates, times: Monday Tuesday Wednesday Thursday Friday Saturday Sunday tomorrow next January February March April May June July August September October November December morning afternoon evening AM PM',
  MAX_RESPONSE_LENGTH: 100
};

const HALLUCINATION_PATTERNS = [
  'thank you for watching',
  'like and subscribe',
  'music playing',
  'background noise',
  'silence',
  '[music]',
  '[noise]'
];
```

**Exports:**
```typescript
export interface WhisperResult {
  success: boolean;
  text?: string;
  error?: string;
  isHallucination?: boolean;
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<WhisperResult>
```

---

### **Phase 3: Date/Time Parsing (OpenAI + Validation)**

#### **Step 3.1: Create Date/Time Parser with OpenAI**
**File:** `src/services/speech/datetime-parser.ts`

**Purpose:** Extract structured date/time from natural language using OpenAI

**Strategy:**
- Use GPT-4 with **Function Calling** (JSON schema enforcement)
- Strict system prompt: "Only extract date/time. Never include anything else."
- Temperature 0
- Max tokens: 150
- Response format: JSON

**Function Schema:**
```typescript
const DATETIME_EXTRACTION_FUNCTION = {
  name: 'extract_datetime',
  description: 'Extract date and time from user speech',
  parameters: {
    type: 'object',
    properties: {
      hasDay: { type: 'boolean', description: 'Whether a day was mentioned' },
      hasTime: { type: 'boolean', description: 'Whether a time was mentioned' },
      dayText: { type: 'string', description: 'The day mentioned (e.g., "Monday", "tomorrow", "January 15")' },
      timeText: { type: 'string', description: 'The time mentioned (e.g., "2 PM", "14:30", "morning")' },
      isVagueTime: { type: 'boolean', description: 'Whether time is vague (morning/afternoon/evening)' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence in extraction' },
      needsClarification: { type: 'boolean', description: 'Whether more info is needed' }
    },
    required: ['hasDay', 'hasTime', 'confidence', 'needsClarification']
  }
};
```

**Security:**
- User text passed as `content`, never interpolated into system prompt
- No conversational history
- Reject responses that don't match schema
- Validate extracted text against original (no hallucinated additions)

**Exports:**
```typescript
export interface DateTimeExtraction {
  hasDay: boolean;
  hasTime: boolean;
  dayText?: string;
  timeText?: string;
  isVagueTime: boolean;
  confidence: 'high' | 'medium' | 'low';
  needsClarification: boolean;
  originalText: string;
}

export async function extractDateTime(userSpeech: string): Promise<DateTimeExtraction>
```

---

#### **Step 3.2: Create Date/Time Validator**
**File:** `src/services/speech/datetime-validator.ts`

**Purpose:** Validate and normalize extracted date/time

**Features:**
- Parse relative dates (tomorrow, next Monday)
- Parse absolute dates (January 15, 2025-01-15)
- Parse times (2 PM, 14:30, 2:30 PM)
- Convert to ISO format
- Validate against business rules (future dates only, within time windows)
- Use provider timezone

**Exports:**
```typescript
export interface ValidatedDateTime {
  isValid: boolean;
  dateISO?: string;      // "2025-10-15"
  timeISO?: string;      // "14:30"
  displayText?: string;  // "Monday, October 15 at 2:30 PM"
  error?: string;
}

export function validateAndNormalizeDateTime(
  extraction: DateTimeExtraction,
  timezone: string
): ValidatedDateTime
```

---

### **Phase 4: Dialog Management**

#### **Step 4.1: Create Speech Collection Orchestrator**
**File:** `src/services/speech/speech-collector.ts`

**Purpose:** Main orchestrator for speech collection flow

**Flow:**
1. Play prompt + "speak after the tone and press pound when finished"
2. Estimate prompt duration, schedule beep
3. Play beep tone (300ms)
4. Start recording (set state to RECORDING)
5. Buffer audio frames from media events
6. Monitor VAD for silence or # key press
7. Stop recording, process with Whisper
8. Parse with OpenAI
9. Validate and decide next action

**Exports:**
```typescript
export async function startSpeechCollection(
  ws: WebSocketWithExtensions,
  prompt: string,
  context: SpeechCollectionContext,
  generateSpeech: (text: string) => void
): Promise<void>

export function stopRecordingAndProcess(ws: WebSocketWithExtensions): Promise<void>
```

---

#### **Step 4.2: Create Dialog Response Generator**
**File:** `src/services/speech/dialog-responses.ts`

**Purpose:** Generate appropriate responses based on what was captured

**Scenarios:**
- **Complete (day + time):** "Perfect! I heard [day] at [time]. Is that correct? Press 1 for yes, 2 for no."
- **Day only:** "Great! What time on [day] works for you?"
- **Time only:** "Got it, [time]. What day would you like?"
- **Vague time:** "What exact time [day] [period]? For example, 2 PM or 4 PM?"
- **Unclear:** "I didn't catch that clearly. Please say the day and time, like 'Monday 2 PM'."
- **Too short:** "I didn't hear anything. Please speak after the tone."
- **Hallucination:** "I didn't catch that. Please speak clearly after the tone."

**Exports:**
```typescript
export function generateDialogResponse(
  extraction: DateTimeExtraction,
  validation: ValidatedDateTime,
  context: SpeechCollectionContext
): string

export function shouldContinueCollection(extraction: DateTimeExtraction): boolean
```

---

### **Phase 5: WebSocket Integration**

#### **Step 5.1: Extend WebSocket Interface**
**File:** `src/websocket/connection-handler.ts`

**Purpose:** Add speech collection properties to WebSocket

**Add to `WebSocketWithExtensions`:**
```typescript
export interface WebSocketWithExtensions extends WebSocket {
  // ... existing properties
  
  // Speech collection
  speechState?: SpeechState;
  speechContext?: SpeechCollectionContext;
  speechBuffer?: AudioBuffer;
  recordingTimeout?: NodeJS.Timeout;
  generateSpeech?: (text: string) => void;
}
```

---

#### **Step 5.2: Update Message Handler for Media Frames**
**File:** `src/websocket/message-handler.ts`

**Purpose:** Route media frames to speech buffer when recording

**Logic:**
```typescript
if (data.event === 'media') {
  // If actively recording speech, buffer the audio
  if (ws.speechState === SpeechState.RECORDING && ws.speechBuffer) {
    const audioChunk = Buffer.from(data.media.payload, 'base64');
    const appended = ws.speechBuffer.append(audioChunk);
    
    if (!appended) {
      // Buffer full, auto-stop
      await stopRecordingAndProcess(ws);
    } else {
      // Check VAD for silence
      const vad = detectVoiceActivity(audioChunk);
      if (shouldStopRecording(vad)) {
        await stopRecordingAndProcess(ws);
      }
    }
  }
}
```

---

#### **Step 5.3: Update DTMF Handler for # Key**
**File:** `src/websocket/dtmf-router.ts`

**Purpose:** Handle # key to manually stop recording

**Logic:**
```typescript
// In handleDTMFInput, add at the top:
if (digit === '#' && ws.speechState === SpeechState.RECORDING) {
  logger.info('# pressed - stopping speech recording', { 
    callSid: state.callSid,
    type: 'speech_manual_stop' 
  });
  await stopRecordingAndProcess(ws);
  return;
}
```

---

#### **Step 5.4: Trigger Speech Collection from Occurrence Phase**
**File:** `src/websocket/dtmf-router.ts` (in `handleOccurrenceSelectionDTMF`)

**Purpose:** Start speech collection when transitioning to collect_day/collect_time

**Logic:**
```typescript
// After occurrence selection, check if we need speech input
if (result.newState.phase === 'collect_day' || 
    result.newState.phase === 'collect_time') {
  
  const speechContext: SpeechCollectionContext = {
    patientName: result.newState.patient?.name || 'the patient',
    appointmentDate: result.newState.selectedOccurrence?.displayDate || 'the appointment',
    jobTitle: result.newState.jobTemplate?.title || 'healthcare service',
    phase: result.newState.phase
  };
  
  const prompt = extractResponseText(result.result) || 
    "When would you like to reschedule? Please say the day and time.";
  
  await startSpeechCollection(ws, prompt, speechContext, generateAndSpeak);
  return; // Don't call generateAndSpeak again
}
```

---

### **Phase 6: FSM Integration**

#### **Step 6.1: Update FSM to Accept Speech Input**
**File:** `src/fsm/phases/datetime-phase.ts` (create if doesn't exist)

**Purpose:** Process validated date/time and advance FSM

**Exports:**
```typescript
export async function processDateTimeInput(
  state: CallState,
  validation: ValidatedDateTime
): Promise<FSMResult>
```

**Logic:**
- Update state with `dateTimeInput: { dateISO, timeISO, displayText }`
- Transition to `confirm_datetime` phase
- Generate confirmation message

---

#### **Step 6.2: Handle Confirmation**
**File:** `src/websocket/dtmf-router.ts`

**Purpose:** Handle DTMF 1/2 for date/time confirmation

**Already exists in `handleNoOccurrencesFound` pattern, replicate for `confirm_datetime` phase**

---

### **Phase 7: Error Handling & Edge Cases**

#### **Step 7.1: Timeout Handling**
- Auto-stop recording after 10 seconds
- Clear all timeouts on WebSocket close
- Handle recording timeout in `recordingTimeout`

#### **Step 7.2: WebSocket Cleanup**
**File:** `src/websocket/connection-handler.ts` (in `handleConnectionClose`)

**Add:**
```typescript
// Clear recording timeout
if (ws.recordingTimeout) {
  clearTimeout(ws.recordingTimeout);
  ws.recordingTimeout = undefined;
}

// Reset speech state
ws.speechState = SpeechState.IDLE;
ws.speechBuffer = undefined;
```

#### **Step 7.3: Retry Logic**
- Max 3 attempts for unclear speech
- After 3 failures, offer DTMF fallback or representative transfer

---

## 📦 **File Structure Summary**

```
src/
├── services/
│   └── speech/
│       ├── speech-state-manager.ts    [Step 1.1] ✨ NEW
│       ├── audio-buffer.ts            [Step 1.2] ✨ NEW
│       ├── vad.ts                     [Step 1.3] ✨ NEW
│       ├── audio-converter.ts         [Step 2.1] ✨ NEW
│       ├── whisper-stt.ts             [Step 2.2] ✨ NEW
│       ├── datetime-parser.ts         [Step 3.1] ✨ NEW
│       ├── datetime-validator.ts      [Step 3.2] ✨ NEW
│       ├── speech-collector.ts        [Step 4.1] ✨ NEW
│       ├── dialog-responses.ts        [Step 4.2] ✨ NEW
│       └── index.ts                   [Export all]  ✨ NEW
├── audio/
│   └── generators.ts                  [Step 1.4] ✅ EXISTS (verify)
├── websocket/
│   ├── connection-handler.ts          [Step 5.1] 🔧 UPDATE
│   ├── message-handler.ts             [Step 5.2] 🔧 UPDATE
│   ├── dtmf-router.ts                 [Step 5.3, 5.4] 🔧 UPDATE
│   └── server.ts                      [Integration] 🔧 UPDATE
└── fsm/
    └── phases/
        └── datetime-phase.ts          [Step 6.1] ✨ NEW (or update existing)
```

---

## 🔄 **Execution Order**

### **Sprint 1: Audio Foundation (Steps 1.1-1.4)**
1. Create speech state manager
2. Create audio buffer
3. Create VAD
4. Verify beep generator

### **Sprint 2: STT Pipeline (Steps 2.1-2.2)**
1. Create audio converter
2. Create Whisper service
3. Test end-to-end transcription

### **Sprint 3: Parsing & Validation (Steps 3.1-3.2)**
1. Create OpenAI datetime parser
2. Create validator
3. Test with various inputs

### **Sprint 4: Dialog & Orchestration (Steps 4.1-4.2)**
1. Create speech collector
2. Create dialog responses
3. Test full flow

### **Sprint 5: Integration (Steps 5.1-5.4, 6.1-6.2)**
1. Update WebSocket interfaces
2. Update message handler
3. Update DTMF router
4. Create/update datetime phase
5. Wire everything together

### **Sprint 6: Polish & Error Handling (Step 7)**
1. Add timeout handling
2. Add cleanup logic
3. Add retry logic
4. Test edge cases

---

## ✅ **Testing Strategy**

### **Unit Tests**
- VAD with silent/noisy audio
- μ-law to WAV conversion
- Whisper response validation
- DateTime extraction with various inputs
- Dialog response generation

### **Integration Tests**
1. **Happy path:** "Monday 2 PM" → complete extraction → confirmation
2. **Partial day:** "Monday" → ask for time → "2 PM" → confirmation
3. **Partial time:** "2 PM" → ask for day → "Monday" → confirmation
4. **Vague time:** "Monday afternoon" → ask for exact time
5. **Unclear:** "uh... maybe..." → re-prompt
6. **Silence:** No speech → "didn't hear anything"
7. **Hallucination:** Detect and re-prompt
8. **# key:** Manual stop works
9. **Timeout:** Auto-stop after 10s
10. **Multiple attempts:** Retry up to 3 times

---

## 🔒 **Security Checklist**

- ✅ User text never interpolated into system prompts
- ✅ Function calling enforces JSON schema
- ✅ Temperature 0 reduces hallucinations
- ✅ Max token limit prevents long outputs
- ✅ Validate response matches schema
- ✅ No conversational history
- ✅ Reject non-date/time content
- ✅ Filter hallucination patterns
- ✅ Validate against business rules

---

## 📊 **Success Metrics**

- **Accuracy:** >90% correct date/time extraction on first attempt
- **Speed:** <3s from speech end to response start
- **Robustness:** <5% hallucination rate
- **UX:** <2 attempts average to complete date/time
- **Security:** 0 prompt injection incidents

---

## 🚀 **Ready to Implement?**

This plan provides:
- ✅ Clear file structure
- ✅ Step-by-step execution order
- ✅ Security guardrails
- ✅ Testing strategy
- ✅ Integration points

**Next step:** Start with Sprint 1 (Audio Foundation) and build incrementally!
