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
 * Includes provider greeting and job list
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
  
  // Generate job list message with last name only and job title
  let jobListMessage = '';
  if (employeeJobs.length === 1) {
    const job = employeeJobs[0];
    const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
    jobListMessage = `You have one job: ${job.jobTemplate.title} for ${patientLastName}. Press 1 to select this job.`;
  } else {
    jobListMessage = `You have ${employeeJobs.length} jobs. `;
    employeeJobs.forEach((job: any, index: number) => {
      const number = index + 1;
      const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
      jobListMessage += `Press ${number} for ${job.jobTemplate.title} for ${patientLastName}. `;
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
 * Includes provider greeting and filtered job list
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
  
  // Generate job list message
  let jobListMessage = '';
  if (employeeJobs.length === 1) {
    const job = employeeJobs[0];
    const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
    jobListMessage = `You have one job. Press 1 for ${job.jobTemplate.title} for ${patientLastName}. `;
  } else {
    jobListMessage = `You have ${employeeJobs.length} jobs. `;
    employeeJobs.forEach((job: any, index: number) => {
      const number = index + 1;
      const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
      jobListMessage += `Press ${number} for ${job.jobTemplate.title} for ${patientLastName}. `;
    });
  }
  
  const fullGreeting = `${providerGreeting}. ${jobListMessage}`;
  
  return {
    message: fullGreeting,
    shouldPresentJobs: true
  };
}
