/**
 * WebSocket Server
 * Main WebSocket server setup and request handling
 */

import { WebSocketServer } from 'ws';
import express, { Request, Response } from 'express';
import http from 'http';
import url from 'url';
import { handleWebSocketMessage, MessageHandlers } from './message-handler';
import {
  handleConnectionOpen,
  handleConnectionClose,
  handleConnectionError,
  saveCallState,
  loadCallState,
  WebSocketWithExtensions
} from './connection-handler';
import { routeDTMFInput } from './dtmf-router';
import { authenticateByPhone, prefetchBackgroundData } from '../handlers/authentication-handler';
import { generateSingleProviderGreeting, generateMultiProviderGreeting, generateOccurrenceBasedGreeting } from '../handlers/provider-handler';
import { generateSpeech, streamAudioToTwilio, stopCurrentAudio } from '../services/elevenlabs';
import { startCallRecording } from '../services/twilio/call-recorder';
import { twilioConfig } from '../config/twilio';
import { logger } from '../lib/logger';
import { initializeDisclaimerCache, playDisclaimerFromCache } from '../audio/disclaimer-cache';

// Use require for twilio to avoid TypeScript import issues
const twilio = require('twilio');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'aEO01A4wXwd1O8GPgGlF';

/**
 * Create and configure WebSocket server
 * @param port - Port to listen on
 * @param expressApp - Optional Express app with HTTP routes (if not provided, creates a new one)
 */
