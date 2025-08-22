# Stage Prompts <-> TwiML Gather Blocks

## TwiML Generation Strategy
Maps FSM stages and prompts to Twilio TwiML elements for voice interaction.

## Stage to TwiML Mapping

### Basic Gather Configuration
```typescript
// Default gather settings for voice input
const DEFAULT_GATHER_CONFIG = {
  input: ['speech', 'dtmf'],
  timeout: 5,
  speechTimeout: 'auto',
  language: 'es-MX', // Configurable via LANG env var
  voice: 'alice'
};
```

### Stage-Specific TwiML Generation

#### COLLECT_CLIENT_ID Stage
```typescript
// Input
{
  stage: 'COLLECT_CLIENT_ID',
  promptKey: 'prompts.collect_client_id.ask',
  promptText: 'Dime tu identificador de cliente.',
  action: '/api/twilio/handle-gather?stage=collect_client_id'
}

// Generated TwiML
<Response>
  <Gather action="/api/twilio/handle-gather?stage=collect_client_id" 
          input="speech dtmf" 
          timeout="5" 
          speechTimeout="auto"
          language="es-MX">
    <Say voice="alice" language="es-MX">Dime tu identificador de cliente.</Say>
  </Gather>
  <Say voice="alice" language="es-MX">No recibí respuesta. Por favor, inténtalo de nuevo.</Say>
  <Redirect>/api/twilio/handle-gather?stage=collect_client_id&retry=1</Redirect>
</Response>
```

#### CONFIRM_JOB Stage
```typescript
// Input with job data interpolation
{
  stage: 'CONFIRM_JOB',
  promptKey: 'confirms.job.readback', 
  promptText: 'Trabajo 456; estado En Progreso; fecha 15 de marzo. ¿Es correcto?',
  action: '/api/twilio/handle-gather?stage=confirm_job'
}

// Generated TwiML
<Response>
  <Gather action="/api/twilio/handle-gather?stage=confirm_job"
          input="speech dtmf"
          timeout="8"
          speechTimeout="auto" 
          language="es-MX">
    <Say voice="alice" language="es-MX">Trabajo 456; estado En Progreso; fecha 15 de marzo. ¿Es correcto?</Say>
  </Gather>
  <Say voice="alice" language="es-MX">No escuché una respuesta. ¿Está correcto?</Say>
  <Redirect>/api/twilio/handle-gather?stage=confirm_job&retry=1</Redirect>
</Response>
```

## Prompt Interpolation
```typescript
// Template processing for dynamic content
const interpolatePrompt = (template: string, variables: Record<string, any>): string => {
  return template.replace(/\{\{(\w+)(?:\|([^}]+))?\}\}/g, (match, key, fallback) => {
    const value = variables[key];
    if (value === null || value === undefined) {
      return fallback || '';
    }
    return String(value);
  });
};

// Example usage
const template = "Trabajo {{job_number}}; estado {{status}}; fecha {{scheduled_date|sin fecha}}.";
const variables = { job_number: "456", status: "En Progreso", scheduled_date: null };
const result = interpolatePrompt(template, variables);
// Result: "Trabajo 456; estado En Progreso; fecha sin fecha."
```

## TwiML Builder Functions

### Gather TwiML
```typescript
const buildGatherTwiML = (config: GatherConfig): string => {
  const {
    prompt,
    action,
    timeout = 5,
    input = ['speech', 'dtmf'],
    language = 'es-MX',
    voice = 'alice',
    retryPrompt,
    retryAction
  } = config;

  return `
    <Response>
      <Gather action="${action}" 
              input="${input.join(' ')}" 
              timeout="${timeout}"
              speechTimeout="auto"
              language="${language}">
        <Say voice="${voice}" language="${language}">${prompt}</Say>
      </Gather>
      ${retryPrompt ? `<Say voice="${voice}" language="${language}">${retryPrompt}</Say>` : ''}
      ${retryAction ? `<Redirect>${retryAction}</Redirect>` : ''}
    </Response>
  `;
};
```

### Say-Only TwiML
```typescript
const buildSayTwiML = (config: SayConfig): string => {
  const {
    message,
    voice = 'alice',
    language = 'es-MX',
    hangup = true
  } = config;

  return `
    <Response>
      <Say voice="${voice}" language="${language}">${message}</Say>
      ${hangup ? '<Hangup/>' : ''}
    </Response>
  `;
};
```

