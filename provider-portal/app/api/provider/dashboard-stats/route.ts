/**
 * Dashboard Stats API
 * Returns all dashboard data in a single call for fast rendering.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getEmployeesByProvider,
  getPatientsByProvider,
  getCallLogsByDateRange,
  getOccurrencesByProvider,
} from '@/lib/airtable';
import { format, subDays } from 'date-fns';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

    const [employees, patients, recentCalls, todayOccurrences] =
      await Promise.all([
        getEmployeesByProvider(user.providerId),
        getPatientsByProvider(user.providerId),
        getCallLogsByDateRange(user.providerId, sevenDaysAgo, today),
        getOccurrencesByProvider(user.providerId),
      ]);

    const activeEmployees = employees.filter(
      (e) => e.fields['Active'] !== false,
    ).length;
    const activePatients = patients.filter(
      (p) => p.fields['Active'] !== false,
    ).length;

    const totalCalls = recentCalls.length;
    const totalSeconds = recentCalls.reduce(
      (sum, c) => sum + ((c.fields['Seconds'] as number) || 0),
      0,
    );

    const last5Calls = recentCalls
      .sort((a, b) => {
        const tA = (a.fields['Started At'] as string) || '';
        const tB = (b.fields['Started At'] as string) || '';
        return tB.localeCompare(tA);
      })
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        startedAt: c.fields['Started At'] as string,
        intent:
          (c.fields['Detected Intent/Action'] as string) || 'General inquiry',
        seconds: (c.fields['Seconds'] as number) || 0,
        direction: c.fields['Direction'] as string,
      }));

    const todayShifts = (
      todayOccurrences as Array<{
        id: string;
        fields: Record<string, unknown>;
      }>
    )
      .filter((o) => {
        const scheduled = o.fields['Scheduled At'] as string | undefined;
        return scheduled === today;
      })
      .sort((a, b) => {
        const tA = (a.fields['Time'] as string) || '';
        const tB = (b.fields['Time'] as string) || '';
        return tA.localeCompare(tB);
      })
      .slice(0, 6)
      .map((o) => ({
        id: o.id,
        time: (o.fields['Time'] as string) || '',
        employee: (o.fields['Employee TXT'] as string) || 'Unassigned',
        patient: (o.fields['Patient TXT'] as string) || 'Unknown',
        status: (o.fields['Status'] as string) || 'Scheduled',
      }));

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalCalls,
          totalTalkTimeSeconds: totalSeconds,
          activeEmployees,
          activePatients,
        },
        recentCalls: last5Calls,
        todayShifts,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 },
    );
  }
}
