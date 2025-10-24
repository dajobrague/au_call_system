/**
 * Job Occurrences Page
 */

'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import { Filter } from 'lucide-react';

export default function OccurrencesPage() {
  const [occurrences, setOccurrences] = useState([]);
  const [filteredOccurrences, setFilteredOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  
  // Unique lists for filters
  const [employees, setEmployees] = useState<string[]>([]);
  const [patients, setPatients] = useState<string[]>([]);
  
  useEffect(() => {
    fetchOccurrences();
  }, []);
  
  useEffect(() => {
    applyFilters();
  }, [occurrences, selectedEmployee, selectedPatient, selectedDate]);
  
  const fetchOccurrences = async () => {
    try {
      const response = await fetch('/api/provider/occurrences');
      const data = await response.json();
      
      if (data.success) {
        setOccurrences(data.data);
        
        // Extract unique employees and patients for filter dropdowns
        const uniqueEmployees = Array.from(
          new Set(
            data.data
              .map((occ: any) => occ.fields['Employee TXT'])
              .filter((name: string) => name)
          )
        ) as string[];
        
        const uniquePatients = Array.from(
          new Set(
            data.data
              .map((occ: any) => occ.fields['Patient TXT'])
              .filter((name: string) => name)
          )
        ) as string[];
        
        setEmployees(uniqueEmployees.sort());
        setPatients(uniquePatients.sort());
      } else {
        setError(data.error || 'Failed to fetch occurrences');
      }
    } catch (err) {
      setError('An error occurred while fetching occurrences');
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilters = () => {
    let filtered = [...occurrences];
    
    // Filter by employee
    if (selectedEmployee) {
      filtered = filtered.filter(
        (occ: any) => occ.fields['Employee TXT'] === selectedEmployee
      );
    }
    
    // Filter by patient
    if (selectedPatient) {
      filtered = filtered.filter(
        (occ: any) => occ.fields['Patient TXT'] === selectedPatient
      );
    }
    
    // Filter by date
    if (selectedDate) {
      filtered = filtered.filter((occ: any) => {
        const occDate = occ.fields['Scheduled At'];
        if (!occDate) return false;
        
        // Compare just the date part (YYYY-MM-DD)
        const occDateStr = new Date(occDate).toISOString().split('T')[0];
        return occDateStr === selectedDate;
      });
    }
    
    setFilteredOccurrences(filtered);
  };
  
  const clearFilters = () => {
    setSelectedEmployee('');
    setSelectedPatient('');
    setSelectedDate('');
  };
  
  const columns = [
    { 
      key: 'Patient TXT', 
      label: 'Patient'
    },
    { 
      key: 'Employee TXT', 
      label: 'Assigned Employee'
    },
    { 
      key: 'Scheduled At', 
      label: 'Scheduled At',
      render: (value: string) => value ? new Date(value).toLocaleDateString() : '-'
    },
    { 
      key: 'Time', 
      label: 'Time'
    },
    { 
      key: 'Status', 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
          value === 'Completed' ? 'bg-green-100 text-green-800' :
          value === 'Cancelled' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value || '-'}
        </span>
      )
    },
  ];
  
  const hasActiveFilters = selectedEmployee || selectedPatient || selectedDate;
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job Occurrences</h1>
        <p className="text-gray-600 mt-1">View scheduled job occurrences</p>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-blue-600 hover:text-blue-800"
            >
              Clear all
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Employee Filter */}
          <div>
            <label htmlFor="employee-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Employee
            </label>
            <select
              id="employee-filter"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Employees</option>
              {employees.map((employee) => (
                <option key={employee} value={employee}>
                  {employee}
                </option>
              ))}
            </select>
          </div>
          
          {/* Patient Filter */}
          <div>
            <label htmlFor="patient-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Patient
            </label>
            <select
              id="patient-filter"
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Patients</option>
              {patients.map((patient) => (
                <option key={patient} value={patient}>
                  {patient}
                </option>
              ))}
            </select>
          </div>
          
          {/* Date Filter */}
          <div>
            <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              id="date-filter"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        {hasActiveFilters && (
          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredOccurrences.length} of {occurrences.length} occurrences
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <DataTable 
          columns={columns} 
          data={filteredOccurrences.length > 0 || hasActiveFilters ? filteredOccurrences : occurrences} 
          loading={loading}
          emptyMessage={hasActiveFilters ? "No occurrences match the selected filters" : "No occurrences found"}
        />
      </div>
    </div>
  );
}

