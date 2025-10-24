import type { Env } from "../index";

export class CallSessionSimple implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const callSid = url.searchParams.get("callSid") ?? "unknown";

    // Cloudflare requires the Upgrade header to return a WebSocket
    const upgradeHeader = request.headers.get("Upgrade");
    
    console.log(`[${callSid}] Headers:`, {
      upgrade: upgradeHeader,
      connection: request.headers.get("Connection"),
      wsKey: request.headers.has("Sec-WebSocket-Key"),
      wsVersion: request.headers.has("Sec-WebSocket-Version"),
    });
    
    // Check if this is a proper WebSocket upgrade request
    if (upgradeHeader !== "websocket") {
      console.log(`[${callSid}] Rejecting - Upgrade header is not 'websocket'`);
      return new Response("Expected Upgrade: websocket header", { 
        status: 426,
        headers: { "Upgrade": "websocket" }
      });
    }
    
    console.log(`[${callSid}] Creating WebSocket pair...`);

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Accept WebSocket on Durable Object side
    this.state.acceptWebSocket(server);

    console.log(`[${callSid}] WebSocket accepted, returning 101 response`);

    // Return the client-side WebSocket
    // @ts-ignore - webSocket is a valid Cloudflare Workers property
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    console.log("Received message:", message);
    // Echo back for testing
    ws.send(message);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    console.log(`WebSocket closed: ${code} ${reason} ${wasClean}`);
    ws.close(code, "Goodbye");
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.log("WebSocket error:", error);
  }
}

