import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  useColorScheme,
  RefreshControl
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
import { QuickEndShiftModal } from '../../components/QuickEndShiftModal';
import { OvertimeLog } from '../../types';
import LineMini from '../../components/charts/LineMini';
import { getLast30DaysRange, getLogsInRange, bucketByDay, sumMinutes } from '../../lib/analytics';

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile, loadProfile, initials } = useProfileStore();
  
  // Compute profile state from profile object
  const hasProfile = !!profile;
  const isComplete = profile ? profileStorage.isProfileComplete(profile) : false;
  const { shifts, getRosterFor, loadShifts } = useShiftsStore();
  const { logs, getDraftLogs, getReadyLogs, getActiveShiftDraft, addLog, clearActiveShift, markDraftAsStale, loadLogs, hasLoggedShiftForDate, getLoggedShiftForDate } = useLogsStore();
  
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [todayRoster, setTodayRoster] = useState<any>(null);
  const [activeShiftDraft, setActiveShiftDraft] = useState<OvertimeLog | null>(null);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [endShiftDraft, setEndShiftDraft] = useState<OvertimeLog | null>(null);
  const [endShiftNoRosterMode, setEndShiftNoRosterMode] = useState(false);
  const [hasLoggedToday, setHasLoggedToday] = useState(false);
  const [todayLoggedShift, setTodayLoggedShift] = useState<OvertimeLog | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      
      // Check if shift has already been logged today
      const today = getCurrentDate();
      const hasLogged = hasLoggedShiftForDate(today);
      const loggedShift = getLoggedShiftForDate(today);
      setHasLoggedToday(hasLogged);
      setTodayLoggedShift(loggedShift);
    }
  }, [hasProfile, shifts, logs]);

  // Check for active shift draft and handle stale drafts
  useEffect(() => {
    const checkActiveShift = async () => {
      const activeDraft = getActiveShiftDraft();
      
      if (activeDraft) {
        const today = getCurrentDate();
        
        // Check if draft is stale (from a previous day)
        if (activeDraft.date < today) {
          console.log('Stale draft detected, clearing active shift');
          await markDraftAsStale(activeDraft.id);
          setActiveShiftDraft(null);
        } else {
          setActiveShiftDraft(activeDraft);
        }
      } else {
        setActiveShiftDraft(null);
      }
    };
    
    if (hasProfile) {
      checkActiveShift();
    }
  }, [hasProfile, logs]);

  // Reload profile when screen comes into focus
  useEffect(() => {
    const refreshProfile = () => {
      loadProfile();
    };
    
    // Reload profile immediately
    refreshProfile();
  }, []);

  // Refresh profile and logs when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
      loadLogs();
    }, [loadProfile, loadLogs])
  );

  // Handle pull-to-refresh
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadProfile(),
        loadLogs(),
        loadShifts()
      ]);
      // Update current time
      setCurrentTime(getCurrentTime());
      // Refresh roster data
      if (hasProfile) {
        const roster = getRosterFor(getCurrentDate());
        setTodayRoster(roster);
        
        // Check if shift has already been logged today
        const today = getCurrentDate();
        const hasLogged = hasLoggedShiftForDate(today);
        const loggedShift = getLoggedShiftForDate(today);
        setHasLoggedToday(hasLogged);
        setTodayLoggedShift(loggedShift);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile, loadLogs, loadShifts, hasProfile, getRosterFor, hasLoggedShiftForDate, getLoggedShiftForDate]);

  const handleStartShift = async () => {
    if (!hasProfile || !isComplete) {
      Alert.alert(
        'Profile Required',
        'Please complete your profile before logging overtime.',
        [{ text: 'OK', onPress: () => router.push('/(tabs)/profile') }]
      );
      return;
    }

    // Check if shift has already been logged today
    if (hasLoggedToday) {
      Alert.alert(
        'Shift Already Logged',
        'You have already logged a shift for today. Do you want to create another log for today?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'View Existing Log', 
            onPress: () => {
              if (todayLoggedShift) {
                router.push(`/log/${todayLoggedShift.id}`);
              }
            }
          },
          { text: 'Create New Log', onPress: () => proceedStartShift() }
        ]
      );
      return;
    }

    // Check if there's already an active shift
    if (activeShiftDraft) {
      Alert.alert(
        'Shift Already Started',
        'You have already started a shift. Please end it before starting a new one.'
      );
      return;
    }

    await proceedStartShift();
  };

  const proceedStartShift = async () => {

    try {
      const today = getCurrentDate();
      const currentActualTime = getCurrentTime();
      const roster = getRosterFor(today);
      
      // Use profile's employeeInitial directly if initials from store is empty
      const logInitials = initials || profile?.employeeInitial || '';

      // Create draft log with current time as actual start
      const draftLog: OvertimeLog = {
        id: `log_${Date.now()}`,
        date: today,
        rosteredStart: roster?.rosteredStart,
        rosteredFinish: roster?.rosteredFinish,
        actualStart: currentActualTime,
        actualFinish: 'N/A', // Will be set when ending shift
        mealBreakMinutes: roster?.mealBreakMinutes || 30,
        minutesOvertime: 0, // Will be calculated when ending shift
        category: 'Overtime',
        initials: logInitials,
        status: 'draft',
        isActiveShift: true,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addLog(draftLog);
      setActiveShiftDraft(draftLog);

      const message = roster 
        ? `Shift started at ${currentActualTime}` 
        : `Shift started at ${currentActualTime} (no roster found)`;
      
      Alert.alert('Shift Started', message);
    } catch (error) {
      console.error('Error starting shift:', error);
      Alert.alert('Error', 'Failed to start shift. Please try again.');
    }
  };

  const handleEndShift = async () => {
    if (!hasProfile || !isComplete) {
      Alert.alert(
        'Profile Required',
        'Please complete your profile before logging overtime.',
        [{ text: 'OK', onPress: () => router.push('/(tabs)/profile') }]
      );
      return;
    }

    // Check if shift has already been logged today (but allow if there's an active draft)
    if (hasLoggedToday && !activeShiftDraft) {
      Alert.alert(
        'Shift Already Logged',
        'You have already logged a shift for today. Do you want to create another log for today?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'View Existing Log', 
            onPress: () => {
              if (todayLoggedShift) {
                router.push(`/log/${todayLoggedShift.id}`);
              }
            }
          },
          { text: 'Create New Log', onPress: () => proceedEndShift() }
        ]
      );
      return;
    }

    await proceedEndShift();
  };

  const proceedEndShift = async () => {
    try {
      const today = getCurrentDate();
      const currentActualTime = getCurrentTime();
      const roster = getRosterFor(today);

      // Check if there's an active shift draft
      if (activeShiftDraft) {
        // Update the active draft with finish time
        const updatedDraft: OvertimeLog = {
          ...activeShiftDraft,
          actualFinish: currentActualTime,
          updatedAt: new Date().toISOString(),
        };
        
        setEndShiftDraft(updatedDraft);
        setEndShiftNoRosterMode(false);
        setShowEndShiftModal(true);
      } else {
        // No active draft - check if roster exists
        const logInitials = initials || profile?.employeeInitial || '';
        
        if (roster) {
          // Roster exists - create draft with actual start = rostered start
          const draftLog: OvertimeLog = {
            id: `log_${Date.now()}`,
            date: today,
            rosteredStart: roster.rosteredStart,
            rosteredFinish: roster.rosteredFinish,
            actualStart: roster.rosteredStart || currentActualTime,
            actualFinish: currentActualTime,
            mealBreakMinutes: roster.mealBreakMinutes || 30,
            minutesOvertime: 0, // Will be calculated in modal
            category: 'Overtime',
            initials: logInitials,
            status: 'draft',
            isActiveShift: false,
            source: 'manual',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          // Save draft to store before opening modal
          await addLog(draftLog);
          setEndShiftDraft(draftLog);
          setEndShiftNoRosterMode(false);
          setShowEndShiftModal(true);
        } else {
          // No roster - enter "no roster" mode
          const draftLog: OvertimeLog = {
            id: `log_${Date.now()}`,
            date: today,
            rosteredStart: undefined,
            rosteredFinish: undefined,
            actualStart: 'N/A', // User will need to enter this
            actualFinish: currentActualTime,
            mealBreakMinutes: 30,
            minutesOvertime: 0, // Will be calculated in modal
            category: 'Overtime',
            initials: logInitials,
            status: 'draft',
            isActiveShift: false,
            source: 'manual',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          // Save draft to store before opening modal
          await addLog(draftLog);
          setEndShiftDraft(draftLog);
          setEndShiftNoRosterMode(true);
          setShowEndShiftModal(true);
        }
      }
    } catch (error) {
      console.error('Error ending shift:', error);
      Alert.alert('Error', 'Failed to end shift. Please try again.');
    }
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
      <ScrollView 
        style={[styles.container, isDark && styles.darkContainer]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#fff' : '#007AFF'}
            colors={['#007AFF']}
          />
        }
        contentContainerStyle={styles.emptyContainer}
      >
        <EmptyState
          title="Welcome to Overtime+"
          description="Set up your profile to start tracking overtime and generate AVAC forms."
          actionText="Set Up Profile"
          onAction={() => router.push('/(tabs)/profile')}
          icon="👋"
        />
      </ScrollView>
    );
  }

  if (!isComplete) {
    return (
      <ScrollView 
        style={[styles.container, isDark && styles.darkContainer]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#fff' : '#007AFF'}
            colors={['#007AFF']}
          />
        }
        contentContainerStyle={styles.emptyContainer}
      >
        <EmptyState
          title="Complete Your Profile"
          description="Please fill in all required profile information to start using the app."
          actionText="Complete Profile"
          onAction={() => router.push('/(tabs)/profile')}
          icon="📝"
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, isDark && styles.darkContainer]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={isDark ? '#fff' : '#007AFF'}
          colors={['#007AFF']}
        />
      }
    >
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

        {/* Shift Already Logged Indicator */}
        {hasLoggedToday && todayLoggedShift && !activeShiftDraft && (
          <TouchableOpacity 
            style={[styles.loggedShiftIndicator, isDark && styles.darkLoggedShiftIndicator]}
            onPress={() => router.push(`/log/${todayLoggedShift.id}`)}
          >
            <View style={styles.loggedShiftContent}>
              <Text style={styles.loggedShiftIcon}>✓</Text>
              <View style={styles.loggedShiftTextContainer}>
                <Text style={[styles.loggedShiftTitle, isDark && styles.darkText]}>
                  Shift Already Logged
                </Text>
                <Text style={[styles.loggedShiftDetails, isDark && styles.darkText]}>
                  {todayLoggedShift.actualStart} - {todayLoggedShift.actualFinish} • {formatMinutes(todayLoggedShift.minutesOvertime)}
                </Text>
              </View>
              <Text style={styles.loggedShiftArrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              styles.startButton,
              activeShiftDraft && styles.disabledButton
            ]}
            onPress={handleStartShift}
            disabled={!!activeShiftDraft}
          >
            <Text style={[
              styles.actionButtonText,
              activeShiftDraft && styles.disabledButtonText
            ]}>
              {activeShiftDraft ? 'Shift In Progress' : 'Start Shift'}
            </Text>
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

        {/* Analytics Preview (Compact) */}
        <View style={[styles.analyticsCard, isDark && styles.darkCard]}>
          {(() => {
            const range = getLast30DaysRange();
            const inRange = getLogsInRange(logs, range);
            const minutes = sumMinutes(inRange);
            const hours = Math.round(minutes / 60);
            const caption = 'Last 30 days';
            return (
              <>
                <View style={styles.analyticsHeader}>
                  <Text style={[styles.analyticsTitle, isDark && styles.darkText]}>Analytics</Text>
                  <TouchableOpacity onPress={() => router.push('/analytics')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.viewLink}>View</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.analyticsRow}>
                  <View style={styles.analyticsStat}>
                    <Text style={[styles.analyticsNumber, isDark && styles.darkText]}>{hours}h</Text>
                    <Text style={[styles.analyticsLabel, isDark && styles.darkText]}>Overtime</Text>
                  </View>
                  <View style={styles.analyticsDivider} />
                  <View style={styles.analyticsStat}>
                    <Text style={[styles.analyticsNumber, isDark && styles.darkText]}>{inRange.length}</Text>
                    <Text style={[styles.analyticsLabel, isDark && styles.darkText]}>Logs</Text>
                  </View>
                </View>
                <Text style={[styles.analyticsCaption, isDark && styles.darkText]}>{caption}</Text>
              </>
            );
          })()}
        </View>

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
      
      {/* Quick End Shift Modal */}
      <QuickEndShiftModal
        visible={showEndShiftModal}
        draftLog={endShiftDraft}
        noRosterMode={endShiftNoRosterMode}
        onClose={() => {
          setShowEndShiftModal(false);
          setEndShiftDraft(null);
        }}
        onComplete={() => {
          setActiveShiftDraft(null);
        }}
      />
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
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
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
  analyticsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  viewLink: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  analyticsStat: {
    flex: 1,
    alignItems: 'center',
  },
  analyticsDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#eee',
  },
  analyticsNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#007AFF',
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  analyticsCaption: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
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
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#888',
  },
  loggedShiftIndicator: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  darkLoggedShiftIndicator: {
    backgroundColor: '#1a2e1a',
    borderColor: '#66BB6A',
  },
  loggedShiftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loggedShiftIcon: {
    fontSize: 24,
    color: '#4CAF50',
    marginRight: 12,
  },
  loggedShiftTextContainer: {
    flex: 1,
  },
  loggedShiftTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 4,
  },
  loggedShiftDetails: {
    fontSize: 14,
    color: '#4CAF50',
  },
  loggedShiftArrow: {
    fontSize: 24,
    color: '#4CAF50',
    marginLeft: 8,
  },
});
