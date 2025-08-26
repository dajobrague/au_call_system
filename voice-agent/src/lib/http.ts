// Small HTTP helpers for API routes

import { NextRequest, NextResponse } from 'next/server'

export function ensurePost(request: NextRequest): void {
  if (request.method !== 'POST') {
    throw new Error(`Method ${request.method} not allowed. Expected POST.`)
  }
}

export function ensureContentType(request: NextRequest, expectedType: string = 'application/x-www-form-urlencoded'): void {
  const contentType = request.headers.get('content-type')
  if (!contentType?.includes(expectedType)) {
    throw new Error(`Invalid content type. Expected ${expectedType}, got ${contentType}`)
  }
}

export function createTwiMLResponse(twiml: string): NextResponse {
  return new NextResponse(twiml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'no-cache',
    },
  })
}

export function createErrorResponse(message: string, status: number = 500): NextResponse {
  const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, there was an error processing your request. Please try again later.</Say>
  <Hangup/>
</Response>`

  return new NextResponse(errorTwiML, {
    status,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'no-cache',
    },
  })
}

export async function parseTwilioFormData(request: NextRequest) {
  const formData = await request.formData()
  
  return {
    CallSid: formData.get('CallSid') as string,
    From: formData.get('From') as string,
    To: formData.get('To') as string,
    SpeechResult: formData.get('SpeechResult') as string,
    Digits: formData.get('Digits') as string,
    GatherAttempt: formData.get('GatherAttempt') as string,
  }
}
