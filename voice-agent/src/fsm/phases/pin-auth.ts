/**
 * PIN Authentication Phase
 * Handles authentication via employee PIN when phone number is not recognized
 * Supports both traditional DTMF and AI voice modes
 */

import { employeeService } from '../../services/airtable';
import { logger } from '../../lib/logger';
import { convertSpokenToPin, generatePinConfirmation } from '../../services/voice/pin-validator';
import { generateTwiML } from '../twiml/twiml-generator';
import type { CallState, ProcessingResult, InputSource } from '../types';

/**
 * Process PIN authentication phase
 * Validates employee PIN and transitions to provider greeting
 */
export async function processPinAuthPhase(
  state: CallState,
  input: string,
  hasInput: boolean,
  inputSource: InputSource
): Promise<{ newState: CallState; result: ProcessingResult }> {
  const startTime = Date.now();

  logger.info('PIN authentication phase', {
    callSid: state.sid,
    hasInput,
    inputSource,
    inputLength: input.length,
    attempts: state.attempts.clientId, // Reusing clientId attempts for PIN
    type: 'pin_auth_process'
  });

  if (!hasInput) {
    // No input provided - increment attempts and reprompt
    const newAttempts = state.attempts.clientId + 1;
    
    if (newAttempts > 2) { // MAX_ATTEMPTS_PER_FIELD
      logger.info('PIN authentication max attempts reached', {
        callSid: state.sid,
        attempts: newAttempts,
        type: 'pin_auth_max_attempts'
      });

      // Max attempts - connect to representative
      const newState: CallState = {
        ...state,
        phase: 'error',
        attempts: { ...state.attempts, clientId: newAttempts },
        updatedAt: new Date().toISOString()
      };

      return {
        newState,
        result: {
          twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-A">I didn't receive your PIN after several attempts. Connecting you with a representative.</Say>
  <Hangup/>
</Response>`,
          action: 'pin_auth_max_attempts',
          shouldDeleteState: true,
        }
      };
    }

    // Reprompt for PIN
    const newState: CallState = {
      ...state,
      attempts: { ...state.attempts, clientId: newAttempts },
      updatedAt: new Date().toISOString()
    };

    return {
      newState,
      result: {
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" timeout="10" finishOnKey="#">
    <Say voice="Google.en-AU-Wavenet-A">I didn't hear your PIN. Please use your keypad to enter your employee PIN followed by the pound key.</Say>
  </Gather>
  <Say voice="Google.en-AU-Wavenet-A">I didn't receive your PIN. Please try again.</Say>
  <Hangup/>
</Response>`,
        action: 'pin_auth_reprompt',
        shouldDeleteState: false,
      }
    };
  }

  // Parse PIN from input (handle both voice and DTMF)
  let pinString: string;
  let confidence = 1.0;

  if (inputSource === 'speech') {
    // Process voice input
    const voicePinResult = convertSpokenToPin(input);
    
    if (!voicePinResult.success) {
      logger.info('Voice PIN conversion failed', {
        callSid: state.sid,
        input,
        error: voicePinResult.error,
        type: 'voice_pin_conversion_failed'
      });

      // Failed to parse voice PIN - ask for clarification
      const newAttempts = state.attempts.clientId + 1;
      
      if (newAttempts > 2) {
        const newState: CallState = {
          ...state,
          phase: 'error',
          attempts: { ...state.attempts, clientId: newAttempts },
          updatedAt: new Date().toISOString()
        };

        return {
          newState,
          result: {
            twiml: generateTwiML('I couldn\'t understand your PIN. Connecting you with a representative.', false),
            action: 'voice_pin_failed',
            shouldDeleteState: true,
          }
        };
      }

      const newState: CallState = {
        ...state,
        attempts: { ...state.attempts, clientId: newAttempts },
        updatedAt: new Date().toISOString()
      };

      const useVoiceAI = process.env.VOICE_AI_ENABLED === 'true';
      const repromptMessage = useVoiceAI 
        ? 'I didn\'t catch your PIN clearly. Please say your four-digit employee PIN again, speaking each number clearly.'
        : 'I didn\'t understand your PIN. Please use your keypad to enter your employee PIN followed by the pound key.';

      return {
        newState,
        result: {
          twiml: generateTwiML(repromptMessage, true),
          action: 'voice_pin_reprompt',
          shouldDeleteState: false,
        }
      };
    }

    pinString = voicePinResult.pin!;
    confidence = voicePinResult.confidence || 0.8;
    
    logger.info('Voice PIN extracted', {
      callSid: state.sid,
      originalInput: input,
      extractedPin: pinString,
      confidence,
      type: 'voice_pin_extracted'
    });
  } else {
    // Traditional DTMF input
    pinString = input.trim();
  }

  const pin = parseInt(pinString, 10);

  if (isNaN(pin) || pin <= 0 || pinString.length !== 4) {
    logger.info('Invalid PIN format', {
      callSid: state.sid,
      input: pinString,
      type: 'pin_auth_invalid_format'
    });

    // Invalid PIN format - reprompt
    const newAttempts = state.attempts.clientId + 1;
    
    if (newAttempts > 2) {
      const newState: CallState = {
        ...state,
        phase: 'error',
        attempts: { ...state.attempts, clientId: newAttempts },
        updatedAt: new Date().toISOString()
      };

      return {
        newState,
        result: {
          twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-A">Invalid PIN format. Connecting you with a representative.</Say>
  <Hangup/>
</Response>`,
          action: 'pin_auth_invalid_format',
          shouldDeleteState: true,
        }
      };
    }

    const newState: CallState = {
      ...state,
      attempts: { ...state.attempts, clientId: newAttempts },
      updatedAt: new Date().toISOString()
    };

    return {
      newState,
      result: {
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" timeout="10" finishOnKey="#">
    <Say voice="Google.en-AU-Wavenet-A">Please use your keypad to enter a valid employee PIN using numbers only, followed by the pound key.</Say>
  </Gather>
  <Say voice="Google.en-AU-Wavenet-A">I didn't receive your PIN. Please try again.</Say>
  <Hangup/>
</Response>`,
        action: 'pin_auth_invalid_reprompt',
        shouldDeleteState: false,
      }
    };
  }

  try {
    // Attempt PIN authentication
    const authResult = await employeeService.authenticateByPin(pin);
    const duration = Date.now() - startTime;

    if (authResult.success && authResult.employee) {
      // PIN authentication successful
      logger.info('PIN authentication successful', {
        callSid: state.sid,
        pin,
        employeeId: authResult.employee.id,
        employeeName: authResult.employee.name,
        providerId: authResult.provider?.id,
        duration,
        type: 'pin_auth_success'
      });

      // Update state with employee and provider info
      const newState: CallState = {
        ...state,
        phase: 'provider_selection', // Check for multiple providers first
        employee: {
          id: authResult.employee.id,
          name: authResult.employee.name,
          pin: authResult.employee.pin,
          phone: authResult.employee.phone,
          providerId: authResult.employee.providerId,
          jobTemplateIds: authResult.employee.jobTemplateIds,
          notes: authResult.employee.notes,
          active: authResult.employee.active,
        },
        provider: authResult.provider,
        authMethod: 'pin',
        updatedAt: new Date().toISOString()
      };

      // Transition to provider_selection with immediate personalized greeting
      const employeeName = authResult.employee.name;
      const useVoiceAI = process.env.VOICE_AI_ENABLED === 'true';
      
      return {
        newState,
        result: {
          twiml: useVoiceAI 
            ? generateVoiceAuthSuccess(employeeName)
            : `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-A">Hi ${employeeName}.</Say>
  <Hangup/>
</Response>`,
          action: 'pin_auth_success',
          shouldDeleteState: false,
        }
      };

    } else {
      // PIN not found
      logger.info('PIN authentication failed', {
        callSid: state.sid,
        pin,
        duration,
        error: authResult.error,
        type: 'pin_auth_failed'
      });

      const newAttempts = state.attempts.clientId + 1;
      
      if (newAttempts > 2) {
        const newState: CallState = {
          ...state,
          phase: 'error',
          attempts: { ...state.attempts, clientId: newAttempts },
          updatedAt: new Date().toISOString()
        };

        return {
          newState,
          result: {
            twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-A">I couldn't find your PIN after several attempts. Connecting you with a representative.</Say>
  <Hangup/>
</Response>`,
            action: 'pin_auth_not_found',
            shouldDeleteState: true,
          }
        };
      }

      // Reprompt for correct PIN
      const newState: CallState = {
        ...state,
        attempts: { ...state.attempts, clientId: newAttempts },
        updatedAt: new Date().toISOString()
      };

      return {
        newState,
        result: {
          twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" timeout="10" finishOnKey="#">
    <Say voice="Google.en-AU-Wavenet-A">I couldn't find that PIN. Please use your keypad to enter your correct employee PIN followed by the pound key.</Say>
  </Gather>
  <Say voice="Google.en-AU-Wavenet-A">I didn't receive your PIN. Please try again.</Say>
  <Hangup/>
</Response>`,
          action: 'pin_auth_not_found_reprompt',
          shouldDeleteState: false,
        }
      };
    }

  } catch (error) {
    // System error during PIN authentication
    const duration = Date.now() - startTime;
    
    logger.error('PIN authentication system error', {
      callSid: state.sid,
      pin,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'pin_auth_error'
    });

    // Fall back to "connect to representative" message
    const newState: CallState = {
      ...state,
      phase: 'error',
      updatedAt: new Date().toISOString()
    };

    return {
      newState,
      result: {
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-A">Our automated system is not available at this time. We are connecting you with a representative.</Say>
  <Hangup/>
</Response>`,
        action: 'system_error',
        shouldDeleteState: true,
      }
    };
  }
}

/**
 * Generate voice authentication success response
 */
function generateVoiceAuthSuccess(employeeName: string): string {
  const prompt = `Hi ${employeeName}. Thank you for authenticating.`;
  const cloudflareUrl = process.env.CLOUDFLARE_VOICE_PROXY_URL || 'wss://voice-proxy.brachod.workers.dev/stream';
  const streamUrl = `${cloudflareUrl}?callSid={CallSid}&prompt=${encodeURIComponent(prompt)}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${streamUrl}" />
  </Start>
  <Say>Connecting you now...</Say>
</Response>`;
}
