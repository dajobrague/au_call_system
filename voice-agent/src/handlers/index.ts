/**
 * Handlers Module
 * Centralized exports for all business logic handlers
 */

// Authentication
export { authenticateByPhone, prefetchBackgroundData } from './authentication-handler';
export type { AuthenticationResult, BackgroundDataResult } from './authentication-handler';

// Provider
export {
  generateSingleProviderGreeting,
  generateMultiProviderGreeting,
  generateProviderSelectionGreeting
} from './provider-handler';
export type { ProviderGreetingOptions, ProviderGreetingResult } from './provider-handler';

// Job
export {
  selectJob,
  generateJobOptionsMessage,
  filterJobsByProvider
} from './job-handler';
export type { JobSelectionResult, JobOptionsMessage } from './job-handler';

// Transfer
export {
  handleRepresentativeTransfer,
  getQueueUpdateMessage
} from './transfer-handler';
export type { TransferOptions, TransferResult } from './transfer-handler';
