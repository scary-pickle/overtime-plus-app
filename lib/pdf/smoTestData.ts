import { Profile, OvertimeLog } from '../../types';

/**
 * Generate sample profile data for SMO AVAC testing
 */
export function generateSMOProfile(): Profile {
  return {
    id: 'smo-test-profile',
    fullName: 'Dr. Sarah Johnson',
    orgUnitNo: '12345678',
    orgUnitName: 'Emergency Department',
    location: 'Royal Brisbane Hospital',
    payrollNumber: 'EMP123456',
    payLevel: 'SMO Level 1',
    delegateName: 'Dr. Michael Chen',
    delegatePosition: 'Director of Emergency Medicine',
    delegatePhone: '07 3646 8111',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
      category: 'Overtime',
      comments: 'Emergency case required extended care',
      initials: 'SJ',
      concurrentEmployment: false,
      status: 'ready',
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
      category: 'On-call',
      comments: 'Night shift with multiple call-outs',
      initials: 'SJ',
      concurrentEmployment: true,
      status: 'ready',
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
      category: 'Physical Recall',
      comments: 'Recalled for emergency surgery',
      initials: 'SJ',
      concurrentEmployment: false,
      status: 'ready',
      createdAt: baseDate.toISOString(),
      updatedAt: baseDate.toISOString(),
    },
  ];
}
