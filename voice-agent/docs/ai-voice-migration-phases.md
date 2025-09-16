# 🎙️ AI Voice Agent Migration - Implementation Phases

## 🎯 **Project Overview**

Transform the entire IVR system from keypad-based interaction to AI-powered voice conversation from the very first moment of the call. Every interaction - from phone authentication to job completion - will be voice-driven using ElevenLabs STT/TTS.

## 🔄 **Complete AI Voice Flow**

### **Current Flow (DTMF):**
```
Call → Phone lookup → "Press PIN" → Keypad input → Menu options → Keypad selections
```

### **New Flow (AI Voice):**
```
Call → Phone lookup → "Hi [Name], please say your PIN" → Voice input → "What can I help you with?" → Natural conversation
```

### **Key Principle:**
**NO KEYPAD INTERACTIONS** - Everything must be voice-driven from call start to completion.

---

## 📋 **Implementation Phases**

### **Phase 1: Foundation Setup**
**Goal:** Get ElevenLabs working with basic audio streaming infrastructure

#### **What We'll Build:**
- ElevenLabs service integration (STT + TTS)
- WebSocket audio streaming infrastructure  
- Basic voice I/O testing endpoints

#### **Files Created:**
- `src/services/elevenlabs/elevenlabs-service.ts`
- `src/services/audio/stream-manager.ts`
- `src/api/twilio/media-stream/route.ts`
- `src/api/test/voice/route.ts` (testing endpoint)

#### **Environment Setup:**
```bash
npm install elevenlabs-node ws @types/ws
```

#### **Testing:**
```bash
# Test 1: ElevenLabs TTS
curl -X POST localhost:3000/api/test/voice/tts -d '{"text":"Hello, this is your AI assistant"}'
# Should return audio file

# Test 2: ElevenLabs STT  
curl -X POST localhost:3000/api/test/voice/stt -F "audio=@test.wav"
# Should return transcribed text

# Test 3: WebSocket connection
# Connect to ws://localhost:3000/api/twilio/media-stream
# Should establish connection and echo audio
```

#### **Success Criteria:**
- [ ] ElevenLabs API integration working
- [ ] Audio streaming WebSocket functional
- [ ] Can convert text → speech → text roundtrip
- [ ] Latency under 500ms for basic operations

---

### **Phase 2: Voice-First Authentication**
**Goal:** Replace PIN keypad entry with voice-driven authentication

#### **What We'll Build:**
- Voice PIN collection and validation
- Natural language phone number recognition
- Speech-based authentication flow

#### **Key Changes:**
- **Before:** "Please enter your PIN followed by #"
- **After:** "Hi David, please say your 4-digit PIN number"

#### **Files Modified:**
- `src/fsm/phases/phone-auth.ts` (add voice mode)
- `src/fsm/phases/pin-auth.ts` (add voice PIN processing)
- `src/fsm/twiml/twiml-generator.ts` (add voice prompts)

#### **Files Created:**
- `src/services/voice/pin-validator.ts`
- `src/services/voice/speech-to-number.ts`

#### **Testing:**
```bash
# Test 1: Known phone number
# Call with registered number
# Should say: "Hi [Employee Name], please say your PIN"
# Speak PIN → Should authenticate successfully

# Test 2: Unknown phone number  
# Call with unregistered number
# Should say: "I don't recognize this number, please say your employee PIN"
# Speak PIN → Should authenticate successfully

# Test 3: Invalid PIN
# Speak wrong PIN → Should prompt to try again
# Multiple failures → Should offer representative
```

#### **Success Criteria:**
- [ ] Voice PIN recognition 95%+ accuracy
- [ ] Natural greeting with employee names
- [ ] Proper error handling for unclear speech
- [ ] Fallback to representative for failures

---

### **Phase 3: Conversational Intent Recognition**
**Goal:** Replace all menu options with natural conversation understanding

#### **What We'll Build:**
- Intent parser for natural language commands
- Context-aware conversation management
- Dynamic response generation

