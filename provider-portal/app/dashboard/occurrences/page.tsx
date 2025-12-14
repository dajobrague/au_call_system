/**
 * Job Occurrences Page
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import DataTable from '@/components/DataTable';
import OccurrencesManagement, { OccurrencesManagementRef, Occurrence } from '@/components/data-entry/OccurrencesManagement';
import { Filter, Trash2, Edit } from 'lucide-react';

interface OccurrenceRecord {
  id: string;
  fields: {
    'Patient TXT'?: string;
    'Employee TXT'?: string;
    'Scheduled At'?: string;
    'Time'?: string;
    'Time Window End'?: string;
    'Status'?: string;
    'Patient (Link)'?: string[];
    'Patient (Lookup)'?: string[];
    'Assigned Employee'?: string[];
  };
}

interface Employee {
  id: string;
  name: string;
}

interface Patient {
  id: string;
  name: string;
}

export default function OccurrencesPage() {
  const [occurrences, setOccurrences] = useState<OccurrenceRecord[]>([]);
  const [filteredOccurrences, setFilteredOccurrences] = useState<OccurrenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  
  // Unique lists for filters
  const [employees, setEmployees] = useState<string[]>([]);
  const [patients, setPatients] = useState<string[]>([]);
  
  // Employees and Patients for Management Component
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  
  // Ref for OccurrencesManagement component
  const occurrencesManagementRef = useRef<OccurrencesManagementRef>(null);
  
  const applyFilters = useCallback(() => {
    let filtered = [...occurrences];
    
    // Filter by employee
    if (selectedEmployee) {
      filtered = filtered.filter(
        (occ) => occ.fields['Employee TXT'] === selectedEmployee
      );
    }
    
    // Filter by patient
    if (selectedPatient) {
      filtered = filtered.filter(
        (occ) => occ.fields['Patient TXT'] === selectedPatient
      );
    }
    
    // Filter by date
    if (selectedDate) {
      filtered = filtered.filter((occ) => {
        const occDate = occ.fields['Scheduled At'];
        if (!occDate) return false;
        
        // Compare just the date part (YYYY-MM-DD)
        const occDateStr = new Date(occDate).toISOString().split('T')[0];
        return occDateStr === selectedDate;
      });
    }
    
    setFilteredOccurrences(filtered);
  }, [occurrences, selectedEmployee, selectedPatient, selectedDate]);
  
  useEffect(() => {
    fetchOccurrences();
    fetchEmployees();
    fetchPatients();
  }, []);
  
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);
  
  const fetchOccurrences = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/provider/occurrences');
      const data = await response.json();
      
      if (data.success) {
        setOccurrences(data.data);
        
        // Extract unique employees and patients for filter dropdowns
        const uniqueEmployees = Array.from(
          new Set(
            data.data
              .map((occ: OccurrenceRecord) => occ.fields['Employee TXT'])
              .filter((name: string | undefined): name is string => !!name)
          )
        ) as string[];
        
        const uniquePatients = Array.from(
          new Set(
            data.data
              .map((occ: OccurrenceRecord) => occ.fields['Patient TXT'])
              .filter((name: string | undefined): name is string => !!name)
          )
        ) as string[];
        
        setEmployees(uniqueEmployees.sort());
        setPatients(uniquePatients.sort());
      } else {
        setError(data.error || 'Failed to fetch occurrences');
      }
    } catch {
      setError('An error occurred while fetching occurrences');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/provider/employees');
      const data = await response.json();
      
      if (data.success) {
        const empList = data.data.map((emp: { id: string; fields: { 'Display Name': string } }) => ({
          id: emp.id,
          name: emp.fields['Display Name']
        }));
        setEmployeesList(empList);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };
  
  const fetchPatients = async () => {
    try {
      const response = await fetch('/api/provider/patients');
      const data = await response.json();
      
      if (data.success) {
        const patList = data.data.map((pat: { id: string; fields: { 'Patient Full Name': string } }) => ({
          id: pat.id,
          name: pat.fields['Patient Full Name']
        }));
        setPatientsList(patList);
      }
    } catch (_error) {
      console.error('Error fetching patients:', _error);
    }
  };
  
  const clearFilters = () => {
    setSelectedEmployee('');
    setSelectedPatient('');
    setSelectedDate('');
  };
  
  const handleEdit = (record: OccurrenceRecord) => {
    // Get the correct patient record ID from Patient (Link) field
    const patientLinkField = record.fields['Patient (Link)'] || record.fields['Patient (Lookup)'];
    const patientRecordId = Array.isArray(patientLinkField) && patientLinkField.length > 0 
      ? patientLinkField[0] 
      : '';
    
    // Transform OccurrenceRecord to Occurrence format
    const occurrence: Occurrence = {
      id: record.id,
      patientName: record.fields['Patient TXT'] || '',
      patientRecordId,
      employeeName: record.fields['Employee TXT'] || '',
      employeeRecordId: record.fields['Assigned Employee']?.[0] || '',
      scheduledAt: record.fields['Scheduled At'] || '',
      time: record.fields['Time'] || '09:00',
      timeWindowEnd: record.fields['Time Window End'] || '10:00',
      status: record.fields['Status'] || 'Scheduled'
    };
    
    occurrencesManagementRef.current?.openEditModal(occurrence);
  };
  
  const handleDelete = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this occurrence?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/provider/occurrences?recordId=${recordId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchOccurrences();
      } else {
        alert(data.error || 'Failed to delete occurrence');
      }
    } catch (_err) {
      alert('An error occurred while deleting');
    }
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
      render: (value: unknown) => value ? new Date(value as string).toLocaleDateString() : '-'
    },
    { 
      key: 'Time', 
      label: 'Time Window Start'
    },
    { 
      key: 'Time Window End', 
      label: 'Time Window End'
    },
    { 
      key: 'Status', 
      label: 'Status',
      render: (value: unknown) => {
        const status = value as string;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
            status === 'Completed' ? 'bg-green-100 text-green-800' :
            status === 'Cancelled' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {status || '-'}
          </span>
        );
      }
    },
    {
      key: '_actions',
      label: 'Actions',
      render: (_value: unknown, row: OccurrenceRecord) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];
  
  const hasActiveFilters = selectedEmployee || selectedPatient || selectedDate;
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job Occurrences</h1>
        <p className="text-gray-600 mt-1">View and manage scheduled job occurrences</p>
      </div>
      
      {/* Occurrences Management */}
      <OccurrencesManagement
        ref={occurrencesManagementRef}
        employees={employeesList}
        patients={patientsList}
        onOccurrenceAdded={fetchOccurrences}
        onOccurrenceUpdated={fetchOccurrences}
        onOccurrenceDeleted={fetchOccurrences}
      />
      
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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

