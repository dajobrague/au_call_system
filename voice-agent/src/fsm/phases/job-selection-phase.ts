/**
 * Job Selection Phase
 * Presents a list of employee's assigned jobs and allows selection via DTMF
 * Replaces the job code collection phase
 */

import { MAX_ATTEMPTS_PER_FIELD, PHASES } from '../constants';
import { generateTwiML, generateConfirmationTwiML } from '../twiml/twiml-generator';
import type { CallState, ProcessingResult } from '../types';

/**
 * Process job selection phase
 * Fetches employee's jobs and presents them for selection
 */
export async function processJobSelectionPhase(
  state: CallState,
  input: string,
  hasInput: boolean
): Promise<{ newState: CallState; result: Partial<ProcessingResult> }> {
  
  console.log(`Job Selection Phase: hasInput=${hasInput}, input="${input}"`);

  // If this is the first time in this phase, fetch the employee's jobs
  if (!state.employeeJobs && state.employee) {
    console.log('Fetching employee jobs...');
    
    try {
      // Import job service dynamically
      const { jobService } = await import('../../services/airtable');
      
      // Fetch all jobs for this employee
      const jobListResult = await jobService.getEmployeeJobs(state.employee);
      
      if (!jobListResult.success || jobListResult.jobs.length === 0) {
        console.error('No jobs found for employee or error fetching jobs');
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
          },
          result: {
            twiml: generateTwiML(
              'You currently have no assigned jobs in the system. Please contact your supervisor.',
              false
            ),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }

      // Store jobs in state
      const newState: CallState = {
        ...state,
        employeeJobs: jobListResult.jobs.map((job, index) => ({
          index: index + 1, // 1-based index for DTMF
          jobTemplate: {
            id: job.jobTemplate.id,
            jobCode: job.jobTemplate.jobCode,
            title: job.jobTemplate.title,
            serviceType: job.jobTemplate.serviceType,
            patientId: job.jobTemplate.patientId,
            occurrenceIds: job.jobTemplate.occurrenceIds,
          },
          patient: job.patient ? {
            id: job.patient.id,
            name: job.patient.name,
            patientId: job.patient.patientId,
          } : null,
        })),
      };

      // Generate job list message
      const jobListMessage = generateJobListMessage(jobListResult.jobs);
      
      console.log(`Presenting ${jobListResult.jobs.length} jobs to employee`);

      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(jobListMessage),
          action: 'job_list_presented',
          shouldDeleteState: false,
        },
      };

    } catch (error) {
      console.error('Error fetching employee jobs:', error);
      return {
        newState: {
          ...state,
          phase: PHASES.ERROR,
        },
        result: {
          twiml: generateTwiML(
            'System error fetching your job list. Connecting you with a representative.',
            false
          ),
          action: 'error',
          shouldDeleteState: true,
        },
      };
    }
  }

  // Process job selection input
  if (hasInput && state.employeeJobs) {
    const selectedIndex = parseInt(input.trim(), 10);
    
    if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > state.employeeJobs.length) {
      // Invalid selection
      const newAttempts = (state.attempts.jobNumber || 0) + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
        console.log('Max job selection attempts reached');
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
            attempts: {
              ...state.attempts,
              jobNumber: newAttempts,
            },
          },
          result: {
            twiml: generateTwiML(
              'I didn\'t receive a valid selection after several attempts. Connecting you with a representative.',
              false
            ),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }

      // Reprompt with error message
      const jobListMessage = generateJobListMessage(
        state.employeeJobs.map(j => ({ jobTemplate: j.jobTemplate, patient: j.patient })),
        true // isRetry
      );

      return {
        newState: {
          ...state,
          attempts: {
            ...state.attempts,
            jobNumber: newAttempts,
          },
        },
        result: {
          twiml: generateConfirmationTwiML(jobListMessage),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }

    // Valid selection - find the selected job
    const selectedJob = state.employeeJobs.find(j => j.index === selectedIndex);
    
    if (!selectedJob) {
      console.error('Selected job not found in state');
      return {
        newState: {
          ...state,
          phase: PHASES.ERROR,
        },
        result: {
          twiml: generateTwiML('System error. Connecting you with a representative.', false),
          action: 'error',
          shouldDeleteState: true,
        },
      };
    }

    console.log(`Job selected: ${selectedJob.jobTemplate.jobCode} - ${selectedJob.jobTemplate.title}`);

    // Transition to job options phase with selected job
    const newState: CallState = {
      ...state,
      phase: PHASES.JOB_OPTIONS,
      jobTemplate: selectedJob.jobTemplate,
      patient: selectedJob.patient || undefined, // Convert null to undefined
      attempts: {
        ...state.attempts,
        jobNumber: 0, // Reset attempts
      },
    };

    // Generate job options message
    const jobOptionsMessage = generateJobOptionsMessage(
      selectedJob.jobTemplate,
      selectedJob.patient
    );

    return {
      newState,
      result: {
        twiml: generateConfirmationTwiML(jobOptionsMessage),
        action: 'job_selected',
        shouldDeleteState: false,
      },
    };
  }

  // No input - reprompt
  const newAttempts = (state.attempts.jobNumber || 0) + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    console.log('Max job selection attempts reached (no input)');
    return {
      newState: {
        ...state,
        phase: PHASES.ERROR,
        attempts: {
          ...state.attempts,
          jobNumber: newAttempts,
        },
      },
      result: {
        twiml: generateTwiML(
          'I didn\'t receive your selection after several attempts. Connecting you with a representative.',
          false
        ),
        action: 'error',
        shouldDeleteState: true,
      },
    };
  }

  // Reprompt
  const jobListMessage = state.employeeJobs
    ? generateJobListMessage(
        state.employeeJobs.map(j => ({ jobTemplate: j.jobTemplate, patient: j.patient })),
        true // isRetry
      )
    : 'Please select a job from your list.';

  return {
    newState: {
      ...state,
      attempts: {
        ...state.attempts,
        jobNumber: newAttempts,
      },
    },
    result: {
      twiml: generateConfirmationTwiML(jobListMessage),
      action: 'reprompt',
      shouldDeleteState: false,
    },
  };
}

/**
 * Generate job list message for voice prompt
 * Shows job title and patient's last name only (no job codes)
 */
function generateJobListMessage(
  jobs: Array<{ jobTemplate: any; patient: any }>,
  isRetry: boolean = false
): string {
  const prefix = isRetry
    ? 'I didn\'t get that. '
    : '';

  if (jobs.length === 1) {
    const job = jobs[0];
    const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
    return `${prefix}You have one job: ${job.jobTemplate.title} for ${patientLastName}. Press 1 to select this job.`;
  }

  let message = `${prefix}You have ${jobs.length} jobs. `;
  
  jobs.forEach((job, index) => {
    const number = index + 1;
    const patientLastName = job.patient?.name ? job.patient.name.split(' ').pop() : 'the patient';
    message += `Press ${number} for ${job.jobTemplate.title} for ${patientLastName}. `;
  });

  return message.trim();
}

/**
 * Generate job options message after selection
 * Shows job title and patient's last name only (no job codes)
 */
function generateJobOptionsMessage(jobTemplate: any, patient: any): string {
  const patientLastName = patient?.name ? patient.name.split(' ').pop() : 'the patient';
  const jobTitle = jobTemplate.title;
  
  return `You selected ${jobTitle} for ${patientLastName}. What would you like to do? Press 1 to reschedule, Press 2 to leave the job open for someone else, Press 3 to talk to a representative, or Press 4 to select a different job.`;
}
