/**
 * Column Mapper Component
 * Maps CSV columns to system fields
 */

'use client';

import { getImportConfig } from '@/lib/import/import-config';
import { ChevronDown } from 'lucide-react';

interface ColumnMapperProps {
  fileType: string;
  csvHeaders: string[];
  mappings: Record<string, string>; // systemField -> csvColumn
  onChange: (mappings: Record<string, string>) => void;
}

export default function ColumnMapper({ fileType, csvHeaders, mappings, onChange }: ColumnMapperProps) {
  const config = getImportConfig(fileType);

  const handleMappingChange = (systemField: string, csvColumn: string) => {
    const newMappings = { ...mappings };
    
    if (csvColumn === '__ignore__') {
      delete newMappings[systemField];
    } else {
      newMappings[systemField] = csvColumn;
    }
    
    onChange(newMappings);
  };

  const getFieldInfo = (fieldKey: string) => {
    return config.fields.find(f => f.key === fieldKey);
  };

  const getMappedFields = () => {
    return config.fields.filter(f => mappings[f.key]);
  };

  const getUnmappedRequiredFields = () => {
    return config.fields.filter(f => f.required && !mappings[f.key]);
  };

  const unmappedRequired = getUnmappedRequiredFields();

  return (
    <div>
      {/* Status */}
      <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border/60">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-foreground">{config.fields.length}</div>
            <div className="text-sm text-muted-foreground">System Fields</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{Object.keys(mappings).length}</div>
            <div className="text-sm text-muted-foreground">Mapped</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${unmappedRequired.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {unmappedRequired.length}
            </div>
            <div className="text-sm text-muted-foreground">Required Missing</div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {unmappedRequired.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-900 mb-2">Missing Required Fields:</h4>
          <ul className="list-disc list-inside text-sm text-red-800">
            {unmappedRequired.map(field => (
              <li key={field.key}>{field.label}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mapping Table */}
      <div className="border border-border/60 rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 border-b border-border/60">
          <div className="grid grid-cols-2 gap-4">
            <div className="font-semibold text-foreground/80">System Field</div>
            <div className="font-semibold text-foreground/80">Source CSV Column</div>
          </div>
        </div>

        <div className="divide-y divide-border/60 max-h-96 overflow-y-auto">
          {config.fields.map((field) => {
            const currentMapping = mappings[field.key];

            return (
              <div key={field.key} className="px-4 py-3 hover:bg-muted/30">
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <div className="font-medium text-foreground">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </div>
                    {field.description && (
                      <div className="text-xs text-muted-foreground mt-1">{field.description}</div>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      value={currentMapping || '__ignore__'}
                      onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-transparent appearance-none pr-10 ${
                        field.required && !currentMapping ? 'border-red-300 bg-red-50' : 'border-input'
                      }`}
                    >
                      <option value="__ignore__">-- Select Column --</option>
                      {csvHeaders.map(header => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">*</span> Required field
      </div>
    </div>
  );
}

