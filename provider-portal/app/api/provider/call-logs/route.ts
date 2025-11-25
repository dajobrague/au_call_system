/**
 * Provider Call Logs API Route
 * Fetches call logs for a provider within a date range
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCallLogsByDateRange } from '@/lib/airtable';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Extract query parameters for date filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }
    
    const callLogs = await getCallLogsByDateRange(
      user.providerId,
      startDate,
      endDate
    );
    
    return NextResponse.json({
      success: true,
      data: callLogs,
      count: callLogs.length,
    });
  } catch (error) {
    console.error('Error fetching call logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call logs' },
      { status: 500 }
    );
  }
}
