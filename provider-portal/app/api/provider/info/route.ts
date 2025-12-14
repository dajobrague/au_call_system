/**
 * Provider Info API Route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderById, updateProvider, getProviderUser } from '@/lib/airtable';

/**
 * Validate Australian phone number
 */
function validateAustralianPhone(phone: string): boolean {
  if (!phone) return true; // Empty is valid (optional field)
  
  // Remove spaces and common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Australian phone formats:
  // Mobile: +61 4XX XXX XXX or 04XX XXX XXX (10 digits starting with 04)
  // Landline: +61 X XXXX XXXX or 0X XXXX XXXX (10 digits starting with 02-08)
  const australianMobileRegex = /^(\+614|04)\d{8}$/;
  const australianLandlineRegex = /^(\+61[2-8]|0[2-8])\d{8}$/;
  
  return australianMobileRegex.test(cleaned) || australianLandlineRegex.test(cleaned);
}

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
    
    // Validate Transfer Number if provided
    if (fields['Transfer Number'] && !validateAustralianPhone(fields['Transfer Number'])) {
      return NextResponse.json(
        { error: 'Transfer Number must be a valid Australian phone number' },
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








