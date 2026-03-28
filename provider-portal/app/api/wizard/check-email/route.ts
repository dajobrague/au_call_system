import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/airtable';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const existing = await findUserByEmail(email.trim().toLowerCase());

    return NextResponse.json({ available: !existing });
  } catch (err) {
    console.error('Email check error:', err);
    return NextResponse.json(
      { error: 'Unable to verify email' },
      { status: 500 }
    );
  }
}
