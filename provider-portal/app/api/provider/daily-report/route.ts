/**
 * Daily Report API Route
 * Comprehensive daily report data for a single date
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getCallLogsByDateRange,
  getProviderById,
  getEmployeesByProvider,
  getPatientsByProvider,
  findRecordsByProvider,
} from '@/lib/airtable';
import {
  aggregateDailyReport,
  type CallLogRawData,
  type OccurrenceRawData,
  type ProviderRawData,
  type EmployeeRawData,
  type PatientRawData,
} from '@/lib/daily-report-aggregation';
import { parse } from 'date-fns';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // Format: YYYY-MM-DD
    
    if (!dateParam) {
      return NextResponse.json(
        { error: 'date parameter is required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    
    // Parse and validate date
    let targetDate: Date;
    try {
      targetDate = parse(dateParam, 'yyyy-MM-dd', new Date());
      if (isNaN(targetDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }
    
    // Fetch all required data in parallel
    const [callLogs, provider, employees, patients, occurrences] = await Promise.all([
      // Call logs for the specific date
      getCallLogsByDateRange(
        user.providerId,
        dateParam,
        dateParam
      ),
      
      // Provider info including on-call hours
      getProviderById(user.providerId),
      
      // All employees for this provider
      getEmployeesByProvider(user.providerId),
      
      // All patients for this provider
      getPatientsByProvider(user.providerId),
      
      // Job occurrences for the date (for cancellations)
      fetchOccurrencesForDate(user.providerId, dateParam),
    ]);
    
    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }
    
    // Aggregate the data into comprehensive report format
    const reportData = aggregateDailyReport(
      targetDate,
      callLogs as unknown as CallLogRawData[],
      occurrences as unknown as OccurrenceRawData[],
      provider as unknown as ProviderRawData,
      employees as unknown as EmployeeRawData[],
      patients as unknown as PatientRawData[]
    );
    
    return NextResponse.json({
      success: true,
      date: dateParam,
      data: reportData,
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate daily report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch job occurrences for a specific date
 * Filters for cancellations and open shifts
 */
async function fetchOccurrencesForDate(
  providerId: string,
  date: string
): Promise<unknown[]> {
  try {
    // Fetch all occurrences for this provider
    const allOccurrences = await findRecordsByProvider(
      'Job Occurrences',
      providerId,
      [
        'Occurrence ID',
        'Status',
        'Scheduled At',
        'Time',
        'Assigned Employee',
        'Patient (Lookup)', // For template-based occurrences
        'Patient (Link)',   // For non-template occurrences
        'Reschedule Reason',
        'Patient TXT',
        'Employee TXT',
        'SMS Wave 1 Sent At',
        'SMS Wave 2 Sent At',
        'SMS Wave 3 Sent At',
        'SMS Staff Contacted',
      ]
    );
    
    // Filter for the specific date and relevant statuses
    const filtered = allOccurrences.filter((occ) => {
      const fields = occ.fields as Record<string, unknown>;
      const scheduledAt = fields['Scheduled At'];
      if (!scheduledAt) return false;
      
      // Check if scheduled date matches target date
      if (scheduledAt !== date) return false;
      
      // Include if it has a reschedule reason (was cancelled/left open)
      return !!fields['Reschedule Reason'];
    });
    
    return filtered;
  } catch (error) {
    console.error('Error fetching occurrences:', error);
    return [];
  }
}

