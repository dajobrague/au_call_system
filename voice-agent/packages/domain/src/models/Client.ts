// Client Record Type Shape

// Core Client Record Interface
// interface ClientRecord {
//   id: string;                    // Airtable record ID
//   clientId: string;              // Unique client identifier (user-facing)
//   clientName: string;            // Display name for client
//   active: boolean;               // Whether client account is active
//   contactEmail?: string;         // Primary contact email
//   contactPhone?: string;         // Primary contact phone
//   createdDate: Date;             // Account creation date
//   lastActivity?: Date;           // Most recent job activity
// }

// Client Status Enumeration
// enum ClientStatus {
//   ACTIVE = 'ACTIVE',             // Normal operating status
//   INACTIVE = 'INACTIVE',         // Temporarily disabled
//   SUSPENDED = 'SUSPENDED',       // Suspended due to issues
//   TERMINATED = 'TERMINATED'      // Permanently closed
// }

// Client with Job Statistics
// interface ClientWithStats extends ClientRecord {
//   totalJobs: number;             // Total jobs for this client
//   activeJobs: number;            // Currently active jobs
//   completedJobs: number;         // Successfully completed jobs
//   lastJobDate?: Date;            // Date of most recent job
// }

// Client Lookup Input
// interface ClientLookupInput {
//   clientId: string;              // Unique identifier to search for
// }

// Client Validation Result
// interface ClientValidation {
//   isValid: boolean;              // Whether client can be used
//   client?: ClientRecord;         // Client data if valid
//   reason?: string;               // Error reason if invalid
// }

// Client Access Permissions
// interface ClientPermissions {
//   canCreateJobs: boolean;        // Can create new jobs
//   canUpdateJobs: boolean;        // Can modify existing jobs
//   canViewHistory: boolean;       // Can access job history
//   maxActiveJobs?: number;        // Limit on concurrent jobs
// }

// TODO: Implement client hierarchy support (parent/child clients)
// TODO: Add client configuration and preferences
// TODO: Define client access control rules
