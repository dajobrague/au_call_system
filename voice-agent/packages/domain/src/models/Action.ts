// Action Type Definitions

// Base Action Interface
// interface BaseAction {
//   type: ActionType;              // Discriminated union type
//   jobId: string;                 // Target job record ID
//   timestamp: Date;               // When action was requested
//   source: ActionSource;          // How action was initiated
//   userId?: string;               // User who initiated action (if available)
// }

// Action Type Enumeration
// enum ActionType {
//   UPDATE_STATUS = 'UPDATE_STATUS',
//   UPDATE_SCHEDULED_DATE = 'UPDATE_SCHEDULED_DATE',
//   UPDATE_ASSIGNEE = 'UPDATE_ASSIGNEE',
//   ADD_NOTE = 'ADD_NOTE'
// }

// Action Source Enumeration
// enum ActionSource {
//   IVR = 'IVR',                   // Voice call system
//   WEB = 'WEB',                   // Web dashboard
//   API = 'API',                   // Direct API call
//   SYSTEM = 'SYSTEM'              // Automated system action
// }

// Specific Action Types

// Update Status Action
// interface UpdateStatusAction extends BaseAction {
//   type: ActionType.UPDATE_STATUS;
//   newStatus: JobStatus;
//   previousStatus: JobStatus;
//   reason?: string;               // Optional reason for status change
// }

// Update Scheduled Date Action
// interface UpdateScheduledDateAction extends BaseAction {
//   type: ActionType.UPDATE_SCHEDULED_DATE;
//   newDate: Date;
//   previousDate?: Date;
//   timezone: string;              // Timezone for date interpretation
//   reason?: string;               // Optional reason for reschedule
// }

// Update Assignee Action
// interface UpdateAssigneeAction extends BaseAction {
//   type: ActionType.UPDATE_ASSIGNEE;
//   newAssignee: string;
//   previousAssignee?: string;
//   notifyAssignee: boolean;       // Whether to send notification
// }

// Add Note Action
// interface AddNoteAction extends BaseAction {
//   type: ActionType.ADD_NOTE;
//   noteContent: string;
//   category?: NoteCategory;       // Optional categorization
//   priority?: NotePriority;       // Optional priority level
// }

// Note Categories
// enum NoteCategory {
//   GENERAL = 'GENERAL',
//   TECHNICAL = 'TECHNICAL',
//   CLIENT_COMMUNICATION = 'CLIENT_COMMUNICATION',
//   INTERNAL = 'INTERNAL'
// }

// Note Priority
// enum NotePriority {
//   LOW = 'LOW',
//   NORMAL = 'NORMAL',
//   HIGH = 'HIGH',
//   URGENT = 'URGENT'
// }

// Union Type for All Actions
// type Action = UpdateStatusAction | UpdateScheduledDateAction | UpdateAssigneeAction | AddNoteAction;

// Action Validation Result
// interface ActionValidation {
//   isValid: boolean;
//   errors: string[];
//   warnings: string[];
// }

// Action Execution Result
// interface ActionResult {
//   success: boolean;
//   action: Action;
//   historyLine?: string;          // Generated history entry
//   error?: string;                // Error message if failed
// }

// TODO: Add action permissions and authorization
// TODO: Implement action rollback capabilities
// TODO: Define action audit and tracking
