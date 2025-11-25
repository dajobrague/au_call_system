/**
 * Provider Employees API Route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getEmployeesByProvider, createEmployee, updateEmployee, deleteEmployee } from '@/lib/airtable';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const employees = await getEmployeesByProvider(user.providerId);
    
    return NextResponse.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
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
    const { displayName, phone, pin, notes, active } = body;
    
    if (!displayName || !phone || !pin) {
      return NextResponse.json(
        { error: 'Missing required fields: displayName, phone, pin' },
        { status: 400 }
      );
    }
    
    const newEmployee = await createEmployee({
      'Display Name': displayName,
      'Phone': phone,
      'Employee PIN': parseInt(pin),
      'Provider': [user.providerId],
      'Notes': notes || '',
      'Active': active !== undefined ? active : true,
    });
    
    return NextResponse.json({
      success: true,
      data: newEmployee,
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
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
    const { recordId, displayName, phone, pin, notes, active } = body;
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing recordId' },
        { status: 400 }
      );
    }
    
    const fields: Record<string, string | number | boolean> = {};
    if (displayName !== undefined) fields['Display Name'] = displayName;
    if (phone !== undefined) fields['Phone'] = phone;
    if (pin !== undefined) fields['Employee PIN'] = parseInt(pin);
    if (notes !== undefined) fields['Notes'] = notes;
    if (active !== undefined) fields['Active'] = active;
    
    const updatedEmployee = await updateEmployee(recordId, fields);
    
    return NextResponse.json({
      success: true,
      data: updatedEmployee,
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json(
      { error: 'Failed to update employee' },
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
    
    await deleteEmployee(recordId);
    
    return NextResponse.json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}








