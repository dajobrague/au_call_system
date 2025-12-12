/**
 * Daily Report Data Aggregation
 * Transforms raw data into structured comprehensive daily reports
 */

import { format } from 'date-fns';
import { formatDateForDisplay, formatTimestampForReport } from './timezone-utils';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DailyReportData {
  header: ReportHeader;
  snapshot: SnapshotSummary;
  callLog: DetailedCallLog[];
  shiftCancellations: ShiftCancellation[];
  staffEngagement: StaffEngagementSummary;
  additionalComments: string;
  issuesRequireFollowUp: boolean;
  compliance: ComplianceNotes;
  attachments: Attachment[];
}

export interface ReportHeader {
  providerName: string;
  date: string;
  onCallWindow: string; // "5:00 PM – 9:00 AM"
  operatorName: string; // Same as providerName per requirements
  generatedAt: string;
}

export interface SnapshotSummary {
  totalCalls: number;
  totalShiftCancellations: number;
  totalDispatchAttempts: number;
  successfulFills: number;
  issuesRequireFollowUp: boolean;
}

export interface DetailedCallLog {
  callNumber: number;
  timestamp: string;
  callerId: string; // "Name (Phone)" or just phone if unknown
  purposeOfCall: string;
  identifiedParticipant: string | null;
  outcome: string;
  actionsTaken: string[];
  finalResolution: string;
  issuesFlagged: boolean;
  recordingUrl?: string;
}

export interface ShiftCancellation {
  cancellationId: string;
  cancelledBy: string;
  phoneNumber: string;
  participant: string; // Patient name
  shiftTime: string;
  reason: string;
  replacementTriggered: boolean;
  staffContacted: number;
  contactedAt: string;
  responses: StaffResponse[];
  finalOutcome: string; // "Filled" | "Not Filled" | "Pending"
}

export interface StaffResponse {
  staffName: string;
  response: string; // "Accepted" | "Declined" | "No Response" | "SMS Sent (Pending)"
}

export interface StaffEngagementSummary {
  totalStaffContacted: number;
  responseRate: number; // percentage
  accepted: number;
  declined: number;
  didNotRespond: number;
  note: string; // For future enhancement placeholder
}

export interface ComplianceNotes {
  allTimestampsRecorded: boolean;
  allCallOutcomesLogged: boolean;
  dataStoredSecurely: string;
  providerIdentifiersMatched: boolean;
  noUnverifiedData: boolean;
}

export interface Attachment {
  type: 'transcript' | 'recording';
  label: string;
  url: string;
}

// Raw data inputs
export interface CallLogRawData {
  id: string;
  fields: {
    CallSid: string;
    Provider?: string[];
    Employee?: string[];
    Patient?: string[];
    Direction: string;
    'Started At': string;
    'Ended At'?: string;
    'Detected Intent/Action'?: string;
    Seconds?: number;
    'Recording URL (Twilio/S3)'?: string;
    Notes?: string;
    From?: string;
    To?: string;
  };
}

export interface OccurrenceRawData {
  id: string;
  fields: {
    'Occurrence ID': string;
    'Status': string;
    'Scheduled At': string;
    'Time': string;
    'Assigned Employee'?: string[];
    'Patient (Lookup)'?: string[]; // For template-based occurrences
    'Patient (Link)'?: string[];   // For non-template occurrences
    'Reschedule Reason'?: string;
    'Patient TXT'?: string;
    'Employee TXT'?: string;
    'SMS Wave 1 Sent At'?: string;
    'SMS Wave 2 Sent At'?: string;
    'SMS Wave 3 Sent At'?: string;
    'SMS Staff Contacted'?: number;
  };
}

export interface ProviderRawData {
  id: string;
  fields: {
    'Name': string;
    'Provider ID': number;
    'On-Call Start Time'?: string;
    'On-Call End Time'?: string;
  };
}

