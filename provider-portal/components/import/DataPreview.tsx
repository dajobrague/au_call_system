/**
 * Data Preview Component
 * Shows preview of mapped data with validation highlights
 */

'use client';

import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface DataPreviewProps {
  data: Record<string, any>[];
  mappings: Record<string, string>; // systemField -> csvColumn
  validationResults?: any;
}

export default function DataPreview({ data, mappings, validationResults }: DataPreviewProps) {
  const getRowValidation = (rowIndex: number) => {
    if (!validationResults?.validationResults) return null;
    return validationResults.validationResults[rowIndex];
  };

  const getFieldValidation = (rowIndex: number, systemField: string) => {
    const rowValidation = getRowValidation(rowIndex);
    if (!rowValidation) return null;

    return rowValidation.fields[systemField];
  };

  // Get system fields that are mapped (these are the keys)
  const mappedSystemFields = Object.keys(mappings);

  return (
    <div className="mt-6">
      <h4 className="font-semibold text-gray-900 mb-3">Data Preview (First 10 Rows)</h4>
      
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Row
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                {mappedSystemFields.map(systemField => (
                  <th key={systemField} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {systemField}
                    <div className="text-xs text-gray-400 font-normal normal-case mt-1">
                      ← {mappings[systemField]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.slice(0, 10).map((row, rowIndex) => {
                const rowValidation = getRowValidation(rowIndex);
                const isValid = rowValidation?.overallValid;
                const hasWarnings = rowValidation && Object.values(rowValidation.fields).some(
                  (f: any) => f.warnings && f.warnings.length > 0
                );

                return (
                  <tr key={rowIndex} className={
                    !isValid
                      ? 'bg-red-50'
                      : hasWarnings
                      ? 'bg-yellow-50'
                      : ''
                  }>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {rowIndex + 1}
                    </td>
                    <td className="px-4 py-3">
                      {isValid === undefined ? (
                        <div className="w-5 h-5 bg-gray-200 rounded-full animate-pulse" />
                      ) : isValid ? (
                        hasWarnings ? (
                          <AlertTriangle className="w-5 h-5 text-yellow-600" title="Has warnings" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-600" title="Valid" />
                        )
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" title="Has errors" />
                      )}
                    </td>
                    {mappedSystemFields.map(systemField => {
                      const csvColumn = mappings[systemField];
                      const fieldValidation = getFieldValidation(rowIndex, systemField);
                      const hasError = fieldValidation?.errors && fieldValidation.errors.length > 0;
                      const hasWarning = fieldValidation?.warnings && fieldValidation.warnings.length > 0;
                      
                      // Show validated/transformed value if available, otherwise show raw CSV value
                      const displayValue = fieldValidation?.value !== undefined 
                        ? fieldValidation.value 
                        : row[csvColumn];

                      return (
                        <td
                          key={systemField}
                          className={`px-4 py-3 text-sm ${
                            hasError
                              ? 'text-red-900 font-medium'
                              : hasWarning
                              ? 'text-yellow-900'
                              : 'text-gray-700'
                          }`}
                          title={
                            hasError
                              ? fieldValidation.errors.join(', ')
                              : hasWarning
                              ? fieldValidation.warnings.join(', ')
                              : undefined
                          }
                        >
                          {displayValue || '-'}
                          {(hasError || hasWarning) && (
                            <div className="text-xs mt-1">
                              {hasError && (
                                <div className="text-red-600">
                                  {fieldValidation.errors[0]}
                                </div>
                              )}
                              {hasWarning && (
                                <div className="text-yellow-600">
                                  {fieldValidation.warnings[0]}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

