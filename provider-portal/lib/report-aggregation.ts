/**
 * Report Data Aggregation Utilities
 * Processes call log data for statistics and charts
 */

import { airtableDateToYYYYMMDD } from './timezone-utils';

export interface CallLogData {
  id: string;
  fields: {
    CallSid: string;
    Provider?: string[];
    Employee?: string[];
    Patient?: string[];
    Direction: string;
    'Started At': string;
    'Ended At'?: string;
    'Detected Intent/Action'?: string;
    Seconds?: number;
    'Recording URL (Twilio/S3)'?: string;
    Notes?: string;
  };
}

export interface AggregatedStatistics {
  totalCalls: number;
  totalDuration: number; // in seconds
  averageDuration: number; // in seconds
  activeEmployees: number;
  callsByEmployee: EmployeeStats[];
  callsByIntent: IntentStats[];
  callsByDate: DateStats[];
  callsByDuration: DurationBuckets;
}

export interface EmployeeStats {
  employeeId: string;
  employeeName: string;
  callCount: number;
  totalDuration: number;
  averageDuration: number;
}

export interface IntentStats {
  intent: string;
  count: number;
  percentage: number;
}

export interface DateStats {
  date: string; // YYYY-MM-DD
  callCount: number;
  totalDuration: number;
}

export interface DurationBuckets {
  short: number; // < 30 seconds
  medium: number; // 30s - 2min
  long: number; // > 2min
}

/**
 * Main aggregation function
 */
export function aggregateCallData(callLogs: CallLogData[]): AggregatedStatistics {
  if (callLogs.length === 0) {
    return {
      totalCalls: 0,
      totalDuration: 0,
      averageDuration: 0,
      activeEmployees: 0,
      callsByEmployee: [],
      callsByIntent: [],
      callsByDate: [],
      callsByDuration: { short: 0, medium: 0, long: 0 }
    };
  }
  
  return {
    totalCalls: callLogs.length,
    totalDuration: calculateTotalDuration(callLogs),
    averageDuration: calculateAverageDuration(callLogs),
    activeEmployees: countActiveEmployees(callLogs),
    callsByEmployee: groupByEmployee(callLogs),
    callsByIntent: groupByIntent(callLogs),
    callsByDate: groupByDate(callLogs),
    callsByDuration: groupByDurationBuckets(callLogs)
  };
}

/**
 * Calculate total duration across all calls
 */
function calculateTotalDuration(callLogs: CallLogData[]): number {
  return callLogs.reduce((total, log) => {
    return total + (log.fields.Seconds || 0);
  }, 0);
}

/**
 * Calculate average call duration
 */
function calculateAverageDuration(callLogs: CallLogData[]): number {
  const totalDuration = calculateTotalDuration(callLogs);
  return callLogs.length > 0 ? Math.round(totalDuration / callLogs.length) : 0;
}

/**
 * Count unique active employees
 */
function countActiveEmployees(callLogs: CallLogData[]): number {
  const employeeIds = new Set<string>();
  callLogs.forEach(log => {
    const employees = log.fields.Employee;
    if (employees && employees.length > 0) {
      employees.forEach(empId => employeeIds.add(empId));
    }
  });
  return employeeIds.size;
}

/**
 * Group calls by employee
 */
function groupByEmployee(callLogs: CallLogData[]): EmployeeStats[] {
  const employeeMap = new Map<string, { callCount: number; totalDuration: number }>();
  
  callLogs.forEach(log => {
    const employees = log.fields.Employee;
    if (employees && employees.length > 0) {
      const empId = employees[0]; // Use first employee if multiple
      const duration = log.fields.Seconds || 0;
      
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, { callCount: 0, totalDuration: 0 });
      }
      
      const stats = employeeMap.get(empId)!;
      stats.callCount++;
      stats.totalDuration += duration;
    }
  });
  
  // Convert to array and calculate averages
  const employeeStats: EmployeeStats[] = Array.from(employeeMap.entries()).map(([empId, stats]) => ({
    employeeId: empId,
    employeeName: `Employee ${empId.substring(0, 8)}`, // Shortened ID as placeholder
    callCount: stats.callCount,
    totalDuration: stats.totalDuration,
    averageDuration: Math.round(stats.totalDuration / stats.callCount)
  }));
  
  // Sort by call count descending
  return employeeStats.sort((a, b) => b.callCount - a.callCount);
}

/**
 * Group calls by detected intent/action
 */
function groupByIntent(callLogs: CallLogData[]): IntentStats[] {
  const intentMap = new Map<string, number>();
  
  callLogs.forEach(log => {
    const intent = log.fields['Detected Intent/Action'] || 'Unknown';
    
    // Extract main intent (take first action if multiple)
    const mainIntent = intent.split(';')[0].trim();
    
    if (!intentMap.has(mainIntent)) {
      intentMap.set(mainIntent, 0);
    }
    
    intentMap.set(mainIntent, intentMap.get(mainIntent)! + 1);
  });
  
  const totalCalls = callLogs.length;
  
  // Convert to array and calculate percentages
  const intentStats: IntentStats[] = Array.from(intentMap.entries()).map(([intent, count]) => ({
    intent,
    count,
    percentage: Math.round((count / totalCalls) * 100)
  }));
  
  // Sort by count descending
  return intentStats.sort((a, b) => b.count - a.count);
}

/**
 * Group calls by date for time series
 */
function groupByDate(callLogs: CallLogData[]): DateStats[] {
  const dateMap = new Map<string, { callCount: number; totalDuration: number }>();
  
  callLogs.forEach(log => {
    const startedAt = log.fields['Started At'];
    if (!startedAt) return;
    
    // Use timezone utility to convert Airtable date to YYYY-MM-DD
    const dateKey = airtableDateToYYYYMMDD(startedAt);
    if (!dateKey) return;
    
    const duration = log.fields.Seconds || 0;
    
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, { callCount: 0, totalDuration: 0 });
    }
    
    const stats = dateMap.get(dateKey)!;
    stats.callCount++;
    stats.totalDuration += duration;
  });
  
  // Convert to array
  const dateStats: DateStats[] = Array.from(dateMap.entries()).map(([date, stats]) => ({
    date,
    callCount: stats.callCount,
    totalDuration: stats.totalDuration
  }));
  
  // Sort by date ascending
  return dateStats.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group calls by duration buckets
 */
function groupByDurationBuckets(callLogs: CallLogData[]): DurationBuckets {
  const buckets: DurationBuckets = {
    short: 0,  // < 30 seconds
    medium: 0, // 30s - 2min (120s)
    long: 0    // > 2min
  };
  
  callLogs.forEach(log => {
    const duration = log.fields.Seconds || 0;
    
    if (duration < 30) {
      buckets.short++;
    } else if (duration <= 120) {
      buckets.medium++;
    } else {
      buckets.long++;
    }
  });
  
  return buckets;
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m`;
}