#### **Key Changes:**
- **Before:** "Press 1 for reschedule, 2 for leave open, 3 for representative"
- **After:** "What would you like to do with your appointment?" → "I need to reschedule" → System understands

#### **Files Created:**
- `src/services/intent/intent-parser.ts`
- `src/services/intent/conversation-context.ts`
- `src/services/voice/natural-responses.ts`

#### **Intent Mapping:**
```typescript
// User Speech → FSM Input
"reschedule" / "change time" / "move appointment" → "1"
"can't make it" / "leave open" / "someone else" → "2"  
"talk to person" / "representative" / "human" → "3"
"wrong job" / "different code" / "other job" → "4"
"yes" / "correct" / "that's right" → "1"
"no" / "wrong" / "try again" → "2"
```

#### **Testing:**
```bash
# Test 1: Job options recognition
# Various ways to say "reschedule":
"I want to reschedule" → intent: "1"
"Can we change the time?" → intent: "1"  
"I need to move my appointment" → intent: "1"

# Test 2: Confirmation handling
"Yes, that's correct" → intent: "1"
"No, that's wrong" → intent: "2"

# Test 3: Unclear speech
"Um, I think maybe..." → Request clarification
"[unintelligible]" → "I didn't catch that, could you repeat?"
```

#### **Success Criteria:**
- [ ] 90%+ accuracy on common phrases
- [ ] Natural conversation flow
- [ ] Proper clarification when uncertain
- [ ] Context awareness within conversations

---

### **Phase 4: Voice Job Code Collection**
**Goal:** Replace keypad job code entry with voice-driven collection

#### **What We'll Build:**
- Speech-to-text job code recognition
- Phonetic job code handling (spelling out codes)
- Intelligent code validation and confirmation

#### **Key Changes:**
- **Before:** "Enter your job code followed by #"
- **After:** "What's your job code? You can say the numbers or spell it out"

#### **Files Modified:**
- `src/fsm/phases/job-code-phase.ts` (add voice processing)

#### **Files Created:**
- `src/services/voice/job-code-parser.ts`
- `src/services/voice/phonetic-processor.ts`

#### **Voice Job Code Handling:**
```typescript
// Multiple input formats supported:
"One two three four" → "1234"
"Twelve thirty-four" → "1234"  
"Alpha Bravo Charlie" → "ABC"
"A-B-C" → "ABC"
"Job code is 1234" → "1234"
```

#### **Testing:**
```bash
# Test 1: Numeric codes
"One two three four" → Extract "1234" → Validate in Airtable
"Twelve thirty-four" → Extract "1234" → Validate

# Test 2: Alphanumeric codes  
"Alpha Bravo One Two" → Extract "AB12" → Validate
"A-B-1-2" → Extract "AB12" → Validate

# Test 3: Confirmation flow
Say code → "I heard job code 1234, is that correct?" → "Yes" → Continue
Say code → "I heard job code 1234, is that correct?" → "No" → "Please say it again"
```

#### **Success Criteria:**
- [ ] 95%+ accuracy on numeric job codes
- [ ] 90%+ accuracy on alphanumeric codes
- [ ] Proper phonetic spelling recognition
- [ ] Clear confirmation and retry flow

---

### **Phase 5: Conversational Date/Time Collection**
**Goal:** Replace rigid date/time entry with natural conversation

#### **What We'll Build:**
- Natural language date/time parsing
- Conversational scheduling flow
- Smart date validation and suggestions

#### **Key Changes:**
- **Before:** "Enter day: 0-1, Enter month: 0-3, Enter time: 1-4-0-0"
- **After:** "When would you like to reschedule?" → "Next Tuesday at 2 PM" → System understands

#### **Files Modified:**
- `src/fsm/phases/datetime-phase.ts` (add conversational flow)

#### **Files Created:**
- `src/services/voice/datetime-parser.ts`
- `src/services/voice/schedule-validator.ts`

