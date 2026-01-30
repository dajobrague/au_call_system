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
import { twilioConfig } from '../config/twilio';
import { logger } from '../lib/logger';
import { initializeDisclaimerCache, playDisclaimerFromCache } from '../audio/disclaimer-cache';
import { 
  publishCallStarted, 
  publishCallAuthenticated, 
  publishAuthenticationFailed,
  publishCallEnded 
} from '../services/redis/call-event-publisher';

// Use require for twilio to avoid TypeScript import issues
const twilio = require('twilio');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'aEO01A4wXwd1O8GPgGlF';

/**
 * Handle outbound call WebSocket connection
 * For outbound calls, we skip authentication and immediately play job offer
 */
async function handleOutboundCall(ws: WebSocketWithExtensions, customParams: any): Promise<void> {
  logger.info('🚨🚨🚨 HANDLE OUTBOUND CALL ENTERED 🚨🚨🚨', {
    callSid: ws.callSid,
    streamSid: ws.streamSid,
    rawParams: JSON.stringify(customParams),
    type: 'outbound_handler_entry'
  });
  
  const { callId, occurrenceId, employeeId, round } = customParams || {};
  
  logger.info('Handling outbound call via WebSocket', {
    callSid: ws.callSid,
    callId,
    occurrenceId,
    employeeId,
    round,
    type: 'outbound_call_websocket_start'
  });
  
  // Initialize call logging
  ws.callEvents = [];
  ws.callStartTime = new Date();
  
  try {
    // Fetch job details from Airtable
    const { airtableClient } = await import('../services/airtable/client');
    const job = await airtableClient.getJobOccurrenceById(occurrenceId);
    
    if (!job) {
      logger.error('Job not found for outbound call', {
        occurrenceId,
        type: 'outbound_job_not_found'
      });
      await generateAndSpeakOutbound(ws, 'Sorry, there was an error loading the job details. Goodbye.');
      return;
    }
    
    // Get employee details
    const employee = await airtableClient.getEmployeeById(employeeId);
    const employeeName = employee?.fields['Display Name']?.split(' ')[0] || 'there';
    
    // Get job details
    const patientName = job.fields['Patient TXT'] || 'the patient';
    const displayDate = job.fields['Display Date'] || job.fields['Scheduled At'] || 'today';
    const startTime = job.fields['Time'] || 'soon';
    const providerId = job.fields['Provider']?.[0] || '';
    
    logger.info('Outbound call details loaded', {
      occurrenceId,
      employeeId,
      employeeName,
      patientName,
      type: 'outbound_details_loaded'
    });
    
    // Create call state for outbound
    const callState = {
      sid: ws.callSid!,
      parentCallSid: ws.parentCallSid!,
      from: 'outbound',
      phase: 'outbound_job_offer',
      employee: { id: employeeId, name: employeeName },
      occurrenceId,
      jobDetails: {
        patientName,
        displayDate,
        startTime,
        providerId
      },
      round: parseInt(round, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await saveCallState(ws, callState);
    ws.employeeId = employeeId;
    ws.providerId = providerId;
    
    // Generate and play job offer message
    const message = `Hi ${employeeName}, we have an urgent shift for ${patientName} on ${displayDate} at ${startTime}. Press 1 to accept this shift, or press 2 to decline.`;
    
    await generateAndSpeakOutbound(ws, message);
    
    logger.info('Outbound job offer message sent', {
      callSid: ws.callSid,
      occurrenceId,
      employeeId,
      type: 'outbound_message_sent'
    });
    
  } catch (error) {
    logger.error('Error handling outbound call', {
      callSid: ws.callSid,
      occurrenceId,
      error: error instanceof Error ? error.message : 'Unknown',
      type: 'outbound_call_error'
    });
    await generateAndSpeakOutbound(ws, 'Sorry, there was a system error. Goodbye.');
  }
}

/**
 * Generate speech and stream to Twilio for outbound calls
 */
async function generateAndSpeakOutbound(ws: WebSocketWithExtensions, text: string): Promise<void> {
  if (!ws.streamSid) return;
  
  const result = await generateSpeech(text, {
    apiKey: ELEVENLABS_API_KEY,
    voiceId: ELEVENLABS_VOICE_ID,
  });
  
  if (result.success && result.frames) {
    await streamAudioToTwilio(ws as any, result.frames, ws.streamSid);
  }
}

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
        
        // Check if this is an outbound call
        const callType = (message.start.customParameters as any)?.callType;
        const isOutboundCall = callType === 'outbound';

        // CRITICAL DEBUG: Log ALL custom parameters to see what Twilio sends
        logger.info('🚨 CRITICAL DEBUG: Start message customParameters', {
          callSid: ws.callSid,
          streamSid: ws.streamSid,
          rawCustomParameters: JSON.stringify(message.start.customParameters),
          callType,
          isOutboundCall,
          allParamKeys: message.start.customParameters ? Object.keys(message.start.customParameters) : [],
          type: 'outbound_param_debug'
        });

        // DEEP DEBUG: Log parameter extraction
        logger.info('🔍 DEEP DEBUG: Start message received', {
          callSid: ws.callSid,
          parentCallSid: ws.parentCallSid,
          customParameters: message.start.customParameters,
          extractedPhone: callerPhone,
          fallbackFrom: from,
          callType,
          isOutboundCall,
          type: 'start_message_debug'
        });

        logger.info('Call started', {
          callSid: ws.callSid,
          parentCallSid: ws.parentCallSid,
          streamSid: ws.streamSid,
          from: callerPhone,
          callType: isOutboundCall ? 'outbound' : 'inbound',
          type: 'call_start'
        });
        
        // Handle outbound calls differently (skip authentication)
        if (isOutboundCall) {
          logger.info('🚨 ROUTING TO OUTBOUND CALL HANDLER', {
            callSid: ws.callSid,
            callType,
            type: 'outbound_routing'
          });
          await handleOutboundCall(ws, message.start.customParameters as any);
          return;
        } else {
          logger.info('🚨 ROUTING TO INBOUND CALL HANDLER', {
            callSid: ws.callSid,
            callType,
            isOutboundCall,
            type: 'inbound_routing'
          });
        }

        // Publish call_started event to Redis Stream (non-blocking)
        publishCallStarted(
          ws.callSid!,
          'pending', // Provider ID will be determined during authentication
          callerPhone
        ).catch(err => {
          logger.error('Failed to publish call_started event', {
            callSid: ws.callSid,
            error: err.message,
            type: 'redis_stream_error'
          });
          // Don't throw - this is non-critical
        });

        // Initialize call logging
        ws.callEvents = [];
        ws.callStartTime = new Date();

        // Recording is now handled by TwiML (record="record-from-answer-dual" in <Connect>)
        // No need to start recording via API - Twilio starts it automatically
        // The recordingStatusCallback will notify us when recording completes
        logger.info('Call recording managed by TwiML', {
          callSid: ws.callSid,
          parentCallSid: ws.parentCallSid,
          type: 'recording_twiml_managed'
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

          // Publish call_authenticated event to Redis Stream (non-blocking)
          if (providerId) {
            publishCallAuthenticated(
              ws.callSid!,
              providerId,
              authResult.employee.name || 'Unknown',
              authResult.employee.id
            ).catch(err => {
              logger.error('Failed to publish call_authenticated event', {
                callSid: ws.callSid,
                error: err.message,
                type: 'redis_stream_error'
              });
            });
          }
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
          
          // DEBUG: Log provider object from backgroundData
          logger.info('🔍 DEBUG: Provider from backgroundData.providers', {
            callSid: ws.callSid,
            hasProvider: !!provider,
            providerKeys: provider ? Object.keys(provider) : [],
            providerId: provider?.id,
            providerName: provider?.name,
            providerTransferNumber: provider?.transferNumber,
            providerObject: JSON.stringify(provider),
            type: 'debug_provider_from_background'
          });
          
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
                greeting: provider.greeting,
                transferNumber: provider.transferNumber
              } : null,
              enrichedOccurrences: enrichedOccurrences,
              currentPage: 1
            };

            await saveCallState(ws, updatedState);
          } else {
            // DEBUG: Log provider object before creating state
            logger.info('🔍 DEBUG: Provider object BEFORE creating no_occurrences state', {
              callSid: ws.callSid,
              hasProvider: !!provider,
              providerKeys: provider ? Object.keys(provider) : [],
              providerId: provider?.id,
              providerName: provider?.name,
              providerTransferNumber: provider?.transferNumber,
              providerObject: JSON.stringify(provider),
              type: 'debug_provider_before_state'
            });
            
            // Update state to allow DTMF input (press 1 for representative)
            const updatedState = {
              ...callState,
              phase: 'no_occurrences_found',
              provider: provider ? {
                id: provider.id,
                name: provider.name,
                greeting: provider.greeting,
                transferNumber: provider.transferNumber
              } : null,
              enrichedOccurrences: enrichedOccurrences,
              updatedAt: new Date().toISOString()
            };
            
            // DEBUG: Log what we're saving to state
            logger.info('🔍 DEBUG: Provider object AFTER creating no_occurrences state', {
              callSid: ws.callSid,
              hasProvider: !!updatedState.provider,
              providerKeys: updatedState.provider ? Object.keys(updatedState.provider) : [],
              providerId: updatedState.provider?.id,
              providerName: updatedState.provider?.name,
              providerTransferNumber: updatedState.provider?.transferNumber,
              providerObject: JSON.stringify(updatedState.provider),
              type: 'debug_provider_after_state'
            });
            
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
                greeting: provider.greeting,
                transferNumber: provider.transferNumber
              } : null,
              employeeJobs: employeeJobs.map((job: any, index: number) => ({
                ...job,
                index: index + 2 // Start from 2 (1 is reserved for "speak to representative")
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
