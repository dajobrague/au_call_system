/**
 * Live Call Log API
 * Returns real-time call events from Redis Streams for "Today" view
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readLiveCallLog } from '@/lib/redis-stream-reader';

export async function GET(request: NextRequest) {
  try {
    // Get current user (must be authenticated)
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '30m';

    // Validate time range
    const validRanges = ['5m', '15m', '30m', '1h', '2h', '4h', '8h', '24h'];
    if (!validRanges.includes(timeRange)) {
      return NextResponse.json(
        { error: 'Invalid time range. Must be one of: ' + validRanges.join(', ') },
        { status: 400 }
      );
    }

    // Read live call log from Redis
    const callLogData = await readLiveCallLog(user.providerId, timeRange);

    return NextResponse.json(callLogData);
  } catch (error) {
    console.error('Error fetching live call log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live call log' },
      { status: 500 }
    );
  }
}