#### **Natural Date/Time Parsing:**
```typescript
// User Speech → Structured Data
"Next Tuesday at 2 PM" → {date: "2024-01-16", time: "14:00"}
"Tomorrow morning" → {date: "2024-01-10", time: "09:00"}
"January 15th at three thirty" → {date: "2024-01-15", time: "15:30"}
"Monday the 22nd" → {date: "2024-01-22", time: null} // Ask for time
```

#### **Testing:**
```bash
# Test 1: Complete date/time
"Next Tuesday at 2 PM" → Parse and validate → Confirm
"Tomorrow at nine AM" → Parse and validate → Confirm

# Test 2: Partial information
"Next Tuesday" → Parse date → "What time on Tuesday?"
"At 3 PM" → "What day at 3 PM?"

# Test 3: Invalid dates
"Yesterday" → "That's in the past, please choose a future date"
"February 30th" → "That's not a valid date, please try again"
```

#### **Success Criteria:**
- [ ] 90%+ accuracy on common date/time phrases
- [ ] Intelligent handling of partial information
- [ ] Proper validation of future dates
- [ ] Natural confirmation flow

---

### **Phase 6: Voice Reason Collection**
**Goal:** Replace speech-to-text reason collection with conversational flow

#### **What We'll Build:**
- Enhanced conversational reason collection
- Better speech processing for longer responses
- Intelligent reason summarization

#### **Key Changes:**
- **Before:** "Please state your reason after the beep" (rigid recording)
- **After:** "Can you tell me why you can't make this appointment?" (conversational)

#### **Files Modified:**
- `src/fsm/phases/reason-phase.ts` (enhance conversation flow)

#### **Files Created:**
- `src/services/voice/reason-processor.ts`
- `src/services/voice/conversation-summarizer.ts`

#### **Enhanced Reason Processing:**
```typescript
// Natural conversation flow:
System: "Can you tell me why you can't make this appointment?"
User: "I have a family emergency and need to be out of town"
System: "I understand, family emergency. Let me mark this appointment as open for others."

// Follow-up questions if needed:
User: "I can't make it"
System: "Could you give me a bit more detail about why?"
User: "I'm sick"
System: "Got it, illness. I'll mark this as open for someone else."
```

#### **Testing:**
```bash
# Test 1: Clear reasons
"Family emergency" → Process and confirm
"I'm sick today" → Process and confirm
"Car broke down" → Process and confirm

# Test 2: Vague responses
"I can't make it" → Ask for more detail
"Something came up" → Ask for clarification

# Test 3: Long explanations
Long speech → Summarize key points → Confirm understanding
```

#### **Success Criteria:**
- [ ] Natural conversation flow for reason collection
- [ ] Intelligent summarization of long responses
- [ ] Appropriate follow-up questions
- [ ] Clear confirmation of understanding

---

### **Phase 7: End-to-End Integration & Polish**
**Goal:** Complete conversational experience with natural transitions

#### **What We'll Build:**
- Seamless conversation flow between phases
- Natural transition phrases
- Context preservation across conversation
- Enhanced error recovery

#### **Files Modified:**
- All phase processors (add natural transitions)
- `src/fsm/services/workflow-orchestrator.ts` (conversation continuity)

#### **Files Created:**
- `src/services/voice/conversation-flow.ts`
- `src/services/voice/context-manager.ts`

#### **Natural Conversation Flow:**
```
Call Start: "Hi David, please say your PIN"
PIN Entry: "Thank you. What's your job code?"
Job Code: "Got it, job 1234 for Maria's home visit. What would you like to do?"
Options: "I need to reschedule"
Reschedule: "When would you like to reschedule to?"
DateTime: "Next Tuesday at 2 PM"
Confirm: "Perfect! I've rescheduled Maria's visit to Tuesday at 2 PM. You'll get a confirmation text."
```

#### **Testing:**
```bash
# Test 1: Complete conversation flow
# Full call from start to finish
# Natural conversation throughout
# No jarring transitions

# Test 2: Error recovery
# Handle unclear speech at any point
# Graceful clarification requests
# Context preservation during errors

# Test 3: Multiple scenarios
# Test all major user journeys
# Reschedule, leave open, representative
# Various edge cases and error conditions
```

