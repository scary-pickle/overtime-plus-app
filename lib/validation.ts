import { z } from 'zod';
import { Profile, UsualShift, OvertimeLog, ExportBatch } from '../types';

// Validation rules for AVAC v8.5
export const validationRules = {
  qld_avac_v8_5: {
    required: [
      'fullName', 'payrollNumber', 'orgUnitNo', 'orgUnitName', 'location',
      'delegateName', 'delegatePosition', 'delegatePhone',
      'logs[].date', 'logs[].actualStart', 'logs[].actualFinish'
    ],
    patterns: {
    },
    timeRules: {
      minShiftMinutes: 30,
      roundTo: 5
    },
    categories: [
      'Overtime', 'Oncall', 'HP Emergency Clinical on Call', 'HPDO Priority on Call', 'Recall Offsite', 'Recall Onsite', 'Recall Offsite Normal Duties (QPSOOE award)', 'Recall Telephone Advice (Medical)', 'Change shift', 'Change shift - cancel leave'
    ]
  }
};

// Time validation helpers
const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const costCentrePattern = /^[0-9]{6}$/;

// Profile validation
export const profileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  payrollNumber: z.string().min(1, 'Payroll number is required'),
  orgUnitNo: z.string().min(1, 'Organisation unit number is required').max(8, 'Organisation unit number must be 8 characters or less'),
  orgUnitName: z.string().min(1, 'Organisation unit name is required'),
  location: z.string().min(1, 'Location is required'),
  payLevel: z.string().min(1, 'Pay level is required'),
  serviceEnquiryNumber: z.string().optional(),
  delegateName: z.string().min(1, 'Delegate name is required'),
  delegatePosition: z.string().min(1, 'Delegate position is required'),
  delegateAreaCode: z.string().min(1, 'Delegate area code is required'),
  delegatePhone: z.string().min(1, 'Delegate phone is required'),
  employeeInitial: z.string().min(1, 'Employee initial is required'),
  pdfTemplateVersion: z.literal('qld_avac_v8.5'),
  timezone: z.string().default('Australia/Brisbane'),
  concurrentEmploymentDefault: z.boolean().default(false),
  email: z.string().email({ message: 'Invalid email address' }).default(''),
  isSMO: z.boolean().default(false)
});

// UsualShift validation
export const usualShiftSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Label is required'),
  type: z.enum(['weekly', 'biweekly', 'custom']),
  weekIndex: z.union([z.literal(1), z.literal(2)]).optional(),
  dayOfWeek: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  rosteredStart: z.string().regex(timePattern, 'Invalid time format (HH:mm)'),
  rosteredFinish: z.string().regex(timePattern, 'Invalid time format (HH:mm)'),
  mealBreakMinutes: z.number().min(0).default(0),
  activeFrom: z.string().datetime(),
  activeTo: z.string().datetime().optional()
}).refine(
  (data) => {
    // Handle overnight shifts that cross midnight
    const startMinutes = timeToMinutes(data.rosteredStart);
    let finishMinutes = timeToMinutes(data.rosteredFinish);
    
    // If finish time is earlier than start time, assume it's the next day
    if (finishMinutes <= startMinutes) {
      finishMinutes += 24 * 60; // Add 24 hours
    }
    
    const duration = finishMinutes - startMinutes;
    
    // Allow shifts up to 24 hours (1440 minutes) to handle overnight shifts
    return duration > 0 && duration <= 24 * 60;
  },
  {
    message: 'Invalid shift duration - shift must be between 1 minute and 24 hours',
    path: ['rosteredFinish']
  }
);

