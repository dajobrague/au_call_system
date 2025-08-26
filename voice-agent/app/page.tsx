export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Voice Agent - Twilio Integration</h1>
      <p>Clean, layered architecture for an Airtable-driven call agent.</p>
      
      <h2>API Endpoints</h2>
      <ul>
        <li><code>POST /api/twilio/voice</code> - Twilio webhook handler</li>
      </ul>

      <h2>Architecture</h2>
      <p>This system follows a layered architecture:</p>
      <ul>
        <li><strong>Phase 1:</strong> Twilio webhook plumbing ✅</li>
        <li><strong>Phase 2:</strong> Finite State Machine (FSM)</li>
        <li><strong>Phase 3:</strong> Airtable integration</li>
        <li><strong>Phase 4:</strong> Interpreter & Responders</li>
        <li><strong>Phase 5:</strong> Recording pipeline (S3)</li>
        <li><strong>Phase 6:</strong> Redis state store</li>
        <li><strong>Phase 7:</strong> Internationalization</li>
      </ul>

      <h2>Status</h2>
      <p>🟢 Ready for Phase 1 testing</p>
    </div>
  )
}
