import { buildAVAC } from './buildAVAC';
import { Profile, OvertimeLog } from '../../types';
import { database } from '../db/sqlite';

/**
 * Generate test profile data with long name for AVAC testing
 */
function generateTestProfile(): Profile {
  return {
    fullName: 'Dr. Christopher Alexander Montgomery-Wellington',
    orgUnitNo: '87654321',
    orgUnitName: 'Cardiology Department',
    location: 'Townsville University Hospital',
    payrollNumber: 'EMP987654',
    payLevel: 'Level 5',
    delegateName: 'Dr. Jennifer Smith',
    delegatePosition: 'Head of Cardiology',
    delegateAreaCode: '(07)',
    delegatePhone: '07 4433 1146',
    employeeInitial: 'CAM',
    pdfTemplateVersion: 'qld_avac_v8.5',
    timezone: 'Australia/Brisbane',
    concurrentEmploymentDefault: false,
    isSMO: false,
    
  };
}

/**
 * Generate test overtime logs for AVAC testing
 */
function generateTestLogs(): OvertimeLog[] {
  const baseDate = new Date();
  
  return [
    {
      id: 'test-log-1',
      date: baseDate.toISOString(),
      rosteredStart: '13:00',
      rosteredFinish: '23:00',
      actualStart: '13:00',
      actualFinish: '23:19',
      mealBreakMinutes: 30,
      minutesOvertime: 60,
      category: 'Overtime',
      comments: '1728992',
      initials: 'CAM',
      concurrentEmployment: false,
      status: 'ready',
      source: 'manual',
      createdAt: baseDate.toISOString(),
      updatedAt: baseDate.toISOString(),
    },
    {
      id: 'test-log-2',
      date: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      rosteredStart: '08:00',
      rosteredFinish: '16:00',
      actualStart: '08:15',
      actualFinish: '17:30',
      mealBreakMinutes: 45,
      minutesOvertime: 60,
      category: 'Overtime',
      comments: 'Extended case review',
      initials: 'CAM',
      concurrentEmployment: false,
      status: 'ready',
      source: 'manual',
      createdAt: baseDate.toISOString(),
      updatedAt: baseDate.toISOString(),
    },
  ];
}

/**
 * Test function to generate AVAC with long name to test multiline functionality
 * This can be called from anywhere in the app to test text wrapping
 */
export async function testAVACGeneration(): Promise<string> {
  try {
    console.log('🧪 Starting AVAC test generation with long name...');
    
    // Generate test data with long name
    const profile = generateTestProfile();
    const logs = generateTestLogs();
    
    console.log('📊 Test data generated:', {
      profile: profile.fullName,
      logsCount: logs.length,
      orgUnit: profile.orgUnitName,
      location: profile.location
    });
    
    // Generate the test PDF
    const fileUri = await buildAVAC(profile, logs);
    
    // Create an export batch entry so it appears in the exports screen
    const batch = {
      id: `test_avac_batch_${Date.now()}`,
      createdAt: new Date().toISOString(),
      pdfUri: fileUri,
      countLogs: logs.length,
      totalMinutes: logs.reduce((sum, log) => sum + (log.minutesOvertime || 0), 0),
      submittedToEmail: undefined,
      customName: 'AVAC Test - Multiline Text'
    };
    
    await database.createExportBatch(batch);
    console.log('📝 Export batch created for test PDF');
    console.log('📱 Note: Go to the Exports tab and pull down to refresh to see the test PDF');
    
    console.log('✅ AVAC test PDF generated successfully:', fileUri);
    return fileUri;
  } catch (error) {
    console.error('❌ Failed to generate AVAC test PDF:', error);
    throw error;
  }
}

/**
 * Quick test function that can be imported and called
 */
export async function quickAVACTest(): Promise<void> {
  try {
    await testAVACGeneration();
    console.log('✅ Quick AVAC test completed successfully');
  } catch (error) {
    console.error('❌ Quick AVAC test failed:', error);
  }
}