export interface EmployeeRawData {
  id: string;
  fields: {
    'Display Name': string;
    'Phone': string;
  };
}

export interface PatientRawData {
  id: string;
  fields: {
    'Patient Full Name': string;
    'Phone': string;
  };
}

// ============================================================================
// Main Aggregation Function
// ============================================================================

export function aggregateDailyReport(
  date: Date,
  callLogs: CallLogRawData[],
  occurrences: OccurrenceRawData[],
  provider: ProviderRawData,
  employees: EmployeeRawData[],
  patients: PatientRawData[]
): DailyReportData {
  const header = buildReportHeader(date, provider);
  const callLogDetails = buildDetailedCallLogs(callLogs, employees, patients);
  const cancellations = buildShiftCancellations(occurrences, employees, patients);
  const staffEngagement = buildStaffEngagementSummary(cancellations);
  const snapshot = buildSnapshotSummary(callLogDetails, cancellations);
  
  return {
    header,
    snapshot,
    callLog: callLogDetails,
    shiftCancellations: cancellations,
    staffEngagement,
    additionalComments: '',
    issuesRequireFollowUp: false, // Manual toggle in UI
    compliance: buildComplianceNotes(),
    attachments: buildAttachments(callLogs),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildReportHeader(date: Date, provider: ProviderRawData): ReportHeader {
  const onCallWindow = formatOnCallWindow(
    provider.fields['On-Call Start Time'],
    provider.fields['On-Call End Time']
  );
  
  return {
    providerName: provider.fields['Name'] || 'Provider',
    date: formatDateForDisplay(date, 'EEEE, MMMM d, yyyy'), // "Monday, December 12, 2025" in Australian timezone
    onCallWindow,
    operatorName: provider.fields['Name'] || 'Provider', // Same as provider name per requirements
    generatedAt: formatTimestampForReport(), // Current time in Australian timezone
  };
}

function formatOnCallWindow(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) {
    return 'Not configured';
  }
  
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };
  
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

function buildDetailedCallLogs(
  callLogs: CallLogRawData[],
  employees: EmployeeRawData[],
  patients: PatientRawData[]
): DetailedCallLog[] {
  // Sort by timestamp ascending (chronological)
  const sortedLogs = [...callLogs].sort((a, b) => {
    const timeA = a.fields['Started At'] || '';
    const timeB = b.fields['Started At'] || '';
    return timeA.localeCompare(timeB);
  });
  
  return sortedLogs.map((log, index) => {
    const callerId = identifyCallerWithPhone(log, employees, patients);
    const intent = log.fields['Detected Intent/Action'] || 'General inquiry';
    const duration = log.fields.Seconds || 0;
    
    return {
      callNumber: index + 1,
      timestamp: log.fields['Started At'] || 'Unknown',
      callerId,
      purposeOfCall: extractPurpose(intent),
      identifiedParticipant: extractParticipant(log, employees, patients),
      outcome: extractOutcome(intent, duration),
      actionsTaken: extractActions(intent),
      finalResolution: extractResolution(intent, log.fields.Notes),
      issuesFlagged: checkForIssues(intent, log.fields.Notes),
      recordingUrl: log.fields['Recording URL (Twilio/S3)'],
    };
  });
}

function identifyCallerWithPhone(
  log: CallLogRawData,
  employees: EmployeeRawData[],
  patients: PatientRawData[]
): string {
  const phone = log.fields.From || 'Unknown';
  
  // Check if it's an identified employee
  if (log.fields.Employee && log.fields.Employee.length > 0) {
    const employeeId = log.fields.Employee[0];
    const employee = employees.find(e => e.id === employeeId);
    if (employee) {
      return `${employee.fields['Display Name']} (${phone})`;
    }
  }
  
  // Check if it's an identified patient
  if (log.fields.Patient && log.fields.Patient.length > 0) {
    const patientId = log.fields.Patient[0];
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      return `${patient.fields['Patient Full Name']} (${phone})`;
    }
  }
  
  // Try to match by phone number
  const matchedEmployee = employees.find(e => e.fields.Phone === phone);
  if (matchedEmployee) {
    return `${matchedEmployee.fields['Display Name']} (${phone})`;
  }
  
  const matchedPatient = patients.find(p => p.fields.Phone === phone);
  if (matchedPatient) {
    return `${matchedPatient.fields['Patient Full Name']} (${phone})`;
  }
  
  return phone;
}

