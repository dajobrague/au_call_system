/**
 * Provider Reports API Route
 * Supports date filtering via query parameters: startDate, endDate
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getReportsByProvider } from '@/lib/airtable';

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
    
    const reports = await getReportsByProvider(user.providerId, startDate, endDate);
    
    return NextResponse.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}








