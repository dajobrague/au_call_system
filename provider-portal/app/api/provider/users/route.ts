/**
 * Provider Users API Route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  getProviderUsers,
  createProviderUser,
  updateProviderUser,
  deleteProviderUser
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
    
    const users = await getProviderUsers(user.providerId);
    
    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching provider users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider users' },
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
    const { firstName, lastName, email, phone, password } = body;
    
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const newUser = await createProviderUser({
      'First Name': firstName,
      'Last Name': lastName,
      'Email': email,
      'Phone': phone || '',
      'Pass': password,
      'Provider': [user.providerId]
    });
    
    return NextResponse.json({
      success: true,
      data: newUser,
    });
  } catch (error) {
    console.error('Error creating provider user:', error);
    return NextResponse.json(
      { error: 'Failed to create provider user' },
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
    const { recordId, firstName, lastName, email, phone, password } = body;
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }
    
    const updateFields: Record<string, string> = {};
    if (firstName) updateFields['First Name'] = firstName;
    if (lastName) updateFields['Last Name'] = lastName;
    if (email) updateFields['Email'] = email;
    if (phone !== undefined) updateFields['Phone'] = phone;
    if (password) updateFields['Pass'] = password;
    
    const updatedUser = await updateProviderUser(recordId, updateFields);
    
    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating provider user:', error);
    return NextResponse.json(
      { error: 'Failed to update provider user' },
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
    
    // Don't allow deleting yourself
    if (recordId === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }
    
    await deleteProviderUser(recordId);
    
    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting provider user:', error);
    return NextResponse.json(
      { error: 'Failed to delete provider user' },
      { status: 500 }
    );
  }
}