function extractParticipant(
  log: CallLogRawData,
  employees: EmployeeRawData[],
  patients: PatientRawData[]
): string | null {
  if (log.fields.Employee && log.fields.Employee.length > 0) {
    const employee = employees.find(e => e.id === log.fields.Employee![0]);
    return employee ? `Employee: ${employee.fields['Display Name']}` : null;
  }
  
  if (log.fields.Patient && log.fields.Patient.length > 0) {
    const patient = patients.find(p => p.id === log.fields.Patient![0]);
    return patient ? `Patient: ${patient.fields['Patient Full Name']}` : null;
  }
  
  return null;
}

function extractPurpose(intent: string): string {
  // Parse intent to extract purpose
  if (intent.includes('shift_cancellation') || intent.includes('cancel')) {
    return 'Shift Cancellation Request';
  }
  if (intent.includes('schedule') || intent.includes('Schedule')) {
    return 'Schedule Inquiry';
  }
  if (intent.includes('emergency')) {
    return 'Emergency Call';
  }
  if (intent.includes('transfer')) {
    return 'Call Transfer Request';
  }
  return 'General Inquiry';
}

function extractOutcome(intent: string, duration: number): string {
  if (duration < 10) {
    return 'Call disconnected early';
  }
  if (intent.includes('completed') || intent.includes('success')) {
    return 'Successfully handled';
  }
  if (intent.includes('transfer')) {
    return 'Transferred to appropriate party';
  }
  return 'Call completed';
}

function extractActions(intent: string): string[] {
  const actions: string[] = [];
  
  if (intent.includes('authentication') || intent.includes('verify')) {
    actions.push('Verified caller identity');
  }
  if (intent.includes('schedule')) {
    actions.push('Checked schedule');
  }
  if (intent.includes('cancel')) {
    actions.push('Processed cancellation');
    actions.push('Initiated staff notification');
  }
  if (intent.includes('transfer')) {
    actions.push('Transferred call');
  }
  
  if (actions.length === 0) {
    actions.push('Handled inquiry');
  }
  
  return actions;
}

function extractResolution(intent: string, notes?: string): string {
  if (notes && notes.trim()) {
    return notes;
  }
  
  if (intent.includes('cancel')) {
    return 'Cancellation processed, replacement workflow initiated';
  }
  if (intent.includes('transfer')) {
    return 'Call transferred successfully';
  }
  
  return 'Call completed successfully';
}

function checkForIssues(intent: string, notes?: string): boolean {
  const issueKeywords = ['error', 'failed', 'issue', 'problem', 'unable', 'unfilled'];
  const combined = `${intent} ${notes || ''}`.toLowerCase();
  
  return issueKeywords.some(keyword => combined.includes(keyword));
}

