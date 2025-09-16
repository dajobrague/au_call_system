/**
 * Input normalization and processing utilities
 * Handles Twilio webhook input normalization
 */

import type { TwilioWebhookData, InputSource } from '../types';

/**
 * Normalize input from Twilio webhook
 */
export function normalizeInput(webhookData: TwilioWebhookData): { input: string; source: InputSource } {
  const speechResult = webhookData.SpeechResult?.trim() || '';
  const digits = webhookData.Digits?.trim() || '';
  
  if (speechResult) {
    return { input: speechResult, source: 'speech' };
  }
  
  if (digits) {
    return { input: digits, source: 'dtmf' };
  }
  
  return { input: '', source: 'none' };
}
