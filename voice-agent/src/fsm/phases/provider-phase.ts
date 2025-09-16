/**
 * Provider selection phase processor
 * Handles multi-provider employee selection
 */

import { MAX_ATTEMPTS_PER_FIELD, PHASES } from '../constants';
import { generateTwiML, generateConfirmationTwiML } from '../twiml/twiml-generator';
import type { CallState, ProcessingResult } from '../types';

/**
 * Process provider_selection phase
 * Handles multi-provider employee selection
 */
export async function processProviderSelectionPhase(state: CallState, input: string, hasInput: boolean): Promise<{ newState: CallState; result: Partial<ProcessingResult> }> {
  console.log(`Provider Selection Phase: hasInput=${hasInput}, input="${input}"`);
  
  // If this is the first time in this phase, check for multiple providers
  if (!state.availableProviders && state.employee) {
    console.log('Checking for multiple providers...');
    
    try {
      // Import multi-provider service dynamically
      const { multiProviderService } = await import('../../services/airtable');
      
      // Check if employee has multiple providers
      const providerResult = await multiProviderService.getEmployeeProviders(state.employee);
      
      if (!providerResult.hasMultipleProviders) {
        console.log('Employee has single provider, continuing to greeting');
        
        // Get the single provider's greeting
        let providerGreeting = 'Welcome to Healthcare Services';
        if (providerResult.providers.length > 0) {
          providerGreeting = providerResult.providers[0].greeting || 'Welcome to Healthcare Services';
        }
        
        // Single provider - continue directly to provider greeting
        const newState: CallState = {
          ...state,
          provider: providerResult.providers.length > 0 ? {
            id: providerResult.providers[0].id,
            name: providerResult.providers[0].name,
            greeting: providerResult.providers[0].greeting,
          } : null,
          phase: PHASES.PROVIDER_GREETING,
        };
        
        // Don't repeat the name - just give provider greeting and ask for job code
        const greeting = `${providerGreeting}. Please use your keypad to enter your job code followed by the pound key.`;
        
        return {
          newState,
          result: {
            twiml: generateTwiML(greeting, true),
            action: 'transition',
            shouldDeleteState: false,
          },
        };
      }
      
      // Multiple providers - store options and present selection
      const newState: CallState = {
        ...state,
        availableProviders: providerResult.providers.map(p => ({
          id: p.id,
          name: p.name,
          greeting: p.greeting,
          selectionNumber: p.selectionNumber,
        })),
        attempts: {
          ...state.attempts,
          clientId: 1, // First provider selection attempt
        },
      };
      
      const selectionMessage = multiProviderService.generateProviderSelectionMessage(providerResult.providers);
      
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(selectionMessage),
          action: 'prompt',
          shouldDeleteState: false,
        },
      };
      
    } catch (error) {
      console.error('Error checking multiple providers:', error);
      // Fallback to single provider flow
      const newState: CallState = {
        ...state,
        phase: PHASES.PROVIDER_GREETING,
      };
      
      // Don't repeat the name - just give generic greeting and ask for job code
      const greeting = `Welcome to Healthcare Services. Please use your keypad to enter your job code followed by the pound key.`;
      
      return {
        newState,
        result: {
          twiml: generateTwiML(greeting, true),
          action: 'transition',
          shouldDeleteState: false,
        },
      };
    }
  }
  
  // Handle provider selection input
  if (hasInput && state.availableProviders) {
    const selection = input.trim();
    const selectionNum = parseInt(selection, 10);
    
    // Validate selection
    const selectedProvider = state.availableProviders.find(p => p.selectionNumber === selectionNum);
    
    if (!selectedProvider) {
      // Invalid selection
      const newAttempts = state.attempts.clientId + 1;
      
      if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
        console.log('Max provider selection attempts reached');
        return {
          newState: {
            ...state,
            phase: PHASES.ERROR,
            attempts: {
              ...state.attempts,
              clientId: newAttempts,
            },
          },
          result: {
            twiml: generateTwiML('I didn\'t understand your provider selection. Connecting you with a representative.', false),
            action: 'error',
            shouldDeleteState: true,
          },
        };
      }
      
      // Reprompt for valid selection
      const newState: CallState = {
        ...state,
        attempts: {
          ...state.attempts,
          clientId: newAttempts,
        },
      };
      
      const maxOption = state.availableProviders.length;
      const repromptMessage = `Please press a number from 1 to ${maxOption} to select your provider.`;
      
      return {
        newState,
        result: {
          twiml: generateConfirmationTwiML(repromptMessage),
          action: 'reprompt',
          shouldDeleteState: false,
        },
      };
    }
    
    // Valid provider selected
    console.log(`Provider ${selectionNum} selected: ${selectedProvider.name}`);
    
    const newState: CallState = {
      ...state,
      provider: {
        id: selectedProvider.id,
        name: selectedProvider.name,
        greeting: selectedProvider.greeting,
      },
      phase: PHASES.PROVIDER_GREETING,
    };
    
    // Generate greeting with selected provider (no name repetition)
    const providerGreeting = selectedProvider.greeting || 'Welcome to Healthcare Services';
    const greeting = `${providerGreeting}. Please use your keypad to enter your job code followed by the pound key.`;
    
    return {
      newState,
      result: {
        twiml: generateTwiML(greeting, true),
        action: 'transition',
        shouldDeleteState: false,
      },
    };
  }
  
  // No input - reprompt
  const newAttempts = state.attempts.clientId + 1;
  
  if (newAttempts > MAX_ATTEMPTS_PER_FIELD) {
    console.log('Max provider selection attempts reached (no input)');
    return {
      newState: {
        ...state,
        phase: PHASES.ERROR,
        attempts: {
          ...state.attempts,
          clientId: newAttempts,
        },
      },
      result: {
        twiml: generateTwiML('I didn\'t hear your provider selection. Connecting you with a representative.', false),
        action: 'error',
        shouldDeleteState: true,
      },
    };
  }
  
  // Reprompt for selection
  const newState: CallState = {
    ...state,
    attempts: {
      ...state.attempts,
      clientId: newAttempts,
    },
  };
  
  if (state.availableProviders && state.availableProviders.length > 0) {
    const maxOption = state.availableProviders.length;
    const repromptMessage = `I didn\'t hear your selection. Please press a number from 1 to ${maxOption} to select your provider.`;
    
    return {
      newState,
      result: {
        twiml: generateConfirmationTwiML(repromptMessage),
        action: 'reprompt',
        shouldDeleteState: false,
      },
    };
  }
  
  // Fallback if no provider data
  return {
    newState: {
      ...state,
      phase: PHASES.ERROR,
    },
    result: {
      twiml: generateTwiML('System error with provider selection. Connecting you with a representative.', false),
      action: 'error',
      shouldDeleteState: true,
    },
  };
}
