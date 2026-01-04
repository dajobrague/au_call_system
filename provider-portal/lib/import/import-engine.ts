/**
 * Import Engine - Batch Import Logic
 * Handles idempotent imports for all entity types
 */

import {
  getEmployeesByProvider,
  getPatientsByProvider,
  createEmployee,
  updateEmployee,
  createPatient,
  updatePatient,
  findPatientByName,
  findEmployeeByPin,
  findEmployeeByName,
  updatePatientStaffPool,
  createOccurrence
} from '../airtable';
import { normalizeAustralianPhone, phonesMatch } from './phone-utils';

export interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

export interface MappedRecord {
  rowIndex: number;
  data: Record<string, any>;
}

/**
 * Import Staff Records
 */
export async function importStaffRecords(
  providerId: string,
  records: MappedRecord[]
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  // Fetch all existing employees for this provider
  const existingEmployees = await getEmployeesByProvider(providerId);

  for (const record of records) {
    try {
      const { displayName, phone, employeePin, email, role, notes, active } = record.data;

      // Normalize phone for matching
      const normalizedPhone = normalizeAustralianPhone(phone);
      if (!normalizedPhone) {
        result.errors.push({
          row: record.rowIndex,
          error: 'Invalid phone number format'
        });
        result.skipped++;
        continue;
      }

      // Find existing employee by phone
      const existing = existingEmployees.find(emp =>
        phonesMatch(emp.fields['Phone'] as string, phone)
      );

      if (existing) {
        // Update existing employee
        await updateEmployee(existing.id, {
          'Display Name': displayName,
          'Phone': normalizedPhone,
          'Employee PIN': employeePin ? parseInt(employeePin) : undefined,
          'Email': email || undefined,
          'Role': role || undefined,
          'Notes': notes || undefined,
          'Active': active !== undefined ? active : true
        });
        result.updated++;
      } else {
        // Create new employee
        await createEmployee({
          'Display Name': displayName,
          'Phone': normalizedPhone,
          'Employee PIN': employeePin ? parseInt(employeePin) : Math.floor(1000 + Math.random() * 9000),
          'Provider': [providerId],
          'Email': email || undefined,
          'Role': role || undefined,
          'Notes': notes || undefined,
          'Active': active !== undefined ? active : true
        });
        result.created++;
      }
    } catch (error) {
      result.errors.push({
        row: record.rowIndex,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      result.skipped++;
    }
  }

  result.success = result.errors.length === 0 || result.errors.length < records.length;
  return result;
}

/**
 * Import Participant (Patient) Records
 */
export async function importParticipantRecords(
  providerId: string,
  records: MappedRecord[]
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  // Fetch all existing patients for this provider
  const existingPatients = await getPatientsByProvider(providerId);

  for (const record of records) {
    try {
      const { patientFullName, phone, dob, patientId, address, importantNotes, active } = record.data;

      // Normalize phone for matching
      const normalizedPhone = normalizeAustralianPhone(phone);
      if (!normalizedPhone) {
        result.errors.push({
          row: record.rowIndex,
          error: 'Invalid phone number format'
        });
        result.skipped++;
        continue;
      }

      // Find existing patient by phone OR name
      let existing = existingPatients.find(pat =>
        phonesMatch(pat.fields['Phone'] as string, phone)
      );

      if (!existing) {
        existing = existingPatients.find(pat =>
          pat.fields['Patient Full Name'] === patientFullName
        );
      }

      if (existing) {
        // Update existing patient
        await updatePatient(existing.id, {
          'Patient Full Name': patientFullName,
          'Phone': normalizedPhone,
          'DOB': dob,
          'Patient ID': patientId ? parseInt(patientId) : undefined,
          'Address': address || undefined,
          'Important Notes': importantNotes || undefined,
          'Active': active !== undefined ? active : true
        });
        result.updated++;
      } else {
        // Create new patient
        await createPatient({
          'Patient Full Name': patientFullName,
          'Phone': normalizedPhone,
          'DOB': dob,
          'Patient ID': patientId ? parseInt(patientId) : undefined,
          'Provider': [providerId],
          'Address': address || undefined,
          'Important Notes': importantNotes || undefined,
          'Active': active !== undefined ? active : true
        });
        result.created++;
      }
    } catch (error) {
      result.errors.push({
        row: record.rowIndex,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      result.skipped++;
    }
  }

  result.success = result.errors.length === 0 || result.errors.length < records.length;
  return result;
}

/**
 * Import Pool Links (Update Patient's Related Staff Pool)
 */
export async function importPoolLinks(
  providerId: string,
  records: MappedRecord[]
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  // Fetch all existing patients and employees
  const existingPatients = await getPatientsByProvider(providerId);
  const existingEmployees = await getEmployeesByProvider(providerId);

  for (const record of records) {
    try {
      const { patientIdentifier, employeeIdentifier } = record.data;

      // Find patient by phone or name
      let patient = existingPatients.find(pat =>
        phonesMatch(pat.fields['Phone'] as string, patientIdentifier)
      );

      if (!patient) {
        patient = existingPatients.find(pat =>
          pat.fields['Patient Full Name'] === patientIdentifier
        );
      }

      if (!patient) {
        // Try database lookup by name
        patient = await findPatientByName(providerId, patientIdentifier);
      }

      if (!patient) {
        result.errors.push({
          row: record.rowIndex,
          error: `Patient not found: ${patientIdentifier}`
        });
        result.skipped++;
        continue;
      }

      // Find employee by phone or PIN
      let employee = existingEmployees.find(emp =>
        phonesMatch(emp.fields['Phone'] as string, employeeIdentifier)
      );

      if (!employee) {
        const pin = parseInt(employeeIdentifier);
        if (!isNaN(pin)) {
          employee = existingEmployees.find(emp =>
            emp.fields['Employee PIN'] === pin
          );

          if (!employee) {
            // Try database lookup by PIN
            employee = await findEmployeeByPin(providerId, pin);
          }
        }
      }

      if (!employee) {
        result.errors.push({
          row: record.rowIndex,
          error: `Employee not found: ${employeeIdentifier}`
        });
        result.skipped++;
        continue;
      }

      // Get current staff pool
      const currentPool = (patient.fields['Related Staff Pool'] as string[]) || [];
      
      // Add employee if not already in pool
      if (!currentPool.includes(employee.id)) {
        const updatedPool = [...currentPool, employee.id];
        await updatePatientStaffPool(patient.id, updatedPool);
        result.updated++;
      } else {
        result.skipped++;
      }

    } catch (error) {
      result.errors.push({
        row: record.rowIndex,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      result.skipped++;
    }
  }

  result.success = result.errors.length === 0 || result.errors.length < records.length;
  return result;
}

/**
 * Import Occurrence Records (Shifts/Job Occurrences)
 */
export async function importOccurrenceRecords(
  providerId: string,
  records: MappedRecord[]
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  // Fetch all existing patients and employees
  const existingPatients = await getPatientsByProvider(providerId);
  const existingEmployees = await getEmployeesByProvider(providerId);

  for (const record of records) {
    try {
      const { patientIdentifier, employeeIdentifier, scheduledAt, startTime, endTime, status } = record.data;

      // Find patient by phone or name
      let patient = existingPatients.find(pat =>
        phonesMatch(pat.fields['Phone'] as string, patientIdentifier)
      );

      if (!patient) {
        patient = existingPatients.find(pat =>
          pat.fields['Patient Full Name'] === patientIdentifier
        );
      }

      if (!patient) {
        patient = await findPatientByName(providerId, patientIdentifier);
      }

      if (!patient) {
        result.errors.push({
          row: record.rowIndex,
          error: `Patient not found: ${patientIdentifier}`
        });
        result.skipped++;
        continue;
      }

      // Find employee by phone, PIN, or name
      let employee = existingEmployees.find(emp =>
        phonesMatch(emp.fields['Phone'] as string, employeeIdentifier)
      );

      if (!employee) {
        const pin = parseInt(employeeIdentifier);
        if (!isNaN(pin)) {
          employee = existingEmployees.find(emp =>
            emp.fields['Employee PIN'] === pin
          );

          if (!employee) {
            employee = await findEmployeeByPin(providerId, pin);
          }
        }
      }

      // Try name-based lookup as fallback
      if (!employee) {
        employee = existingEmployees.find(emp =>
          emp.fields['Display Name'] === employeeIdentifier
        );

        if (!employee) {
          employee = await findEmployeeByName(providerId, employeeIdentifier);
        }
      }

      if (!employee) {
        result.errors.push({
          row: record.rowIndex,
          error: `Employee not found: ${employeeIdentifier}`
        });
        result.skipped++;
        continue;
      }

      // Create job occurrence (always create, never update)
      await createOccurrence({
        patientRecordId: patient.id,
        employeeRecordId: employee.id,
        scheduledAt: scheduledAt,
        time: startTime,
        timeWindowEnd: endTime || startTime,
      });

      result.created++;

    } catch (error) {
      result.errors.push({
        row: record.rowIndex,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      result.skipped++;
    }
  }

  result.success = result.errors.length === 0 || result.errors.length < records.length;
  return result;
}

