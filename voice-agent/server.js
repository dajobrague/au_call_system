#!/usr/bin/env node

/**
 * Unified Server for Railway
 * Runs both Next.js (web pages + API routes) and WebSocket server
 */

// Register ts-node for TypeScript support
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    resolveJsonModule: true,
  }
});

// Load environment variables
require('dotenv').config();

const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

console.log('🚀 Starting Unified Server (Next.js + WebSocket)...');
console.log(`📡 Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`🌐 Port: ${port}`);
console.log(`📂 Working Directory: ${__dirname}`);
console.log('');

// Initialize Next.js app with explicit directory
const app = next({ 
  dev, 
  hostname, 
  port,
  dir: __dirname,  // Explicitly set the directory
  conf: {
    distDir: '.next'
  }
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);

  // ============================================================
  // WebSocket Server Setup
  // ============================================================
  console.log('📡 Initializing WebSocket server...');
  
  const wss = new Server({ 
    server: httpServer,
    path: '/stream',
  });

  // Import WebSocket handlers and services
  const url = require('url');
  const { handleWebSocketMessage } = require('./src/websocket/message-handler');
  const {
    handleConnectionOpen,
    handleConnectionClose,
    handleConnectionError,
    saveCallState: saveWsCallState,
    loadCallState: loadWsCallState
  } = require('./src/websocket/connection-handler');
  const { routeDTMFInput } = require('./src/websocket/dtmf-router');
  const { authenticateByPhone, prefetchBackgroundData } = require('./src/handlers/authentication-handler');
  const { generateOccurrenceBasedGreeting, generateMultiProviderGreeting } = require('./src/handlers/provider-handler');
  const { generateSpeech, streamAudioToTwilio, stopCurrentAudio } = require('./src/services/elevenlabs');
  const { startCallRecording } = require('./src/services/twilio/call-recorder');
  const { twilioConfig } = require('./src/config/twilio');
  const { initializeDisclaimerCache, playDisclaimerFromCache } = require('./src/audio/disclaimer-cache');
  const twilioClient = require('twilio');
  const { 
    publishCallStarted, 
    publishCallAuthenticated 
  } = require('./src/services/redis/call-event-publisher');

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
  const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'aEO01A4wXwd1O8GPgGlF';

  // Pre-generate disclaimer audio for instant playback
  initializeDisclaimerCache().catch(error => {
    console.error('Failed to initialize disclaimer cache:', error.message);
  });

  // Handle outbound calls (job offers to staff)
  async function handleOutboundCallWs(ws, customParams, generateAndSpeak) {
    const { callId, occurrenceId, employeeId, round } = customParams || {};
    
    console.log('🚨🚨🚨 HANDLE OUTBOUND CALL ENTERED 🚨🚨🚨');
    console.log('📋 Params:', { callId, occurrenceId, employeeId, round });
    
    ws.callEvents = [];
    ws.callStartTime = new Date();
    
    try {
      // Fetch job details from Airtable
      const { airtableClient } = require('./src/services/airtable/client');
      const job = await airtableClient.getJobOccurrenceById(occurrenceId);
      
      if (!job) {
        console.error('❌ Job not found for outbound call:', occurrenceId);
        await generateAndSpeak('Sorry, there was an error loading the job details. Goodbye.');
        return;
      }
      
      // Get employee details (optional - might not exist for test calls)
      let employeeName = 'there';
      try {
        if (employeeId && employeeId !== 'TEST_EMPLOYEE') {
          const employee = await airtableClient.getEmployeeById(employeeId);
          employeeName = employee?.fields['Display Name']?.split(' ')[0] || 'there';
        }
      } catch (e) {
        console.log('⚠️ Could not fetch employee, using default name');
      }
      
      // Get job details
      const patientName = job.fields['Patient TXT'] || 'the patient';
      const displayDate = job.fields['Display Date'] || job.fields['Scheduled At'] || 'today';
      const startTime = job.fields['Time'] || 'soon';
      const providerId = job.fields['Provider']?.[0] || '';
      
      console.log('📋 Job details:', { patientName, displayDate, startTime, employeeName });
      
      // Create call state for outbound
      const callState = {
        sid: ws.callSid,
        parentCallSid: ws.parentCallSid,
        from: 'outbound',
        phase: 'outbound_job_offer',
        employee: { id: employeeId, name: employeeName },
        occurrenceId,
        jobDetails: { patientName, displayDate, startTime, providerId },
        round: parseInt(round, 10) || 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await saveWsCallState(ws, callState);
      ws.employeeId = employeeId;
      ws.providerId = providerId;
      
      // Generate and play job offer message
      const message = `Hi ${employeeName}, we have an urgent shift for ${patientName} on ${displayDate} at ${startTime}. Press 1 to accept this shift, or press 2 to decline.`;
      
      console.log('🎤 Playing message:', message);
      await generateAndSpeak(message);
      
      console.log('✅ Outbound job offer message sent successfully');
      
    } catch (error) {
      console.error('❌ Error handling outbound call:', error);
      await generateAndSpeak('Sorry, there was a system error. Goodbye.');
    }
  }

  wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket connection from:', req.socket.remoteAddress);
    
    const parsedUrl = url.parse(req.url || '', true);
    const from = parsedUrl.query.phone || parsedUrl.query.from || 'Unknown';

    handleConnectionOpen(ws);

    // Helper function to generate and speak text
    const generateAndSpeak = async (text) => {
      if (!ws.streamSid) {
        console.error('Cannot speak - no streamSid');
        return;
      }

      stopCurrentAudio(ws);

      const result = await generateSpeech(text, {
        apiKey: ELEVENLABS_API_KEY,
        voiceId: ELEVENLABS_VOICE_ID
      });

      if (result.success && result.frames) {
        await streamAudioToTwilio(ws, result.frames, ws.streamSid);
      }
    };

    // Message handlers
    const handlers = {
      onStart: async (message) => {
        if (!message.start) return;

        ws.streamSid = message.start.streamSid;
        ws.callSid = message.start.callSid;
        ws.parentCallSid = message.start.customParameters?.parentCallSid || 
                           message.start.customParameters?.callSid || 
                           ws.callSid;

        let callerPhone = message.start.customParameters?.phone || message.start.customParameters?.from || from;
        
        // Check if this is an outbound call
        const callType = message.start.customParameters?.callType;
        const isOutboundCall = callType === 'outbound';

        console.log('📞 Call started:', ws.callSid, '| Type:', isOutboundCall ? 'OUTBOUND' : 'INBOUND', '| Total:', wss.clients.size);
        console.log('📋 Custom params:', JSON.stringify(message.start.customParameters));
        
        // Handle outbound calls differently (skip authentication)
        if (isOutboundCall) {
          console.log('🚨 OUTBOUND CALL DETECTED - Routing to outbound handler');
          await handleOutboundCallWs(ws, message.start.customParameters, generateAndSpeak);
          return;
        }
        
        console.log('📥 INBOUND CALL - Continuing with normal auth flow');

        ws.callEvents = [];
        ws.callStartTime = new Date();

        // Publish call_started event to Redis Stream (non-blocking)
        publishCallStarted(
          ws.callSid,
          'pending', // Provider ID will be determined during authentication
          callerPhone
        ).catch(err => {
          console.error('Failed to publish call_started event:', err.message);
        });

        // Recording is now handled by TwiML (record="record-from-answer-dual" in <Connect>)
        // No need to start recording via API - Twilio starts it automatically
        console.log('📼 Call recording managed by TwiML');

        // Start authentication in parallel
        const authPromise = (async () => {
          try {
            if (!callerPhone || callerPhone === 'Unknown' || callerPhone.length < 10) {
              try {
                const client = twilioClient(twilioConfig.accountSid, twilioConfig.authToken);
                const call = await client.calls(ws.parentCallSid).fetch();
                callerPhone = call.from;
              } catch (error) {
                callerPhone = 'Unknown';
              }
            }
            return await authenticateByPhone(callerPhone);
          } catch (error) {
            return { success: false, error: 'Authentication failed' };
          }
        })();

        // Play disclaimer while auth happens
        await playDisclaimerFromCache(ws, ws.streamSid);

        const authResult = await authPromise;

        if (!authResult.success || !authResult.employee) {
          // Fall back to PIN authentication
          const pinAuthState = {
            sid: ws.callSid,
            parentCallSid: ws.parentCallSid,
            from: callerPhone,
            phase: 'pin_auth',
            authMethod: 'pin_pending',
            pinBuffer: '',
            attempts: { clientId: 0, confirmClientId: 0, jobNumber: 0, confirmJobNumber: 0, jobOptions: 0, occurrenceSelection: 0 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await saveWsCallState(ws, pinAuthState);
          await generateAndSpeak('I could not find your phone number in our system. Please use your keypad to enter your employee PIN followed by the pound key.');
          return;
        }

        // Track successful auth
        if (ws.callEvents) {
          const { trackCallEvent } = require('./src/services/airtable/call-log-service');
          trackCallEvent(ws.callEvents, 'authentication', 'phone_auth_success', {
            employeeId: authResult.employee.id,
            employeeName: authResult.employee.name,
            phone: callerPhone
          });
        }

        // Create initial call state
        const callState = {
          sid: ws.callSid,
          parentCallSid: ws.parentCallSid,
          from: callerPhone,
          phase: 'provider_selection',
          employee: authResult.employee,
          provider: authResult.provider,
          authMethod: 'phone',
          attempts: { clientId: 0, confirmClientId: 0, jobNumber: 0, confirmJobNumber: 0, jobOptions: 0, occurrenceSelection: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await saveWsCallState(ws, callState);

        // Prefetch background data
        const backgroundData = await prefetchBackgroundData(authResult.employee);
        ws.cachedData = { ...ws.cachedData, ...backgroundData };

        // Create call log
        let providerId = authResult.provider?.id;
        if (!providerId && backgroundData.providers?.providers?.length > 0) {
          providerId = backgroundData.providers.providers[0].id;
        }

        const { createCallLog } = require('./src/services/airtable/call-log-service');
        const startedAt = ws.callStartTime.toLocaleString('en-AU', {
          timeZone: 'Australia/Sydney',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });

        const callLogResult = await createCallLog({
          callSid: ws.callSid,
          employeeId: authResult.employee.id,
          providerId: providerId,
          direction: 'Inbound',
          startedAt
        });

        if (callLogResult.success && callLogResult.recordId) {
          ws.callLogRecordId = callLogResult.recordId;

          // Publish call_authenticated event to Redis Stream (non-blocking)
          if (providerId) {
            ws.providerId = providerId; // Store for call_ended event
            publishCallAuthenticated(
              ws.callSid,
              providerId,
              authResult.employee.name,
              callerPhone
            ).catch(err => {
              console.error('Failed to publish call_authenticated event:', err.message);
            });
          }
        }

        // Generate greeting
        const providerResult = backgroundData.providers;
        const enrichedOccurrences = backgroundData.enrichedOccurrences || [];

        if (!providerResult?.hasMultipleProviders) {
          const provider = providerResult?.providers?.[0];
          const greeting = generateOccurrenceBasedGreeting(
            authResult.employee,
            provider,
            enrichedOccurrences,
            1
          );

          if (greeting.shouldPresentJobs) {
            const updatedState = {
              ...callState,
              phase: 'occurrence_selection',
              provider: provider ? { id: provider.id, name: provider.name, greeting: provider.greeting, transferNumber: provider.transferNumber } : null,
              enrichedOccurrences: enrichedOccurrences,
              currentPage: 1
            };
            await saveWsCallState(ws, updatedState);
          } else {
            const updatedState = {
              ...callState,
              phase: 'no_occurrences_found',
              provider: provider ? { id: provider.id, name: provider.name, greeting: provider.greeting, transferNumber: provider.transferNumber } : null,
              enrichedOccurrences: enrichedOccurrences,
              updatedAt: new Date().toISOString()
            };
            await saveWsCallState(ws, updatedState);
          }

          await generateAndSpeak(greeting.message);
        } else {
          const greeting = generateMultiProviderGreeting(
            authResult.employee,
            providerResult.providers
          );

          const updatedState = {
            ...callState,
            availableProviders: providerResult.providers.map((p, index) => ({ ...p, selectionNumber: index + 1 })),
            enrichedOccurrences: enrichedOccurrences
          };

          await saveWsCallState(ws, updatedState);
          await generateAndSpeak(greeting);
        }
      },

      onMedia: async () => {
        // Media frames - no action needed
      },

      onDtmf: async (message) => {
        if (!message.dtmf || !ws.callSid) return;

        const digit = message.dtmf.digit;
        const callState = await loadWsCallState(ws, ws.callSid);

        if (!callState) return;

        await routeDTMFInput({
          ws,
          callState,
          digit,
          streamSid: ws.streamSid,
          generateAndSpeak,
          saveState: (state) => saveWsCallState(ws, state)
        });
      },

      onStop: async (message) => {
        if (ws.inConference) return;
        await handleConnectionClose(ws, 1000, Buffer.from('Stream stopped'));
      }
    };

    // Handle incoming messages
    ws.on('message', async (data) => {
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

  wss.on('error', (error) => {
    console.error('❌ WebSocket server error:', error);
  });

  console.log('✅ WebSocket server initialized on path: /stream');

  // Initialize SMS Wave Worker
  try {
    const { initializeSMSWaveWorker } = require('./src/workers/sms-wave-worker');
    initializeSMSWaveWorker();
    console.log('✅ SMS Wave Worker initialized');
  } catch (workerError) {
    console.error('⚠️  SMS Wave Worker initialization failed:', workerError.message);
    console.error('   SMS waves will not be processed!');
  }

  // Initialize Outbound Call Worker (Phase 2)
  try {
    const { initializeOutboundCallWorker } = require('./src/workers/outbound-call-worker');
    initializeOutboundCallWorker();
    console.log('✅ Outbound Call Worker initialized');
  } catch (workerError) {
    console.error('⚠️  Outbound Call Worker initialization failed:', workerError.message);
    console.error('   Outbound calls will not be processed!');
  }

  // Initialize Report Scheduler
  try {
    const { initializeReportScheduler } = require('./src/services/cron/report-scheduler');
    initializeReportScheduler();
    console.log('✅ Report Scheduler initialized (midnight AEST)');
  } catch (schedulerError) {
    console.error('⚠️  Report Scheduler initialization failed:', schedulerError.message);
    console.error('   Daily reports will not be generated automatically!');
  }

  // ============================================================
  // Twilio Voice Endpoints (needed for WebSocket)
  // ============================================================
  const twilio = require('twilio');
  const { logger } = require('./src/lib/logger');
  const { loadCallState, saveCallState } = require('./src/fsm/state/state-manager');

  // Body parsers ONLY for Twilio routes (not Next.js routes)
  const twilioBodyParser = express.urlencoded({ extended: true });

  // Initial voice webhook
  server.post('/api/twilio/voice', twilioBodyParser, async (req, res) => {
    try {
      const host = req.get('host') || process.env.RAILWAY_PUBLIC_DOMAIN;
      const protocol = 'https'; // Railway always uses HTTPS
      const wsProtocol = 'wss';
      
      const websocketUrl = `${wsProtocol}://${host}/stream`;
      const actionUrl = `${protocol}://${host}/api/transfer/after-connect?callSid=${req.body.CallSid}&from=${encodeURIComponent(req.body.From)}`;
      const recordingStatusCallback = `${protocol}://${host}/api/twilio/recording-status`;
      
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const response = new VoiceResponse();
      
      // Enable call recording with callback
      const connect = response.connect({ 
        action: actionUrl,
        record: true,
        recordingStatusCallback: recordingStatusCallback
      });
      const stream = connect.stream({ url: websocketUrl });
      // Note: track attribute needs to be set differently - will fix after confirming syntax
      stream.parameter({ name: 'phone', value: req.body.From });
      stream.parameter({ name: 'parentCallSid', value: req.body.CallSid });
      
      response.say({ voice: 'Polly.Amy' }, 'The call has ended. Goodbye.');
      response.hangup();

      res.type('text/xml').send(response.toString());
      
      logger.info('TwiML generated with recording (server.js)', {
        callSid: req.body.CallSid,
        from: req.body.From,
        websocketUrl: websocketUrl,
        recordingStatusCallback: recordingStatusCallback,
        actionUrl: actionUrl,
        type: 'twiml_with_recording'
      });
      
      if (req.body.CallSid) {
        try {
          const { voiceMetrics } = require('./src/services/monitoring/voice-metrics');
          voiceMetrics.recordCallStart(req.body.CallSid);
        } catch (e) {}
      }
    } catch (error) {
      logger.error('Error in voice handler', { error: error.message });
      res.status(500).send('Error');
    }
  });

  // After-connect handler
  server.post('/api/transfer/after-connect', twilioBodyParser, async (req, res) => {
    logger.info('After-connect endpoint called', {
      url: req.url,
      method: req.method,
      type: 'after_connect_entry'
    });
    
    try {
      const callSid = req.body.CallSid;
      const from = req.body.From;
      
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      
      if (!callSid) {
        twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Goodbye.');
        twiml.hangup();
        return res.type('text/xml').send(twiml.toString());
      }
      
      const callState = await loadCallState(callSid);
      
      if (callState && callState.pendingTransfer) {
        const host = req.get('host') || process.env.RAILWAY_PUBLIC_DOMAIN;
        const protocol = 'https';
        const APP_BASE_URL = `${protocol}://${host}`;
        
        const representativePhone = callState.pendingTransfer.representativePhone;
        const callerPhone = callState.pendingTransfer.callerPhone;
        
        logger.info('Pending transfer found - generating simple Dial TwiML', {
          callSid,
          representativePhone,
          type: 'after_connect_transfer_found'
        });
        
        // Generate TwiML for simple direct transfer (no recording, no conference)
        twiml.say({ voice: 'Polly.Amy' }, 'Connecting you to a representative. Please hold.');
        
        const dial = twiml.dial({
          callerId: callerPhone,
          timeout: 30,
          action: `${APP_BASE_URL}/api/queue/transfer-status?callSid=${callSid}&from=${encodeURIComponent(from)}`
        });
        
        // Simple direct dial to representative - no conference, no recording
        dial.number(representativePhone);
        
        // Clear the pending transfer flag
        callState.pendingTransfer = undefined;
        await saveCallState(callState);
        
        logger.info('Simple Dial TwiML generated for transfer (no recording)', {
          callSid,
          representativePhone,
          type: 'after_connect_dial_twiml'
        });
        
        twiml.say({ voice: 'Polly.Amy' }, 'The representative is not available. You will be placed in the queue.');
        twiml.redirect(`${APP_BASE_URL}/api/queue/enqueue-caller?callSid=${callSid}&from=${encodeURIComponent(from)}`);
      } else {
        twiml.say({ voice: 'Polly.Amy' }, 'Thank you for calling. Goodbye.');
        twiml.hangup();
      }
      
      return res.type('text/xml').send(twiml.toString());
    } catch (error) {
      logger.error('Error in after-connect', { error: error.message });
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      twiml.say({ voice: 'Polly.Amy' }, 'An error occurred. Please try again later.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }
  });

  // Conference recording endpoint removed - transfer recordings disabled for reliability

  // Health check
  server.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      websocket: wss.clients.size,
      nextjs: 'ready',
      timestamp: new Date().toISOString()
    });
  });

  // ============================================================
  // Next.js Handler (for all other routes including /job/[id])
  // ============================================================
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  // ============================================================
  // Start Server
  // ============================================================
  httpServer.listen(port, () => {
    console.log('');
    console.log('✅ Unified Server Started Successfully!');
    console.log(`🌐 Next.js ready: http://${hostname}:${port}`);
    console.log(`🔌 WebSocket ready: ws://${hostname}:${port}/stream`);
    console.log(`🔗 Health check: http://${hostname}:${port}/health`);
    console.log(`📱 Job pages: http://${hostname}:${port}/job/[id]`);
    console.log(`📱 SMS Wave System: Active`);
    console.log('');
    console.log('📊 Server is ready to accept connections...');
    console.log('');
  });

  // ============================================================
  // Graceful Shutdown
  // ============================================================
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    // Shutdown SMS Wave Worker
    try {
      const { shutdownSMSWaveWorker } = require('./src/workers/sms-wave-worker');
      await shutdownSMSWaveWorker();
      console.log('✅ SMS Wave Worker shut down');
    } catch (error) {
      console.error('⚠️  Error shutting down SMS Wave Worker:', error.message);
    }
    
    // Shutdown Outbound Call Worker (Phase 2)
    try {
      const { shutdownOutboundCallWorker } = require('./src/workers/outbound-call-worker');
      await shutdownOutboundCallWorker();
      console.log('✅ Outbound Call Worker shut down');
    } catch (error) {
      console.error('⚠️  Error shutting down Outbound Call Worker:', error.message);
    }
    
    // Shutdown Report Scheduler
    try {
      const { shutdownReportScheduler } = require('./src/services/cron/report-scheduler');
      shutdownReportScheduler();
      console.log('✅ Report Scheduler shut down');
    } catch (error) {
      console.error('⚠️  Error shutting down Report Scheduler:', error.message);
    }
    
    // Close WebSocket server
    wss.close(() => {
      console.log('✅ WebSocket server closed');
    });
    
    // Close HTTP server
    httpServer.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
