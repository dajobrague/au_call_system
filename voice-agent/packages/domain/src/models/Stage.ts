// FSM Stage Definitions

// Stage Enumeration
// enum Stage {
//   COLLECT_CLIENT_ID = 'COLLECT_CLIENT_ID',           // Ask for client identifier
//   COLLECT_JOB_NUMBER = 'COLLECT_JOB_NUMBER',         // Ask for job number
//   CONFIRM_JOB = 'CONFIRM_JOB',                       // Read back job details
//   ASK_ACTION = 'ASK_ACTION',                         // Present action menu
//   COLLECT_ACTION_VALUE = 'COLLECT_ACTION_VALUE',     // Get specific action input
//   CONFIRM_ACTION = 'CONFIRM_ACTION',                 // Confirm action details
//   EXECUTE_ACTION = 'EXECUTE_ACTION',                 // Perform the action
//   GOODBYE = 'GOODBYE',                               // End call gracefully
//   ERROR_RECOVERY = 'ERROR_RECOVERY'                  // Handle errors and retries
// }

// Stage Configuration
// interface StageConfig {
//   stage: Stage;
//   promptKey: string;             // Key for voice prompt in playbooks
//   timeoutSeconds: number;        // Input timeout for this stage
//   maxRetries: number;            // Maximum retry attempts
//   nextStages: Stage[];           // Possible next stages
//   requiresInput: boolean;        // Whether user input is expected
// }

// Stage Transition
// interface StageTransition {
//   fromStage: Stage;
//   toStage: Stage;
//   trigger: TransitionTrigger;
//   condition?: TransitionCondition;
// }

// Transition Triggers
// enum TransitionTrigger {
//   USER_INPUT_VALID = 'USER_INPUT_VALID',
//   USER_INPUT_INVALID = 'USER_INPUT_INVALID',
//   USER_CONFIRMATION_YES = 'USER_CONFIRMATION_YES',
//   USER_CONFIRMATION_NO = 'USER_CONFIRMATION_NO',
//   ACTION_SUCCESS = 'ACTION_SUCCESS',
//   ACTION_FAILED = 'ACTION_FAILED',
//   TIMEOUT = 'TIMEOUT',
//   MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
//   SYSTEM_ERROR = 'SYSTEM_ERROR'
// }

// Transition Conditions
// interface TransitionCondition {
//   type: 'FIELD_PRESENT' | 'FIELD_EMPTY' | 'CUSTOM';
//   fieldName?: string;
//   customCheck?: string;          // Reference to custom validation
// }

// Stage Context
// interface StageContext {
//   currentStage: Stage;
//   previousStage?: Stage;
//   attemptCount: number;          // Retry attempts for current stage
//   stageStartTime: Date;          // When current stage began
//   totalStageTime: number;        // Total time spent in all stages
//   collectedData: Record<string, any>;  // Data collected so far
// }

// Stage Validation Rules
// interface StageValidation {
//   stage: Stage;
//   requiredFields: string[];      // Fields that must be present
//   validationRules: ValidationRule[];
// }

// Validation Rule
// interface ValidationRule {
//   field: string;
//   type: 'FORMAT' | 'BUSINESS_RULE' | 'EXTERNAL_CHECK';
//   rule: string;                  // Rule definition or reference
//   errorMessage: string;          // User-friendly error message
// }

// Stage Statistics
// interface StageStats {
//   stage: Stage;
//   averageTime: number;           // Average time spent in stage
//   successRate: number;           // Percentage of successful completions
//   commonErrors: string[];        // Most frequent error types
// }

// TODO: Implement stage timing and performance tracking
// TODO: Add conditional stage routing based on job type
// TODO: Define stage recovery and fallback strategies
