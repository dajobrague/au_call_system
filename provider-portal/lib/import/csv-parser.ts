/**
 * CSV Parser Utility
 * Wrapper around papaparse for consistent CSV parsing
 */

import Papa from 'papaparse';

export interface ParsedCSV {
  headers: string[];
  data: Record<string, any>[];
  rowCount: number;
  errors?: string[];
}

/**
 * Parse CSV file
 */
export function parseCSVFile(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      trimHeaders: true,
      complete: (results) => {
        const errors: string[] = [];
        
        // Collect parsing errors
        if (results.errors && results.errors.length > 0) {
          results.errors.forEach(err => {
            errors.push(`Row ${err.row}: ${err.message}`);
          });
        }
        
        resolve({
          headers: results.meta.fields || [],
          data: results.data as Record<string, any>[],
          rowCount: (results.data as any[]).length,
          errors: errors.length > 0 ? errors : undefined
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      }
    });
  });
}

/**
 * Parse CSV from text content
 */
export function parseCSVText(csvText: string): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      trimHeaders: true,
      complete: (results) => {
        const errors: string[] = [];
        
        if (results.errors && results.errors.length > 0) {
          results.errors.forEach(err => {
            errors.push(`Row ${err.row}: ${err.message}`);
          });
        }
        
        resolve({
          headers: results.meta.fields || [],
          data: results.data as Record<string, any>[],
          rowCount: (results.data as any[]).length,
          errors: errors.length > 0 ? errors : undefined
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      }
    });
  });
}

/**
 * Validate CSV structure
 */
export function validateCSVStructure(parsed: ParsedCSV): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!parsed.headers || parsed.headers.length === 0) {
    errors.push('CSV must have header row');
  }
  
  if (parsed.rowCount === 0) {
    errors.push('CSV must contain at least one data row');
  }
  
  // Check for duplicate headers
  const headerSet = new Set(parsed.headers);
  if (headerSet.size !== parsed.headers.length) {
    errors.push('CSV contains duplicate column names');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

