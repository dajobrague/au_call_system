/**
 * Provider Job Occurrences API Route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOccurrencesByProvider } from '@/lib/airtable';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const occurrences = await getOccurrencesByProvider(user.providerId);
    
    return NextResponse.json({
      success: true,
      data: occurrences,
    });
  } catch (error) {
    console.error('Error fetching occurrences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch occurrences' },
      { status: 500 }
    );
  }
}








