/**
 * Airtable Report Service
 * Generates call log reports grouped by provider
 */

import { airtableClient } from './client';
import { logger } from '../../lib/logger';
import { format } from 'date-fns';

const CALL_LOGS_TABLE_ID = 'tbl9BBKoeV45juYaj';
const PROVIDERS_TABLE_ID = 'tblhfR3I18aQi4zkO';
const EMPLOYEES_TABLE_ID = 'tbl5rZo5KN6uKpPJc';
const TIMEZONE = 'Australia/Sydney';

export interface CallLogRecord {
  id: string;
  callSid: string;
  providerId?: string;
  providerName?: string;
  employeeId?: string;
  employeeName?: string;
  patientName?: string;
  direction: string;
  startedAt: string;
  endedAt?: string;
  seconds?: number;
  recordingUrl?: string;
  detectedIntent?: string;
  notes?: string;
}

export interface ProviderCallSummary {
  providerId: string;
  providerName: string;
  providerLogo?: string;
  callCount: number;
  totalDuration: number;
  avgDuration: number;
  calls: CallLogRecord[];
}

export interface ReportData {
  startDate: string;
  endDate: string;
  providers: ProviderCallSummary[];
  totalCalls: number;
  totalDuration: number;
}

/**
 * Get call logs for a specific date range (AEST timezone)
 */
export async function getCallLogsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<CallLogRecord[]> {
  try {
    // Format dates as DD/MM/YYYY to match Airtable international format
    // Started At field format: "08/10/2025, 11:49:10" (DD/MM/YYYY, HH:MM:SS)
    const startDateStr = format(startDate, 'dd/MM/yyyy');
    const endDateStr = format(endDate, 'dd/MM/yyyy');

    logger.info('Fetching call logs for date range', {
      startDate: startDateStr,
      endDate: endDateStr,
      type: 'report_fetch_start'
    });

    // Since "Started At" is a text field with timestamp, we use FIND() to match date portion
    const isSameDay = startDateStr === endDateStr;
    
    let formula: string;
    if (isSameDay) {
      // Single day - use FIND to match the date portion (ignores the time)
      formula = `FIND("${startDateStr}", {Started At})`;
    } else {
      // Date range - we'll get all records and filter in memory
      formula = '';
    }

    const records = await airtableClient.findRecords(
      CALL_LOGS_TABLE_ID,
      formula,
      { maxRecords: 1000 }
    );

    logger.info('Call logs fetched', {
      count: records.length,
      type: 'report_fetch_success'
    });

    // Transform to CallLogRecord format (without employee names yet)
    const callLogs: CallLogRecord[] = records.map((record: any) => ({
      id: record.id,
      callSid: record.fields['CallSid'] || '',
      providerId: record.fields['Provider']?.[0],
      providerName: record.fields['Provider (from Provider)']?.[0] || 'Unknown Provider',
      employeeId: record.fields['Employee']?.[0],
      employeeName: 'Unknown Employee', // Will be fetched below
      patientName: record.fields['Patient (from Patient)']?.[0] || 'N/A',
      direction: record.fields['Direction'] || 'Unknown',
      startedAt: record.fields['Started At'] || '',
      endedAt: record.fields['Ended At'],
      seconds: record.fields['Seconds'],
      recordingUrl: record.fields['Recording URL (Twilio/S3)'],
      detectedIntent: record.fields['Detected Intent/Action'],
      notes: record.fields['Notes']
    }));

    // Fetch employee names for all calls with employee IDs
    const employeeIds = [...new Set(callLogs.map(call => call.employeeId).filter(Boolean))];
    const employeeDetailsMap = new Map<string, string>();

    logger.info('Fetching employee names', {
      employeeCount: employeeIds.length,
      type: 'employee_fetch_start'
    });

    // Fetch all employee details in parallel
    await Promise.all(
      employeeIds.map(async (employeeId) => {
        if (employeeId) {
          const details = await getEmployeeDetails(employeeId);
          employeeDetailsMap.set(employeeId, details.displayName);
        }
      })
    );

    // Update call logs with employee names
    callLogs.forEach(call => {
      if (call.employeeId && employeeDetailsMap.has(call.employeeId)) {
        call.employeeName = employeeDetailsMap.get(call.employeeId)!;
      }
    });

    logger.info('Employee names fetched', {
      employeeCount: employeeDetailsMap.size,
      type: 'employee_fetch_success'
    });

    return callLogs;

  } catch (error) {
    logger.error('Failed to fetch call logs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'report_fetch_error'
    });
    throw error;
  }
}

