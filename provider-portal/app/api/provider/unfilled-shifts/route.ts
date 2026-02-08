/**
 * Unfilled Shifts API
 * Returns shifts that were not picked up after all outbound call retries
 * Provider-scoped via authenticated session
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUnfilledShiftsByProvider, getCallLogsByOccurrence } from '@/lib/airtable';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/provider/unfilled-shifts
 * Returns unfilled shifts with optional call attempt history
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const providerId = user.providerId;
    const { searchParams } = new URL(request.url);
    const includeCallHistory = searchParams.get('includeCallHistory') !== 'false';

    // Fetch unfilled shifts for the provider
    const unfilledShifts = await getUnfilledShiftsByProvider(providerId);

    // Optionally enrich with call attempt history
    let enrichedShifts = unfilledShifts.map(shift => ({
      id: shift.id,
      fields: shift.fields,
      callAttempts: [] as Array<Record<string, unknown>>,
    }));

    if (includeCallHistory && unfilledShifts.length > 0) {
      // Fetch call logs for each unfilled shift (in parallel, max 5 concurrent)
      const batchSize = 5;
      for (let i = 0; i < enrichedShifts.length; i += batchSize) {
        const batch = enrichedShifts.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (shift) => {
            const occurrenceId = shift.id;
            const callLogs = await getCallLogsByOccurrence(providerId, occurrenceId);
            return { shiftId: occurrenceId, callLogs };
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            const shiftIndex = enrichedShifts.findIndex(s => s.id === result.value.shiftId);
            if (shiftIndex !== -1) {
              enrichedShifts[shiftIndex].callAttempts = result.value.callLogs.map(log => ({
                id: log.id,
                ...log.fields,
              }));
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      shifts: enrichedShifts,
      total: enrichedShifts.length,
    });
  } catch (error) {
    console.error('Error fetching unfilled shifts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unfilled shifts' },
      { status: 500 }
    );
  }
}
