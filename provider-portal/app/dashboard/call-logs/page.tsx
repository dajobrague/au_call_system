/**
 * Call Logs Page
 */

'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';

export default function CallLogsPage() {
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchCallLogs();
  }, []);
  
  const fetchCallLogs = async () => {
    try {
      const response = await fetch('/api/provider/call-logs');
      const data = await response.json();
      
      if (data.success) {
        setCallLogs(data.data);
      } else {
        setError(data.error || 'Failed to fetch call logs');
      }
    } catch {
      setError('An error occurred while fetching call logs');
    } finally {
      setLoading(false);
    }
  };
  
  const columns = [
    { key: 'Call SID', label: 'Call ID' },
    { key: 'From', label: 'From' },
    { key: 'To', label: 'To' },
    { 
      key: 'Start Time', 
      label: 'Date/Time',
      render: (value: unknown) => value ? new Date(value as string).toLocaleString() : '-'
    },
    { 
      key: 'Duration', 
      label: 'Duration',
      render: (value: unknown) => value ? `${Math.floor((value as number) / 60)}:${((value as number) % 60).toString().padStart(2, '0')}` : '-'
    },
    { key: 'Status', label: 'Status' },
  ];
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Call Logs</h1>
        <p className="text-gray-600 mt-1">View call history for your provider</p>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow">
        <DataTable 
          columns={columns} 
          data={callLogs} 
          loading={loading}
          emptyMessage="No call logs found"
        />
      </div>
    </div>
  );
}








