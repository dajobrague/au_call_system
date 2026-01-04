/**
 * CSV Data Validation API
 * POST /api/import/validate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { validateRow, autoDetectMappings } from '@/lib/import/import-validator';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.providerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fileType, data, mappings, autoMap } = body;

    // Validate required fields
    if (!fileType || !data || !Array.isArray(data)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: fileType, data (array)' },
        { status: 400 }
      );
    }

    let columnMappings = mappings || {};

    // Auto-detect mappings if requested and no mappings provided
    if (autoMap && Object.keys(columnMappings).length === 0 && data.length > 0) {
      const headers = Object.keys(data[0]);
      columnMappings = autoDetectMappings(headers, fileType);
    }

    // Validate each row
    const validationResults = data.map((row, index) => 
      validateRow(row, columnMappings, fileType, index)
    );

    // Separate valid, warning, and error rows
    const validRows = validationResults.filter(r => r.overallValid);
    const rowsWithWarnings = validationResults.filter(r => {
      if (!r.overallValid) return false;
      return Object.values(r.fields).some(f => f.warnings && f.warnings.length > 0);
    });
    const errorRows = validationResults.filter(r => !r.overallValid);

    // Collect all errors and warnings for summary
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const warnings: Array<{ row: number; field: string; message: string }> = [];

    validationResults.forEach(result => {
      Object.entries(result.fields).forEach(([fieldKey, fieldResult]) => {
        if (fieldResult.errors && fieldResult.errors.length > 0) {
          fieldResult.errors.forEach(error => {
            errors.push({
              row: result.rowIndex,
              field: fieldKey,
              message: error
            });
          });
        }
        if (fieldResult.warnings && fieldResult.warnings.length > 0) {
          fieldResult.warnings.forEach(warning => {
            warnings.push({
              row: result.rowIndex,
              field: fieldKey,
              message: warning
            });
          });
        }
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        totalRows: data.length,
        validRows: validRows.length,
        warningRows: rowsWithWarnings.length,
        errorRows: errorRows.length,
        errors,
        warnings,
        validationResults,
        detectedMappings: autoMap ? columnMappings : undefined
      }
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to validate CSV data' 
      },
      { status: 500 }
    );
  }
}

