/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Job Templates Page with CRUD functionality
 */

'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import { Plus, Edit, Trash2, X, Save } from 'lucide-react';
import { generateTimeSlots, formatTimeSlot } from '@/lib/time-slots';

interface JobTemplate {
  id: string;
  fields: {
    'Job Code': string;
    'Title': string;
    'Service Type': string;
    'Priority': string;
    'Active'?: boolean;
    'Time Window Start'?: string;
    'Time Window End'?: string;
    'Default Employee'?: string[];
    'Patient'?: string[];
  };
}

interface Employee {
  id: string;
  fields: {
    'Display Name': string;
  };
}

interface Patient {
  id: string;
  fields: {
    'Patient Full Name': string;
  };
}

interface FormData {
  jobCode: string;
  title: string;
  serviceType: string;
  priority: string;
  patientRecordId: string;
  defaultEmployeeRecordId: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  active: boolean;
}

export default function JobTemplatesPage() {
  const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    jobCode: '',
    title: '',
    serviceType: 'Home Health',
    priority: 'Normal',
    patientRecordId: '',
    defaultEmployeeRecordId: '',
    timeWindowStart: '09:00',
    timeWindowEnd: '17:00',
    active: true,
  });
  
  const timeSlots = generateTimeSlots();
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const [templatesRes, employeesRes, patientsRes] = await Promise.all([
        fetch('/api/provider/job-templates'),
        fetch('/api/provider/employees'),
        fetch('/api/provider/patients'),
      ]);
      
      const [templatesData, employeesData, patientsData] = await Promise.all([
        templatesRes.json(),
        employeesRes.json(),
        patientsRes.json(),
      ]);
      
      if (templatesData.success) {
        setJobTemplates(templatesData.data);
      }
      if (employeesData.success) {
        setEmployees(employeesData.data);
      }
      if (patientsData.success) {
        setPatients(patientsData.data);
      }
    } catch (err) {
      setError('An error occurred while fetching data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAdd = () => {
    setEditingTemplate(null);
    setFormData({
      jobCode: '',
      title: '',
      serviceType: 'Home Health',
      priority: 'Normal',
      patientRecordId: '',
      defaultEmployeeRecordId: '',
      timeWindowStart: '09:00',
      timeWindowEnd: '17:00',
      active: true,
    });
    setShowModal(true);
    setError('');
    setSuccess('');
  };
  
  const handleEdit = (template: JobTemplate) => {
    setEditingTemplate(template);
    setFormData({
      jobCode: template.fields['Job Code'] || '',
      title: template.fields['Title'] || '',
      serviceType: template.fields['Service Type'] || 'Home Health',
      priority: template.fields['Priority'] || 'Normal',
      patientRecordId: template.fields['Patient']?.[0] || '',
      defaultEmployeeRecordId: template.fields['Default Employee']?.[0] || '',
      timeWindowStart: template.fields['Time Window Start'] || '09:00',
      timeWindowEnd: template.fields['Time Window End'] || '17:00',
      active: template.fields['Active'] !== false,
    });
    setShowModal(true);
    setError('');
    setSuccess('');
  };
  
  const handleDelete = async (template: JobTemplate) => {
    if (!confirm(`Are you sure you want to delete job template "${template.fields['Job Code']}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/provider/job-templates?recordId=${template.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Job template deleted successfully!');
        fetchData();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to delete job template');
      }
    } catch (err) {
      setError('An error occurred while deleting job template');
      console.error(err);
    }
  };
  
  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.jobCode || !formData.title || !formData.serviceType || !formData.priority || !formData.patientRecordId) {
      setError('Please fill in all required fields');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const isEditing = editingTemplate !== null;
      const url = '/api/provider/job-templates';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const body: any = {
        jobCode: formData.jobCode,
        title: formData.title,
        serviceType: formData.serviceType,
        priority: formData.priority,
        patientRecordId: formData.patientRecordId,
        defaultEmployeeRecordId: formData.defaultEmployeeRecordId || null,
        timeWindowStart: formData.timeWindowStart,
        timeWindowEnd: formData.timeWindowEnd,
        active: formData.active,
      };
      
      if (isEditing) {
        body.recordId = editingTemplate.id;
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(isEditing ? 'Job template updated successfully!' : 'Job template created successfully!');
        setShowModal(false);
        fetchData();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || `Failed to ${isEditing ? 'update' : 'create'} job template`);
      }
    } catch (err) {
      setError(`An error occurred while ${editingTemplate ? 'updating' : 'creating'} job template`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };
  
  const getPatientName = (patientIds?: string[]) => {
    if (!patientIds || patientIds.length === 0) return '-';
    const patient = patients.find(p => p.id === patientIds[0]);
    return patient ? patient.fields['Patient Full Name'] : '-';
  };
  
  const getEmployeeName = (employeeIds?: string[]) => {
    if (!employeeIds || employeeIds.length === 0) return '-';
    const employee = employees.find(e => e.id === employeeIds[0]);
    return employee ? employee.fields['Display Name'] : '-';
  };
  
  const columns = [
    { key: 'Job Code', label: 'Job Code' },
    { key: 'Title', label: 'Title' },
    { key: 'Service Type', label: 'Service Type' },
    { key: 'Priority', label: 'Priority' },
    {
      key: 'Patient',
      label: 'Patient',
      render: (value: any) => getPatientName(value)
    },
    {
      key: 'Default Employee',
      label: 'Default Employee',
      render: (value: any) => getEmployeeName(value)
    },
    {
      key: 'Time Window Start',
      label: 'Shift Start',
      render: (value: any) => value ? formatTimeSlot(value) : '-'
    },
    {
      key: 'Time Window End',
      label: 'Shift End',
      render: (value: any) => value ? formatTimeSlot(value) : '-'
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
      key: 'id',
      label: 'Actions',
      render: (_value: any, row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="text-blue-600 hover:text-blue-900 p-1"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="text-red-600 hover:text-red-900 p-1"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Templates</h1>
          <p className="text-gray-600 mt-1">Manage job templates for your provider</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Job Template
        </button>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-700 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-700 hover:text-green-900">
            <X className="w-4 h-4" />
          </button>
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
      
      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingTemplate ? 'Edit Job Template' : 'Add New Job Template'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Job Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.jobCode}
                      onChange={(e) => setFormData({ ...formData, jobCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ABC123"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Low">Low</option>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Patient Visit"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.serviceType}
                    onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Home Health">Home Health</option>
                    <option value="Personal Care">Personal Care</option>
                    <option value="Nursing">Nursing</option>
                    <option value="Therapy">Therapy</option>
                    <option value="Companion Care">Companion Care</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.patientRecordId}
                    onChange={(e) => setFormData({ ...formData, patientRecordId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.fields['Patient Full Name']}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Employee
                  </label>
                  <select
                    value={formData.defaultEmployeeRecordId}
                    onChange={(e) => setFormData({ ...formData, defaultEmployeeRecordId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Default Employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fields['Display Name']}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shift Start Time
                    </label>
                    <select
                      value={formData.timeWindowStart}
                      onChange={(e) => setFormData({ ...formData, timeWindowStart: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {timeSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {formatTimeSlot(slot)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shift End Time
                    </label>
                    <select
                      value={formData.timeWindowEnd}
                      onChange={(e) => setFormData({ ...formData, timeWindowEnd: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {timeSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {formatTimeSlot(slot)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="active" className="ml-2 block text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
