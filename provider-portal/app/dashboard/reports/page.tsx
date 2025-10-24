/**
 * Reports Page
 */

'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchReports();
  }, []);
  
  const fetchReports = async () => {
    try {
      const response = await fetch('/api/provider/reports');
      const data = await response.json();
      
      if (data.success) {
        setReports(data.data);
      } else {
        setError(data.error || 'Failed to fetch reports');
      }
    } catch (err) {
      setError('An error occurred while fetching reports');
    } finally {
      setLoading(false);
    }
  };
  
  const columns = [
    { key: 'Name', label: 'Report Name' },
    { key: 'Type', label: 'Type' },
    { 
      key: 'Created At', 
      label: 'Generated',
      render: (value: string) => value ? new Date(value).toLocaleString() : '-'
    },
    { 
      key: 'PDF URL', 
      label: 'Download',
      render: (value: string) => value ? (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Download PDF
        </a>
      ) : '-'
    },
  ];
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">View generated reports for your provider</p>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow">
        <DataTable 
          columns={columns} 
          data={reports} 
          loading={loading}
          emptyMessage="No reports found"
        />
      </div>
    </div>
  );
}

