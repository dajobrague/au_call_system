/**
 * CSV Import Configuration
 * Defines field types, validation rules, and transformations
 */

export type FieldType = 
  | 'text' 
  | 'phone' 
  | 'email' 
  | 'date' 
  | 'time' 
  | 'number' 
  | 'boolean' 
  | 'lookup';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  description?: string;
  validation?: ValidationRule;
  transform?: (value: any) => any;
  matchAliases?: string[];  // Alternative column names that auto-map
}

export interface ValidationRule {
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  customValidator?: (value: any) => { valid: boolean; error?: string };
}

/**
 * Import Configuration Schema
 */
export interface ImportConfig {
  entityType: 'staff' | 'participants' | 'pools' | 'shifts';
  fields: FieldDefinition[];
  lookupFields?: {
    // For pools and shifts - how to find related records
    patient?: {
      byPhone: boolean;
      byName: boolean;
      byEmail: boolean;
    };
    employee?: {
      byPhone: boolean;
      byPin: boolean;
    };
  };
}

/**
 * STAFF (Employees) Configuration
 */
export const STAFF_IMPORT_CONFIG: ImportConfig = {
  entityType: 'staff',
  fields: [
    {
      key: 'displayName',
      label: 'Display Name',
      type: 'text',
      required: true,
      matchAliases: ['name', 'full_name', 'employee_name', 'staff_name'],
      validation: { minLength: 2, maxLength: 100 }
    },
    {
      key: 'phone',
      label: 'Phone',
      type: 'phone',
      required: true,
      matchAliases: ['mobile', 'phone_number', 'contact', 'cell'],
      description: 'Australian mobile or landline'
    },
    {
      key: 'employeePin',
      label: 'Employee PIN',
      type: 'number',
      required: false,
      matchAliases: ['pin', 'employee_id', 'staff_id', 'id'],
      validation: { min: 1000, max: 9999 }
    },
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      required: false,
      matchAliases: ['email_address', 'e-mail'],
      validation: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      }
    },
    {
      key: 'role',
      label: 'Role',
      type: 'text',
      required: false,
      matchAliases: ['position', 'job_title', 'title']
    },
    {
      key: 'notes',
      label: 'Notes',
      type: 'text',
      required: false,
      matchAliases: ['comments', 'description', 'memo']
    },
    {
      key: 'active',
      label: 'Active',
      type: 'boolean',
      required: false,
      matchAliases: ['status', 'is_active', 'enabled'],
      transform: (value) => {
        if (typeof value === 'boolean') return value;
        const str = String(value).toLowerCase();
        return ['true', 'yes', '1', 'active', 'y'].includes(str);
      }
    }
  ]
};

/**
 * PARTICIPANTS (Patients) Configuration
 */
export const PARTICIPANTS_IMPORT_CONFIG: ImportConfig = {
  entityType: 'participants',
  fields: [
    {
      key: 'patientFullName',
      label: 'Patient Full Name',
      type: 'text',
      required: true,
      matchAliases: ['name', 'full_name', 'patient_name', 'participant_name'],
      validation: { minLength: 2, maxLength: 100 }
    },
    {
      key: 'phone',
      label: 'Phone',
      type: 'phone',
      required: true,
      matchAliases: ['mobile', 'phone_number', 'contact', 'cell'],
      description: 'Australian mobile or landline'
    },
    {
      key: 'dob',
      label: 'Date of Birth',
      type: 'date',
      required: true,
      matchAliases: ['birth_date', 'birthdate', 'date_of_birth', 'birthday']
    },
    {
      key: 'patientId',
      label: 'Patient ID',
      type: 'number',
      required: false,
      matchAliases: ['id', 'participant_id', 'patient_number']
    },
    {
      key: 'address',
      label: 'Address',
      type: 'text',
      required: false,
      matchAliases: ['street_address', 'location', 'residence']
    },
    {
      key: 'importantNotes',
      label: 'Important Notes',
      type: 'text',
      required: false,
      matchAliases: ['notes', 'medical_notes', 'special_needs', 'comments']
    },
    {
      key: 'active',
      label: 'Active',
      type: 'boolean',
      required: false,
      matchAliases: ['status', 'is_active', 'enabled'],
      transform: (value) => {
        if (typeof value === 'boolean') return value;
        const str = String(value).toLowerCase();
        return ['true', 'yes', '1', 'active', 'y'].includes(str);
      }
    }
  ]
};

