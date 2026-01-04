/**
 * Validation Results Component
 * Displays validation summary with collapsible details
 */

'use client';

import { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface ValidationResultsProps {
  results: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
    errors: Array<{ row: number; field: string; message: string }>;
    warnings: Array<{ row: number; field: string; message: string }>;
  };
}

export default function ValidationResults({ results }: ValidationResultsProps) {
  const [showErrors, setShowErrors] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  const { totalRows, validRows, warningRows, errorRows, errors, warnings } = results;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-2xl font-bold text-gray-900">{totalRows}</div>
          </div>
          <div className="text-sm text-gray-600">Total Rows</div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="text-2xl font-bold text-green-600">{validRows}</div>
          </div>
          <div className="text-sm text-gray-600">Valid Rows</div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div className="text-2xl font-bold text-yellow-600">{warningRows}</div>
          </div>
          <div className="text-sm text-gray-600">Warnings</div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-5 h-5 text-red-600" />
            <div className="text-2xl font-bold text-red-600">{errorRows}</div>
          </div>
          <div className="text-sm text-gray-600">Errors (Will Skip)</div>
        </div>
      </div>

      {/* Overall Status */}
      <div className={`border rounded-lg p-4 ${
        errorRows === 0
          ? 'bg-green-50 border-green-200'
          : errorRows < totalRows
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start gap-3">
          {errorRows === 0 ? (
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
          ) : errorRows < totalRows ? (
            <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className={`font-semibold ${
              errorRows === 0
                ? 'text-green-900'
                : errorRows < totalRows
                ? 'text-yellow-900'
                : 'text-red-900'
            }`}>
              {errorRows === 0
                ? 'All rows are valid!'
                : errorRows < totalRows
                ? `${validRows} rows will be imported, ${errorRows} will be skipped`
                : 'All rows have errors'}
            </h4>
            <p className={`text-sm mt-1 ${
              errorRows === 0
                ? 'text-green-800'
                : errorRows < totalRows
                ? 'text-yellow-800'
                : 'text-red-800'
            }`}>
              {errorRows === 0
                ? 'You can proceed with the import.'
                : errorRows < totalRows
                ? 'Rows with errors will be skipped. You can still proceed with the import.'
                : 'Please fix the errors before importing.'}
            </p>
          </div>
        </div>
      </div>

      {/* Errors Details */}
      {errors.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="w-full bg-red-50 px-4 py-3 flex items-center justify-between hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-red-900">
                {errors.length} Error{errors.length !== 1 ? 's' : ''}
              </span>
            </div>
            {showErrors ? (
              <ChevronUp className="w-5 h-5 text-red-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-red-600" />
            )}
          </button>
          
          {showErrors && (
            <div className="bg-white p-4 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {errors.slice(0, 50).map((error, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium text-red-900">Row {error.row + 1}</span>
                    <span className="text-gray-600"> - {error.field}: </span>
                    <span className="text-red-700">{error.message}</span>
                  </div>
                ))}
                {errors.length > 50 && (
                  <div className="text-sm text-gray-600 italic">
                    ... and {errors.length - 50} more errors
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Warnings Details */}
      {warnings.length > 0 && (
        <div className="border border-yellow-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowWarnings(!showWarnings)}
            className="w-full bg-yellow-50 px-4 py-3 flex items-center justify-between hover:bg-yellow-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-900">
                {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
              </span>
            </div>
            {showWarnings ? (
              <ChevronUp className="w-5 h-5 text-yellow-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-yellow-600" />
            )}
          </button>
          
          {showWarnings && (
            <div className="bg-white p-4 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {warnings.slice(0, 50).map((warning, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium text-yellow-900">Row {warning.row + 1}</span>
                    <span className="text-gray-600"> - {warning.field}: </span>
                    <span className="text-yellow-700">{warning.message}</span>
                  </div>
                ))}
                {warnings.length > 50 && (
                  <div className="text-sm text-gray-600 italic">
                    ... and {warnings.length - 50} more warnings
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

