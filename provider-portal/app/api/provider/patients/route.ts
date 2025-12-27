/**
 * Provider Patients API Route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPatientsByProvider, createPatient, updatePatient, deletePatient } from '@/lib/airtable';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const patients = await getPatientsByProvider(user.providerId);
    
    return NextResponse.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patients' },
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
    const { patientName, phone, dob, address, notes, active, relatedStaffPool } = body;
    
    if (!patientName || !phone || !dob) {
      return NextResponse.json(
        { error: 'Missing required fields: patientName, phone, dob' },
        { status: 400 }
      );
    }
    
    const fields: Record<string, any> = {
      'Patient Full Name': patientName,
      'Phone': phone,
      'DOB': dob,
      'Provider': [user.providerId],
      'Address': address || '',
      'Important Notes': notes || '',
      'Active': active !== undefined ? active : true,
    };

    // Add Related Staff Pool if provided (array of employee record IDs)
    if (relatedStaffPool && Array.isArray(relatedStaffPool) && relatedStaffPool.length > 0) {
      fields['Related Staff Pool'] = relatedStaffPool;
    }
    
    const newPatient = await createPatient(fields);
    
    return NextResponse.json({
      success: true,
      data: newPatient,
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json(
      { error: 'Failed to create patient' },
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
    const { recordId, patientName, phone, dob, address, notes, active, relatedStaffPool } = body;
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing recordId' },
        { status: 400 }
      );
    }
    
    const fields: Record<string, any> = {};
    if (patientName !== undefined) fields['Patient Full Name'] = patientName;
    if (phone !== undefined) fields['Phone'] = phone;
    if (dob !== undefined) fields['DOB'] = dob;
    if (address !== undefined) fields['Address'] = address;
    if (notes !== undefined) fields['Important Notes'] = notes;
    if (active !== undefined) fields['Active'] = active;
    
    // Handle Related Staff Pool (array of employee record IDs)
    if (relatedStaffPool !== undefined) {
      if (Array.isArray(relatedStaffPool) && relatedStaffPool.length > 0) {
        fields['Related Staff Pool'] = relatedStaffPool;
      } else {
        // If empty array, clear the field
        fields['Related Staff Pool'] = [];
      }
    }
    
    const updatedPatient = await updatePatient(recordId, fields);
    
    return NextResponse.json({
      success: true,
      data: updatedPatient,
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    return NextResponse.json(
      { error: 'Failed to update patient' },
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
        { error: 'Missing recordId' },
        { status: 400 }
      );
    }
    
    await deletePatient(recordId);
    
    return NextResponse.json({
      success: true,
      message: 'Patient deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting patient:', error);
    return NextResponse.json(
      { error: 'Failed to delete patient' },
      { status: 500 }
    );
  }
}








