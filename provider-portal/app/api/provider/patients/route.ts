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
    const { patientName, patientId, phone, dob, address, notes, active } = body;
    
    if (!patientName || !patientId || !phone || !dob) {
      return NextResponse.json(
        { error: 'Missing required fields: patientName, patientId, phone, dob' },
        { status: 400 }
      );
    }
    
    const newPatient = await createPatient({
      'Patient Full Name': patientName,
      'Patient ID': parseInt(patientId),
      'Phone': phone,
      'DOB': dob,
      'Provider': [user.providerId],
      'Address': address || '',
      'Important Notes': notes || '',
      'Active': active !== undefined ? active : true,
    });
    
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
    const { recordId, patientName, patientId, phone, dob, address, notes, active } = body;
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing recordId' },
        { status: 400 }
      );
    }
    
    const fields: Record<string, string | number | boolean> = {};
    if (patientName !== undefined) fields['Patient Full Name'] = patientName;
    if (patientId !== undefined) fields['Patient ID'] = parseInt(patientId);
    if (phone !== undefined) fields['Phone'] = phone;
    if (dob !== undefined) fields['DOB'] = dob;
    if (address !== undefined) fields['Address'] = address;
    if (notes !== undefined) fields['Important Notes'] = notes;
    if (active !== undefined) fields['Active'] = active;
    
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








