/**
 * Job Templates Page
 */

'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';

export default function JobTemplatesPage() {
  const [jobTemplates, setJobTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchJobTemplates();
  }, []);
  
  const fetchJobTemplates = async () => {
    try {
      const response = await fetch('/api/provider/job-templates');
      const data = await response.json();
      
      if (data.success) {
        setJobTemplates(data.data);
      } else {
        setError(data.error || 'Failed to fetch job templates');
      }
    } catch {
      setError('An error occurred while fetching job templates');
    } finally {
      setLoading(false);
    }
  };
  
  const columns = [
    { key: 'Job Code', label: 'Job Code' },
    { key: 'Title', label: 'Title' },
    { key: 'Service Type', label: 'Service Type' },
    { key: 'Priority', label: 'Priority' },
    { 
      key: 'Active', 
      label: 'Status',
      render: (value: unknown) => {
        const isActive = value as boolean;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        );
      }
    },
  ];
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job Templates</h1>
        <p className="text-gray-600 mt-1">View job templates for your provider</p>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow">
        <DataTable 
          columns={columns} 
          data={jobTemplates} 
          loading={loading}
          emptyMessage="No job templates found"
        />
      </div>
    </div>
  );
}








