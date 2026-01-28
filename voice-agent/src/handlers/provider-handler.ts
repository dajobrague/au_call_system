/**
 * Provider Handler
 * Handles provider selection and greeting generation
 */

import { paginateOccurrences, generateOccurrenceListPrompt } from './occurrence-pagination';

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
  // Option 1 is always "speak to a representative", jobs start from option 2
  let jobListMessage = '';
  if (employeeJobs.length === 1) {
    const job = employeeJobs[0];
    const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
    jobListMessage = `Press 1 to speak to a representative, or Press 2 for ${job.jobTemplate.title} for ${patientLastName}.`;
  } else {
    jobListMessage = `Press 1 to speak to a representative. You have ${employeeJobs.length} jobs. `;
    employeeJobs.forEach((job: any, index: number) => {
      const number = index + 2; // Jobs start from 2
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
  // Option 1 is always "speak to a representative", jobs start from option 2
  let jobListMessage = '';
  if (employeeJobs.length === 1) {
    const job = employeeJobs[0];
    const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
    jobListMessage = `Press 1 to speak to a representative. You have one job. Press 2 for ${job.jobTemplate.title} for ${patientLastName}. `;
  } else {
    jobListMessage = `Press 1 to speak to a representative. You have ${employeeJobs.length} jobs. `;
    employeeJobs.forEach((job: any, index: number) => {
      const number = index + 2; // Jobs start from 2
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

/**
 * Generate greeting with occurrence list (new flow - shows shifts immediately)
 * @param employee - Authenticated employee
 * @param provider - Provider info (optional)
 * @param enrichedOccurrences - Flat list of all occurrences with full details
 * @param pageNumber - Current page number (default 1)
 * @returns Greeting message with occurrence list
 */
export function generateOccurrenceBasedGreeting(
  employee: any,
  provider: any,
  enrichedOccurrences: any[],
  pageNumber: number = 1
): ProviderGreetingResult {
  const providerGreeting = provider?.greeting || 'Welcome to Healthcare Services';
  
  // Check if employee has any occurrences
  if (!enrichedOccurrences || enrichedOccurrences.length === 0) {
    return {
      message: `Hi ${employee.name}. ${providerGreeting}. You currently have no upcoming shifts scheduled. Press 1 to speak with a representative.`,
      shouldPresentJobs: false
    };
  }
  
  // Paginate occurrences
  const paginationResult = paginateOccurrences(enrichedOccurrences, pageNumber);
  
  // Generate occurrence list prompt
  const occurrencePrompt = generateOccurrenceListPrompt(
    paginationResult.pageItems,
    paginationResult.currentPage,
    paginationResult.hasNextPage
  );
  
  // Build full greeting
  let fullGreeting = `Hi ${employee.name}. ${providerGreeting}. ${occurrencePrompt}`;
  
  return {
    message: fullGreeting,
    shouldPresentJobs: true
  };
}
