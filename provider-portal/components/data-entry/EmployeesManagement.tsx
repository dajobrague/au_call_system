/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Employees Pool Management Component
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { Plus, Edit, Trash2, X, Save, ChevronDown, Upload, UserPlus } from 'lucide-react';
import ImportWizard from '../import/ImportWizard';

interface Employee {
  id: string;
  fields: {
    'Display Name': string;
    'Phone': string;
    'Employee PIN': number;
    'Email'?: string;
    'Role'?: string;
    'Notes'?: string;
    'Active'?: boolean;
    'Outbound Call?'?: boolean;
  };
}

interface EmployeeFormData {
  displayName: string;
  phone: string;
  pin: string;
  email: string;
  role: string;
  notes: string;
  active: boolean;
  outboundCall: boolean;
}

export default function EmployeesManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>({
    displayName: '',
    phone: '',
    pin: '',
    email: '',
    role: '',
    notes: '',
    active: true,
    outboundCall: true, // Default to enabled
  });
  const [saving, setSaving] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
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
  
  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/provider/employees');
      const data = await response.json();
      
      if (data.success) {
        setEmployees(data.data);
      } else {
        setError(data.error || 'Failed to fetch employees');
      }
    } catch (_err) {
      setError('An error occurred while fetching employees');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAdd = () => {
    setEditingEmployee(null);
    setFormData({
      displayName: '',
      phone: '',
      pin: '',
      email: '',
      role: '',
      notes: '',
      active: true,
      outboundCall: true, // Default to enabled for new employees
    });
    setShowModal(true);
    setError('');
    setSuccess('');
  };
  
  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      displayName: employee.fields['Display Name'] || '',
      phone: employee.fields['Phone'] || '',
      pin: employee.fields['Employee PIN'] ? employee.fields['Employee PIN'].toString() : '',
      email: employee.fields['Email'] || '',
      role: employee.fields['Role'] || '',
      notes: employee.fields['Notes'] || '',
      active: employee.fields['Active'] !== false,
      outboundCall: employee.fields['Outbound Call?'] !== false, // Default to true if not set
    });
    setShowModal(true);
    setError('');
    setSuccess('');
  };
  
  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to delete ${employee.fields['Display Name']}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/provider/employees?recordId=${employee.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Employee deleted successfully!');
        fetchEmployees();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to delete employee');
      }
    } catch (_err) {
      setError('An error occurred while deleting employee');
    }
  };
  
  const handleSubmit = async () => {
    // Validate
    if (!formData.displayName || !formData.phone || !formData.pin) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (isNaN(parseInt(formData.pin))) {
      setError('PIN must be a valid number');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const isEditing = editingEmployee !== null;
      const url = '/api/provider/employees';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const body: any = {
        displayName: formData.displayName,
        phone: formData.phone,
        pin: formData.pin,
        email: formData.email,
        role: formData.role,
        notes: formData.notes,
        active: formData.active,
        outboundCall: formData.outboundCall,
      };
      
      if (isEditing) {
        body.recordId = editingEmployee.id;
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
        setSuccess(isEditing ? 'Employee updated successfully!' : 'Employee added successfully!');
        setShowModal(false);
        fetchEmployees();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || `Failed to ${isEditing ? 'update' : 'add'} employee`);
      }
    } catch (_err) {
      setError(`An error occurred while ${editingEmployee ? 'updating' : 'adding'} employee`);
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
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees Pool</h1>
          <p className="text-muted-foreground mt-1">Add and manage your employees</p>
        </div>
        
        {/* Add Employee Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowAddDropdown(!showAddDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Employee
            <ChevronDown className="w-4 h-4" />
          </button>

          {showAddDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-card rounded-xl shadow-lg border border-border/60 z-50">
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowAddDropdown(false);
                    handleAdd();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-foreground/80 hover:bg-muted/30 transition-colors"
                >
                  <UserPlus className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-medium">Add One Employee</div>
                    <div className="text-xs text-muted-foreground">Manually enter employee details</div>
                  </div>
                </button>
                <button
                  disabled
                  className="w-full flex items-center gap-3 px-4 py-3 text-left border-t border-border/40 opacity-50 cursor-not-allowed"
                >
                  <Upload className="w-5 h-5 text-muted-foreground/60" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-muted-foreground">Import Employees</span>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                        Coming Soon
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground/60">Upload CSV file to import</div>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border/60">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No employees found. Click &quot;Add Employee&quot; to get started.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {employee.fields['Display Name']}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {formatPhoneNumber(employee.fields['Phone'])}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        employee.fields['Active'] !== false
                          ? 'bg-green-100 text-green-800'
                          : 'bg-muted/50 text-foreground'
                      }`}>
                        {employee.fields['Active'] !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="text-primary hover:text-primary/80 p-1"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee)}
                          className="text-destructive hover:text-destructive/80 p-1"
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
          <div className="bg-card rounded-xl border border-border/60 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    placeholder="John Doe"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    placeholder="(555) 123-4567"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">
                    Employee PIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    placeholder="1234"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    placeholder="employee@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">
                    Role
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    placeholder="e.g., Caregiver, Nurse, Therapist"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    placeholder="Additional notes..."
                  />
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="active"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="h-4 w-4 text-primary focus:ring-primary/20 border-input rounded"
                    />
                    <label htmlFor="active" className="ml-2 block text-sm text-foreground/80">
                      Active
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="outboundCall"
                      checked={formData.outboundCall}
                      onChange={(e) => setFormData({ ...formData, outboundCall: e.target.checked })}
                      className="h-4 w-4 text-primary focus:ring-primary/20 border-input rounded"
                    />
                    <label htmlFor="outboundCall" className="ml-2 block text-sm text-foreground/80">
                      Enable Outbound Calls
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border/60">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-foreground/80 border border-input rounded-lg hover:bg-muted/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
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
            fetchEmployees(); // Refresh the employee list after import
          }}
          preselectedFileType="staff"
        />
      )}
    </div>
  );
}
