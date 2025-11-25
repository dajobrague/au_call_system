/**
 * Provider Info API Route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderById, updateProvider, getProviderUser } from '@/lib/airtable';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const provider = await getProviderById(user.providerId);
    
    // Also fetch the current user's full details
    let userDetails = null;
    try {
      userDetails = await getProviderUser(user.id);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
    
    return NextResponse.json({
      success: true,
      provider,
      user: userDetails,
    });
  } catch (error) {
    console.error('Error fetching provider info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider info' },
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
    const { fields } = body;
    
    if (!fields) {
      return NextResponse.json(
        { error: 'Missing fields in request body' },
        { status: 400 }
      );
    }
    
    const updatedProvider = await updateProvider(user.providerId, fields);
    
    return NextResponse.json({
      success: true,
      provider: updatedProvider,
    });
  } catch (error) {
    console.error('Error updating provider info:', error);
    return NextResponse.json(
      { error: 'Failed to update provider info' },
      { status: 500 }
    );
  }
}








