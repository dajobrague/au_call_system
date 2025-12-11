/**
 * Provider Job Occurrences API Route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  getOccurrencesByProvider, 
  createOccurrence, 
  updateOccurrence, 
  deleteOccurrence 
} from '@/lib/airtable';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const occurrences = await getOccurrencesByProvider(user.providerId);
    
    return NextResponse.json({
      success: true,
      data: occurrences,
    });
  } catch (error) {
    console.error('Error fetching occurrences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch occurrences' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { patientRecordId, employeeRecordId, scheduledAt, time, timeWindowEnd } = body;
    
    if (!patientRecordId || !employeeRecordId || !scheduledAt || !time || !timeWindowEnd) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const occurrence = await createOccurrence({
      patientRecordId,
      employeeRecordId,
      scheduledAt,
      time,
      timeWindowEnd
    });
    
    return NextResponse.json({
      success: true,
      data: occurrence,
    });
  } catch (error) {
    console.error('Error creating occurrence:', error);
    return NextResponse.json(
      { error: 'Failed to create occurrence' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { recordId, patientRecordId, employeeRecordId, scheduledAt, time, timeWindowEnd, status } = body;
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }
    
    const occurrence = await updateOccurrence(recordId, {
      patientRecordId,
      employeeRecordId,
      scheduledAt,
      time,
      timeWindowEnd,
      status
    });
    
    return NextResponse.json({
      success: true,
      data: occurrence,
    });
  } catch (error) {
    console.error('Error updating occurrence:', error);
    return NextResponse.json(
      { error: 'Failed to update occurrence' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }
    
    await deleteOccurrence(recordId);
    
    return NextResponse.json({
      success: true,
      message: 'Occurrence deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting occurrence:', error);
    return NextResponse.json(
      { error: 'Failed to delete occurrence' },
      { status: 500 }
    );
  }
}








