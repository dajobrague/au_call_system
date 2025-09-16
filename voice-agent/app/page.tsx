export default function Home() {
  return (
    <main className="px-8 py-10 font-sans max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold">Voice Agent - Twilio Integration</h1>
      <p className="text-gray-600 mt-2">Clean, layered architecture for an Airtable-driven call agent.</p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">API Endpoints</h2>
        <ul className="list-disc pl-6 mt-2">
          <li>
            <code className="px-2 py-1 bg-gray-100 rounded">POST /api/twilio/voice</code>
            <span className="text-gray-600"> - Twilio webhook handler</span>
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Architecture</h2>
        <p className="text-gray-600 mt-2">This system follows a layered architecture:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>
            <span className="font-semibold">Phase 1:</span> Twilio webhook plumbing ✅
          </li>
          <li>
            <span className="font-semibold">Phase 2:</span> Finite State Machine (FSM)
          </li>
          <li>
            <span className="font-semibold">Phase 3:</span> Airtable integration
          </li>
          <li>
            <span className="font-semibold">Phase 4:</span> Interpreter & Responders
          </li>
          <li>
            <span className="font-semibold">Phase 5:</span> Recording pipeline (S3)
          </li>
          <li>
            <span className="font-semibold">Phase 6:</span> Redis state store
          </li>
          <li>
            <span className="font-semibold">Phase 7:</span> Internationalization
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Status</h2>
        <p className="mt-2">🟢 Ready for Phase 1 testing</p>
      </section>
    </main>
  )
}
