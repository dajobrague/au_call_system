/**
 * Job Handler
 * Handles job selection and job options message generation
 */

export interface JobSelectionResult {
  success: boolean;
  job?: any;
  error?: string;
}

export interface JobOptionsMessage {
  message: string;
  jobTitle: string;
  patientName: string;
}

/**
 * Select a job from the employee's job list
 * @param employeeJobs - List of available jobs
 * @param selectionNumber - DTMF digit pressed (2-based, since 1 is reserved for representative)
 * @returns Selected job or error
 */
export function selectJob(employeeJobs: any[], selectionNumber: number): JobSelectionResult {
  if (!employeeJobs || employeeJobs.length === 0) {
    return {
      success: false,
      error: 'No jobs available'
    };
  }
  
  // Option 1 is reserved for "speak to representative"
  // Jobs start from option 2
  if (selectionNumber < 2 || selectionNumber > (employeeJobs.length + 1)) {
    const maxOption = employeeJobs.length + 1;
    return {
      success: false,
      error: `Invalid selection. Please press a number from 2 to ${maxOption}`
    };
  }
  
  const selectedJob = employeeJobs.find((j: any) => j.index === selectionNumber);
  
  if (!selectedJob) {
    return {
      success: false,
      error: 'Job not found'
    };
  }
  
  return {
    success: true,
    job: selectedJob
  };
}

/**
 * Generate job options message after occurrence selection
 * Simplified: Only leave open or talk to representative
 * NOTE: Reschedule option removed per client feedback (kept code for potential future use)
 */
export function generateJobOptionsMessage(job: any): JobOptionsMessage {
  const patientFirstName = job.patient?.firstName || job.patient?.name?.split(' ')[0] || 'the patient';
  const jobTitle = job.jobTemplate?.title || 'this shift';
  
  // NEW simplified message - only 2 options
  const message = `Confirm: Press 1 to cancel your shift, or press 2 to connect with a representative.`;
  
  // OLD message with reschedule (commented out for future use):
  // const message = `You selected ${jobTitle} for ${patientFirstName}. What would you like to do? Press 1 to reschedule, Press 2 to leave the job open for someone else, Press 3 to talk to a representative, or Press 4 to select a different job.`;
  
  return {
    message,
    jobTitle,
    patientName: patientFirstName
  };
}

/**
 * Filter jobs by provider ID
 * @param employeeJobs - All employee jobs
 * @param providerId - Provider ID to filter by
 * @returns Filtered job list
 */
export function filterJobsByProvider(employeeJobs: any[], providerId: string): any[] {
  if (!providerId) {
    return employeeJobs;
  }
  
  return employeeJobs.filter((job: any) => {
    const jobProviderId = job.jobTemplate.providerId || 
                          (Array.isArray(job.jobTemplate.providerIds) ? job.jobTemplate.providerIds[0] : null);
    return jobProviderId === providerId;
  });
}
