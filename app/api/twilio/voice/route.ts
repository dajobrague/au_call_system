import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Parse the form data from Twilio
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const speechResult = formData.get('SpeechResult') as string;
    const digits = formData.get('Digits') as string;
    const gatherAttempt = formData.get('GatherAttempt') as string;

    console.log('Twilio webhook received:', {
      callSid,
      from,
      to,
      speechResult,
      digits,
      gatherAttempt
    });

    // Check if this is a gather response (user provided input)
    if (speechResult || digits) {
      // User provided input - acknowledge and hang up
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you. We received your response.</Say>
  <Hangup/>
</Response>`;
      
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // Check if this is a retry (no input on previous attempt)
    const attempt = parseInt(gatherAttempt || '0');
    
    if (attempt >= 1) {
      // Second attempt failed - end call politely
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We didn't receive your input. Thank you for calling. Goodbye.</Say>
  <Hangup/>
</Response>`;
      
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // First call or retry - present the main prompt
    const isRetry = attempt > 0;
    const prompt = isRetry 
      ? "Please say your client number or enter it using the keypad, followed by the pound key."
      : "Welcome. After the tone, please say your client number or enter it using the keypad, then press pound.";

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    input="speech dtmf" 
    language="en-US" 
    timeout="10" 
    speechTimeout="3" 
    finishOnKey="#"
    action="/api/twilio/voice"
    method="POST">
    <Say voice="alice">${prompt}</Say>
  </Gather>
  <Say voice="alice">We didn't receive your input. Please try again.</Say>
  <Redirect>/api/twilio/voice</Redirect>
</Response>`;

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('Error in voice webhook:', error);
    
    // Return a simple error response in TwiML format
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, there was an error. Please try calling again later.</Say>
  <Hangup/>
</Response>`;
    
    return new NextResponse(errorTwiml, {
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}
