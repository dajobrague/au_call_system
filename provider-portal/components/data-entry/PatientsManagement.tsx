/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Patients Management Component
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { Plus, Edit, Trash2, X, Save, Eye, AlertTriangle, ChevronDown, Upload, UserPlus } from 'lucide-react';
import MultiSelectEmployee from '../MultiSelectEmployee';
import ImportWizard from '../import/ImportWizard';

interface Patient {
  id: string;
  fields: {
    'Patient Full Name': string;
    'Patient ID': number;
    'Phone': string;
    'DOB': string;
    'Address'?: string;
    'Important Notes'?: string;
    'Active'?: boolean;
    'Related Staff Pool'?: string[];
  };
}

interface PatientFormData {
  patientName: string;
  phone: string;
  dob: string;
  address: string;
  notes: string;
  active: boolean;
  relatedStaffPool: string[];
}

interface Employee {
  id: string;
  fields: {
    'Display Name': string;
  };
}

export default function PatientsManagement() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState<PatientFormData>({
    patientName: '',
    phone: '',
    dob: '',
    address: '',
    notes: '',
    active: true,
    relatedStaffPool: [],
  });
  const [saving, setSaving] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    fetchPatients();
    fetchEmployees();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAddDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    } catch (_err) {
      setError('An error occurred while fetching patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/provider/employees');
      const data = await response.json();
      
      if (data.success) {
        setEmployees(data.data);
      }
    } catch (_err) {
      console.error('Error fetching employees:', _err);
    }
  };
  
  const handleAdd = () => {
    setEditingPatient(null);
    setFormData({
      patientName: '',
      phone: '',
      dob: '',
      address: '',
      notes: '',
      active: true,
      relatedStaffPool: [],
    });
    setShowModal(true);
    setError('');
    setSuccess('');
  };
  
  const handleView = (patient: Patient) => {
    setViewingPatient(patient);
    setShowViewModal(true);
  };

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setFormData({
      patientName: patient.fields['Patient Full Name'] || '',
      phone: patient.fields['Phone'] || '',
      dob: patient.fields['DOB'] || '',
      address: patient.fields['Address'] || '',
      notes: patient.fields['Important Notes'] || '',
      active: patient.fields['Active'] !== false,
      relatedStaffPool: patient.fields['Related Staff Pool'] || [],
    });
    setShowModal(true);
    setError('');
    setSuccess('');
  };
  
  const handleDelete = async (patient: Patient) => {
    if (!confirm(`Are you sure you want to delete ${patient.fields['Patient Full Name']}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/provider/patients?recordId=${patient.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Patient deleted successfully!');
        fetchPatients();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to delete patient');
      }
    } catch (_err) {
      setError('An error occurred while deleting patient');
    }
  };
  
  const handleSubmit = async () => {
    // Validate
    if (!formData.patientName || !formData.phone || !formData.dob) {
      setError('Please fill in all required fields');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const isEditing = editingPatient !== null;
      const url = '/api/provider/patients';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const body: any = {
        patientName: formData.patientName,
        phone: formData.phone,
        dob: formData.dob,
        address: formData.address,
        notes: formData.notes,
        active: formData.active,
        relatedStaffPool: formData.relatedStaffPool,
      };
      
      if (isEditing) {
        body.recordId = editingPatient.id;
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
        setSuccess(isEditing ? 'Patient updated successfully!' : 'Patient added successfully!');
        setShowModal(false);
        fetchPatients();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || `Failed to ${isEditing ? 'update' : 'add'} patient`);
      }
    } catch (_err) {
      setError(`An error occurred while ${editingPatient ? 'updating' : 'adding'} patient`);
    } finally {
      setSaving(false);
    }
  };
  
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getEmployeesByIds = (employeeIds: string[] | undefined) => {
    if (!employeeIds || employeeIds.length === 0) return [];
    const employeeNames = employeeIds
      .map(id => {
        const emp = employees.find(e => e.id === id);
        return emp ? { id, name: emp.fields['Display Name'] } : null;
      })
      .filter(Boolean);
    return employeeNames as { id: string; name: string }[];
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-600 mt-1">Add and manage your patients</p>
        </div>
        
        {/* Add Patient Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowAddDropdown(!showAddDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Patient
            <ChevronDown className="w-4 h-4" />
          </button>

          {showAddDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowAddDropdown(false);
                    handleAdd();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium">Add One Patient</div>
                    <div className="text-xs text-gray-500">Manually enter patient details</div>
                  </div>
                </button>
                <button
                  disabled
                  className="w-full flex items-center gap-3 px-4 py-3 text-left border-t border-gray-100 opacity-50 cursor-not-allowed"
                >
                  <Upload className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-500">Import Patients</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                        Coming Soon
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">Upload CSV file to import</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
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
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DOB
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Related Staff
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No patients found. Click &quot;Add Patient&quot; to get started.
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {patient.fields['Patient Full Name']}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {patient.fields['Patient ID']}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPhoneNumber(patient.fields['Phone'])}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(patient.fields['DOB'])}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1 min-w-[320px] max-w-4xl">
                        {getEmployeesByIds(patient.fields['Related Staff Pool']).length === 0 ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          getEmployeesByIds(patient.fields['Related Staff Pool']).map((emp) => (
                            <span
                              key={emp.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {emp.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        patient.fields['Active'] !== false
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {patient.fields['Active'] !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(patient)}
                          className="text-gray-600 hover:text-gray-900 p-1"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(patient)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(patient)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingPatient ? 'Edit Patient' : 'Add New Patient'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.patientName}
                    onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Jane Smith"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="(555) 123-4567"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="123 Main St, City, State"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Important Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Medical conditions, allergies, etc."
                  />
                </div>
                
                <div>
                  <MultiSelectEmployee
                    employees={employees.map(emp => ({
                      id: emp.id,
                      name: emp.fields['Display Name']
                    }))}
                    selectedIds={formData.relatedStaffPool}
                    onChange={(selectedIds) => setFormData({ ...formData, relatedStaffPool: selectedIds })}
                    label="Related Staff Pool"
                    placeholder="Search and select employees..."
                  />
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

      {/* View-Only Modal */}
      {showViewModal && viewingPatient && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Patient Details
                </h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Warning Banner - No Staff Pool */}
              {(!viewingPatient.fields['Related Staff Pool'] || viewingPatient.fields['Related Staff Pool'].length === 0) && (
                <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900 mb-1">
                        No Staff Pool Assigned
                      </h4>
                      <p className="text-sm text-amber-800">
                        <strong>Warning:</strong> No one will receive open job notifications for this patient because there is no staffing pool associated yet. 
                        Please edit this patient and assign employees to the Related Staff Pool to enable notifications.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Patient Information */}
              <div className="space-y-6">
                {/* Basic Info Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Patient Full Name
                    </label>
                    <p className="text-base text-gray-900 font-medium">
                      {viewingPatient.fields['Patient Full Name']}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Patient ID
                    </label>
                    <p className="text-base text-gray-900">
                      {viewingPatient.fields['Patient ID']}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Phone Number
                    </label>
                    <p className="text-base text-gray-900">
                      {formatPhoneNumber(viewingPatient.fields['Phone'])}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Date of Birth
                    </label>
                    <p className="text-base text-gray-900">
                      {formatDate(viewingPatient.fields['DOB'])}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Status
                    </label>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      viewingPatient.fields['Active'] !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {viewingPatient.fields['Active'] !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Address */}
                {viewingPatient.fields['Address'] && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Address
                    </label>
                    <p className="text-base text-gray-900">
                      {viewingPatient.fields['Address']}
                    </p>
                  </div>
                )}

                {/* Important Notes */}
                {viewingPatient.fields['Important Notes'] && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Important Notes
                    </label>
                    <p className="text-base text-gray-900 whitespace-pre-wrap">
                      {viewingPatient.fields['Important Notes']}
                    </p>
                  </div>
                )}

                {/* Related Staff Pool */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Related Staff Pool
                  </label>
                  {(!viewingPatient.fields['Related Staff Pool'] || viewingPatient.fields['Related Staff Pool'].length === 0) ? (
                    <p className="text-sm text-gray-400 italic">
                      No staff members assigned to this patient's pool
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {getEmployeesByIds(viewingPatient.fields['Related Staff Pool']).map((emp) => (
                        <span
                          key={emp.id}
                          className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                        >
                          {emp.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(viewingPatient);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit Patient
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Wizard */}
      {showImportWizard && (
        <ImportWizard
          onClose={() => {
            setShowImportWizard(false);
            fetchPatients(); // Refresh the patient list after import
          }}
          preselectedFileType="participants"
        />
      )}
    </div>
  );
}

