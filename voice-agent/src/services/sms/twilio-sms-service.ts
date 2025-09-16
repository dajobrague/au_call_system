/**
 * Twilio SMS Service
 * Handles SMS sending and response processing using Twilio REST API
 */

import https from 'https';
import { twilioConfig, SMS_CONFIG } from '../../config/twilio';
import { logger } from '../../lib/logger';

/**
 * SMS sending result
 */
export interface SMSResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  to: string;
}

/**
 * SMS response tracking
 */
export interface SMSResponseTracker {
  messageSid: string;
  occurrenceId: string;
  employeeId: string;
  sentAt: string;
  status: 'sent' | 'delivered' | 'responded' | 'failed';
}

/**
 * Twilio SMS Service Class
 */
export class TwilioSMSService {
  /**
   * Send SMS using Twilio REST API
   */
  async sendSMS(
    to: string,
    message: string,
    context?: { occurrenceId?: string; employeeId?: string; [key: string]: any }
  ): Promise<SMSResult> {
    const startTime = Date.now();
    
    logger.info('Sending SMS via Twilio', {
      to,
      messageLength: message.length,
      context,
      type: 'sms_send_start'
    });

    try {
      // Prepare Twilio API request
      const postData = new URLSearchParams({
        From: twilioConfig.phoneNumber,
        To: to,
        Body: message,
        MessagingServiceSid: twilioConfig.messagingSid
      }).toString();

      const result = await this.makeTwilioRequest('/2010-04-01/Accounts/' + twilioConfig.accountSid + '/Messages.json', postData);
      
      const duration = Date.now() - startTime;
      
      if (result.success && result.data.sid) {
        logger.info('SMS sent successfully', {
          to,
          messageSid: result.data.sid,
          status: result.data.status,
          duration,
          context,
          type: 'sms_send_success'
        });
        
        return {
          success: true,
          messageSid: result.data.sid,
          to
        };
      } else {
        logger.error('SMS send failed', {
          to,
          error: result.error || 'Unknown error',
          duration,
          context,
          type: 'sms_send_failed'
        });
        
        return {
          success: false,
          error: result.error || 'Failed to send SMS',
          to
        };
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('SMS send error', {
        to,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        context,
        type: 'sms_send_error'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS send error',
        to
      };
    }
  }

  /**
   * Send job availability SMS to multiple employees
   */
  async sendJobAvailabilityNotifications(
    employees: Array<{ id: string; name: string; phone: string }>,
    jobMessage: string,
    occurrenceId: string
  ): Promise<{ 
    success: boolean; 
    results: SMSResult[]; 
    successCount: number; 
    failureCount: number 
  }> {
    const startTime = Date.now();
    
    logger.info('Sending job availability notifications', {
      employeeCount: employees.length,
      occurrenceId,
      messageLength: jobMessage.length,
      type: 'job_sms_batch_start'
    });

    // Send SMS to all employees in parallel
    const smsPromises = employees.map(employee => 
      this.sendSMS(
        employee.phone,
        jobMessage,
        { occurrenceId, employeeId: employee.id }
      )
    );

    try {
      const results = await Promise.all(smsPromises);
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      const duration = Date.now() - startTime;
      
      logger.info('Job availability notifications complete', {
        totalEmployees: employees.length,
        successCount,
        failureCount,
        occurrenceId,
        duration,
        type: 'job_sms_batch_complete'
      });
      
      return {
        success: failureCount === 0,
        results,
        successCount,
        failureCount
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Job availability notifications error', {
        employeeCount: employees.length,
        occurrenceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'job_sms_batch_error'
      });
      
      return {
        success: false,
        results: [],
        successCount: 0,
        failureCount: employees.length
      };
    }
  }

  /**
   * Make Twilio REST API request
   */
  private makeTwilioRequest(path: string, postData: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString('base64');
      
      const options = {
        hostname: 'api.twilio.com',
        port: 443,
        path,
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'VoiceAgent/1.0',
        },
        timeout: SMS_CONFIG.timeout,
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            
            if (res.statusCode && res.statusCode >= 400) {
              resolve({
                success: false,
                error: jsonData.message || `HTTP ${res.statusCode}`,
                data: jsonData
              });
            } else {
              resolve({
                success: true,
                data: jsonData
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse response: ${parseError}`
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Health check for SMS service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    try {
      // Test Twilio credentials by making a simple API call
      const testResult = await this.makeTwilioRequest(
        '/2010-04-01/Accounts/' + twilioConfig.accountSid + '.json',
        ''
      );
      
      if (testResult.success) {
        return {
          healthy: true,
          message: 'Twilio SMS service healthy',
          details: {
            accountSid: twilioConfig.accountSid,
            messagingSid: twilioConfig.messagingSid,
            phoneNumber: twilioConfig.phoneNumber
          }
        };
      } else {
        return {
          healthy: false,
          message: 'Twilio SMS service connection failed',
          details: {
            error: testResult.error
          }
        };
      }
      
    } catch (error) {
      return {
        healthy: false,
        message: 'Twilio SMS service health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// Export singleton instance
export const twilioSMSService = new TwilioSMSService();
