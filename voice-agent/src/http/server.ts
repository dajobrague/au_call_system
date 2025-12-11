/**
 * HTTP Server
 * Handles HTTP endpoints for Twilio callbacks
 */

import express, { Request, Response } from 'express';
import { logger } from '../lib/logger';
import { loadCallState, saveCallState } from '../fsm/state/state-manager';

const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

const REPRESENTATIVE_PHONE = process.env.REPRESENTATIVE_PHONE || '+61490550941';
const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || 'aucallsystem-ivr-system.up.railway.app';
const APP_BASE_URL = `https://${RAILWAY_PUBLIC_DOMAIN}`;

/**
 * Create Express app with HTTP routes
 */
export function createHttpRoutes(): express.Application {
  const app = express();
  
  // Parse URL-encoded bodies (for Twilio form data)
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  /**
   * POST /api/transfer/after-connect
   * Called by Twilio when <Connect><Stream> ends
   */
  app.post('/api/transfer/after-connect', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    // Dynamic URL construction
    const host = req.headers['host'] || process.env.RAILWAY_PUBLIC_DOMAIN || 'aucallsystem-ivr-system.up.railway.app';
    const protocol = host.includes('localhost') || host.includes('ngrok') ? 'http' : 'https';
    const APP_BASE_URL = `${protocol}://${host}`;
    
    try {
      const callSid = req.body.CallSid as string;
      const from = req.body.From as string;
      const callStatus = req.body.CallStatus as string;

      logger.info('After-connect handler called', {
        callSid,
        from,
        callStatus,
        type: 'after_connect_start'
      });

      const twiml = new VoiceResponse();

      if (!callSid) {
        logger.error('Missing CallSid in after-connect request', {
          type: 'after_connect_missing_callsid'
        });
        twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Goodbye.');
        twiml.hangup();
        return res.type('text/xml').send(twiml.toString());
      }

      // Load call state to check for pending transfer
      const callState = await loadCallState(callSid);

      if (callState && callState.pendingTransfer) {
        logger.info('Pending transfer found - generating Dial TwiML', {
          callSid,
          representativePhone: callState.pendingTransfer.representativePhone,
          type: 'after_connect_transfer_found'
        });

        // Store representative phone before clearing state
        const representativePhone = callState.pendingTransfer.representativePhone;
        const callerPhone = callState.pendingTransfer.callerPhone;
        
        // Generate TwiML for transfer with Dial
        twiml.say({ voice: 'Polly.Amy' }, 'Connecting you to a representative. Please hold.');
        
        const dial = twiml.dial({
          callerId: callerPhone,
          timeout: 30,
          record: 'record-from-answer',
          action: `${APP_BASE_URL}/api/queue/transfer-status?callSid=${callSid}&from=${encodeURIComponent(from)}`
        });
        
        dial.number(representativePhone);

        // Fallback if representative doesn't answer
        twiml.say({ voice: 'Polly.Amy' }, 'The representative is not available. You will be placed in the queue.');
        twiml.redirect(`${APP_BASE_URL}/api/queue/enqueue-caller?callSid=${callSid}&from=${encodeURIComponent(from)}`);

        // Clear the pending transfer flag
        callState.pendingTransfer = undefined;
        await saveCallState(callState);

        logger.info('Dial TwiML generated for transfer', {
          callSid,
          representativePhone,
          duration: Date.now() - startTime,
          type: 'after_connect_dial_twiml'
        });

      } else {
        // No pending transfer - normal call end
        logger.info('No pending transfer - ending call', {
          callSid,
          type: 'after_connect_normal_end'
        });
        
        twiml.say({ voice: 'Polly.Amy' }, 'Thank you for calling. Goodbye.');
        twiml.hangup();
      }

      const duration = Date.now() - startTime;
      logger.info('After-connect handler complete', {
        callSid,
        duration,
        type: 'after_connect_complete'
      });

      return res.type('text/xml').send(twiml.toString());

    } catch (error) {
      logger.error('Error in after-connect handler', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: 'after_connect_error'
      });

      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please try again later.');
      twiml.hangup();

      return res.type('text/xml').send(twiml.toString());
    }
  });

  /**
   * GET /health
   * Health check endpoint
   */
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'voice-agent-railway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  /**
   * GET /api/health
   * Alternative health check endpoint
   */
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'voice-agent-railway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  return app;
}

