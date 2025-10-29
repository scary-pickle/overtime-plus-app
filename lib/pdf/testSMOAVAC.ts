import { buildSMOAVACTest } from './buildSMOAVAC';
import { generateSMOProfile, generateSMOLogs } from './smoTestData';
import { database } from '../db/sqlite';

/**
 * Test function to generate SMO AVAC with green overlay boxes
 * This can be called from anywhere in the app to test coordinate positioning
 */
export async function testSMOAVACGeneration(): Promise<string> {
  try {
    console.log('🧪 Starting SMO AVAC test generation...');
    
    // Generate test data
    const profile = generateSMOProfile();
    const logs = generateSMOLogs();
    
    console.log('📊 Test data generated:', {
      profile: profile.fullName,
      logsCount: logs.length,
      orgUnit: profile.orgUnitName,
      location: profile.location
    });
    
    // Generate the test PDF with green overlay boxes
    const fileUri = await buildSMOAVACTest(profile, logs);
    
    // Create an export batch entry so it appears in the exports screen
    const batch = {
      id: `test_batch_${Date.now()}`,
      createdAt: new Date().toISOString(),
      pdfUri: fileUri,
      countLogs: logs.length,
      totalMinutes: logs.reduce((sum, log) => sum + (log.minutesOvertime || 0), 0),
      submittedToEmail: undefined,
      customName: 'SMO AVAC Test - Text Positioning'
    };
    
    await database.createExportBatch(batch);
    console.log('📝 Export batch created for test PDF');
    console.log('📱 Note: Go to the Exports tab and pull down to refresh to see the test PDF');
    
    console.log('✅ SMO AVAC test PDF generated successfully:', fileUri);
    return fileUri;
  } catch (error) {
    console.error('❌ Failed to generate SMO AVAC test PDF:', error);
    throw error;
  }
}

/**
 * Quick test function that can be imported and called
 */
export async function quickSMOTest(): Promise<void> {
  try {
    const fileUri = await testSMOAVACGeneration();
    console.log('🎉 SMO AVAC test completed! Check the generated PDF:', fileUri);
  } catch (error) {
    console.error('💥 SMO AVAC test failed:', error);
  }
}
