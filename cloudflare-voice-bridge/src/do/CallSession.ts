/**
 * CallSession Durable Object
 * Manages individual call sessions with bidirectional audio streaming
 */

import type { 
  Env, 
  CallSessionState, 
  TwilioMessage, 
  TwilioStartMessage, 
  TwilioMediaMessage 
} from '../types';
import { 
  parseTwilioMessage, 
  createTwilioMediaMessage, 
  createTwilioMarkMessage,
  validateStartMessage,
  extractAudioFormat,
  logTwilioMessage 
} from '../utils/twilio';
import { 
  createRobustElevenLabsConnection,
  setupElevenLabsEventHandlers,
  initializeTTSConnection,
  sendTextToElevenLabs,
  closeElevenLabsConnection,
  sendElevenLabsPing
} from '../utils/elevenlabs';
import { 
  processTwilioAudio, 
  processElevenLabsAudio 
} from '../utils/audio';

export class CallSession implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessionState: CallSessionState | null = null;
  private twilioSocket: WebSocket | null = null;
  private elevenLabsSocket: WebSocket | null = null;
  private pingInterval: number | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const callSid = url.searchParams.get('callSid');
    
    if (!callSid) {
      return new Response('Missing callSid parameter', { status: 400 });
    }

    console.log(`📞 CallSession fetch for: ${callSid}`);
    console.log(`📋 Upgrade header: "${request.headers.get('Upgrade')}"`);
    console.log(`📋 Connection header: "${request.headers.get('Connection')}"`);
    
    // Handle WebSocket upgrade (case-insensitive)
    const upgradeHeader = request.headers.get('Upgrade')?.toLowerCase();
    if (upgradeHeader === 'websocket') {
      console.log('✅ WebSocket upgrade detected, handling...');
      return this.handleWebSocketUpgrade(request, callSid);
    }

    console.log('❌ No WebSocket upgrade, returning HTTP response');
    // Handle HTTP requests (health check, etc.)
    return new Response(`Call session ${callSid} - WebSocket endpoint`, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  /**
   * Handle WebSocket upgrade from Twilio
   */
  private async handleWebSocketUpgrade(request: Request, callSid: string): Promise<Response> {
    console.log(`🔗 WebSocket upgrade for call: ${callSid}`);

    try {
      console.log('📋 Creating WebSocket pair...');
      
      // Create WebSocket pair
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      console.log('📋 Accepting WebSocket connection...');
      // Accept the WebSocket connection
      server.accept();
      
      console.log('📋 Initializing call session...');
      // Initialize call session
      await this.initializeCallSession(callSid, server);
      
      console.log('📋 Setting up Twilio WebSocket handlers...');
      // Set up Twilio WebSocket handlers
      this.setupTwilioWebSocketHandlers(server);
      
      console.log('✅ WebSocket upgrade successful, returning client socket');
      // Return the client WebSocket to Twilio
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
      
    } catch (error) {
      console.error('❌ WebSocket upgrade failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error details:', errorMessage);
      return new Response(`WebSocket upgrade failed: ${errorMessage}`, { status: 500 });
    }
  }

  /**
   * Initialize call session state
   */
  private async initializeCallSession(callSid: string, twilioSocket: WebSocket): Promise<void> {
    this.twilioSocket = twilioSocket;
    
    this.sessionState = {
      callSid,
      twilioSocket,
      startTime: Date.now(),
      lastActivity: Date.now(),
      audioFormat: {
        encoding: 'mulaw',
        sampleRate: 8000,
        channels: 1,
      },
      metrics: {
        bytesReceived: 0,
        bytesSent: 0,
        messagesReceived: 0,
        messagesSent: 0,
        reconnects: 0,
      },
      status: 'connecting',
    };

    console.log(`📞 Call session initialized: ${callSid}`);
  }

  /**
   * Set up Twilio WebSocket event handlers
   */
  private setupTwilioWebSocketHandlers(websocket: WebSocket): void {
    websocket.addEventListener('message', async (event) => {
      await this.handleTwilioMessage(event.data);
    });

    websocket.addEventListener('close', () => {
      console.log('📴 Twilio WebSocket closed');
      this.cleanup();
    });

    websocket.addEventListener('error', (event) => {
      console.error('🚨 Twilio WebSocket error:', event);
      this.cleanup();
    });
  }

  /**
   * Handle incoming Twilio messages
   */
  private async handleTwilioMessage(data: string): Promise<void> {
    if (!this.sessionState) return;

    const message = parseTwilioMessage(data);
    if (!message) return;

    logTwilioMessage(message, 'inbound');
    this.sessionState.lastActivity = Date.now();
    this.sessionState.metrics.messagesReceived++;

    switch (message.event) {
      case 'start':
        await this.handleTwilioStart(message as TwilioStartMessage);
        break;
        
      case 'media':
        await this.handleTwilioMedia(message as TwilioMediaMessage);
        break;
        
      case 'mark':
        console.log('📍 Twilio mark received:', message.mark.name);
        break;
        
      case 'stop':
        console.log('📴 Twilio stream stopped');
        this.cleanup();
        break;
    }
  }

  /**
   * Handle Twilio stream start
   */
  private async handleTwilioStart(message: TwilioStartMessage): Promise<void> {
    if (!this.sessionState) return;

    if (!validateStartMessage(message)) {
      console.error('❌ Invalid Twilio start message');
      return;
    }

    // Update session state
    this.sessionState.streamSid = message.streamSid;
    this.sessionState.audioFormat = extractAudioFormat(message);
    this.sessionState.status = 'active';

    console.log('🎵 Twilio stream started:', {
      callSid: message.start.callSid,
      streamSid: message.streamSid,
      encoding: this.sessionState.audioFormat.encoding,
      sampleRate: this.sessionState.audioFormat.sampleRate,
    });

    // Connect to ElevenLabs
    await this.connectToElevenLabs();
  }

  /**
   * Handle Twilio media (audio) messages
   * For TTS WebSocket, we convert audio to text first, then send text to ElevenLabs
   */
  private async handleTwilioMedia(message: TwilioMediaMessage): Promise<void> {
    if (!this.sessionState || !this.elevenLabsSocket) return;

    try {
      // For now, we'll implement a simple approach:
      // In a full implementation, you would:
      // 1. Convert audio to text using STT (Speech-to-Text)
      // 2. Process the text through your FSM logic
      // 3. Send the response text to ElevenLabs TTS
      
      // For this initial implementation, let's just acknowledge the audio
      console.log('🎵 Received audio from Twilio:', message.media.payload.length, 'bytes');
      this.sessionState.metrics.bytesReceived += message.media.payload.length;
      
      // TODO: Implement STT processing here
      // For now, just update last activity
      this.sessionState.lastActivity = Date.now();
      
    } catch (error) {
      console.error('❌ Error handling Twilio media:', error);
    }
  }

  /**
   * Connect to ElevenLabs Realtime
   */
  private async connectToElevenLabs(): Promise<void> {
    if (!this.sessionState) return;

    try {
      console.log('🔗 Connecting to ElevenLabs...');
      
      const websocket = await createRobustElevenLabsConnection(
        this.env.XI_API_KEY,
        this.env.ELEVENLABS_VOICE_ID || 'aGkVQvWUZi16EH8aZJvT'
      );

      if (!websocket) {
        console.error('❌ Failed to connect to ElevenLabs');
        this.cleanup();
        return;
      }

      this.elevenLabsSocket = websocket;
      
      // Set up event handlers
      setupElevenLabsEventHandlers(
        websocket,
        (audioData) => this.handleElevenLabsAudio(audioData),
        (message) => this.handleElevenLabsMessage(message),
        (error) => this.handleElevenLabsError(error),
        () => this.handleElevenLabsClose()
      );

      // Initialize TTS connection
      initializeTTSConnection(websocket, this.env.XI_API_KEY, {
        stability: 0.5,
        similarity_boost: 0.8,
        speed: 1,
      });
      
      // Send initial prompt if available
      const url = new URL(this.sessionState.callSid); // This will be updated to get prompt from URL
      // For now, send a greeting
      sendTextToElevenLabs(websocket, "Hi David Bracho.", true);

      // Start ping interval
      this.startPingInterval();
      
      console.log('✅ ElevenLabs connection established');
      
    } catch (error) {
      console.error('❌ ElevenLabs connection failed:', error);
      this.cleanup();
    }
  }

  /**
   * Handle audio from ElevenLabs
   */
  private handleElevenLabsAudio(audioData: ArrayBuffer): void {
    if (!this.sessionState || !this.twilioSocket || !this.sessionState.streamSid) return;

    try {
      // Process audio for Twilio
      const audioResult = processElevenLabsAudio(
        audioData,
        16000, // ElevenLabs sends 16kHz
        this.sessionState.audioFormat.encoding as 'mulaw' | 'pcm',
        this.sessionState.audioFormat.sampleRate
      );

      if (audioResult.success && audioResult.data) {
        // Send to Twilio
        const twilioMessage = createTwilioMediaMessage(
          this.sessionState.streamSid,
          audioResult.data
        );
        
        this.twilioSocket.send(twilioMessage);
        this.sessionState.metrics.bytesSent += audioResult.data.byteLength;
        this.sessionState.metrics.messagesSent++;
        
        console.log('🎵 Sent audio to Twilio:', audioResult.data.byteLength, 'bytes');
      } else {
        console.error('❌ ElevenLabs audio processing failed:', audioResult.error);
      }
    } catch (error) {
      console.error('❌ Error handling ElevenLabs audio:', error);
    }
  }

  /**
   * Handle text messages from ElevenLabs
   */
  private handleElevenLabsMessage(message: string): void {
    console.log('💬 ElevenLabs message:', message);
    // Could be used for transcription or agent responses
  }

  /**
   * Handle ElevenLabs errors
   */
  private handleElevenLabsError(error: any): void {
    console.error('🚨 ElevenLabs error:', error);
    
    if (this.sessionState) {
      this.sessionState.metrics.reconnects++;
      
      // Attempt reconnection if not too many retries
      if (this.sessionState.metrics.reconnects < 3) {
        console.log('🔄 Attempting ElevenLabs reconnection...');
        setTimeout(() => this.connectToElevenLabs(), 2000);
      } else {
        console.error('❌ Max reconnection attempts reached');
        this.cleanup();
      }
    }
  }

  /**
   * Handle ElevenLabs connection close
   */
  private handleElevenLabsClose(): void {
    console.log('📴 ElevenLabs connection closed');
    this.elevenLabsSocket = null;
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.elevenLabsSocket && this.elevenLabsSocket.readyState === WebSocket.OPEN) {
        // Send keepalive message instead of ping
        sendElevenLabsPing(this.elevenLabsSocket);
      }
      
      // Check for inactive connections
      if (this.sessionState && Date.now() - this.sessionState.lastActivity > 60000) {
        console.warn('⚠️ Connection inactive for 60s, cleaning up');
        this.cleanup();
      }
    }, 15000) as any; // Ping every 15 seconds
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    console.log('🧹 Cleaning up call session');
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.elevenLabsSocket) {
      closeElevenLabsConnection(this.elevenLabsSocket, 'Call session cleanup');
      this.elevenLabsSocket = null;
    }
    
    if (this.twilioSocket) {
      this.twilioSocket.close();
      this.twilioSocket = null;
    }
    
    if (this.sessionState) {
      const duration = Date.now() - this.sessionState.startTime;
      console.log('📊 Call session metrics:', {
        callSid: this.sessionState.callSid,
        duration,
        bytesReceived: this.sessionState.metrics.bytesReceived,
        bytesSent: this.sessionState.metrics.bytesSent,
        messagesReceived: this.sessionState.metrics.messagesReceived,
        messagesSent: this.sessionState.metrics.messagesSent,
        reconnects: this.sessionState.metrics.reconnects,
      });
      
      this.sessionState.status = 'closed';
      this.sessionState = null;
    }
  }
}
