/**
 * Occurrences Management Component
 * Allows adding, editing, and deleting job occurrences
 */

'use client';

import { useState, useImperativeHandle, forwardRef } from 'react';
import { Plus, X, Loader2, Calendar, Clock, User, UserCircle } from 'lucide-react';
import { generateTimeSlots, formatTimeSlot } from '@/lib/time-slots';

interface Employee {
  id: string;
  name: string;
}

interface Patient {
  id: string;
  name: string;
}

export interface Occurrence {
  id: string;
  patientName: string;
  patientRecordId: string;
  employeeName: string;
  employeeRecordId: string;
  scheduledAt: string;
  time: string;
  timeWindowEnd?: string;
  status: string;
}

interface OccurrencesManagementProps {
  employees: Employee[];
  patients: Patient[];
  onOccurrenceAdded: () => void;
  onOccurrenceUpdated: () => void;
  onOccurrenceDeleted: () => void;
}

export interface OccurrencesManagementRef {
  openEditModal: (occurrence: Occurrence) => void;
}

const OccurrencesManagement = forwardRef<OccurrencesManagementRef, OccurrencesManagementProps>(({
  employees,
  patients,
  onOccurrenceAdded,
  onOccurrenceUpdated,
  onOccurrenceDeleted
}, ref) => {
  const [showModal, setShowModal] = useState(false);
  const [editingOccurrence, setEditingOccurrence] = useState<Occurrence | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Form fields
  const [patientRecordId, setPatientRecordId] = useState('');
  const [employeeRecordId, setEmployeeRecordId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [time, setTime] = useState('09:00');
  const [timeWindowEnd, setTimeWindowEnd] = useState('10:00');
  
  const timeSlots = generateTimeSlots();
  
  const resetForm = () => {
    setPatientRecordId('');
    setEmployeeRecordId('');
    setScheduledAt('');
    setTime('09:00');
    setTimeWindowEnd('10:00');
    setError('');
    setEditingOccurrence(null);
  };
  
  const handleOpenModal = (occurrence?: Occurrence) => {
    if (occurrence) {
      setEditingOccurrence(occurrence);
      setPatientRecordId(occurrence.patientRecordId);
      setEmployeeRecordId(occurrence.employeeRecordId);
      setScheduledAt(occurrence.scheduledAt);
      setTime(occurrence.time);
      setTimeWindowEnd(occurrence.timeWindowEnd || '10:00');
    } else {
      resetForm();
      // Set default date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduledAt(tomorrow.toISOString().split('T')[0]);
    }
    setShowModal(true);
  };
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    openEditModal: (occurrence: Occurrence) => {
      handleOpenModal(occurrence);
    }
  }));
  
  const handleCloseModal = () => {
    setShowModal(false);
    setTimeout(resetForm, 200);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!patientRecordId || !employeeRecordId || !scheduledAt || !time || !timeWindowEnd) {
      setError('All fields are required');
      return;
    }
    
    // Validate that end time is after start time
    if (time >= timeWindowEnd) {
      setError('Time Window End must be after Time Window Start');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const payload = {
        patientRecordId,
        employeeRecordId,
        scheduledAt,
        time,
        timeWindowEnd
      };
      
      if (editingOccurrence) {
        // Update existing occurrence
        const response = await fetch('/api/provider/occurrences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId: editingOccurrence.id,
            ...payload
          }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          onOccurrenceUpdated();
          handleCloseModal();
        } else {
          setError(data.error || 'Failed to update occurrence');
        }
      } else {
        // Create new occurrence
        const response = await fetch('/api/provider/occurrences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        const data = await response.json();
        
        if (data.success) {
          onOccurrenceAdded();
          handleCloseModal();
        } else {
          setError(data.error || 'Failed to create occurrence');
        }
      }
    } catch (_err) {
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  const _handleDelete = async (occurrenceId: string) => {
    if (!confirm('Are you sure you want to delete this occurrence?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/provider/occurrences?recordId=${occurrenceId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        onOccurrenceDeleted();
      } else {
        alert(data.error || 'Failed to delete occurrence');
      }
    } catch (_err) {
      alert('An error occurred while deleting');
    }
  };
  
  return (
    <>
      {/* Add New Occurrence Button */}
      <div className="mb-6">
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add New Occurrence
        </button>
      </div>
      
      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingOccurrence ? 'Edit Occurrence' : 'Add New Occurrence'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              {/* Patient Selection */}
              <div>
                <label htmlFor="patient" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Patient *
                  </div>
                </label>
                <select
                  id="patient"
                  value={patientRecordId}
                  onChange={(e) => setPatientRecordId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a patient...</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Employee Selection */}
              <div>
                <label htmlFor="employee" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4" />
                    Assigned Employee *
                  </div>
                </label>
                <select
                  id="employee"
                  value={employeeRecordId}
                  onChange={(e) => setEmployeeRecordId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select an employee...</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Date Selection */}
              <div>
                <label htmlFor="scheduledAt" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Scheduled Date *
                  </div>
                </label>
                <input
                  type="date"
                  id="scheduledAt"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              {/* Time Window Start */}
              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time Window Start *
                  </div>
                </label>
                <select
                  id="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {formatTimeSlot(slot)}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Time Window End */}
              <div>
                <label htmlFor="timeWindowEnd" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time Window End *
                  </div>
                </label>
                <select
                  id="timeWindowEnd"
                  value={timeWindowEnd}
                  onChange={(e) => setTimeWindowEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {formatTimeSlot(slot)}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingOccurrence ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingOccurrence ? 'Update Occurrence' : 'Create Occurrence'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
});

OccurrencesManagement.displayName = 'OccurrencesManagement';

export default OccurrencesManagement;

