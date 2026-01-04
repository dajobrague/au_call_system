/**
 * Flexible Validation Engine for CSV Imports
 * Uses configuration to validate all field types
 */

import { normalizeAustralianPhone, validateAustralianPhone } from './phone-utils';
import { parseFlexibleDate, validateDateString, parseTimeString, parseDateTimeString } from './date-utils';
import { getImportConfig, FieldDefinition } from './import-config';

export interface ValidationResult {
  valid: boolean;
  value?: any;              // Transformed/normalized value
  warnings?: string[];      // Non-critical issues
  errors?: string[];        // Critical issues
}

export interface RowValidationResult {
  rowIndex: number;
  fields: Record<string, ValidationResult>;
  overallValid: boolean;
}

/**
 * Validate a single field value based on its definition
 */
export function validateField(
  value: any,
  fieldDef: FieldDefinition
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    warnings: [],
    errors: []
  };
  
  // Check required
  if (fieldDef.required && (!value || String(value).trim() === '')) {
    result.valid = false;
    result.errors!.push(`${fieldDef.label} is required`);
    return result;
  }
  
  // Skip validation if empty and not required
  if (!value || String(value).trim() === '') {
    result.value = null;
    return result;
  }
  
  const strValue = String(value).trim();
  
  // Type-specific validation
  switch (fieldDef.type) {
    case 'phone':
      const phoneResult = validateAustralianPhone(strValue);
      if (!phoneResult.valid) {
        result.valid = false;
        result.errors!.push(phoneResult.error!);
      } else {
        result.value = phoneResult.normalized;
      }
      break;
      
    case 'date':
      // Try datetime parsing first (e.g., "2025-12-16 09:30:00 +1000")
      const dateTimeResult = parseDateTimeString(strValue);
      if (dateTimeResult.date) {
        result.value = dateTimeResult.date;
        // Successfully extracted date from datetime - no warning needed
      } else {
        // Fall back to pure date parsing
        const dateResult = validateDateString(strValue);
        if (!dateResult.valid) {
          result.valid = false;
          result.errors!.push(dateResult.error!);
        } else {
          result.value = dateResult.parsed;
          // Successfully parsed date - no warning needed
        }
      }
      break;
      
    case 'time':
      // Try datetime parsing first (e.g., "2025-12-16 09:30:00 +1000")
      const timeFromDateTime = parseDateTimeString(strValue);
      if (timeFromDateTime.time) {
        result.value = timeFromDateTime.time;
        // Successfully extracted time from datetime - no warning needed
      } else {
        // Fall back to pure time parsing
        const time = parseTimeString(strValue);
        if (!time) {
          result.valid = false;
          result.errors!.push('Invalid time format. Expected HH:mm (e.g., 09:30)');
        } else {
          result.value = time;
        }
      }
      break;
      
    case 'number':
      const num = parseFloat(strValue);
      if (isNaN(num)) {
        result.valid = false;
        result.errors!.push('Must be a valid number');
      } else {
        result.value = num;
        
        // Check min/max
        if (fieldDef.validation?.min && num < fieldDef.validation.min) {
          result.valid = false;
          result.errors!.push(`Must be at least ${fieldDef.validation.min}`);
        }
        if (fieldDef.validation?.max && num > fieldDef.validation.max) {
          result.valid = false;
          result.errors!.push(`Must be at most ${fieldDef.validation.max}`);
        }
      }
      break;
      
    case 'email':
      if (fieldDef.validation?.pattern && !fieldDef.validation.pattern.test(strValue)) {
        result.valid = false;
        result.errors!.push('Invalid email format');
      } else {
        result.value = strValue.toLowerCase();
      }
      break;
      
    case 'boolean':
      if (fieldDef.transform) {
        result.value = fieldDef.transform(strValue);
      } else {
        const lower = strValue.toLowerCase();
        result.value = ['true', 'yes', '1', 'y'].includes(lower);
      }
      break;
      
    case 'lookup':
      // Lookups validated later when we have DB context
      result.value = strValue;
      break;
      
    case 'text':
    default:
      result.value = strValue;
      
      // Check length
      if (fieldDef.validation?.minLength && strValue.length < fieldDef.validation.minLength) {
        result.valid = false;
        result.errors!.push(`Must be at least ${fieldDef.validation.minLength} characters`);
      }
      if (fieldDef.validation?.maxLength && strValue.length > fieldDef.validation.maxLength) {
        result.valid = false;
        result.errors!.push(`Must be at most ${fieldDef.validation.maxLength} characters`);
      }
      
      // Custom validator
      if (fieldDef.validation?.customValidator) {
        const customResult = fieldDef.validation.customValidator(strValue);
        if (!customResult.valid) {
          result.valid = false;
          result.errors!.push(customResult.error || 'Validation failed');
        }
      }
      break;
  }
  
  // Apply transformation
  if (result.valid && result.value !== undefined && fieldDef.transform) {
    result.value = fieldDef.transform(result.value);
  }
  
  return result;
}

/**
 * Validate an entire CSV row
 */
export function validateRow(
  row: Record<string, any>,
  mappings: Record<string, string>, // systemField -> csvColumn
  entityType: string,
  rowIndex: number
): RowValidationResult {
  const config = getImportConfig(entityType);
  const fieldResults: Record<string, ValidationResult> = {};
  let overallValid = true;
  
  // Validate each field
  for (const fieldDef of config.fields) {
    const csvColumn = mappings[fieldDef.key];
    const value = csvColumn ? row[csvColumn] : undefined;
    
    const fieldResult = validateField(value, fieldDef);
    fieldResults[fieldDef.key] = fieldResult;
    
    if (!fieldResult.valid) {
      overallValid = false;
    }
  }
  
  return {
    rowIndex,
    fields: fieldResults,
    overallValid
  };
}

/**
 * Auto-detect column mappings based on aliases
 * Returns systemField -> csvColumn mappings
 */
export function autoDetectMappings(
  csvColumns: string[],
  entityType: string
): Record<string, string> {
  const config = getImportConfig(entityType);
  const mappings: Record<string, string> = {}; // systemField -> csvColumn
  
  // For each system field, try to find a matching CSV column
  for (const fieldDef of config.fields) {
    let bestMatch: string | null = null;
    
    for (const column of csvColumns) {
      const normalizedColumn = column.toLowerCase().trim().replace(/[_\s]+/g, '_');
      
      // Check exact match with field key
      if (normalizedColumn === fieldDef.key.toLowerCase()) {
        bestMatch = column;
        break;
      }
      
      // Check aliases
      if (fieldDef.matchAliases) {
        const aliasMatch = fieldDef.matchAliases.find(alias => 
          normalizedColumn === alias.toLowerCase().replace(/[_\s]+/g, '_') ||
          normalizedColumn.includes(alias.toLowerCase().replace(/[_\s]+/g, '_'))
        );
        
        if (aliasMatch && !bestMatch) {
          bestMatch = column;
        }
      }
    }
    
    if (bestMatch) {
      mappings[fieldDef.key] = bestMatch;
    }
  }
  
  return mappings;
}

