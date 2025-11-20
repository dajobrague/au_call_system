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
 * @param selectionNumber - DTMF digit pressed (1-based)
 * @returns Selected job or error
 */
export function selectJob(employeeJobs: any[], selectionNumber: number): JobSelectionResult {
  if (!employeeJobs || employeeJobs.length === 0) {
    return {
      success: false,
      error: 'No jobs available'
    };
  }
  
  if (selectionNumber < 1 || selectionNumber > employeeJobs.length) {
    return {
      success: false,
      error: `Invalid selection. Please press a number from 1 to ${employeeJobs.length}`
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
 * Generate job options message after job selection
 * Shows job title, patient name, and available options
 */
export function generateJobOptionsMessage(job: any): JobOptionsMessage {
  const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
  const jobTitle = job.jobTemplate.title;
  
  const message = `You selected ${jobTitle} for ${patientLastName}. Confirm: press 1 if you want to leave this shift open for someone else, or press 2 to connect with a representative.`;
  
  return {
    message,
    jobTitle,
    patientName: patientLastName
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
