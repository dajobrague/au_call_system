/**
 * CSV Mapping Profile Management API
 * GET    /api/import/profiles?fileType=staff
 * POST   /api/import/profiles
 * PATCH  /api/import/profiles (with id in body)
 * DELETE /api/import/profiles?id=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getProviderMappingProfiles,
  saveProviderMappingProfile,
  updateProviderMappingProfile,
  deleteProviderMappingProfile,
  CSVMappingProfile
} from '@/lib/airtable';

/**
 * GET - List profiles for a provider
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.providerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileType = searchParams.get('fileType');

    const profiles = await getProviderMappingProfiles(user.providerId);
    
    // Filter by file type if specified
    const filteredProfiles = fileType
      ? profiles.filter(p => p.fileType === fileType)
      : profiles;

    return NextResponse.json({
      success: true,
      data: filteredProfiles
    });

  } catch (error) {
    console.error('Get profiles error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch profiles' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new profile
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.providerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, fileType, columnMappings } = body;

    // Validate required fields
    if (!name || !fileType || !columnMappings) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, fileType, columnMappings' },
        { status: 400 }
      );
    }

    // Create profile with ID and timestamps
    const profile: CSVMappingProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      fileType,
      columnMappings,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString()
    };

    await saveProviderMappingProfile(user.providerId, profile);

    return NextResponse.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('Create profile error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create profile' 
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update existing profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.providerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    // Update lastUsedAt if not explicitly set
    if (!updates.lastUsedAt) {
      updates.lastUsedAt = new Date().toISOString();
    }

    await updateProviderMappingProfile(user.providerId, id, updates);

    return NextResponse.json({
      success: true,
      data: { id, ...updates }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update profile' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete profile
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.providerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    await deleteProviderMappingProfile(user.providerId, id);

    return NextResponse.json({
      success: true,
      data: { id }
    });

  } catch (error) {
    console.error('Delete profile error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete profile' 
      },
      { status: 500 }
    );
  }
}

