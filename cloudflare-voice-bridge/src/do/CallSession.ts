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

    const upgrade = request.headers.get("Upgrade");
    const hasWebSocketKey = request.headers.has("Sec-WebSocket-Key");
    const hasWebSocketVersion = request.headers.has("Sec-WebSocket-Version");
    
    console.log("📋 Upgrade header:", JSON.stringify(upgrade));
    console.log("📋 Connection header:", JSON.stringify(request.headers.get("Connection")));
    console.log("📋 Has WebSocket Key:", hasWebSocketKey);
    console.log("📋 Has WebSocket Version:", hasWebSocketVersion);

    // Handle Twilio's Media Streams API - it sends WebSocket-like headers but not always Upgrade: websocket
    const isTwilioStream = hasWebSocketKey && hasWebSocketVersion;
    const isStandardWebSocket = upgrade && upgrade.toLowerCase() === "websocket";
    
    if (!isTwilioStream && !isStandardWebSocket) {
      return new Response("Expected WebSocket or Twilio Stream", {
        status: 426,
        headers: { "Upgrade": "websocket" },
      });
    }

    // Set up WebSocket pair and bind server to DO lifecycle
    console.log("🔗 Accepting WebSocket for call:", this.callSid);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Attach backpressure-safe ping/pong later if needed
    this.state.acceptWebSocket(server);

    // Return 101 Switching Protocols with the client socket
    return new Response(null, { status: 101, webSocket: client });
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