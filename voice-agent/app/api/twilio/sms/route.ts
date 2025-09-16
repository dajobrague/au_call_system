/**
 * Twilio SMS Webhook Handler
 * Handles incoming SMS responses for job assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioRequest } from '../../../../src/security/twilio-signature';
import { logger } from '../../../../src/lib/logger';

// Set runtime to nodejs for compatibility
export const runtime = 'nodejs';

/**
 * Handle incoming SMS messages
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse form data
    const formData = await request.formData();
    const body = new URLSearchParams();
    
    // Convert FormData to URLSearchParams for validation
    const entries = Array.from(formData.entries());
    for (const [key, value] of entries) {
      if (typeof value === 'string') {
        body.append(key, value);
      }
    }

    // Validate Twilio signature (bypass in development)
    const webhookUrl = new URL(request.url);
    const isDevelopment = webhookUrl.hostname === 'localhost' || webhookUrl.hostname === '127.0.0.1';
    
    if (!isDevelopment) {
      const validationResult = validateTwilioRequest(
        request.headers,
        webhookUrl.protocol + '//' + webhookUrl.host + webhookUrl.pathname,
        body,
        process.env.TWILIO_AUTH_TOKEN || ''
      );
      
      if (!validationResult.isValid) {
        logger.error('Invalid Twilio SMS signature', {
          reason: validationResult.reason || 'Invalid signature',
          type: 'sms_webhook_security_error'
        });
        
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      logger.info('Development mode - bypassing SMS signature validation', {
        hostname: webhookUrl.hostname,
        type: 'sms_webhook_dev_bypass'
      });
    }

    // Extract SMS data
    const from = body.get('From') || '';
    const to = body.get('To') || '';
    const messageBody = (body.get('Body') || '').trim().toUpperCase();
    const messageSid = body.get('MessageSid') || '';
    const smsStatus = body.get('SmsStatus') || '';

    logger.info('SMS webhook received', {
      from,
      to: to.replace(/\d(?=\d{4})/g, '*'), // Mask phone number
      messageBody,
      messageSid,
      smsStatus,
      type: 'sms_webhook_received'
    });

    // Check if this is a "YES" response for job acceptance
    if (messageBody === 'YES') {
      logger.info('Job acceptance SMS received', {
        from,
        messageSid,
        type: 'job_acceptance_received'
      });

      try {
        // For now, just log the job acceptance - full assignment logic will be implemented later
        const duration = Date.now() - startTime;
        
        logger.info('Job acceptance SMS received - processing not yet implemented', {
          from,
          messageSid,
          messageBody,
          duration,
          type: 'job_acceptance_logged'
        });
        
        // TODO: Implement job assignment logic
        // 1. Find employee by phone number
        // 2. Find open jobs for their provider
        // 3. Assign first available job
        // 4. Send confirmation SMS
        
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error('Job acceptance processing error', {
          from,
          messageSid,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
          type: 'job_acceptance_error'
        });
      }
    } else {
      // Not a job acceptance - just log
      logger.info('Non-job SMS received', {
        from,
        messageBody,
        type: 'non_job_sms'
      });
    }

    // Return empty TwiML (no response needed for SMS)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('SMS webhook error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      type: 'sms_webhook_error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests (not supported)
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
