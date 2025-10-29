import { database } from './db/sqlite';

export const clearTestData = async () => {
  try {
    console.log('🧹 Starting to clear test data...');
    
    await database.init();
    await database.clearAllData();
    
    console.log('✅ Cleared all overtime logs');
    console.log('✅ Cleared all usual shifts');
    console.log('✅ Cleared all export batches');
    console.log('🎉 Test data cleared successfully! Your app now has clean data.');
    
    return true;
  } catch (error) {
    console.error('❌ Error clearing test data:', error);
    return false;
  }
};

// Helper function to check if data exists
export const checkDataExists = async () => {
  try {
    await database.init();
    const counts = await database.getDataCounts();
    
    console.log('📊 Current data status:');
    console.log(`   - Logs: ${counts.logs}`);
    console.log(`   - Shifts: ${counts.shifts}`);
    console.log(`   - Export Batches: ${counts.batches}`);
    
    return counts;
  } catch (error) {
    console.error('❌ Error checking data:', error);
    return { logs: 0, shifts: 0, batches: 0 };
  }
};