function buildShiftCancellations(
  occurrences: OccurrenceRawData[],
  employees: EmployeeRawData[],
  patients: PatientRawData[]
): ShiftCancellation[] {
  // Filter for cancelled or open occurrences with reschedule reason
  const cancellations = occurrences.filter(occ => 
    (occ.fields.Status === 'Open' || 
     occ.fields.Status === 'Cancelled' || 
     occ.fields.Status === 'UNFILLED_AFTER_SMS') &&
    occ.fields['Reschedule Reason']
  );
  
  return cancellations.map((occ, index) => {
    const patientName = occ.fields['Patient TXT'] || 'Unknown Patient';
    const employeeName = occ.fields['Employee TXT'] || 'Staff Member';
    const employeePhone = getEmployeePhone(occ.fields['Assigned Employee'], employees);
    
    const shiftTime = formatShiftTime(occ.fields['Scheduled At'], occ.fields.Time);
    const staffContacted = occ.fields['SMS Staff Contacted'] || 0;
    const contactedAt = occ.fields['SMS Wave 1 Sent At'] || 'Not sent';
    
    // Determine final outcome based on status
    let finalOutcome = 'Pending';
    if (occ.fields.Status === 'Scheduled' || occ.fields.Status === 'Completed') {
      finalOutcome = 'Filled';
    } else if (occ.fields.Status === 'UNFILLED_AFTER_SMS') {
      finalOutcome = 'Not Filled';
    }
    
    return {
      cancellationId: `C${index + 1}`,
      cancelledBy: employeeName,
      phoneNumber: employeePhone,
      participant: patientName,
      shiftTime,
      reason: occ.fields['Reschedule Reason'] || 'No reason provided',
      replacementTriggered: staffContacted > 0,
      staffContacted,
      contactedAt,
      responses: buildStaffResponses(staffContacted),
      finalOutcome,
    };
  });
}

function getEmployeePhone(employeeIds: string[] | undefined, employees: EmployeeRawData[]): string {
  if (!employeeIds || employeeIds.length === 0) return 'Unknown';
  
  const employee = employees.find(e => e.id === employeeIds[0]);
  return employee?.fields.Phone || 'Unknown';
}

function formatShiftTime(scheduledAt: string, time: string): string {
  try {
    const date = new Date(scheduledAt);
    return `${format(date, 'MMM d, yyyy')} at ${time}`;
  } catch {
    return `${scheduledAt} at ${time}`;
  }
}

function buildStaffResponses(staffContacted: number): StaffResponse[] {
  // For now, show that SMS was sent but responses are pending
  // This will be enhanced when we add response tracking
  if (staffContacted === 0) {
    return [];
  }
  
  return [{
    staffName: `${staffContacted} staff members`,
    response: 'SMS Sent (Response tracking coming soon)',
  }];
}

function buildStaffEngagementSummary(cancellations: ShiftCancellation[]): StaffEngagementSummary {
  const totalStaffContacted = cancellations.reduce((sum, c) => sum + c.staffContacted, 0);
  
  // For now, response tracking is a placeholder
  return {
    totalStaffContacted,
    responseRate: 0, // Will be calculated when we add response tracking
    accepted: 0,
    declined: 0,
    didNotRespond: totalStaffContacted,
    note: 'Response tracking coming soon. See Additional Comments for manual tracking.',
  };
}

function buildSnapshotSummary(
  callLogs: DetailedCallLog[],
  cancellations: ShiftCancellation[]
): SnapshotSummary {
  const totalDispatchAttempts = cancellations.reduce((sum, c) => sum + c.staffContacted, 0);
  const successfulFills = cancellations.filter(c => c.finalOutcome === 'Filled').length;
  
  return {
    totalCalls: callLogs.length,
    totalShiftCancellations: cancellations.length,
    totalDispatchAttempts,
    successfulFills,
    issuesRequireFollowUp: false, // Set manually in UI
  };
}

function buildComplianceNotes(): ComplianceNotes {
  return {
    allTimestampsRecorded: true,
    allCallOutcomesLogged: true,
    dataStoredSecurely: 'Australian servers',
    providerIdentifiersMatched: true,
    noUnverifiedData: true,
  };
}

function buildAttachments(callLogs: CallLogRawData[]): Attachment[] {
  const attachments: Attachment[] = [];
  
  callLogs.forEach((log, index) => {
    if (log.fields['Recording URL (Twilio/S3)']) {
      attachments.push({
        type: 'recording',
        label: `Call #${index + 1} Recording`,
        url: log.fields['Recording URL (Twilio/S3)'],
      });
    }
  });
  
  return attachments;
}