// OvertimeLog validation
export const overtimeLogSchema = z.object({
  id: z.string(),
  date: z.string().datetime(),
  rosteredStart: z.union([z.string().regex(timePattern), z.literal('N/A')]).optional(),
  rosteredFinish: z.union([z.string().regex(timePattern), z.literal('N/A')]).optional(),
  actualStart: z.union([z.string().regex(timePattern, 'Invalid time format (HH:mm)'), z.literal('N/A')]),
  actualFinish: z.union([z.string().regex(timePattern, 'Invalid time format (HH:mm)'), z.literal('N/A')]),
  mealBreakMinutes: z.number().min(0).default(0),
  minutesOvertime: z.number().min(0),
  category: z.enum(['Overtime', 'Oncall', 'HP Emergency Clinical on Call', 'HPDO Priority on Call', 'Recall Offsite', 'Recall Onsite', 'Recall Offsite Normal Duties (QPSOOE award)', 'Recall Telephone Advice (Medical)', 'Change shift', 'Change shift - cancel leave']),
  comments: z.string().optional(),
  initials: z.string().min(1, 'Initials are required'),
  status: z.enum(['draft', 'ready', 'exported']),
  exportBatchId: z.string().optional(),
  source: z.enum(['manual', 'geofence-proposed', 'imported']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).refine(
  (data) => {
    // Skip validation if either actual start or finish is N/A
    if (data.actualStart === 'N/A' || data.actualFinish === 'N/A') {
      return true;
    }
    
    // For midnight crossing, we need to check if the shift duration is reasonable
    // Allow finish time to be earlier than start time (crosses midnight)
    // but ensure the total duration is reasonable (not more than 24 hours)
    const startMinutes = timeToMinutes(data.actualStart);
    let finishMinutes = timeToMinutes(data.actualFinish);
    
    // If finish time is earlier than start time, assume it's the next day
    if (finishMinutes <= startMinutes) {
      finishMinutes += 24 * 60; // Add 24 hours
    }
    
    const duration = finishMinutes - startMinutes;
    
    // Allow shifts up to 24 hours (1440 minutes) to handle midnight crossing
    return duration > 0 && duration <= 24 * 60;
  },
  {
    message: 'Invalid shift times - shift must be between 1 minute and 24 hours',
    path: ['actualFinish']
  }
).refine(
  (data) => {
    // Skip validation if either actual start or finish is N/A
    if (data.actualStart === 'N/A' || data.actualFinish === 'N/A') {
      return true;
    }
    
    // Ensure minimum shift duration (handles midnight crossing)
    const startMinutes = timeToMinutes(data.actualStart);
    let finishMinutes = timeToMinutes(data.actualFinish);
    
    // If finish time is earlier than start time, assume it's the next day
    if (finishMinutes <= startMinutes) {
      finishMinutes += 24 * 60; // Add 24 hours
    }
    
    const duration = finishMinutes - startMinutes - (data.mealBreakMinutes || 0);
    return duration >= validationRules.qld_avac_v8_5.timeRules.minShiftMinutes;
  },
  {
    message: `Minimum shift duration is ${validationRules.qld_avac_v8_5.timeRules.minShiftMinutes} minutes`,
    path: ['actualFinish']
  }
);

// ExportBatch validation
export const exportBatchSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  pdfUri: z.string().url(),
  countLogs: z.number().min(0),
  totalMinutes: z.number().min(0),
  submittedToEmail: z.string().email().optional()
});

// Helper function to convert time string to minutes
function timeToMinutes(timeStr: string | 'N/A'): number {
  if (timeStr === 'N/A') {
    return 0; // Return 0 for N/A values
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Validation helpers
export const validateProfile = (data: unknown): Profile => {
  return profileSchema.parse(data);
};

export const validateUsualShift = (data: unknown): UsualShift => {
  return usualShiftSchema.parse(data);
};

export const validateOvertimeLog = (data: unknown): OvertimeLog => {
  return overtimeLogSchema.parse(data);
};

export const validateExportBatch = (data: unknown): ExportBatch => {
  return exportBatchSchema.parse(data);
};

// Business rule validations
export const validateDuplicateDate = (date: string, existingLogs: OvertimeLog[], currentLogId?: string): boolean => {
  return existingLogs.some(log => 
    log.date === date && log.id !== currentLogId
  );
};

export const validateCostCentre = (costCentre: string): boolean => {
  return costCentrePattern.test(costCentre);
};

export const validateTimeFormat = (time: string): boolean => {
  return timePattern.test(time);
};
