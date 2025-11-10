export type Profile = {
  fullName: string;
  payrollNumber: string;
  orgUnitNo: string;
  orgUnitName: string;
  location: string;
  payLevel: string;
  serviceEnquiryNumber?: string;
  delegateName: string;
  delegatePosition: string;
  delegateAreaCode: string; // "(07)"
  delegatePhone: string;
  employeeInitial: string; // Employee initials (e.g., "JS" for John Smith)
  pdfTemplateVersion: 'qld_avac_v8.5';
  timezone: string; // "Australia/Brisbane"
  concurrentEmploymentDefault: boolean; // Default concurrent employment setting
  email: string; // User's QLD Health email address
  emailTemplate?: string; // Customizable email body template
  emailSubmissionMethod?: 'apple-mail' | 'share-sheet'; // Preferred email submission method
  isSMO: boolean; // Whether user is a Senior Medical Officer
};

export type UsualShift = {
  id: string;
  label: string;          // "Week A", "Base"
  type: 'weekly'|'biweekly'|'custom';
  weekIndex?: 1|2;        // for biweekly
  dayOfWeek: 0|1|2|3|4|5|6; // Sun..Sat
  rosteredStart: string;  // "08:00"
  rosteredFinish: string; // "16:00"
  mealBreakMinutes?: number; // default 0
  activeFrom: string;     // ISO date
  activeTo?: string;      // ISO date
  deletedAt?: string;     // ISO timestamp for soft delete
};

export type OvertimeLog = {
  id: string;
  date: string; // ISO date
  rosteredStart?: string | 'N/A';
  rosteredFinish?: string | 'N/A';
  actualStart: string | 'N/A';    // "18:30" or "N/A"
  actualFinish: string | 'N/A';   // "20:45" or "N/A"
  mealBreakMinutes?: number;
  minutesOvertime: number;
  category: 'Overtime'|'Oncall'|'HP Emergency Clinical on Call'|'HPDO Priority on Call'|'Recall Offsite'|'Recall Onsite'|'Recall Offsite Normal Duties (QPSOOE award)'|'Recall Telephone Advice (Medical)'|'Change shift'|'Change shift - cancel leave';
  comments?: string;
  initials: string;       // from profile.fullName
  concurrentEmployment?: boolean; // Whether employee works more than one job at the same time
  smoCategories?: {       // SMO-specific category checkboxes
    vmoAdditionalHours?: boolean;
    overtime?: boolean;
    oncall?: boolean;
    physicalRecall?: boolean;
    digitalRecall?: boolean;
    extraShift?: boolean;
    approvedForPayment?: boolean;
  };
  status: 'draft'|'ready'|'exported';
  exportBatchId?: string;
  source: 'manual'|'geofence-proposed'|'imported';
  isActiveShift?: boolean; // Marks this draft as the currently active shift started via "Start Shift" button
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;     // ISO timestamp for soft delete
};

export type ExportBatch = {
  id: string;
  createdAt: string;
  pdfUri: string;
  countLogs: number;
  totalMinutes: number;
  submittedToEmail?: string;
  customName?: string;
  submittedAt?: string; // ISO timestamp
  submittedVia?: 'email' | 'manual';
  deletedAt?: string;   // ISO timestamp for soft delete
};

export type NotificationSettings = {
  enabled: boolean;
  reminderMinutes: number; // minutes before rostered finish
  snoozeMinutes: number;   // default snooze duration
};

export type TimeRange = {
  start: string; // "HH:mm"
  finish: string; // "HH:mm"
};

export type RosterForDate = {
  date: string;
  rosteredStart?: string;
  rosteredFinish?: string;
  mealBreakMinutes?: number;
  source: UsualShift | null;
};

export type MinutesCalculation = {
  minutesWorked: number;
  minutesRostered: number;
  minutesOvertime: number;
  roundedOvertime: number; // rounded to nearest 5
};

export type ValidationRules = {
  qld_avac_v8_5: {
    required: string[];
    patterns: Record<string, string>;
    timeRules: {
      minShiftMinutes: number;
      roundTo: number;
    };
    categories: string[];
  };
};

export type LogTemplate = {
  id: string;
  name: string; // user-friendly name like "Weekend ED Call"
  // Actual times are NOT stored in templates - they're left blank when using template
  rosteredStart?: string | 'N/A';
  rosteredFinish?: string | 'N/A';
  mealBreakMinutes?: number;
  category: 'Overtime'|'Oncall'|'HP Emergency Clinical on Call'|'HPDO Priority on Call'|'Recall Offsite'|'Recall Onsite'|'Recall Offsite Normal Duties (QPSOOE award)'|'Recall Telephone Advice (Medical)'|'Change shift'|'Change shift - cancel leave';
  comments?: string;
  concurrentEmployment?: boolean;
  smoCategories?: {       // SMO-specific category checkboxes
    vmoAdditionalHours?: boolean;
    overtime?: boolean;
    oncall?: boolean;
    physicalRecall?: boolean;
    digitalRecall?: boolean;
    extraShift?: boolean;
    approvedForPayment?: boolean;
  };
  createdAt: string;
  updatedAt: string;
};