#### **Success Criteria:**
- [ ] Completely natural conversation experience
- [ ] Smooth transitions between phases
- [ ] Excellent error recovery
- [ ] Context preserved throughout call
- [ ] User feels like talking to human assistant

---

### **Phase 8: Production Readiness**
**Goal:** Performance optimization, monitoring, and deployment preparation

#### **What We'll Build:**
- Performance monitoring and optimization
- Enhanced error handling and logging
- Production configuration and scaling
- Comprehensive rollback mechanisms

#### **Files Created:**
- `src/services/monitoring/voice-metrics.ts`
- `src/services/monitoring/performance-tracker.ts`
- Production environment configurations

#### **Production Considerations:**
- **Latency:** < 500ms total response time
- **Accuracy:** > 95% speech recognition
- **Availability:** 99.9% uptime
- **Scalability:** Handle concurrent calls
- **Cost Management:** ElevenLabs usage optimization

#### **Testing:**
```bash
# Test 1: Load testing
# Multiple concurrent voice calls
# System performance under load
# Resource usage monitoring

# Test 2: Rollback testing
# Feature flag toggle to DTMF mode
# Immediate fallback capability
# No data loss during rollback

# Test 3: Production scenarios
# Real-world usage patterns
# Edge cases and error conditions
# Performance optimization validation
```

#### **Success Criteria:**
- [ ] Production-ready performance
- [ ] Comprehensive monitoring in place
- [ ] Rollback strategy verified
- [ ] Documentation complete
- [ ] Ready for full deployment

---

## 🎯 **Key Success Metrics**

### **Technical Metrics:**
- **Speech Recognition Accuracy:** > 95%
- **Response Latency:** < 500ms end-to-end
- **System Availability:** 99.9%
- **Error Rate:** < 2%

### **User Experience Metrics:**
- **Conversation Completion Rate:** > 95%
- **User Satisfaction:** Natural, human-like interaction
- **Task Success Rate:** Maintain current FSM success rates
- **Error Recovery:** Graceful handling of unclear speech

### **Business Metrics:**
- **Call Duration:** Potentially shorter due to natural flow
- **Representative Escalation:** Reduced due to better UX
- **System Efficiency:** Maintained or improved
- **Cost Management:** ElevenLabs usage within budget

---

## 🚀 **Deployment Strategy**

### **Feature Flag Control:**
```typescript
const VOICE_AI_ENABLED = process.env.VOICE_AI_ENABLED === 'true'
const VOICE_AI_PERCENTAGE = process.env.VOICE_AI_PERCENTAGE || '0'

// Gradual rollout capability
if (VOICE_AI_ENABLED && shouldUseVoiceAI(callSid, VOICE_AI_PERCENTAGE)) {
  return processVoiceAI(webhookData)
} else {
  return processTraditionalIVR(webhookData)
}
```

### **Rollout Plan:**
1. **Internal Testing:** Development team only
2. **Limited Beta:** 5% of calls
3. **Expanded Beta:** 25% of calls  
4. **Soft Launch:** 50% of calls
5. **Full Deployment:** 100% of calls

### **Rollback Strategy:**
- **Instant Rollback:** Toggle feature flag off
- **Partial Rollback:** Reduce percentage of voice AI calls
- **Emergency Rollback:** Automatic fallback on high error rates
- **Data Preservation:** All call state maintained during rollback

---

## 📋 **Testing Checklist for Each Phase**

### **Before Starting Each Phase:**
- [ ] Previous phase fully tested and stable
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Rollback strategy verified

### **During Each Phase:**
- [ ] Unit tests for new components
- [ ] Integration tests with existing system
- [ ] Manual testing of user scenarios
- [ ] Performance impact assessment

### **Before Completing Each Phase:**
- [ ] All success criteria met
- [ ] Documentation updated
- [ ] Team review and approval
- [ ] Ready to proceed to next phase

This comprehensive plan ensures we build a completely voice-driven AI assistant that feels natural and human-like from the very first moment of the call! 🎙️✨
