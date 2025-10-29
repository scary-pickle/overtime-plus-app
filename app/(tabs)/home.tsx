import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  useColorScheme 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../lib/state/profileStore';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { useLogsStore } from '../../lib/state/logsStore';
import { profileStorage } from '../../lib/storage/profile';
import { getCurrentTime, getCurrentDate, formatMinutes } from '../../lib/time';
import { getRosterForDate } from '../../lib/roster';
import { LateBadge } from '../../components/LateBadge';
import { EmptyState } from '../../components/EmptyState';
import { testSMOAVACGeneration } from '../../lib/pdf/testSMOAVAC';

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile, loadProfile } = useProfileStore();
  
  // Compute profile state from profile object
  const hasProfile = !!profile;
  const isComplete = profile ? profileStorage.isProfileComplete(profile) : false;
  const { shifts, getRosterFor } = useShiftsStore();
  const { logs, getDraftLogs, getReadyLogs } = useLogsStore();
  
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [todayRoster, setTodayRoster] = useState<any>(null);

  useEffect(() => {
    // Update time every minute
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hasProfile) {
      const roster = getRosterFor(getCurrentDate());
      setTodayRoster(roster);
    }
  }, [hasProfile, shifts]);

  // Reload profile when screen comes into focus
  useEffect(() => {
    const refreshProfile = () => {
      loadProfile();
    };
    
    // Reload profile immediately
    refreshProfile();
  }, []);

  // Refresh profile when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('Home screen focused, refreshing profile');
      loadProfile();
    }, [loadProfile])
  );

  const handleStartShift = () => {
    if (!hasProfile || !isComplete) {
      Alert.alert(
        'Profile Required',
        'Please complete your profile before logging overtime.',
        [{ text: 'OK', onPress: () => router.push('/(tabs)/profile') }]
      );
      return;
    }
    
    router.push('/log/new');
  };

  const handleEndShift = () => {
    if (!hasProfile || !isComplete) {
      Alert.alert(
        'Profile Required',
        'Please complete your profile before logging overtime.',
        [{ text: 'OK', onPress: () => router.push('/(tabs)/profile') }]
      );
      return;
    }
    
    router.push('/log/new');
  };

  const draftLogs = getDraftLogs();
  const readyLogs = getReadyLogs();
  const pendingCount = draftLogs.length + readyLogs.length;

  // Debug information
  console.log('Home Screen Debug:', {
    hasProfile,
    isComplete,
    profile: profile ? 'Profile exists' : 'No profile',
    profileKeys: profile ? Object.keys(profile) : 'No profile'
  });

  if (!hasProfile) {
    return (
      <View style={[styles.container, isDark && styles.darkContainer]}>
        <EmptyState
          title="Welcome to Overtime+"
          description="Set up your profile to start tracking overtime and generate AVAC forms."
          actionText="Set Up Profile"
          onAction={() => router.push('/(tabs)/profile')}
          icon="👋"
        />
        <TouchableOpacity 
          style={styles.debugButton}
          onPress={() => {
            console.log('Manual refresh triggered');
            loadProfile();
          }}
        >
          <Text style={styles.debugButtonText}>Refresh Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isComplete) {
    return (
      <View style={[styles.container, isDark && styles.darkContainer]}>
        <EmptyState
          title="Complete Your Profile"
          description="Please fill in all required profile information to start using the app."
          actionText="Complete Profile"
          onAction={() => router.push('/(tabs)/profile')}
          icon="📝"
        />
        <TouchableOpacity 
          style={styles.debugButton}
          onPress={() => {
            console.log('Manual refresh triggered');
            loadProfile();
          }}
        >
          <Text style={styles.debugButtonText}>Refresh Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.content}>
        {/* Today Card */}
        <View style={[styles.todayCard, isDark && styles.darkCard]}>
          <Text style={[styles.todayTitle, isDark && styles.darkText]}>
            Today - {new Date().toLocaleDateString('en-AU', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })}
          </Text>
          
          <Text style={[styles.currentTime, isDark && styles.darkText]}>
            {currentTime}
          </Text>

          {todayRoster ? (
            <View style={styles.rosterInfo}>
              <Text style={[styles.rosterLabel, isDark && styles.darkText]}>
                Rostered: {todayRoster.rosteredStart} - {todayRoster.rosteredFinish}
              </Text>
              <LateBadge 
                rosteredFinish={todayRoster.rosteredFinish}
                style={styles.lateBadge}
              />
            </View>
          ) : (
            <Text style={[styles.noRoster, isDark && styles.darkText]}>
              No rostered shift today
            </Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartShift}
          >
            <Text style={styles.actionButtonText}>Start Shift</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.endButton]}
            onPress={handleEndShift}
          >
            <Text style={styles.actionButtonText}>End Shift</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, isDark && styles.darkCard]}>
          <Text style={[styles.statsTitle, isDark && styles.darkText]}>
            This Week
          </Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, isDark && styles.darkText]}>
                {logs.length}
              </Text>
              <Text style={[styles.statLabel, isDark && styles.darkText]}>
                Total Logs
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, isDark && styles.darkText]}>
                {formatMinutes(logs.reduce((sum, log) => sum + log.minutesOvertime, 0))}
              </Text>
              <Text style={[styles.statLabel, isDark && styles.darkText]}>
                Overtime
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, isDark && styles.darkText]}>
                {pendingCount}
              </Text>
              <Text style={[styles.statLabel, isDark && styles.darkText]}>
                Pending
              </Text>
            </View>
          </View>
        </View>

        {/* SMO AVAC Test Button - Development Only */}
        {__DEV__ && (
          <View style={[styles.statsCard, isDark && styles.darkCard]}>
            <Text style={[styles.statsTitle, isDark && styles.darkText]}>
              Development Tools
            </Text>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#28a745', marginTop: 10 }]}
              onPress={async () => {
                try {
                  Alert.alert('Generating SMO AVAC Test...', 'Please wait while the test PDF is generated.');
                  const fileUri = await testSMOAVACGeneration();
                  Alert.alert('Success!', 'SMO AVAC test PDF generated!\n\nGo to the Exports tab and pull down to refresh to view the PDF.');
                } catch (error) {
                  Alert.alert('Error', `Failed to generate SMO AVAC test: ${error}`);
                }
              }}
            >
              <Text style={styles.actionButtonText}>Generate SMO AVAC Test</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Logs */}
        {logs.length > 0 && (
          <View style={[styles.recentCard, isDark && styles.darkCard]}>
            <Text style={[styles.recentTitle, isDark && styles.darkText]}>
              Recent Logs
            </Text>
            
            {logs.slice(0, 3).map((log) => (
              <View key={log.id} style={styles.recentItem}>
                <Text style={[styles.recentDate, isDark && styles.darkText]}>
                  {new Date(log.date).toLocaleDateString('en-AU', { 
                    day: 'numeric', 
                    month: 'short' 
                  })}
                </Text>
                <Text style={[styles.recentTime, isDark && styles.darkText]}>
                  {log.actualStart} - {log.actualFinish}
                </Text>
                <Text style={[styles.recentOvertime, isDark && styles.darkText]}>
                  {formatMinutes(log.minutesOvertime)}
                </Text>
              </View>
            ))}
            
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/(tabs)/log')}
            >
              <Text style={styles.viewAllText}>View All Logs</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  content: {
    padding: 16,
  },
  todayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  darkText: {
    color: '#fff',
  },
  currentTime: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 12,
  },
  rosterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rosterLabel: {
    fontSize: 16,
    color: '#666',
  },
  lateBadge: {
    marginLeft: 8,
  },
  noRoster: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  endButton: {
    backgroundColor: '#FF4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  recentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentDate: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  recentTime: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'center',
  },
  recentOvertime: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  viewAllButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  debugButton: {
    backgroundColor: '#FF6B6B',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
