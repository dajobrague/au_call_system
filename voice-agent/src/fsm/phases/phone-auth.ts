/**
 * Phone Authentication Phase
 * Handles automatic authentication via phone number recognition
 * Supports both traditional DTMF and AI voice modes
 */

import { employeeService } from '../../services/airtable';
import { extractTwilioPhoneNumber } from '../../utils/phone-formatter';
import { logger } from '../../lib/logger';
import { generateTwiML } from '../twiml/twiml-generator';
import type { CallState, ProcessingResult, InputSource } from '../types';
import type { TwilioWebhookData } from '../types';

/**
 * Process phone authentication phase
 * Attempts to authenticate user by their calling phone number
 */
export async function processPhoneAuthPhase(
  state: CallState,
  webhookData: TwilioWebhookData
): Promise<{ newState: CallState; result: ProcessingResult }> {
  const callerPhone = extractTwilioPhoneNumber(webhookData.From);
  const startTime = Date.now();

  logger.info('Phone authentication phase', {
    callSid: state.sid,
    callerPhone,
    phase: state.phase,
    type: 'phone_auth_start'
  });

  try {
    // Attempt phone authentication
    const authResult = await employeeService.authenticateByPhone(callerPhone);
    const duration = Date.now() - startTime;

    if (authResult.success && authResult.employee) {
      // Phone authentication successful
      logger.info('Phone authentication successful', {
        callSid: state.sid,
        callerPhone,
        employeeId: authResult.employee.id,
        employeeName: authResult.employee.name,
        providerId: authResult.provider?.id,
        duration,
        type: 'phone_auth_success'
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
        authMethod: 'phone',
        updatedAt: new Date().toISOString()
      };

      // Transition to provider_selection with immediate personalized greeting
      const employeeName = authResult.employee.name;
      
      // Check if voice AI mode is enabled
      const useVoiceAI = process.env.VOICE_AI_ENABLED === 'true';
      
      if (useVoiceAI) {
        // Pre-cache the personalized greeting for WebSocket to retrieve
        const personalizedGreeting = `Hi ${employeeName}, how can I help you today?`;
        
        // Cache the prompt asynchronously
        import('../../services/redis').then(({ cacheVoicePrompt }) => {
          cacheVoicePrompt(webhookData.CallSid, personalizedGreeting).catch(err => {
            console.error('❌ Failed to cache personalized greeting:', err);
          });
        }).catch(err => {
          console.error('❌ Failed to import Redis service:', err);
        });
        
        return {
          newState,
          result: {
            twiml: generateVoiceGreeting(employeeName),
            action: 'phone_auth_success',
            shouldDeleteState: false,
            logData: {
              phase: state.phase,
              action: 'phone_auth_success',
              employeeId: authResult.employee.id,
              employeeName: authResult.employee.name,
              authMethod: 'phone',
              duration,
              voiceMode: useVoiceAI,
              voicePromptCached: personalizedGreeting
            }
          }
        };
      } else {
        return {
          newState,
          result: {
            twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-A">Hi ${employeeName}.</Say>
  <Hangup/>
</Response>`,
            action: 'phone_auth_success',
            shouldDeleteState: false,
            logData: {
              phase: state.phase,
              action: 'phone_auth_success',
              employeeId: authResult.employee.id,
              employeeName: authResult.employee.name,
              authMethod: 'phone',
              duration,
              voiceMode: useVoiceAI
            }
          }
        };
      }

    } else {
      // Phone not found - transition to PIN authentication
      logger.info('Phone not found, requesting PIN', {
        callSid: state.sid,
        callerPhone,
        duration,
        error: authResult.error,
        type: 'phone_auth_failed'
      });

      const newState: CallState = {
        ...state,
        phase: 'pin_auth', // Move to PIN authentication phase
        updatedAt: new Date().toISOString()
      };

      // Check if voice AI mode is enabled
      const useVoiceAI = process.env.VOICE_AI_ENABLED === 'true';

      if (useVoiceAI) {
        // Pre-cache the PIN request prompt for WebSocket to retrieve
        const pinPrompt = `Welcome. I don't recognize your phone number. Please use your keypad to enter your employee PIN followed by the pound key.`;
        
        // Cache the prompt asynchronously
        import('../../services/redis').then(({ cacheVoicePrompt }) => {
          cacheVoicePrompt(webhookData.CallSid, pinPrompt).catch(err => {
            console.error('❌ Failed to cache PIN prompt:', err);
          });
        }).catch(err => {
          console.error('❌ Failed to import Redis service:', err);
        });
        
        return {
          newState,
          result: {
            twiml: generateVoicePinRequest(),
            action: 'phone_auth_failed',
            shouldDeleteState: false,
            logData: {
              phase: state.phase,
              action: 'phone_auth_failed',
              callerPhone,
              authMethod: 'phone_failed',
              duration,
              error: authResult.error,
              voiceMode: useVoiceAI,
              voicePromptCached: pinPrompt
            }
          }
        };
      } else {
        return {
          newState,
          result: {
            twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" timeout="10" finishOnKey="#" action="/api/twilio/voice" method="POST">
    <Say voice="Google.en-AU-Wavenet-A">Welcome. I don't recognize your phone number. Please use your keypad to enter your employee PIN followed by the pound key.</Say>
  </Gather>
  <Say voice="Google.en-AU-Wavenet-A">I didn't receive your PIN. Please try again.</Say>
  <Hangup/>
</Response>`,
            action: 'phone_auth_failed',
            shouldDeleteState: false,
            logData: {
              phase: state.phase,
              action: 'phone_auth_failed',
              callerPhone,
              authMethod: 'phone_failed',
              duration,
              error: authResult.error,
              voiceMode: useVoiceAI
            }
          }
        };
      }
    }

  } catch (error) {
    // System error during authentication
    const duration = Date.now() - startTime;
    
    logger.error('Phone authentication system error', {
      callSid: state.sid,
      callerPhone,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'phone_auth_error'
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
        logData: {
          phase: state.phase,
          action: 'system_error',
          callerPhone,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    };
  }
}

/**
 * Generate voice greeting for authenticated users
 */
function generateVoiceGreeting(employeeName: string): string {
  // Use generateAdaptiveTwiML to get proper phone parameter handling
  const { generateAdaptiveTwiML } = require('../twiml/twiml-generator');
  return generateAdaptiveTwiML(`Hi ${employeeName}, welcome. Please enter your job code.`, false);
}

/**
 * Generate voice PIN request for unknown numbers
 */
function generateVoicePinRequest(): string {
  // Use generateAdaptiveTwiML to get proper phone parameter handling
  const { generateAdaptiveTwiML } = require('../twiml/twiml-generator');
  return generateAdaptiveTwiML("Welcome. I don't recognize your phone number. Please enter your PIN.", false);
}
