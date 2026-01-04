/**
 * CSV Import Execution API
 * POST /api/import/execute
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { validateRow } from '@/lib/import/import-validator';
import {
  importStaffRecords,
  importParticipantRecords,
  importPoolLinks,
  importOccurrenceRecords,
  MappedRecord
} from '@/lib/import/import-engine';
import { saveProviderMappingProfile, CSVMappingProfile } from '@/lib/airtable';

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
    const { fileType, data, mappings, saveProfile } = body;

    // Validate required fields
    if (!fileType || !data || !Array.isArray(data) || !mappings) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: fileType, data (array), mappings' },
        { status: 400 }
      );
    }

    // Validate and transform all rows
    const validatedRecords: MappedRecord[] = [];
    const validationErrors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const validation = validateRow(row, mappings, fileType, i);

      if (!validation.overallValid) {
        // Collect all errors for this row
        const errors = Object.values(validation.fields)
          .flatMap(f => f.errors || [])
          .join(', ');
        
        validationErrors.push({
          row: i,
          error: errors
        });
        continue;
      }

      // Extract validated and transformed values
      const mappedData: Record<string, any> = {};
      Object.entries(validation.fields).forEach(([fieldKey, fieldResult]) => {
        mappedData[fieldKey] = fieldResult.value;
      });

      validatedRecords.push({
        rowIndex: i,
        data: mappedData
      });
    }

    // Import records based on file type
    let importResult;

    switch (fileType) {
      case 'staff':
        importResult = await importStaffRecords(user.providerId, validatedRecords);
        break;

      case 'participants':
        importResult = await importParticipantRecords(user.providerId, validatedRecords);
        break;

      case 'pools':
        importResult = await importPoolLinks(user.providerId, validatedRecords);
        break;

      case 'shifts':
        importResult = await importOccurrenceRecords(user.providerId, validatedRecords);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown file type: ${fileType}` },
          { status: 400 }
        );
    }

    // Save mapping profile if requested
    if (saveProfile && saveProfile.name) {
      const profile: CSVMappingProfile = {
        id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: saveProfile.name,
        fileType,
        columnMappings: Object.entries(mappings).map(([systemField, csvColumn]) => ({
          csvColumn: csvColumn as string,
          systemField
        })),
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      };

      await saveProviderMappingProfile(user.providerId, profile);
    }

    // Combine validation errors with import errors
    const allErrors = [
      ...validationErrors,
      ...importResult.errors
    ];

    return NextResponse.json({
      success: importResult.success,
      data: {
        totalRows: data.length,
        processed: validatedRecords.length,
        created: importResult.created,
        updated: importResult.updated,
        skipped: importResult.skipped + validationErrors.length,
        errors: allErrors
      }
    });

  } catch (error) {
    console.error('Import execution error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to execute import' 
      },
      { status: 500 }
    );
  }
}

