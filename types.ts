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
};

export type OvertimeLog = {
  id: string;
  date: string; // ISO date
  rosteredStart?: string;
  rosteredFinish?: string;
  actualStart: string;    // "18:30"
  actualFinish: string;   // "20:45"
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
  createdAt: string;
  updatedAt: string;
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
