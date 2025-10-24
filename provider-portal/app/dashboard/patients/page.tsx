/**
 * Patients Page
 */

'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchPatients();
  }, []);
  
  const fetchPatients = async () => {
    try {
      const response = await fetch('/api/provider/patients');
      const data = await response.json();
      
      if (data.success) {
        setPatients(data.data);
      } else {
        setError(data.error || 'Failed to fetch patients');
      }
    } catch (err) {
      setError('An error occurred while fetching patients');
    } finally {
      setLoading(false);
    }
  };
  
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '-';
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; // Return original if not 10 digits
  };

  const columns = [
    { key: 'Patient Full Name', label: 'Name' },
    { 
      key: 'Phone', 
      label: 'Phone',
      render: (value: string) => formatPhoneNumber(value)
    },
    { key: 'Address', label: 'Address' },
    { 
      key: 'Important Notes', 
      label: 'Notes',
      render: (value: string) => (
        <span className="truncate max-w-xs block" title={value}>
          {value || '-'}
        </span>
      )
    },
  ];
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
        <p className="text-gray-600 mt-1">View patients linked to your provider</p>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow">
        <DataTable 
          columns={columns} 
          data={patients} 
          loading={loading}
          emptyMessage="No patients found"
        />
      </div>
    </div>
  );
}

