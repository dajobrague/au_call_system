/**
 * Provider Job Templates API Route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  getJobTemplatesByProvider,
  createJobTemplate,
  updateJobTemplate,
  deleteJobTemplate
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
    const {
      jobCode,
      title,
      serviceType,
      priority,
      patientRecordId,
      defaultEmployeeRecordId,
      timeWindowStart,
      timeWindowEnd,
      active = true
    } = body;
    
    // Validate required fields
    if (!jobCode || !title || !serviceType || !priority || !patientRecordId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const fields: {
      'Job Code': string;
      'Title': string;
      'Service Type': string;
      'Priority': string;
      'Provider': string[];
      'Patient': string[];
      'Default Employee'?: string[];
      'Time Window Start'?: string;
      'Time Window End'?: string;
      'Active': boolean;
    } = {
      'Job Code': jobCode,
      'Title': title,
      'Service Type': serviceType,
      'Priority': priority,
      'Provider': [user.providerId],
      'Patient': [patientRecordId],
      'Active': active
    };
    
    if (defaultEmployeeRecordId) {
      fields['Default Employee'] = [defaultEmployeeRecordId];
    }
    
    if (timeWindowStart) {
      fields['Time Window Start'] = timeWindowStart;
    }
    
    if (timeWindowEnd) {
      fields['Time Window End'] = timeWindowEnd;
    }
    
    const newTemplate = await createJobTemplate(fields);
    
    return NextResponse.json({
      success: true,
      data: newTemplate,
    });
  } catch (error) {
    console.error('Error creating job template:', error);
    return NextResponse.json(
      { error: 'Failed to create job template' },
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
    const {
      recordId,
      jobCode,
      title,
      serviceType,
      priority,
      patientRecordId,
      defaultEmployeeRecordId,
      timeWindowStart,
      timeWindowEnd,
      active
    } = body;
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'Record ID is required' },
        { status: 400 }
      );
    }
    
    // Build update fields object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: Record<string, any> = {};
    
    if (jobCode !== undefined) fields['Job Code'] = jobCode;
    if (title !== undefined) fields['Title'] = title;
    if (serviceType !== undefined) fields['Service Type'] = serviceType;
    if (priority !== undefined) fields['Priority'] = priority;
    if (patientRecordId !== undefined) fields['Patient'] = [patientRecordId];
    if (defaultEmployeeRecordId !== undefined) {
      fields['Default Employee'] = defaultEmployeeRecordId ? [defaultEmployeeRecordId] : [];
    }
    if (timeWindowStart !== undefined) fields['Time Window Start'] = timeWindowStart;
    if (timeWindowEnd !== undefined) fields['Time Window End'] = timeWindowEnd;
    if (active !== undefined) fields['Active'] = active;
    
    const updatedTemplate = await updateJobTemplate(recordId, fields);
    
    return NextResponse.json({
      success: true,
      data: updatedTemplate,
    });
  } catch (error) {
    console.error('Error updating job template:', error);
    return NextResponse.json(
      { error: 'Failed to update job template' },
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
        { error: 'Record ID is required' },
        { status: 400 }
      );
    }
    
    await deleteJobTemplate(recordId);
    
    return NextResponse.json({
      success: true,
      message: 'Job template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting job template:', error);
    return NextResponse.json(
      { error: 'Failed to delete job template' },
      { status: 500 }
    );
  }
}








