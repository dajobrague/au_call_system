/**
 * Outbound Calling Settings API Route
 * Manages outbound calling configuration for providers
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderById, updateProvider } from '@/lib/airtable';

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
    
    return NextResponse.json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error('Error fetching outbound calling settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch outbound calling settings' },
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
    
    console.log('[Outbound Calling] PATCH request for provider:', user.providerId);
    
    const body = await request.json();
    const { enabled, waitMinutes, maxRounds, messageTemplate } = body;
    
    console.log('[Outbound Calling] Request body:', {
      enabled,
      waitMinutes,
      maxRounds,
      messageTemplateLength: messageTemplate?.length
    });
    
    // Validation
    if (waitMinutes !== undefined) {
      const wait = Number(waitMinutes);
      if (isNaN(wait) || wait < 1 || wait > 120) {
        return NextResponse.json(
          { error: 'Wait time must be between 1 and 120 minutes' },
          { status: 400 }
        );
      }
    }
    
    if (maxRounds !== undefined) {
      const rounds = Number(maxRounds);
      if (isNaN(rounds) || rounds < 1 || rounds > 5) {
        return NextResponse.json(
          { error: 'Max rounds must be between 1 and 5' },
          { status: 400 }
        );
      }
    }
    
    if (enabled && !messageTemplate?.trim()) {
      return NextResponse.json(
        { error: 'Message template is required when outbound calling is enabled' },
        { status: 400 }
      );
    }
    
    // Build update fields
    const fields: Record<string, any> = {};
    
    if (enabled !== undefined) {
      fields['Outbound Call Enabled'] = enabled;
    }
    
    if (waitMinutes !== undefined) {
      fields['Outbound Call Wait Minutes'] = Number(waitMinutes);
    }
    
    if (maxRounds !== undefined) {
      fields['Outbound Call Max Rounds'] = Number(maxRounds);
    }
    
    if (messageTemplate !== undefined) {
      fields['Outbound Call Message Template'] = messageTemplate.trim();
    }
    
    console.log('[Outbound Calling] Updating fields:', Object.keys(fields));
    console.log('[Outbound Calling] Calling updateProvider with providerId:', user.providerId);
    
    const startTime = Date.now();
    const updatedProvider = await updateProvider(user.providerId, fields);
    const duration = Date.now() - startTime;
    
    console.log('[Outbound Calling] Update successful in', duration, 'ms');
    
    return NextResponse.json({
      success: true,
      provider: updatedProvider,
    });
  } catch (error) {
    console.error('[Outbound Calling] Error updating settings:', error);
    console.error('[Outbound Calling] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Failed to update outbound calling settings';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
