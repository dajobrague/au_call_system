/**
 * Provider Info API Route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderById } from '@/lib/airtable';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const provider = await getProviderById(user.providerId);
    
    return NextResponse.json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error('Error fetching provider info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider info' },
      { status: 500 }
    );
  }
}








