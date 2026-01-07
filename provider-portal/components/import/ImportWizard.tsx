/**
 * Import Wizard Component
 * 5-step wizard for CSV imports
 */

'use client';

import { useState, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Upload, Check, AlertTriangle } from 'lucide-react';
import { CSVMappingProfile, FileType } from '@/lib/airtable';
import ColumnMapper from './ColumnMapper';
import DataPreview from './DataPreview';
import ValidationResults from './ValidationResults';

interface ImportWizardProps {
  onClose: () => void;
  initialProfile?: CSVMappingProfile | null;
  preselectedFileType?: FileType | null;
}

interface ParsedData {
  headers: string[];
  preview: Record<string, any>[];
  totalRows: number;
  fileName: string;
}

export default function ImportWizard({ onClose, initialProfile, preselectedFileType }: ImportWizardProps) {
  const [step, setStep] = useState(preselectedFileType ? 2 : 1);
  const [fileType, setFileType] = useState<FileType>(
    preselectedFileType || initialProfile?.fileType || 'staff'
  );
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>(
    initialProfile?.columnMappings.reduce((acc, m) => ({ ...acc, [m.csvColumn]: m.systemField }), {}) || {}
  );
  const [validationResults, setValidationResults] = useState<any>(null);
  const [importResults, setImportResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [saveProfileName, setSaveProfileName] = useState('');
  const [saveProfileChecked, setSaveProfileChecked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileTypeDescriptions: Record<FileType, { name: string; description: string }> = {
    staff: {
      name: 'Staff (Employees)',
      description: 'Upload employee data with phone numbers, names, and details'
    },
    participants: {
      name: 'Participants (Patients)',
      description: 'Upload patient data including phone, DOB, and address'
    },
    pools: {
      name: 'Pools (Staff-Patient Links)',
      description: 'Link staff to patients for the Related Staff Pool field'
    },
    shifts: {
      name: 'Shifts (Job Occurrences)',
      description: 'Create job occurrences/shifts with dates and times'
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/import/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setParsedData(data.data);
        
        // Auto-detect mappings if no profile loaded
        if (!initialProfile) {
          await autoDetectMappings(data.data.headers);
        }
        
        setStep(3); // Go to column mapping
      } else {
        setError(data.error || 'Failed to parse CSV');
      }
    } catch (err) {
      setError('Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const autoDetectMappings = async (headers: string[]) => {
    try {
      const response = await fetch('/api/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileType,
          data: [],
          mappings: {},
          autoMap: true
        })
      });

      const data = await response.json();
      if (data.success && data.data.detectedMappings) {
        setColumnMappings(data.data.detectedMappings);
      }
    } catch (err) {
      console.error('Auto-detect failed:', err);
    }
  };

  const handleValidate = async () => {
    if (!parsedData) return;

    setLoading(true);
    setError('');

    try {
      // Fetch full data for validation
      const formData = new FormData();
      formData.append('file', file!);

      const uploadResponse = await fetch('/api/import/upload', {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadResponse.json();

      // Now validate all rows
      const response = await fetch('/api/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileType,
          data: uploadData.data.preview, // Use all data
          mappings: columnMappings
        })
      });

      const data = await response.json();

      if (data.success) {
        setValidationResults(data.data);
        setStep(4);
      } else {
        setError(data.error || 'Validation failed');
      }
    } catch (err) {
      setError('Failed to validate data');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setLoading(true);
    setError('');

    try {
      // Fetch full data
      const formData = new FormData();
      formData.append('file', file!);

      const uploadResponse = await fetch('/api/import/upload', {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadResponse.json();

      // Execute import
      const response = await fetch('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileType,
          data: uploadData.data.preview,
          mappings: columnMappings,
          saveProfile: saveProfileChecked ? { name: saveProfileName } : undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        setImportResults(data.data);
        setStep(5);
      } else {
        setError(data.error || 'Import failed');
      }
    } catch (err) {
      setError('Failed to execute import');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Import Type</h3>
      <p className="text-gray-600 mb-6">Choose the type of data you want to import</p>

      <div className="space-y-3">
        {(Object.keys(fileTypeDescriptions) as FileType[]).map((type) => (
          <div
            key={type}
            onClick={() => setFileType(type)}
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              fileType === type
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                fileType === type ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
              }`}>
                {fileType === type && <Check className="w-3 h-3 text-white" />}
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  {fileTypeDescriptions[type].name}
                </div>
                <div className="text-sm text-gray-600">
                  {fileTypeDescriptions[type].description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setStep(2)}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV File</h3>
      <p className="text-gray-600 mb-6">
        Select a CSV file for {fileTypeDescriptions[fileType].name}
      </p>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-700 font-medium mb-2">
          {file ? file.name : 'Click to upload or drag and drop'}
        </p>
        <p className="text-sm text-gray-500">CSV files only, max 10MB</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => {
    // Check if all required fields are mapped
    const config = parsedData ? require('@/lib/import/import-config').getImportConfig(fileType) : null;
    const requiredFields = config?.fields.filter((f: any) => f.required) || [];
    const mappedSystemFields = new Set(Object.keys(columnMappings)); // systemField -> csvColumn
    const unmappedRequired = requiredFields.filter((f: any) => !mappedSystemFields.has(f.key));
    const canProceed = unmappedRequired.length === 0 && Object.keys(columnMappings).length > 0;

    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Map Columns</h3>
        <p className="text-gray-600 mb-6">
          Match your CSV columns to system fields. All required fields must be mapped.
        </p>

        {parsedData && (
          <ColumnMapper
            fileType={fileType}
            csvHeaders={parsedData.headers}
            mappings={columnMappings}
            onChange={setColumnMappings}
          />
        )}

        {!canProceed && Object.keys(columnMappings).length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded">
            <strong>Required:</strong> Please map all required fields (marked with *) before proceeding.
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleValidate}
            disabled={loading || !canProceed}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canProceed ? 'All required fields must be mapped' : ''}
          >
            {loading ? 'Validating...' : 'Validate Data'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Review & Confirm</h3>
      <p className="text-gray-600 mb-6">
        Check validation results before importing
      </p>

      {validationResults && (
        <>
          <ValidationResults results={validationResults} />

          {parsedData && (
            <DataPreview
              data={parsedData.preview}
              mappings={columnMappings}
              validationResults={validationResults}
            />
          )}

          <div className="mt-6 border-t border-gray-200 pt-6">
            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={saveProfileChecked}
                onChange={(e) => setSaveProfileChecked(e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">Save this mapping as a profile</span>
            </label>

            {saveProfileChecked && (
              <input
                type="text"
                value={saveProfileName}
                onChange={(e) => setSaveProfileName(e.target.value)}
                placeholder="Profile name (e.g., 'My Staff Import')"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>
        </>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button
          onClick={() => setStep(3)}
          className="flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleImport}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Importing...' : 'Import Data'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h3>
        <p className="text-gray-600 mb-8">Your data has been successfully imported</p>

        {importResults && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-900">{importResults.totalRows}</div>
              <div className="text-sm text-gray-600">Total Rows</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600">{importResults.created}</div>
              <div className="text-sm text-gray-600">Created</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-600">{importResults.updated}</div>
              <div className="text-sm text-gray-600">Updated</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-orange-600">{importResults.skipped}</div>
              <div className="text-sm text-gray-600">Skipped</div>
            </div>
          </div>
        )}

        {importResults?.errors && importResults.errors.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <h4 className="font-semibold text-orange-900">Skipped Rows</h4>
            </div>
            <div className="text-sm text-orange-800 space-y-1 max-h-40 overflow-y-auto">
              {importResults.errors.slice(0, 10).map((err: any, i: number) => (
                <div key={i}>Row {err.row + 1}: {err.error}</div>
              ))}
              {importResults.errors.length > 10 && (
                <div className="text-orange-600">... and {importResults.errors.length - 10} more</div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => {
              setStep(1);
              setFile(null);
              setParsedData(null);
              setColumnMappings({});
              setValidationResults(null);
              setImportResults(null);
              setSaveProfileChecked(false);
              setSaveProfileName('');
            }}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Import Another File
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  const steps = [
    { number: 1, title: 'Type' },
    { number: 2, title: 'Upload' },
    { number: 3, title: 'Map' },
    { number: 4, title: 'Review' },
    { number: 5, title: 'Complete' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">CSV Import Wizard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step > s.number
                      ? 'bg-green-500 text-white'
                      : step === s.number
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step > s.number ? <Check className="w-5 h-5" /> : s.number}
                  </div>
                  <span className="text-xs mt-1 text-gray-600">{s.title}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    step > s.number ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </div>
      </div>
    </div>
  );
}

