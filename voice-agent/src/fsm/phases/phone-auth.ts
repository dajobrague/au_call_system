/**
 * Phone Authentication Phase
 * Handles automatic authentication via phone number recognition
 */

import { employeeService } from '../../services/airtable';
import { extractTwilioPhoneNumber } from '../../utils/phone-formatter';
import { logger } from '../../lib/logger';
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
      
      return {
        newState,
        result: {
          twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-AU-Wavenet-A">Hi ${employeeName}.</Say>
  <Redirect>/api/twilio/voice</Redirect>
</Response>`,
          action: 'phone_auth_success',
          shouldDeleteState: false,
          logData: {
            phase: state.phase,
            action: 'phone_auth_success',
            employeeId: authResult.employee.id,
            employeeName: authResult.employee.name,
            authMethod: 'phone',
            duration
          }
        }
      };

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

      return {
        newState,
        result: {
          twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" timeout="10" finishOnKey="#">
    <Say voice="Google.en-AU-Wavenet-A">Welcome. I don't recognize your phone number. Please use your keypad to enter your employee PIN followed by the pound key.</Say>
  </Gather>
  <Say voice="Google.en-AU-Wavenet-A">I didn't receive your PIN. Please try again.</Say>
  <Redirect>/api/twilio/voice</Redirect>
</Response>`,
          action: 'phone_auth_failed',
          shouldDeleteState: false,
          logData: {
            phase: state.phase,
            action: 'phone_auth_failed',
            callerPhone,
            authMethod: 'phone_failed',
            duration,
            error: authResult.error
          }
        }
      };
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
