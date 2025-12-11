/**
 * Job Details API
 * Provides job details for web-based acceptance interface
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../src/lib/logger';

// Set runtime to nodejs for compatibility
export const runtime = 'nodejs';

interface JobDetailsParams {
  params: {
    id: string;
  };
}

/**
 * Get job details for acceptance page
 */
export async function GET(request: NextRequest, { params }: JobDetailsParams) {
  const startTime = Date.now();
  const jobId = params.id;
  
  try {
    const url = new URL(request.url);
    const employeeId = url.searchParams.get('emp');
    
    logger.info('Job details API request', {
      jobId,
      employeeId,
      type: 'job_details_api_request'
    });

    // Validate required parameters
    if (!employeeId) {
      return NextResponse.json(
        { error: 'Missing employee ID parameter' },
        { status: 400 }
      );
    }

    // For testing, recognize employee ID recW1CXg3O5I3oR0g as David Bracho
    let employeeName = 'Unknown Employee';
    if (employeeId === 'recW1CXg3O5I3oR0g') {
      employeeName = 'David Bracho';
    } else if (employeeId === 'test_employee') {
      employeeName = 'Test Employee';
    }

    logger.info('Employee recognized for job access', {
      jobId,
      employeeId,
      employeeName,
      type: 'employee_recognized'
    });

    try {
      // Import services
      const { airtableClient } = await import('../../../../src/services/airtable');
      
      // Get job occurrence details
      const jobOccurrence = await airtableClient.getJobOccurrenceById(jobId);
      
      if (!jobOccurrence) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }
      
      // Check job availability and assignment
      const assignedEmployees = jobOccurrence.fields['Assigned Employee'] || [];
      const isAssignedToCurrentEmployee = assignedEmployees.includes(employeeId);
      const isAssignedToOthers = assignedEmployees.length > 0 && !isAssignedToCurrentEmployee;
      
      // If job is assigned to someone else, return limited info but include provider and employee for UI
      if (isAssignedToOthers) {
        // Still get provider info for header
        const providerId = jobOccurrence.fields['Provider']?.[0];
        let provider = null;
        if (providerId) {
          provider = await airtableClient.getProviderById(providerId);
        }

        // Get employee info for sorry message
        let employee = null;
        if (employeeId && employeeId !== 'test_employee') {
          try {
            // For now, use hardcoded employee data for known IDs
            if (employeeId === 'recW1CXg3O5I3oR0g') {
              employee = {
                id: employeeId,
                fields: {
                  'Display Name': 'David Bracho'
                }
              };
            } else if (employeeId === 'recX3JNx6p0KFNXjB') {
              employee = {
                id: employeeId,
                fields: {
                  'Display Name': 'Sarah Johnson'
                }
              };
            } else {
              // Try to fetch from Airtable
              const { employeeService } = await import('../../../../src/services/airtable');
              const employeeRecord = await employeeService.getEmployeeById(employeeId);
              if (employeeRecord) {
                employee = {
                  id: employeeRecord.id,
                  fields: {
                    'Display Name': employeeRecord.name
                  }
                };
              }
            }
          } catch (error) {
            logger.warn('Could not fetch employee details for assigned_to_others case', {
              jobId,
              employeeId,
              error: error instanceof Error ? error.message : 'Unknown error',
              type: 'employee_fetch_warning_assigned_to_others'
            });
          }
        }

        return NextResponse.json({
          success: true,
          job: {
            id: jobOccurrence.id,
            status: 'assigned_to_others',
            assignedToCurrentEmployee: false,
            provider: provider ? {
              name: provider.fields['Name'],
              logo: provider.fields['Logo']?.[0]?.url || null
            } : null,
            employee: employee ? {
              name: employee.fields['Display Name'],
              id: employee.id
            } : (employeeId === 'test_employee' ? {
              name: 'Test Employee',
              id: 'test_employee'
            } : null)
          }
        });
      }
      
      // Get additional details (patient info, provider info, and employee info)
      const patientId = jobOccurrence.fields['Patient']?.[0];
      const providerId = jobOccurrence.fields['Provider']?.[0];
      
      let patient = null;
      let provider = null;
      let employee = null;
      
      if (patientId) {
        patient = await airtableClient.getPatientById(patientId);
      }
      
      if (providerId) {
        provider = await airtableClient.getProviderById(providerId);
      }
      
      // Get employee details for welcome message
      if (employeeId && employeeId !== 'test_employee') {
        try {
          // For now, use hardcoded employee data for known IDs
          if (employeeId === 'recW1CXg3O5I3oR0g') {
            employee = {
              id: employeeId,
              fields: {
                'Display Name': 'David Bracho'
              }
            };
          } else {
            // Try to fetch from Airtable
            const { employeeService } = await import('../../../../src/services/airtable');
            const employeeRecord = await employeeService.getEmployeeById(employeeId);
            if (employeeRecord) {
              employee = {
                id: employeeRecord.id,
                fields: {
                  'Display Name': employeeRecord.name
                }
              };
            }
          }
        } catch (error) {
          logger.warn('Could not fetch employee details', {
            jobId,
            employeeId,
            error: error instanceof Error ? error.message : 'Unknown error',
            type: 'employee_fetch_warning'
          });
        }
      }
      
      const duration = Date.now() - startTime;
      
      // Return job details
      const jobDetails = {
        id: jobOccurrence.id,
        occurrenceId: jobOccurrence.fields['Occurrence ID'],
        scheduledAt: jobOccurrence.fields['Scheduled At'],
        time: jobOccurrence.fields['Time'],
        status: jobOccurrence.fields['Status'],
        reason: jobOccurrence.fields['Reschedule Reason'],
        assignedToCurrentEmployee: isAssignedToCurrentEmployee,
        isAvailable: !isAssignedToOthers && (jobOccurrence.fields['Status'] === 'Open' || jobOccurrence.fields['Status'] === 'Scheduled'),
        patient: patient ? {
          name: patient.fields['Patient Full Name'],
          address: patient.fields['Address'],
          notes: patient.fields['Important Notes']
        } : null,
        provider: provider ? {
          name: provider.fields['Name'],
          logo: provider.fields['Logo']?.[0]?.url || null
        } : null,
        employee: employee ? {
          name: employee.fields['Display Name'],
          id: employee.id
        } : (employeeId === 'test_employee' ? {
          name: 'Test Employee',
          id: 'test_employee'
        } : null),
        jobTemplate: {
          title: 'Healthcare Service',
          serviceType: 'General'
        }
      };
      
      logger.info('Job details API response', {
        jobId,
        employeeId,
        jobStatus: jobOccurrence.fields['Status'],
        duration,
        type: 'job_details_api_success'
      });
      
      return NextResponse.json({
        success: true,
        job: jobDetails
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Job details API error', {
        jobId,
        employeeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'job_details_api_error'
      });
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Job details API request error', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      type: 'job_details_api_request_error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle job acceptance/decline actions
 */
export async function POST(request: NextRequest, { params }: JobDetailsParams) {
  const startTime = Date.now();
  const jobId = params.id;
  
  try {
    const body = await request.json();
    const { action, employeeId } = body;
    
    logger.info('Job action API request', {
      jobId,
      employeeId,
      action,
      type: 'job_action_api_request'
    });

    // Validate required parameters
    if (!employeeId || !action) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Recognize employee for job actions
    let employeeName = 'Unknown Employee';
    if (employeeId === 'recW1CXg3O5I3oR0g') {
      employeeName = 'David Bracho';
    } else if (employeeId === 'test_employee') {
      employeeName = 'Test Employee';
    }

    try {
      // Import services
      const { airtableClient } = await import('../../../../src/services/airtable');
      
      if (action === 'accept') {
        logger.info('Job acceptance via web interface', {
          jobId,
          employeeId,
          employeeName,
          type: 'web_job_acceptance_start'
        });

        // Check if job is still available
        const jobOccurrence = await airtableClient.getJobOccurrenceById(jobId);
        
        if (!jobOccurrence) {
          return NextResponse.json({
            success: false,
            error: 'Job not found'
          }, { status: 404 });
        }

        if (jobOccurrence.fields['Status'] !== 'Open') {
          logger.info('Job no longer available for acceptance', {
            jobId,
            currentStatus: jobOccurrence.fields['Status'],
            type: 'web_job_no_longer_available'
          });

          return NextResponse.json({
            success: false,
            error: 'Job no longer available - it has been assigned to another employee',
            currentStatus: jobOccurrence.fields['Status']
          }, { status: 410 });
        }

        // Assign job to employee and clear reschedule reason
        const updates = {
          'Status': 'Scheduled',
          'Assigned Employee': [employeeId], // Assign to this employee
          'Reschedule Reason': '' // Clear reschedule reason
        };

        const updateSuccess = await airtableClient.updateJobOccurrence(jobId, updates);

        if (updateSuccess) {
          logger.info('Job assigned successfully via web interface', {
            jobId,
            employeeId,
            employeeName,
            type: 'web_job_assigned_success'
          });

          // Cancel pending SMS waves (Wave 2 and Wave 3)
          try {
            const { cancelWaves } = await import('../../../../src/services/queue/sms-wave-queue');
            const cancelResult = await cancelWaves(jobId);
            
            logger.info('Pending waves cancelled after job assignment', {
              jobId,
              wave2Cancelled: cancelResult.wave2,
              wave3Cancelled: cancelResult.wave3,
              type: 'waves_cancelled_after_assignment'
            });
          } catch (cancelError) {
            // Log but don't fail the assignment if wave cancellation fails
            logger.warn('Failed to cancel pending waves (non-critical)', {
              jobId,
              error: cancelError instanceof Error ? cancelError.message : 'Unknown error',
              type: 'wave_cancel_warning'
            });
          }

          return NextResponse.json({
            success: true,
            message: `Job successfully assigned to ${employeeName}! Check the system for full details.`,
            action: 'accept',
            employeeName
          });
        } else {
          logger.error('Failed to assign job via web interface', {
            jobId,
            employeeId,
            employeeName,
            type: 'web_job_assignment_failed'
          });

          return NextResponse.json({
            success: false,
            error: 'Failed to assign job in system'
          }, { status: 500 });
        }
        
      } else {
        // Handle decline
        logger.info('Job declined via web interface', {
          jobId,
          employeeId,
          employeeName,
          type: 'web_job_decline'
        });
        
        return NextResponse.json({
          success: true,
          message: `Thank you for your response, ${employeeName}. The job will remain available for other employees.`,
          action: 'decline',
          employeeName
        });
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Job action processing error', {
        jobId,
        employeeId,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        type: 'job_action_processing_error'
      });
      
      return NextResponse.json(
        { error: 'Failed to process job action' },
        { status: 500 }
      );
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Job action API request error', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      type: 'job_action_api_request_error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
