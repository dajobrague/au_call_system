/**
 * Twilio Access Token endpoint for WebRTC voice testing
 * Generates tokens for browser-based voice calls
 */

import { NextRequest, NextResponse } from 'next/server';
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.warn('Twilio credentials not found in environment variables');
}

export async function POST(request: NextRequest) {
  try {
    const { identity = 'test-user' } = await request.json();

    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured' },
        { status: 500 }
      );
    }

    // Create access token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const accessToken = new AccessToken(
      accountSid,
      process.env.TWILIO_API_KEY || accountSid, // Use account SID if no API key
      process.env.TWILIO_API_SECRET || authToken, // Use auth token if no API secret
      { identity }
    );

    // Create voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true, // Allow incoming calls
    });

    accessToken.addGrant(voiceGrant);

    // Generate the token
    const token = accessToken.toJwt();

    console.log(`Generated access token for identity: ${identity}`);

    return NextResponse.json({
      success: true,
      token,
      identity,
      accountSid,
      expires: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate access token', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/voice/token',
    method: 'POST',
    description: 'Generate Twilio access token for WebRTC voice calls',
    parameters: {
      identity: 'string (optional) - Client identity for the call (default: test-user)',
    },
    example: {
      identity: 'test-user-123',
    },
    requirements: [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN', 
      'TWILIO_TWIML_APP_SID (optional - for outgoing calls)',
    ],
  });
}
