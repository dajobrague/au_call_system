import type { Env } from "../index";

export class CallSession implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Env;
  private streamSid?: string;
  private callSid?: string;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.callSid = url.searchParams.get("callSid") ?? "unknown";

    // Cloudflare requires the Upgrade header to return a WebSocket
    const upgradeHeader = request.headers.get("Upgrade");
    
    console.log(`[${this.callSid}] Headers:`, {
      upgrade: upgradeHeader,
      connection: request.headers.get("Connection"),
      wsKey: request.headers.has("Sec-WebSocket-Key"),
      wsVersion: request.headers.has("Sec-WebSocket-Version"),
    });
    
    // Check if this is a proper WebSocket upgrade request
    if (upgradeHeader !== "websocket") {
      console.log(`[${this.callSid}] Rejecting - Upgrade header is not 'websocket'`);
      return new Response("Expected Upgrade: websocket header", { 
        status: 426,
        headers: { "Upgrade": "websocket" }
      });
    }
    
    console.log(`[${this.callSid}] Creating WebSocket pair for Twilio call...`);

    // Set up WebSocket pair and bind server to DO lifecycle
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Accept the WebSocket connection on the server end
    this.state.acceptWebSocket(server);

    console.log(`[${this.callSid}] ✅ WebSocket accepted, returning 101 response`);

    // Return 101 Switching Protocols with the client socket
    // @ts-expect-error - webSocket is a valid Cloudflare Workers Response property
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Twilio sends JSON messages with event types: start, media, mark, stop
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    try {
      const evt = JSON.parse(text);
      if (evt.event === "start") {
        this.streamSid = evt.streamSid;
        console.log("✅ Twilio start:", { callSid: this.callSid, streamSid: this.streamSid, media: evt.media });
      } else if (evt.event === "media") {
        // evt.media.payload is base64-encoded audio
        // TODO: forward to ElevenLabs WS (to be implemented)
        // For now, just count frames:
        const bytes = (evt.media?.payload?.length ?? 0) * 0.75; // rough base64->bytes
        // console.log("🎧 media frame bytes ~", bytes);
      } else if (evt.event === "mark") {
        // Handle markers if you use them
        // console.log("🔖 mark:", evt);
      } else if (evt.event === "stop") {
        console.log("🛑 Twilio stop:", { callSid: this.callSid, streamSid: this.streamSid });
        try { ws.close(1000, "call ended"); } catch {}
      } else {
        // Unknown event
        // console.log("❓ unknown event:", evt);
      }
    } catch (e) {
      console.log("❌ bad message:", e);
      try { ws.close(1011, "invalid message"); } catch {}
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    console.log("🔚 socket closed:", { callSid: this.callSid, streamSid: this.streamSid, code, reason, wasClean });
  }

  webSocketError(ws: WebSocket, err: unknown) {
    console.log("💥 socket error:", { callSid: this.callSid, streamSid: this.streamSid, err });
    try { ws.close(1011, "error"); } catch {}
  }
}