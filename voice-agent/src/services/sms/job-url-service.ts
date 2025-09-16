/**
 * Job URL Service
 * Generates secure URLs for job acceptance
 */

import crypto from 'crypto';
import { logger } from '../../lib/logger';

/**
 * Generate secure job acceptance URL
 */
export function generateJobAcceptanceURL(
  jobOccurrenceId: string,
  employeeId: string,
  baseUrl: string = 'https://sam-voice-agent.vercel.app'
): { url: string } {
  
  // Build simple URL with just job ID and employee ID
  const url = `${baseUrl}/job/${jobOccurrenceId}?emp=${employeeId}`;
  
  logger.info('Job acceptance URL generated', {
    jobOccurrenceId,
    employeeId,
    urlLength: url.length,
    type: 'job_url_generated'
  });
  
  return { url };
}

/**
 * Generate secure token for job acceptance
 */
function generateSecureToken(jobOccurrenceId: string, employeeId: string): string {
  // Create a secure token using job ID + employee ID + timestamp + secret
  const secret = process.env.JOB_URL_SECRET || 'healthcare-voice-agent-secret';
  const timestamp = Date.now().toString();
  const data = `${jobOccurrenceId}:${employeeId}:${timestamp}`;
  
  // Create HMAC hash
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data);
  const hash = hmac.digest('hex');
  
  // Combine timestamp and hash for validation
  const token = `${timestamp}.${hash.substring(0, 16)}`;
  
  return token;
}

/**
 * Validate security token
 */
export function validateJobAcceptanceToken(
  token: string,
  jobOccurrenceId: string,
  employeeId: string
): { valid: boolean; expired?: boolean; error?: string } {
  
  try {
    const [timestampStr, providedHash] = token.split('.');
    
    if (!timestampStr || !providedHash) {
      return { valid: false, error: 'Invalid token format' };
    }
    
    const timestamp = parseInt(timestampStr, 10);
    
    if (isNaN(timestamp)) {
      return { valid: false, error: 'Invalid timestamp' };
    }
    
    // Check if token is expired (24 hours)
    const now = Date.now();
    const tokenAge = now - timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      return { valid: false, expired: true, error: 'Token expired' };
    }
    
    // Regenerate hash and compare
    const secret = process.env.JOB_URL_SECRET || 'healthcare-voice-agent-secret';
    const data = `${jobOccurrenceId}:${employeeId}:${timestampStr}`;
    
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    const expectedHash = hmac.digest('hex').substring(0, 16);
    
    if (providedHash !== expectedHash) {
      return { valid: false, error: 'Invalid token signature' };
    }
    
    return { valid: true };
    
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Token validation error' 
    };
  }
}

/**
 * Shorten URL using a simple approach
 * TODO: Integrate with Twilio's URL shortening service
 */
export async function shortenJobURL(longUrl: string): Promise<string> {
  // For now, return the original URL
  // TODO: Integrate with Twilio URL shortening API
  
  logger.info('URL shortening requested', {
    originalLength: longUrl.length,
    type: 'url_shortening_requested'
  });
  
  // Mock shortened URL for now
  const mockShortUrl = longUrl.replace('https://sam-voice-agent.vercel.app/job/', 'https://sam-voice-agent.vercel.app/j/');
  
  return mockShortUrl;
}

/**
 * Generate complete SMS with job acceptance URL
 */
export async function generateJobSMSWithURL(
  jobDetails: {
    title: string;
    patientName: string;
    displayDate: string;
    address: string;
    reason: string;
    serviceType: string;
  },
  jobOccurrenceId: string,
  employeeId: string
): Promise<string> {
  
  // Generate simple URL without token
  const { url } = generateJobAcceptanceURL(jobOccurrenceId, employeeId);
  
  // Shorten URL
  const shortUrl = await shortenJobURL(url);
  
  // Generate SMS content with URL
  const smsContent = `JOB AVAILABLE: ${jobDetails.title} for ${jobDetails.patientName} on ${jobDetails.displayDate} at ${jobDetails.address}. ` +
    `Reason: ${jobDetails.reason}. ` +
    `View details and respond: ${shortUrl} - ${jobDetails.serviceType} Services`;
  
  logger.info('Job SMS with URL generated', {
    jobOccurrenceId,
    employeeId,
    smsLength: smsContent.length,
    urlLength: shortUrl.length,
    type: 'job_sms_url_generated'
  });
  
  return smsContent;
}
