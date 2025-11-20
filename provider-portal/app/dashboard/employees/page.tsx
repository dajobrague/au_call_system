/**
 * Employees Page
 */

'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchEmployees();
  }, []);
  
  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/provider/employees');
      const data = await response.json();
      
      if (data.success) {
        setEmployees(data.data);
      } else {
        setError(data.error || 'Failed to fetch employees');
      }
    } catch {
      setError('An error occurred while fetching employees');
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
    { key: 'Display Name', label: 'Name' },
    { 
      key: 'Phone', 
      label: 'Phone',
      render: (value: unknown) => formatPhoneNumber(value as string)
    },
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
    { 
      key: 'Notes', 
      label: 'Notes',
      render: (value: unknown) => {
        const notes = value as string;
        return (
          <span className="truncate max-w-xs block" title={notes}>
            {notes || '-'}
          </span>
        );
      }
    },
  ];
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <p className="text-gray-600 mt-1">View employees linked to your provider</p>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow">
        <DataTable 
          columns={columns} 
          data={employees} 
          loading={loading}
          emptyMessage="No employees found"
        />
      </div>
    </div>
  );
}