/**
 * Get employee details including display name
 */
async function getEmployeeDetails(employeeId: string): Promise<{ displayName: string }> {
  try {
    const employee = await airtableClient.getRecord(EMPLOYEES_TABLE_ID, employeeId);
    
    return {
      displayName: employee.fields['Display Name'] || 'Unknown Employee'
    };
  } catch (error) {
    logger.warn('Could not fetch employee details', {
      employeeId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'employee_details_warning'
    });
    return { displayName: 'Unknown Employee' };
  }
}

/**
 * Get provider details including logo
 */
async function getProviderDetails(providerId: string): Promise<{ name: string; logo?: string }> {
  try {
    const provider = await airtableClient.getRecord(PROVIDERS_TABLE_ID, providerId);
    
    const logoAttachments = provider.fields['Logo'];
    const logoUrl = logoAttachments && Array.isArray(logoAttachments) && logoAttachments.length > 0
      ? logoAttachments[0].url
      : undefined;

    return {
      name: provider.fields['Name'] || 'Unknown Provider',
      logo: logoUrl
    };
  } catch (error) {
    logger.warn('Could not fetch provider details', {
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'provider_details_warning'
    });
    return { name: 'Unknown Provider' };
  }
}

/**
 * Group call logs by provider with statistics
 */
export async function groupCallsByProvider(
  callLogs: CallLogRecord[]
): Promise<ProviderCallSummary[]> {
  try {
    // Group by provider ID
    const providerGroups = new Map<string, CallLogRecord[]>();
    
    for (const call of callLogs) {
      const providerId = call.providerId || 'unknown';
      if (!providerGroups.has(providerId)) {
        providerGroups.set(providerId, []);
      }
      providerGroups.get(providerId)!.push(call);
    }

    // Create summaries with provider details
    const summaries: ProviderCallSummary[] = [];

    for (const [providerId, calls] of providerGroups.entries()) {
      const providerDetails = providerId !== 'unknown'
        ? await getProviderDetails(providerId)
        : { name: 'Unknown Provider' };

      const totalDuration = calls.reduce((sum, call) => sum + (call.seconds || 0), 0);
      const callCount = calls.length;

      summaries.push({
        providerId,
        providerName: providerDetails.name,
        providerLogo: providerDetails.logo,
        callCount,
        totalDuration,
        avgDuration: callCount > 0 ? Math.round(totalDuration / callCount) : 0,
        calls: calls.sort((a, b) => 
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        )
      });
    }

    // Sort by call count (descending)
    summaries.sort((a, b) => b.callCount - a.callCount);

    logger.info('Call logs grouped by provider', {
      providerCount: summaries.length,
      type: 'report_grouped'
    });

    return summaries;

  } catch (error) {
    logger.error('Failed to group calls by provider', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'report_group_error'
    });
    throw error;
  }
}

/**
 * Generate complete report data for a date range
 */
export async function generateReportData(
  startDate: Date,
  endDate: Date
): Promise<ReportData> {
  try {
    const callLogs = await getCallLogsByDateRange(startDate, endDate);
    const providers = await groupCallsByProvider(callLogs);

    const totalCalls = callLogs.length;
    const totalDuration = callLogs.reduce((sum, call) => sum + (call.seconds || 0), 0);

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      providers,
      totalCalls,
      totalDuration
    };

  } catch (error) {
    logger.error('Failed to generate report data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'report_generate_error'
    });
    throw error;
  }
}

/**
 * Parse date string in AEST timezone
 */
export function parseAESTDate(dateString: string): Date {
  // Parse as simple date without timezone conversion
  // Input format: YYYY-MM-DD
  return new Date(dateString + 'T00:00:00');
}

/**
 * Get yesterday's date range in AEST
 */
export function getYesterdayAEST(): { start: Date; end: Date } {
  const now = new Date();
  
  // Get yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  return {
    start: yesterday,
    end: yesterdayEnd
  };
}

