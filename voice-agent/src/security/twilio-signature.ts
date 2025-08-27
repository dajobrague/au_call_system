/**
 * Twilio webhook signature validation
 * Validates X-Twilio-Signature header to prevent spoofed requests
 */

import { createHmac } from 'crypto';

/**
 * Validates Twilio webhook signature using HMAC-SHA1
 * Following Twilio's exact specification:
 * 1. Take the full URL
 * 2. Append POST parameters in alphabetical order by parameter name
 * 3. Hash with HMAC-SHA1 using auth token
 * 4. Base64 encode and compare
 * 
 * @param signature - X-Twilio-Signature header value
 * @param url - Full webhook URL (including query params)
 * @param formParams - URLSearchParams object with POST parameters
 * @param authToken - Twilio auth token
 * @returns true if signature is valid, false otherwise
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  formParams: URLSearchParams,
  authToken: string
): boolean {
  try {
    // Start with the full URL
    let signatureString = url;
    
    // Get all parameter names and sort them alphabetically
    const paramNames = Array.from(formParams.keys()).sort();
    
    // Append each parameter name + value (no separators)
    for (const paramName of paramNames) {
      const paramValue = formParams.get(paramName) || '';
      signatureString += paramName + paramValue;
    }
    
    console.log('Signature validation debug:', {
      url,
      paramNames,
      signatureString: signatureString.substring(0, 200) + '...',
      signatureStringLength: signatureString.length
    });
    
    // Create HMAC-SHA1 hash using auth token
    const hmac = createHmac('sha1', authToken);
    hmac.update(signatureString);
    const expectedSignature = hmac.digest('base64');
    
    console.log('Signature comparison:', {
      expected: expectedSignature,
      received: signature,
      match: signature === expectedSignature
    });
    
    // Compare signatures
    return signature === expectedSignature;
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
}

/**
 * Extracts and validates Twilio signature from request headers
 * @param headers - Request headers
 * @param url - Full webhook URL
 * @param formParams - URLSearchParams with POST parameters
 * @param authToken - Twilio auth token
 * @returns validation result with details
 */
export function validateTwilioRequest(
  headers: Headers,
  url: string,
  formParams: URLSearchParams,
  authToken: string
): { isValid: boolean; reason?: string } {
  const signature = headers.get('X-Twilio-Signature');
  
  if (!signature) {
    return { isValid: false, reason: 'Missing X-Twilio-Signature header' };
  }
  
  if (!authToken) {
    return { isValid: false, reason: 'Missing Twilio auth token' };
  }
  
  const isValid = validateTwilioSignature(signature, url, formParams, authToken);
  
  return {
    isValid,
    reason: isValid ? undefined : 'Invalid signature'
  };
}
