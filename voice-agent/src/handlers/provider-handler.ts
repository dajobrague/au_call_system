/**
 * Provider Handler
 * Handles provider selection and greeting generation
 */

export interface ProviderGreetingOptions {
  employee: any;
  provider?: any;
  employeeJobs: any[];
  hasMultipleProviders: boolean;
}

export interface ProviderGreetingResult {
  message: string;
  shouldPresentJobs: boolean;
}

/**
 * Generate greeting message for single provider scenario
 * Includes provider greeting and job list with date/time details
 */
export function generateSingleProviderGreeting(options: ProviderGreetingOptions): ProviderGreetingResult {
  const { employee, provider, employeeJobs } = options;
  
  const providerGreeting = provider?.greeting || 'Welcome to Healthcare Services';
  
  if (employeeJobs.length === 0) {
    return {
      message: `Hi ${employee.name}. ${providerGreeting}. You currently have no assigned jobs in the system. Please contact your supervisor.`,
      shouldPresentJobs: false
    };
  }
  
  // Limit to 2 shifts maximum as per requirements
  const jobsToPresent = employeeJobs.slice(0, 2);
  
  // Generate job list message with first name, job title, date and time
  let jobListMessage = '';
  if (jobsToPresent.length === 1) {
    const job = jobsToPresent[0];
    const patientFirstName = job.patient?.name ? job.patient.name.split(' ')[0] : 'a patient';
    const shiftDetails = job.nextOccurrence?.displayDate || 'an upcoming shift';
    jobListMessage = `You have one shift: ${job.jobTemplate.title} for ${patientFirstName} at ${shiftDetails}. Press 1 to select this shift.`;
  } else {
    jobListMessage = `You have ${jobsToPresent.length} shifts. `;
    jobsToPresent.forEach((job: any, index: number) => {
      const number = index + 1;
      const patientFirstName = job.patient?.name ? job.patient.name.split(' ')[0] : 'a patient';
      const shiftDetails = job.nextOccurrence?.displayDate || 'an upcoming shift';
      jobListMessage += `Press ${number} for ${job.jobTemplate.title} for ${patientFirstName} at ${shiftDetails}. `;
    });
  }
  
  const fullGreeting = `Hi ${employee.name}. ${providerGreeting}. ${jobListMessage}`;
  
  return {
    message: fullGreeting,
    shouldPresentJobs: true
  };
}

/**
 * Generate greeting message for multiple provider scenario
 * Asks user to select a provider
 */
export function generateMultiProviderGreeting(employee: any, providers: any[]): string {
  const providerOptions = providers
    .map((p: any, index: number) => `Press ${index + 1} for ${p.name}`)
    .join(', ');
  
  return `Hi ${employee.name}. I see you work for multiple providers. ${providerOptions}.`;
}

/**
 * Generate greeting after provider selection in multi-provider scenario
 * Includes provider greeting and filtered job list with date/time details
 */
export function generateProviderSelectionGreeting(
  provider: any,
  employeeJobs: any[]
): ProviderGreetingResult {
  const providerGreeting = provider?.greeting || 'Welcome to Healthcare Services';
  
  if (employeeJobs.length === 0) {
    return {
      message: `${providerGreeting}. You currently have no assigned jobs for this provider. Please contact your supervisor.`,
      shouldPresentJobs: false
    };
  }
  
  // Limit to 2 shifts maximum as per requirements
  const jobsToPresent = employeeJobs.slice(0, 2);
  
  // Generate job list message with first name, job title, date and time
  let jobListMessage = '';
  if (jobsToPresent.length === 1) {
    const job = jobsToPresent[0];
    const patientFirstName = job.patient?.name ? job.patient.name.split(' ')[0] : 'a patient';
    const shiftDetails = job.nextOccurrence?.displayDate || 'an upcoming shift';
    jobListMessage = `You have one shift. Press 1 for ${job.jobTemplate.title} for ${patientFirstName} at ${shiftDetails}. `;
  } else {
    jobListMessage = `You have ${jobsToPresent.length} shifts. `;
    jobsToPresent.forEach((job: any, index: number) => {
      const number = index + 1;
      const patientFirstName = job.patient?.name ? job.patient.name.split(' ')[0] : 'a patient';
      const shiftDetails = job.nextOccurrence?.displayDate || 'an upcoming shift';
      jobListMessage += `Press ${number} for ${job.jobTemplate.title} for ${patientFirstName} at ${shiftDetails}. `;
    });
  }
  
  const fullGreeting = `${providerGreeting}. ${jobListMessage}`;
  
  return {
    message: fullGreeting,
    shouldPresentJobs: true
  };
}
