/**
 * Provider Job Templates API Route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getJobTemplatesByProvider } from '@/lib/airtable';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const jobTemplates = await getJobTemplatesByProvider(user.providerId);
    
    return NextResponse.json({
      success: true,
      data: jobTemplates,
    });
  } catch (error) {
    console.error('Error fetching job templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job templates' },
      { status: 500 }
    );
  }
}








