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

    // Check if we have input (speech or DTMF)
    const hasInput = speechResult || digits;
    
    if (hasInput) {
      // Success: we received input
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you. We received your response.</Say>
  <Hangup/>
</Response>`;
      
      return new NextResponse(twiml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // No input received - check if this is a retry
    const attemptNumber = parseInt(gatherAttempt || '0');
    const isRetry = attemptNumber > 0;
    
    if (isRetry && attemptNumber >= 1) {
      // Max retries reached - end call
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We didn't receive your input. Goodbye.</Say>
  <Hangup/>
</Response>`;
      
      return new NextResponse(twiml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // First attempt or retry - show gather prompt
    const promptText = isRetry 
      ? 'We didn\'t receive your input. Please try again.'
      : 'Welcome. After the tone, please say your client number or enter it using the keypad, then press pound.';
      
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
    <Say voice="alice">${promptText}</Say>
  </Gather>
  <Say voice="alice">We didn't receive your input. Please try again.</Say>
  <Redirect>/api/twilio/voice</Redirect>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, there was an error processing your request. Please try again later.</Say>
  <Hangup/>
</Response>`;

    return new NextResponse(errorTwiML, {
      status: 500,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'no-cache',
      },
    });
  }
}

// Handle unsupported methods
export async function GET() {
  return new Response('Method Not Allowed', { status: 405 });
}