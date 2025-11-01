import { Profile, UsualShift, OvertimeLog } from '../../types';

// Example profile data
export const exampleProfile: Profile = {
  fullName: 'John Smith',
  payrollNumber: '123456',
  orgUnitNo: 'OU001',
  orgUnitName: 'Emergency Department',
  location: 'Royal Brisbane Hospital',
  payLevel: 'Nurse Level 5',
  serviceEnquiryNumber: '07 3646 8111',
  delegateName: 'Sarah Johnson',
  delegatePosition: 'Nurse Unit Manager',
  delegateAreaCode: '(07)',
  delegatePhone: '3646 8000',
  employeeInitial: 'JS',
  pdfTemplateVersion: 'qld_avac_v8.5',
  timezone: 'Australia/Brisbane',
  concurrentEmploymentDefault: false,
  email: '',
  isSMO: false,
};

// Example usual shifts
export const exampleShifts: UsualShift[] = [
  {
    id: 'shift_1',
    label: 'Week A - Day Shift',
    type: 'biweekly',
    weekIndex: 1,
    dayOfWeek: 1, // Monday
    rosteredStart: '07:00',
    rosteredFinish: '15:30',
    mealBreakMinutes: 30,
    activeFrom: '2024-01-01T00:00:00.000Z',
    activeTo: undefined,
  },
  {
    id: 'shift_2',
    label: 'Week A - Night Shift',
    type: 'biweekly',
    weekIndex: 1,
    dayOfWeek: 2, // Tuesday
    rosteredStart: '19:00',
    rosteredFinish: '07:30',
    mealBreakMinutes: 30,
    activeFrom: '2024-01-01T00:00:00.000Z',
    activeTo: undefined,
  },
  {
    id: 'shift_3',
    label: 'Week B - Day Shift',
    type: 'biweekly',
    weekIndex: 2,
    dayOfWeek: 1, // Monday
    rosteredStart: '07:00',
    rosteredFinish: '15:30',
    mealBreakMinutes: 30,
    activeFrom: '2024-01-01T00:00:00.000Z',
    activeTo: undefined,
  },
  {
    id: 'shift_4',
    label: 'Regular Weekend',
    type: 'weekly',
    dayOfWeek: 6, // Saturday
    rosteredStart: '08:00',
    rosteredFinish: '16:00',
    mealBreakMinutes: 30,
    activeFrom: '2024-01-01T00:00:00.000Z',
    activeTo: undefined,
  },
];

// Example overtime logs
export const exampleLogs: OvertimeLog[] = [
  {
    id: 'log_1',
    date: '2024-01-15T00:00:00.000Z',
    rosteredStart: '07:00',
    rosteredFinish: '15:30',
    actualStart: '07:00',
    actualFinish: '17:00',
    mealBreakMinutes: 30,
    minutesOvertime: 60,
    category: 'Overtime',
    comments: 'Patient handover took longer than expected',
    initials: 'JS',
    status: 'ready',
    source: 'manual',
    createdAt: '2024-01-15T17:00:00.000Z',
    updatedAt: '2024-01-15T17:00:00.000Z',
  },
  {
    id: 'log_2',
    date: '2024-01-16T00:00:00.000Z',
    rosteredStart: '19:00',
    rosteredFinish: '07:30',
    actualStart: '19:00',
    actualFinish: '08:00',
    mealBreakMinutes: 30,
    minutesOvertime: 30,
    category: 'Overtime',
    comments: 'Emergency admission required extra time',
    initials: 'JS',
    status: 'draft',
    source: 'manual',
    createdAt: '2024-01-16T08:00:00.000Z',
    updatedAt: '2024-01-16T08:00:00.000Z',
  },
  {
    id: 'log_3',
    date: '2024-01-20T00:00:00.000Z',
    rosteredStart: '08:00',
    rosteredFinish: '16:00',
    actualStart: '08:00',
    actualFinish: '18:30',
    mealBreakMinutes: 30,
    minutesOvertime: 120,
    category: 'Overtime',
    comments: 'Weekend shift - multiple emergency cases',
    initials: 'JS',
    status: 'exported',
    source: 'manual',
    createdAt: '2024-01-20T18:30:00.000Z',
    updatedAt: '2024-01-20T18:30:00.000Z',
  },
];

// Helper function to seed example data
export const seedExampleData = async () => {
  // This would be called during development/testing
  console.log('Example data available for seeding');
  return {
    profile: exampleProfile,
    shifts: exampleShifts,
    logs: exampleLogs,
  };
};
