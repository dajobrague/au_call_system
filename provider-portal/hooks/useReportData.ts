/**
 * Custom hook for fetching and aggregating report data
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { aggregateCallData, type AggregatedStatistics, type CallLogData } from '@/lib/report-aggregation';
import type { DateRange } from '@/components/reports/DateSelector';

interface UseReportDataResult {
  statistics: AggregatedStatistics | null;
  callLogs: CallLogData[];
  loading: boolean;
  error: string;
  refetch: () => void;
}

export function useReportData(dateRange: DateRange): UseReportDataResult {
  const [callLogs, setCallLogs] = useState<CallLogData[]>([]);
  const [statistics, setStatistics] = useState<AggregatedStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const fetchData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const startDate = format(dateRange.startDate, 'yyyy-MM-dd');
      const endDate = format(dateRange.endDate, 'yyyy-MM-dd');
      
      const response = await fetch(
        `/api/provider/call-logs?startDate=${startDate}&endDate=${endDate}`
      );
      
      const data = await response.json();
      
      if (data.success) {
        const logs = data.data as CallLogData[];
        setCallLogs(logs);
        
        // Aggregate the data
        const aggregated = aggregateCallData(logs);
        setStatistics(aggregated);
      } else {
        setError(data.error || 'Failed to fetch call logs');
        setCallLogs([]);
        setStatistics(null);
      }
    } catch (_err) {
      setError('An error occurred while fetching call logs');
      setCallLogs([]);
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [dateRange]);
  
  return {
    statistics,
    callLogs,
    loading,
    error,
    refetch: fetchData
  };
}