export function createWebSocketServer(port: number = 3001, expressApp?: express.Application): { app: express.Application; server: http.Server; wss: WebSocketServer } {
  // Use provided Express app or create a new one
  const app = expressApp || express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ 
    server,
    path: '/stream'  // Explicitly handle /stream path
  });

  // Pre-generate disclaimer audio for instant playback
  initializeDisclaimerCache().catch(error => {
    logger.error('Failed to initialize disclaimer cache', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'disclaimer_init_error'
    });
  });

  // Health check endpoint (only add if not using custom app)
  if (!expressApp) {
    app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  // Log all incoming HTTP requests for debugging
  server.on('request', (req, res) => {
    const isWebSocketUpgrade = req.headers.upgrade === 'websocket';
    logger.info('HTTP Request received', {
      method: req.method,
      url: req.url,
      headers: {
        upgrade: req.headers.upgrade,
        connection: req.headers.connection,
        userAgent: req.headers['user-agent']
      },
      isWebSocketUpgrade,
      type: 'http_request'
    });
  });

  // WebSocket connection handler
  wss.on('connection', (ws: WebSocketWithExtensions, req: http.IncomingMessage) => {
    const parsedUrl = url.parse(req.url || '', true);
    // Extract phone from URL parameters (sent by Vercel)
    const from = parsedUrl.query.phone as string || parsedUrl.query.from as string || 'Unknown';

    // DEEP DEBUG: Log URL parsing details
    logger.info('🔍 DEEP DEBUG: New WebSocket connection', {
      rawUrl: req.url,
      parsedQuery: parsedUrl.query,
      phoneParam: parsedUrl.query.phone,
      fromParam: parsedUrl.query.from,
      extractedFrom: from,
      fromLength: from.length,
      fromCharCodes: Array.from(from).map(c => c.charCodeAt(0)),
      type: 'ws_new_connection_debug'
    });

    handleConnectionOpen(ws);

    // Helper function to generate and speak text
    const generateAndSpeak = async (text: string): Promise<void> => {
      if (!ws.streamSid) {
        logger.error('Cannot speak - no streamSid', { type: 'speak_error' });
        return;
      }

      // Stop any currently playing audio (prevents overlapping speech)
      stopCurrentAudio(ws as any);

      const result = await generateSpeech(text, {
        apiKey: ELEVENLABS_API_KEY,
        voiceId: ELEVENLABS_VOICE_ID
      });

      if (result.success && result.frames) {
        await streamAudioToTwilio(ws as any, result.frames, ws.streamSid);
      }
    };

    // Message handlers
    const handlers: MessageHandlers = {
      onStart: async (message) => {
        if (!message.start) return;

        ws.streamSid = message.start.streamSid;
        ws.callSid = message.start.callSid; // This IS the parent CallSid from Twilio
        
        // Extract parent CallSid from custom parameters (for backwards compatibility)
        // Note: Twilio's message.start.callSid IS already the parent call's CallSid
        // The custom parameter is just for explicit tracking
        ws.parentCallSid = (message.start.customParameters as any)?.parentCallSid || 
                           (message.start.customParameters as any)?.callSid || 
                           ws.callSid;

        // Extract phone from Twilio's customParameters (set via <Parameter> in TwiML)
        let callerPhone = (message.start.customParameters as any)?.phone || message.start.customParameters?.from || from;

        // DEEP DEBUG: Log parameter extraction
        logger.info('🔍 DEEP DEBUG: Start message received', {
          callSid: ws.callSid,
          parentCallSid: ws.parentCallSid,
          customParameters: message.start.customParameters,
          extractedPhone: callerPhone,
          fallbackFrom: from,
          type: 'start_message_debug'
        });

        logger.info('Call started', {
          callSid: ws.callSid,
          parentCallSid: ws.parentCallSid,
          streamSid: ws.streamSid,
          from: callerPhone,
          type: 'call_start'
        });

        // Initialize call logging
        ws.callEvents = [];
        ws.callStartTime = new Date();

        // Start call recording immediately (runs in parallel)
        // Use parentCallSid for REST API operations
        startCallRecording({
          callSid: ws.parentCallSid!,
          recordingChannels: 'dual', // Records both inbound and outbound audio
          trim: 'do-not-trim'
        }).then((result) => {
          if (result.success) {
            logger.info('Call recording started successfully', {
              callSid: ws.callSid,
              parentCallSid: ws.parentCallSid,
              recordingSid: result.recordingSid,
              type: 'recording_success'
            });
            // Store recording SID on WebSocket for later reference
            ws.recordingSid = result.recordingSid;
            ws.cachedData = {
              ...ws.cachedData,
              recordingSid: result.recordingSid
            };
          } else {
            logger.error('Failed to start call recording', {
              callSid: ws.callSid,
              parentCallSid: ws.parentCallSid,
              error: result.error,
              type: 'recording_failure'
            });
          }
        }).catch((error) => {
          logger.error('Call recording error', {
            callSid: ws.callSid,
            parentCallSid: ws.parentCallSid,
            error: error instanceof Error ? error.message : 'Unknown error',
            type: 'recording_error'
          });
        });

        // Start authentication immediately in parallel (don't wait for disclaimer)
        const authPromise = (async () => {
          try {
            // If no phone in URL, use Twilio API as fallback
            if (!callerPhone || callerPhone === 'Unknown' || callerPhone.length < 10) {
              logger.info('No valid phone in URL, using Twilio API fallback', {
                callSid: ws.callSid,
                urlPhone: callerPhone,
                type: 'phone_fallback'
              });
              
              try {
                const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);
                const call = await twilioClient.calls(ws.parentCallSid!).fetch();
                callerPhone = call.from;
                
                logger.info('Fetched caller phone from Twilio API', {
                  callSid: ws.callSid,
                  parentCallSid: ws.parentCallSid,
                  phone: callerPhone,
                  type: 'phone_fallback_success'
                });
              } catch (error) {
                logger.error('Failed to fetch call details from Twilio', {
                  callSid: ws.callSid,
                  parentCallSid: ws.parentCallSid,
                  error: error instanceof Error ? error.message : 'Unknown error',
                  type: 'phone_fallback_error'
                });
                callerPhone = 'Unknown';
              }
            } else {
              logger.info('Phone number available from URL', {
                callSid: ws.callSid,
                phone: callerPhone,
                type: 'phone_from_url'
              });
            }

            return await authenticateByPhone(callerPhone);
          } catch (error) {
            logger.error('Authentication error', {
              error: error instanceof Error ? error.message : 'Unknown error',
              type: 'auth_error'
            });
            return { success: false, error: 'Authentication failed' };
          }
        })();

        // Play pre-cached disclaimer instantly while authentication happens in background
        await playDisclaimerFromCache(ws, ws.streamSid!);

        // Wait for authentication to complete
        const authResult = await authPromise;

        if (!authResult.success || !authResult.employee) {
          // Track auth failure
          if (ws.callEvents) {
            const { trackCallEvent } = require('../services/airtable/call-log-service');
            trackCallEvent(ws.callEvents, 'authentication', 'phone_auth_failed', {
              phone: callerPhone
            });
          }
          
          // Fall back to PIN authentication instead of hanging up
          logger.info('Phone auth failed, falling back to PIN', {
            callSid: ws.callSid,
            phone: callerPhone,
            type: 'phone_auth_fallback_to_pin'
          });
          
          // Create call state for PIN authentication phase
          const pinAuthState = {
            sid: ws.callSid!,
            parentCallSid: ws.parentCallSid!,
            from: callerPhone,
            phase: 'pin_auth',
            authMethod: 'pin_pending',
            pinBuffer: '', // Will collect PIN digits here
            attempts: {
              clientId: 0, // Used for PIN attempts
              confirmClientId: 0,
              jobNumber: 0,
              confirmJobNumber: 0,
              jobOptions: 0,
              occurrenceSelection: 0
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await saveCallState(ws, pinAuthState);
          
          await generateAndSpeak('I could not find your phone number in our system. Please use your keypad to enter your employee PIN followed by the pound key.');
          
          return;
        }

        // Track successful authentication
        if (ws.callEvents) {
          const { trackCallEvent } = require('../services/airtable/call-log-service');
          trackCallEvent(ws.callEvents, 'authentication', 'phone_auth_success', {
            employeeId: authResult.employee.id,
            employeeName: authResult.employee.name,
            phone: callerPhone
          });
        }

        // Create initial call state
        const callState = {
          sid: ws.callSid!,
          parentCallSid: ws.parentCallSid!,
          from: callerPhone,
          phase: 'provider_selection',
          employee: authResult.employee,
          provider: authResult.provider,
          authMethod: 'phone',
          attempts: {
            clientId: 0,
            confirmClientId: 0,
            jobNumber: 0,
            confirmJobNumber: 0,
            jobOptions: 0,
            occurrenceSelection: 0
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await saveCallState(ws, callState);

        // Prefetch background data
        const backgroundData = await prefetchBackgroundData(authResult.employee);
        ws.cachedData = {
          ...ws.cachedData,
          ...backgroundData
        };

        // Determine provider ID for call log
        let providerId = authResult.provider?.id;
        if (!providerId && backgroundData.providers?.providers?.length > 0) {
          // For single provider or first provider in multi-provider scenario
          providerId = backgroundData.providers.providers[0].id;
        }

        logger.info('Provider ID for call log', {
          callSid: ws.callSid,
          providerId,
          fromAuth: authResult.provider?.id,
          fromBackground: backgroundData.providers?.providers?.[0]?.id,
          type: 'call_log_provider_check'
        });

        // Create initial call log record in Airtable
        const { createCallLog } = require('../services/airtable/call-log-service');
        const startedAt = ws.callStartTime!.toLocaleString('en-AU', {
          timeZone: 'Australia/Sydney',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });

        const callLogResult = await createCallLog({
          callSid: ws.callSid!,
          employeeId: authResult.employee.id,
          providerId: providerId,
          direction: 'Inbound',
          startedAt
        });

        if (callLogResult.success && callLogResult.recordId) {
          ws.callLogRecordId = callLogResult.recordId;
          logger.info('Call log record created', {
            callSid: ws.callSid,
            recordId: callLogResult.recordId,
            type: 'call_log_initialized'
          });
        } else {
          logger.error('Failed to create call log record', {
            callSid: ws.callSid,
            error: callLogResult.error,
            type: 'call_log_create_failed'
          });
        }

        // Generate greeting based on provider count
        const providerResult = backgroundData.providers;
        const employeeJobs = backgroundData.employeeJobs || [];
        const enrichedOccurrences = backgroundData.enrichedOccurrences || [];

        // NEW FLOW: Use occurrence-based greeting (shows shifts immediately)
        if (!providerResult?.hasMultipleProviders) {
          // Single provider - show occurrence list directly
          const provider = providerResult?.providers?.[0];
          const greeting = generateOccurrenceBasedGreeting(
            authResult.employee,
            provider,
            enrichedOccurrences,
            1  // Start at page 1
          );

          if (greeting.shouldPresentJobs) {
            // Update state with occurrence list (skip job_selection phase)
            const updatedState = {
              ...callState,
              phase: 'occurrence_selection',
              provider: provider ? {
                id: provider.id,
                name: provider.name,
                greeting: provider.greeting
              } : null,
              enrichedOccurrences: enrichedOccurrences,
              currentPage: 1
            };

            await saveCallState(ws, updatedState);
          } else {
            // Update state to allow DTMF input (press 1 for representative)
            const updatedState = {
              ...callState,
              phase: 'no_occurrences_found',
              provider: provider ? {
                id: provider.id,
                name: provider.name,
                greeting: provider.greeting
              } : null,
              enrichedOccurrences: enrichedOccurrences,
              updatedAt: new Date().toISOString()
            };
            await saveCallState(ws, updatedState);
            
            logger.info('No shifts found - state updated for representative transfer', {
              callSid: ws.callSid,
              phase: 'no_occurrences_found',
              hasEmployee: !!updatedState.employee,
              hasProvider: !!updatedState.provider,
              type: 'no_shifts_state_saved'
            });
          }

          await generateAndSpeak(greeting.message);
        } else {
          // Multiple providers - still need provider selection first
          const greeting = generateMultiProviderGreeting(
            authResult.employee,
            providerResult.providers
          );

          // Update state with available providers
          const updatedState = {
            ...callState,
            availableProviders: providerResult.providers.map((p: any, index: number) => ({
              ...p,
              selectionNumber: index + 1
            })),
            enrichedOccurrences: enrichedOccurrences  // Store for later use
          };

          await saveCallState(ws, updatedState);
          await generateAndSpeak(greeting);
        }
        
        // OLD FLOW (commented out for reference - job-based greeting):
        /*
        if (!providerResult?.hasMultipleProviders) {
          const provider = providerResult?.providers?.[0];
          const greeting = generateSingleProviderGreeting({
            employee: authResult.employee,
            provider,
            employeeJobs,
            hasMultipleProviders: false
          });

          if (greeting.shouldPresentJobs) {
            const updatedState = {
              ...callState,
              phase: 'job_selection',
              provider: provider ? {
                id: provider.id,
                name: provider.name,
                greeting: provider.greeting
              } : null,
              employeeJobs: employeeJobs.map((job: any, index: number) => ({
                ...job,
                index: index + 1
              }))
            };

            await saveCallState(ws, updatedState);
          }

          await generateAndSpeak(greeting.message);
        }
        */
      },

      onMedia: async () => {
        // Media frames - no action needed
      },

      onDtmf: async (message) => {
        if (!message.dtmf || !ws.callSid) return;

        const digit = message.dtmf.digit;
        
        logger.info('DTMF input received', {
          callSid: ws.callSid,
          digit,
          type: 'dtmf_received'
        });
        
        const callState = await loadCallState(ws, ws.callSid);

        if (!callState) {
          logger.error('No call state found for DTMF', {
            callSid: ws.callSid,
            digit,
            type: 'dtmf_no_state'
          });
          return;
        }
        
        logger.info('Call state loaded for DTMF', {
          callSid: ws.callSid,
          digit,
          phase: callState.phase,
          hasEmployee: !!callState.employee,
          hasProvider: !!callState.provider,
          type: 'dtmf_state_loaded'
        });

        // Route DTMF to appropriate handler
        await routeDTMFInput({
          ws,
          callState,
          digit,
          streamSid: ws.streamSid!,
          generateAndSpeak,
          saveState: (state) => saveCallState(ws, state)
        });
      },

      onStop: async (message) => {
        // Don't close WebSocket if we're in a conference (agent transfer)
        // The WebSocket must stay open to continue recording the conversation
        if (ws.inConference) {
          logger.info('Stream stop received but WebSocket staying open for conference', {
            callSid: ws.callSid,
            conferenceName: ws.conferenceName,
            type: 'ws_stop_ignored_conference'
          });
          return;
        }
        
        // Normal call end - close connection
        await handleConnectionClose(ws, 1000, Buffer.from('Stream stopped'));
      }
    };

    // Handle incoming messages
    ws.on('message', async (data: string) => {
      await handleWebSocketMessage(data, ws, handlers);
    });

    // Handle connection close
    ws.on('close', async (code, reason) => {
      await handleConnectionClose(ws, code, reason);
    });

    // Handle errors
    ws.on('error', (error) => {
      handleConnectionError(ws, error);
    });
  });

  // Log WebSocket server errors
  wss.on('error', (error) => {
    logger.error('WebSocket server error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: 'wss_server_error'
    });
  });

  return { app, server, wss };
}
