/**
 * Report Comments API
 * Save and load comments from Redis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveReportComments, loadReportComments } from '@/lib/redis';

/**
 * GET - Load comments for a specific date
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    const comments = await loadReportComments(user.providerId, date);

    return NextResponse.json({
      success: true,
      comments: comments || ''
    });
  } catch (error) {
    console.error('Error loading report comments:', error);
    return NextResponse.json(
      { error: 'Failed to load comments' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save comments for a specific date
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { date, comments } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      );
    }

    await saveReportComments(user.providerId, date, comments || '');

    return NextResponse.json({
      success: true,
      message: 'Comments saved successfully'
    });
  } catch (error) {
    console.error('Error saving report comments:', error);
    return NextResponse.json(
      { error: 'Failed to save comments' },
      { status: 500 }
    );
  }
}

