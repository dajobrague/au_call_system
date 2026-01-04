/**
 * CSV Upload & Parsing API
 * POST /api/import/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseCSVText, validateCSVStructure } from '@/lib/import/csv-parser';
import { getCurrentUser } from '@/lib/auth';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    if (!user?.providerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Only CSV files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` 
        },
        { status: 400 }
      );
    }

    // Read file content as text
    const fileContent = await file.text();
    
    // Parse CSV
    const parsed = await parseCSVText(fileContent);
    
    // Validate CSV structure
    const validation = validateCSVStructure(parsed);
    if (!validation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid CSV structure',
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    // Return parsed data with preview (first 10 rows)
    return NextResponse.json({
      success: true,
      data: {
        headers: parsed.headers,
        preview: parsed.data.slice(0, 10),
        totalRows: parsed.rowCount,
        fileName: file.name,
        fileSize: file.size,
        parseErrors: parsed.errors
      }
    });

  } catch (error) {
    console.error('CSV upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process CSV file' 
      },
      { status: 500 }
    );
  }
}

