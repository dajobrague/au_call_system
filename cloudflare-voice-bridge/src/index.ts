export interface Env {
  CALL_SESSIONS: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check / basic HTTP route
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // WS entrypoint -> route to DO instance by callSid
    if (url.pathname === "/stream") {
      const callSid = url.searchParams.get("callSid") ?? crypto.randomUUID();
      const id = env.CALL_SESSIONS.idFromName(callSid);
      const stub = env.CALL_SESSIONS.get(id);
      return stub.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// Export the Durable Object
export { CallSession } from './do/CallSession';
// export { CallSessionSimple as CallSession } from './do/CallSession-simple';