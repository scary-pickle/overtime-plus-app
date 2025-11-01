import { Profile, OvertimeLog } from '../../types';

/**
 * Generate sample profile data for SMO AVAC testing
 */
export function generateSMOProfile(): Profile {
  return {
    fullName: 'Dr. Sarah Elizabeth Johnson-Williams',
    orgUnitNo: '12345678',
    orgUnitName: 'Emergency Department',
    location: 'Royal Brisbane Hospital',
    payrollNumber: 'EMP123456',
    payLevel: 'SMO Level 1',
    delegateName: 'Dr. Michael Chen',
    delegatePosition: 'Director of Emergency Medicine',
    delegateAreaCode: '(07)',
    delegatePhone: '07 3646 8111',
    employeeInitial: 'SEJ',
    pdfTemplateVersion: 'qld_avac_v8.5',
    timezone: 'Australia/Brisbane',
    concurrentEmploymentDefault: false,
    email: '',
    isSMO: true,
    
  };
}

/**
 * Generate sample overtime logs for SMO AVAC testing
 */
export function generateSMOLogs(): OvertimeLog[] {
  const baseDate = new Date();
  
  return [
    {
      id: 'smo-log-1',
      date: baseDate.toISOString(),
      rosteredStart: '08:00',
      rosteredFinish: '16:00',
      actualStart: '08:15',
      actualFinish: '18:30',
      mealBreakMinutes: 30,
      minutesOvertime: 60,
      category: 'Overtime',
      comments: 'Emergency case required extended care',
      initials: 'SJ',
      concurrentEmployment: false,
      status: 'ready',
      source: 'manual',
      createdAt: baseDate.toISOString(),
      updatedAt: baseDate.toISOString(),
    },
    {
      id: 'smo-log-2',
      date: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      rosteredStart: '20:00',
      rosteredFinish: '08:00',
      actualStart: '20:00',
      actualFinish: '09:15',
      mealBreakMinutes: 60,
      minutesOvertime: 60,
      category: 'Oncall',
      comments: 'Night shift with multiple call-outs',
      initials: 'SJ',
      concurrentEmployment: true,
      status: 'ready',
      source: 'manual',
      createdAt: baseDate.toISOString(),
      updatedAt: baseDate.toISOString(),
    },
    {
      id: 'smo-log-3',
      date: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      rosteredStart: '09:00',
      rosteredFinish: '17:00',
      actualStart: '09:00',
      actualFinish: '19:45',
      mealBreakMinutes: 45,
      minutesOvertime: 60,
      category: 'Recall Onsite',
      comments: 'Recalled for emergency surgery',
      initials: 'SJ',
      concurrentEmployment: false,
      status: 'ready',
      source: 'manual',
      createdAt: baseDate.toISOString(),
      updatedAt: baseDate.toISOString(),
    },
    {
      id: 'smo-log-4',
      date: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      rosteredStart: '07:00',
      rosteredFinish: '15:00',
      actualStart: '07:00',
      actualFinish: '16:30',
      mealBreakMinutes: 30,
      minutesOvertime: 60,
      category: 'Recall Telephone Advice (Medical)',
      comments: 'Telemedicine consultation extended',
      initials: 'SJ',
      concurrentEmployment: false,
      status: 'ready',
      source: 'manual',
      createdAt: baseDate.toISOString(),
      updatedAt: baseDate.toISOString(),
    },
    {
      id: 'smo-log-5',
      date: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      rosteredStart: '12:00',
      rosteredFinish: '20:00',
      actualStart: '12:00',
      actualFinish: '21:15',
      mealBreakMinutes: 45,
      minutesOvertime: 60,
      category: 'Change shift',
      comments: 'Covering for colleague on leave',
      initials: 'SJ',
      concurrentEmployment: true,
      status: 'ready',
      source: 'manual',
      createdAt: baseDate.toISOString(),
      updatedAt: baseDate.toISOString(),
    },
  ];
}