### Redirect TwiML
```typescript
const buildRedirectTwiML = (url: string): string => {
  return `
    <Response>
      <Redirect>${url}</Redirect>
    </Response>
  `;
};
```

## Voice and Language Configuration

### Multi-Language Support
```typescript
const getVoiceConfig = (language: string) => {
  switch (language) {
    case 'es':
    case 'es-MX':
      return { voice: 'alice', language: 'es-MX' };
    case 'en':
    case 'en-US':
      return { voice: 'alice', language: 'en-US' };
    default:
      return { voice: 'alice', language: 'es-MX' }; // Default to Spanish
  }
};
```

### Stage-Specific Timeouts
```typescript
const getStageTimeout = (stage: Stage): number => {
  switch (stage) {
    case 'COLLECT_CLIENT_ID':
    case 'COLLECT_JOB_NUMBER':
      return 5; // Quick input expected
    case 'CONFIRM_JOB':
    case 'CONFIRM_ACTION':
      return 8; // More time for decision making
    case 'ASK_ACTION':
      return 10; // Menu selection may take longer
    default:
      return 5;
  }
};
```

## Error and Retry Handling

### Retry TwiML Generation
```typescript
const buildRetryTwiML = (stage: Stage, attemptCount: number): string => {
  const maxRetries = 3;
  
  if (attemptCount >= maxRetries) {
    return buildSayTwiML({
      message: 'No pude entender tu respuesta. Por favor, llama de nuevo más tarde.',
      hangup: true
    });
  }

  const retryPrompts = {
    'COLLECT_CLIENT_ID': [
      'No entendí. Repite tu identificador de cliente.',
      'Por favor, deletrea tu identificador de cliente.',
      'Intenta decir tu identificador letra por letra.'
    ],
    'COLLECT_JOB_NUMBER': [
      'Número de trabajo no válido. Inténtalo de nuevo.',
      'Dime solo el número del trabajo.',
      'Por favor, repite el número más despacio.'
    ]
  };

  const prompts = retryPrompts[stage] || ['No entendí. Por favor, inténtalo de nuevo.'];
  const prompt = prompts[Math.min(attemptCount, prompts.length - 1)];

  return buildGatherTwiML({
    prompt,
    action: `/api/twilio/handle-gather?stage=${stage}&retry=${attemptCount + 1}`,
    timeout: getStageTimeout(stage) + attemptCount // Increase timeout with retries
  });
};
```

## SSML Support
```typescript
// Enhanced speech synthesis markup
const buildSSMLPrompt = (text: string, options: SSMLOptions = {}): string => {
  const { rate = 'medium', volume = 'medium', emphasis = [] } = options;
  
  let ssml = `<speak><prosody rate="${rate}" volume="${volume}">`;
  
  // Apply emphasis to specific words
  let processedText = text;
  emphasis.forEach(word => {
    processedText = processedText.replace(
      new RegExp(`\\b${word}\\b`, 'gi'),
      `<emphasis level="strong">${word}</emphasis>`
    );
  });
  
  ssml += processedText;
  ssml += '</prosody></speak>';
  
  return ssml;
};
```

## TwiML Validation
```typescript
const validateTwiML = (twiml: string): boolean => {
  try {
    // Basic XML validation
    const parser = new DOMParser();
    const doc = parser.parseFromString(twiml, 'text/xml');
    const parserError = doc.querySelector('parsererror');
    
    if (parserError) {
      console.error('Invalid TwiML XML:', parserError.textContent);
      return false;
    }
    
    // Check for required Response element
    if (!doc.querySelector('Response')) {
      console.error('TwiML must contain Response element');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('TwiML validation error:', error);
    return false;
  }
};
```

## Performance Optimization
```typescript
// Cache frequently used TwiML templates
const twimlCache = new Map<string, string>();

const getCachedTwiML = (cacheKey: string, generator: () => string): string => {
  if (twimlCache.has(cacheKey)) {
    return twimlCache.get(cacheKey)!;
  }
  
  const twiml = generator();
  twimlCache.set(cacheKey, twiml);
  return twiml;
};
```

## TODO
- Implement SSML support for enhanced speech synthesis
- Add TwiML template caching for performance
- Create TwiML testing utilities for development
