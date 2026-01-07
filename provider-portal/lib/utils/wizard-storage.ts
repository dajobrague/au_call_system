/**
 * Wizard state management using sessionStorage
 * Stores wizard data temporarily during the onboarding flow
 */

export interface WizardUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface WizardBusinessData {
  providerName: string;
  state: string;
  suburb: string;
  address: string;
  timezone: string;
}

export interface WizardLogoData {
  logoUrl?: string;
  logoS3Key?: string;
}

export interface WizardGreetingData {
  greetingText: string;
}

export interface WizardTransferData {
  transferNumber?: string;
}

export interface WizardState {
  user?: WizardUserData;
  business?: WizardBusinessData;
  logo?: WizardLogoData;
  greeting?: WizardGreetingData;
  transfer?: WizardTransferData;
  currentStep: number;
}

const STORAGE_KEY = 'provider_wizard_state';

/**
 * Save wizard state to session storage
 */
export function saveWizardState(state: Partial<WizardState>): void {
  if (typeof window === 'undefined') return;
  
  const currentState = getWizardState();
  const newState = { ...currentState, ...state };
  
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  } catch (error) {
    console.error('Failed to save wizard state:', error);
  }
}

/**
 * Get wizard state from session storage
 */
export function getWizardState(): WizardState {
  if (typeof window === 'undefined') {
    return { currentStep: 0 };
  }
  
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return { currentStep: 0 };
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load wizard state:', error);
    return { currentStep: 0 };
  }
}

/**
 * Clear wizard state from session storage
 */
export function clearWizardState(): void {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear wizard state:', error);
  }
}

/**
 * Check if wizard is complete (all required fields filled)
 */
export function isWizardComplete(state: WizardState): boolean {
  return !!(
    state.user?.email &&
    state.user?.password &&
    state.business?.providerName &&
    state.business?.state &&
    state.business?.suburb &&
    state.business?.address &&
    state.business?.timezone
    // greeting and transfer are optional
  );
}

/**
 * Get list of Australian states/territories
 */
export const AUSTRALIAN_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'SA', label: 'South Australia' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'ACT', label: 'Australian Capital Territory' },
];

/**
 * Get list of Australian timezones
 */
export const AUSTRALIAN_TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Australia/Hobart', label: 'Hobart (AEST/AEDT)' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST)' },
];