/**
 * POOLS (Staff-Patient Links) Configuration
 */
export const POOLS_IMPORT_CONFIG: ImportConfig = {
  entityType: 'pools',
  fields: [
    {
      key: 'patientIdentifier',
      label: 'Patient Identifier',
      type: 'lookup',
      required: true,
      matchAliases: ['patient', 'patient_phone', 'patient_name', 'participant'],
      description: 'Phone number OR full name of patient'
    },
    {
      key: 'employeeIdentifier',
      label: 'Employee Identifier',
      type: 'lookup',
      required: true,
      matchAliases: ['employee', 'staff', 'employee_phone', 'staff_phone', 'employee_pin'],
      description: 'Phone number OR PIN of employee'
    }
  ],
  lookupFields: {
    patient: {
      byPhone: true,
      byName: true,
      byEmail: false
    },
    employee: {
      byPhone: true,
      byPin: true
    }
  }
};

/**
 * SHIFTS (Job Occurrences) Configuration
 */
export const SHIFTS_IMPORT_CONFIG: ImportConfig = {
  entityType: 'shifts',
  fields: [
    {
      key: 'patientIdentifier',
      label: 'Patient Identifier',
      type: 'lookup',
      required: true,
      matchAliases: ['patient', 'patient_phone', 'patient_name', 'participant', 'name', 'participant_name'],
      description: 'Phone number OR full name of patient'
    },
    {
      key: 'employeeIdentifier',
      label: 'Employee Identifier',
      type: 'lookup',
      required: true,
      matchAliases: ['employee', 'staff', 'employee_phone', 'staff_phone', 'employee_pin', 'staff_id', 'staff_name'],
      description: 'Phone number, PIN, or name of employee'
    },
    {
      key: 'scheduledAt',
      label: 'Scheduled Date',
      type: 'date',
      required: true,
      matchAliases: ['date', 'shift_date', 'scheduled_date', 'work_date', 'start_date_time', 'start_datetime']
    },
    {
      key: 'startTime',
      label: 'Start Time',
      type: 'time',
      required: true,
      matchAliases: ['time', 'start', 'shift_start', 'begin_time', 'start_date_time', 'start_datetime']
    },
    {
      key: 'endTime',
      label: 'End Time',
      type: 'time',
      required: false,
      matchAliases: ['finish', 'end', 'shift_end', 'finish_time', 'end_date_time', 'end_datetime']
    },
    {
      key: 'shiftType',
      label: 'Shift Type',
      type: 'text',
      required: false,
      matchAliases: ['type', 'shift_type', 'service_type', 'care_type']
    },
    {
      key: 'status',
      label: 'Status',
      type: 'text',
      required: false,
      matchAliases: ['shift_status', 'state', 'booking_status'],
      transform: (value) => {
        if (!value) return 'Scheduled';
        return value;
      }
    },
    {
      key: 'shiftId',
      label: 'Shift ID',
      type: 'text',
      required: false,
      matchAliases: ['id', 'shift_id', 'external_id', 'reference_id'],
      description: 'External system shift ID'
    },
    {
      key: 'notes',
      label: 'Notes',
      type: 'text',
      required: false,
      matchAliases: ['note', 'shift_notes', 'comments', 'description']
    }
  ],
  lookupFields: {
    patient: {
      byPhone: true,
      byName: true,
      byEmail: false
    },
    employee: {
      byPhone: true,
      byPin: true
    }
  }
};

/**
 * Get config for entity type
 */
export function getImportConfig(entityType: string): ImportConfig {
  switch (entityType) {
    case 'staff':
      return STAFF_IMPORT_CONFIG;
    case 'participants':
      return PARTICIPANTS_IMPORT_CONFIG;
    case 'pools':
      return POOLS_IMPORT_CONFIG;
    case 'shifts':
      return SHIFTS_IMPORT_CONFIG;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

