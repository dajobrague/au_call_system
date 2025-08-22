// Type shape (fields only as comments)

// Core Job Record Interface
// interface JobRecord {
//   id: string;                    // Airtable record ID
//   jobNumber: string;             // User-visible job identifier
//   clientId: string;              // Reference to client record
//   status: JobStatus;             // Current job status
//   scheduledDate?: Date;          // When job is scheduled to occur
//   assignee?: string;             // Person assigned to the job
//   jobHistory: string;            // Formatted history log (append-only)
//   createdDate: Date;             // Job creation timestamp
//   updatedDate: Date;             // Last modification timestamp
// }

// Job Status Enumeration
// enum JobStatus {
//   PENDING = 'PENDING',           // Initial state for new jobs
//   IN_PROGRESS = 'IN_PROGRESS',   // Work is being performed
//   ON_HOLD = 'ON_HOLD',           // Temporarily paused
//   COMPLETED = 'COMPLETED',       // Successfully finished
//   CANCELLED = 'CANCELLED'        // Terminated without completion
// }

// Extended Job with Client Information
// interface JobWithClient extends JobRecord {
//   clientName?: string;           // Resolved client name for display
//   clientActive?: boolean;        // Whether client account is active
// }

// Job Creation Input
// interface CreateJobInput {
//   jobNumber: string;
//   clientId: string;
//   status?: JobStatus;            // Defaults to PENDING
//   scheduledDate?: Date;
//   assignee?: string;
//   initialNotes?: string;
// }

// Job Update Input
// interface UpdateJobInput {
//   id: string;
//   status?: JobStatus;
//   scheduledDate?: Date;
//   assignee?: string;
//   notes?: string;                // Will be appended to history
// }

// TODO: Implement job validation rules
// TODO: Add job priority and category fields
// TODO: Define job state transition constraints
