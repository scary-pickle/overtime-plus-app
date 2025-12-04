import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  useColorScheme,
  RefreshControl,
  Modal
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../lib/state/profileStore';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { useLogsStore } from '../../lib/state/logsStore';
import { useAuthStore } from '../../lib/state/authStore';
import { profileStorage } from '../../lib/storage/profile';
import { getCurrentTime, getCurrentDate, formatMinutes, getShiftStartDate, getHoursElapsedSinceShiftStart } from '../../lib/time';
import { getRosterForDate } from '../../lib/roster';
import { notificationManager } from '../../lib/notifications';
import { LateBadge } from '../../components/LateBadge';
import { EmptyState } from '../../components/EmptyState';
import { QuickEndShiftModal } from '../../components/QuickEndShiftModal';
import { OvertimeLog } from '../../types';
import { createScopedLogger } from '../../lib/utils/logger';
// Analytics charts preview removed from Home; link provided on Weekly card instead

const debug = createScopedLogger('home');

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Get user from auth store for userId
  const { user } = useAuthStore();
  const { profile, loadProfile, initials } = useProfileStore();
  
  // Compute profile state from profile object
  const hasProfile = !!profile;
  const isComplete = profile ? profileStorage.isProfileComplete(profile) : false;
  const { shifts, getRosterFor, loadShifts } = useShiftsStore();
  const { logs, getDraftLogs, getReadyLogs, getActiveShiftDraft, addLog, updateLog, deleteLog, clearActiveShift, markDraftAsStale, loadLogs, hasLoggedShiftForDate, getLoggedShiftForDate } = useLogsStore();
  
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [todayRoster, setTodayRoster] = useState<any>(null);
  const [activeShiftDraft, setActiveShiftDraft] = useState<OvertimeLog | null>(null);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [endShiftDraft, setEndShiftDraft] = useState<OvertimeLog | null>(null);
  const [endShiftNoRosterMode, setEndShiftNoRosterMode] = useState(false);
  const [hasLoggedToday, setHasLoggedToday] = useState(false);
  const [todayLoggedShift, setTodayLoggedShift] = useState<OvertimeLog | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showActiveShiftWarningModal, setShowActiveShiftWarningModal] = useState(false);

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
      const loggedShift = getLoggedShiftForDate(today);
      
      // Only show as "already logged" if:
      // 1. The shift's date matches today
      // 2. The shift has actually completed (has a finish time)
      // 3. The shift is in ready or exported status
      // 4. The shift is NOT a shift swap (shift swaps are handled separately)
      const hasLogged = loggedShift !== null && 
                        loggedShift.date === today && 
                        loggedShift.actualFinish !== 'N/A' &&
                        (loggedShift.status === 'ready' || loggedShift.status === 'exported') &&
                        !loggedShift.isShiftSwap;
      
      setHasLoggedToday(hasLogged);
      setTodayLoggedShift(hasLogged ? loggedShift : null);
    }
  }, [hasProfile, shifts, logs, currentTime]);

  // Check for active shift draft and handle stale drafts, 24-hour cleanup, and auto-reset
  useEffect(() => {
    const checkActiveShift = async () => {
      const activeDraft = getActiveShiftDraft();
      const today = getCurrentDate();
      const todayRoster = getRosterFor(today);
      
      if (activeDraft) {
        // Check if draft is from a previous day
        if (activeDraft.date < today) {
          debug.debug('Stale draft detected (previous day), clearing active shift');
          await markDraftAsStale(activeDraft.id);
          await notificationManager.cancelActiveShiftReminder(activeDraft.id);
          setActiveShiftDraft(null);
          return;
        }
        
        // Check if shift has been active for 24+ hours (abandoned)
        const hoursElapsed = getHoursElapsedSinceShiftStart(activeDraft.date, activeDraft.actualStart);
        if (hoursElapsed >= 24) {
          debug.debug(`Abandoned shift detected (${hoursElapsed.toFixed(1)} hours), clearing active shift`);
          await markDraftAsStale(activeDraft.id);
          await notificationManager.cancelActiveShiftReminder(activeDraft.id);
          setActiveShiftDraft(null);
          return;
        }
        
        // Check if a new shift is about to start (based on roster)
        // If there's a roster for today and we're within 30 minutes of the rostered start time,
        // auto-reset the abandoned shift
        if (todayRoster && todayRoster.rosteredStart) {
          const currentTime = getCurrentTime();
          const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
          const [rosterHours, rosterMinutes] = todayRoster.rosteredStart.split(':').map(Number);
          
          const currentTotalMinutes = currentHours * 60 + currentMinutes;
          const rosterTotalMinutes = rosterHours * 60 + rosterMinutes;
          
          // Check if we're within 30 minutes before or after the rostered start time
          const minutesUntilRoster = rosterTotalMinutes - currentTotalMinutes;
          if (minutesUntilRoster >= -30 && minutesUntilRoster <= 30) {
            // New shift is about to start or has just started
            // Auto-reset the abandoned shift
            debug.debug('New shift about to start, auto-resetting abandoned shift');
            await markDraftAsStale(activeDraft.id);
            await notificationManager.cancelActiveShiftReminder(activeDraft.id);
            setActiveShiftDraft(null);
            return;
          }
        }
        
        // Shift is still valid, keep it active
        setActiveShiftDraft(activeDraft);
      } else {
        setActiveShiftDraft(null);
      }
    };
    
    if (hasProfile) {
      checkActiveShift();
    }
  }, [hasProfile, logs, currentTime]);

  // Reload profile when screen comes into focus
  useEffect(() => {
    const refreshProfile = () => {
      loadProfile(user?.id);
    };
    
    // Reload profile immediately
    refreshProfile();
  }, [loadProfile, user?.id]);

  // Refresh profile and logs when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadProfile(user?.id);
      loadLogs(user?.id);
    }, [loadProfile, loadLogs, user?.id])
  );

  // Handle pull-to-refresh
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadProfile(user?.id),
        loadLogs(user?.id),
        loadShifts(user?.id)
      ]);
      // Update current time
      setCurrentTime(getCurrentTime());
      // Refresh roster data
      if (hasProfile) {
        const roster = getRosterFor(getCurrentDate());
        setTodayRoster(roster);
        
        // Check if shift has already been logged today
        const today = getCurrentDate();
        const loggedShift = getLoggedShiftForDate(today);
        
        // Only show as "already logged" if:
        // 1. The shift's date matches today
        // 2. The shift has actually completed (has a finish time)
        // 3. The shift is in ready or exported status
        // 4. The shift is NOT a shift swap (shift swaps are handled separately)
        const hasLogged = loggedShift !== null && 
                          loggedShift.date === today && 
                          loggedShift.actualFinish !== 'N/A' &&
                          (loggedShift.status === 'ready' || loggedShift.status === 'exported') &&
                          !loggedShift.isShiftSwap;
        
        setHasLoggedToday(hasLogged);
        setTodayLoggedShift(hasLogged ? loggedShift : null);
      }
    } catch (error) {
      debug.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile, loadLogs, loadShifts, hasProfile, getRosterFor, hasLoggedShiftForDate, getLoggedShiftForDate, user?.id]);

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

  const handleResetActiveShift = async () => {
    if (!activeShiftDraft) {
      return;
    }

    Alert.alert(
      'Reset Active Shift',
      'Are you sure you want to reset and delete the current active shift? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Cancel the 8-hour reminder notification
              await notificationManager.cancelActiveShiftReminder(activeShiftDraft.id);
              
              // Delete the active draft
              await deleteLog(activeShiftDraft.id, user?.id);
              
              // Clear the active shift state
              setActiveShiftDraft(null);
              
              Alert.alert(
                'Shift Reset',
                'The active shift has been reset. You can now start a new shift.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              debug.error('Error resetting active shift:', error);
              Alert.alert('Error', 'Failed to reset shift. Please try again.');
            }
          },
        },
      ]
    );
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

      // Cancel shift start reminder for today (if it exists) since shift is now started
      await notificationManager.cancelShiftStartReminder(today);

      // Schedule 8-hour reminder notification
      await notificationManager.scheduleActiveShiftReminder(draftLog.id, today, currentActualTime);

      const message = roster 
        ? `Shift started at ${currentActualTime}` 
        : `Shift started at ${currentActualTime} (no roster found)`;
      
      Alert.alert('Shift Started', message);
    } catch (error) {
      debug.error('Error starting shift:', error);
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
        // Recalculate the date based on start and finish times
        const shiftStartDate = getShiftStartDate(today, activeShiftDraft.actualStart, currentActualTime);
        const updatedDraft: OvertimeLog = {
          ...activeShiftDraft,
          date: shiftStartDate, // Ensure date is based on start time
          actualFinish: currentActualTime,
          updatedAt: new Date().toISOString(),
        };
        
        // Check if the draft has rostered times - if not, enable noRosterMode
        // This allows users to edit rostered times even if they didn't add shifts to shift tracking
        const hasRosteredTimes = updatedDraft.rosteredStart && 
                                  updatedDraft.rosteredFinish && 
                                  updatedDraft.rosteredStart !== 'N/A' && 
                                  updatedDraft.rosteredFinish !== 'N/A';
        
        setEndShiftDraft(updatedDraft);
        setEndShiftNoRosterMode(!hasRosteredTimes);
        setShowEndShiftModal(true);
      } else {
        // No active draft - check if there's an existing draft log for today
        // Look for drafts that were created from a previous "end shift" action
        const draftLogs = getDraftLogs();
        const todayISO = today; // ISO date string (YYYY-MM-DD)
        const todayDrafts = draftLogs.filter(log => {
          // Check if draft was created today (based on createdAt)
          const createdDate = log.createdAt ? new Date(log.createdAt).toISOString().split('T')[0] : null;
          return log.status === 'draft' && 
                 log.isActiveShift === false &&
                 createdDate === todayISO &&
                 log.actualFinish !== 'N/A'; // Has a finish time, so it was from "end shift"
        });
        
        // Get the most recent draft (sorted by createdAt descending)
        const existingDraft = todayDrafts.length > 0 
          ? todayDrafts.sort((a, b) => {
              const timeA = new Date(a.createdAt).getTime();
              const timeB = new Date(b.createdAt).getTime();
              return timeB - timeA; // Most recent first
            })[0]
          : null;

        if (existingDraft) {
          // Found an existing draft - use it and update the finish time
          const shiftStartDate = getShiftStartDate(today, existingDraft.actualStart, currentActualTime);
          const updatedDraft: OvertimeLog = {
            ...existingDraft,
            date: shiftStartDate, // Recalculate date based on start and finish times
            actualFinish: currentActualTime, // Update finish time to current time
            updatedAt: new Date().toISOString(),
          };
          
          // Check if the draft has rostered times - if not, enable noRosterMode
          const hasRosteredTimes = updatedDraft.rosteredStart && 
                                    updatedDraft.rosteredFinish && 
                                    updatedDraft.rosteredStart !== 'N/A' && 
                                    updatedDraft.rosteredFinish !== 'N/A';
          
          // Update the existing draft in the store
          await updateLog(updatedDraft);
          setEndShiftDraft(updatedDraft);
          setEndShiftNoRosterMode(!hasRosteredTimes);
          setShowEndShiftModal(true);
        } else {
          // No existing draft - create a new one
          const logInitials = initials || profile?.employeeInitial || '';
          
          if (roster) {
            // Roster exists - create draft with actual start = rostered start
            // Calculate the correct date based on start and finish times
            const actualStart = roster.rosteredStart || currentActualTime;
            const shiftStartDate = getShiftStartDate(today, actualStart, currentActualTime);
            
            const draftLog: OvertimeLog = {
              id: `log_${Date.now()}`,
              date: shiftStartDate, // Use calculated start date, not today
              rosteredStart: roster.rosteredStart,
              rosteredFinish: roster.rosteredFinish,
              actualStart: actualStart,
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
            // For no roster mode, we'll calculate the date in the modal after user enters start time
            // For now, use today but it will be updated when user enters start time
            const draftLog: OvertimeLog = {
              id: `log_${Date.now()}`,
              date: today, // Will be recalculated in modal when user enters start time
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
      }
    } catch (error) {
      debug.error('Error ending shift:', error);
      Alert.alert('Error', 'Failed to end shift. Please try again.');
    }
  };

  const handleCreateLog = () => {
    // Check if there's an active shift in progress
    const activeShift = getActiveShiftDraft();
    
    if (activeShift) {
      // Show warning modal asking user what they want to do
      setShowActiveShiftWarningModal(true);
    } else {
      // No active shift, proceed directly to create new log
      router.push('/log/new');
    }
  };

  const handleEditActiveShift = () => {
    const activeShift = getActiveShiftDraft();
    if (activeShift) {
      setShowActiveShiftWarningModal(false);
      router.push(`/log/${activeShift.id}`);
    }
  };

  const handleCreateNewLogAnyway = () => {
    setShowActiveShiftWarningModal(false);
    router.push('/log/new');
  };

  const draftLogs = getDraftLogs();
  const readyLogs = getReadyLogs();
  const pendingCount = draftLogs.length + readyLogs.length;
  
  // Filter out shift swaps from analytics - shift swaps shouldn't count as normal overtime
  const normalLogs = logs.filter(log => !log.isShiftSwap);

  // Check and schedule unexported logs notification when logs change
  useEffect(() => {
    if (hasProfile && isComplete) {
      const unexportedCount = draftLogs.length + readyLogs.length;
      notificationManager.checkAndScheduleUnexportedLogsNotification(unexportedCount).catch(err => {
        debug.error('Failed to check unexported logs notification:', err);
      });
    }
  }, [draftLogs.length, readyLogs.length, hasProfile, isComplete]);

  // Check and schedule incomplete draft reminders when logs change
  useEffect(() => {
    if (hasProfile && isComplete) {
      const draftLogsForNotification = draftLogs.map(log => ({
        id: log.id,
        date: log.date,
        createdAt: log.createdAt,
        isActiveShift: log.isActiveShift
      }));
      notificationManager.checkAndScheduleIncompleteDraftReminder(draftLogsForNotification).catch(err => {
        debug.error('Failed to check incomplete draft reminder:', err);
      });
    }
  }, [draftLogs.length, hasProfile, isComplete]);

  // Weekly summary notification is scheduled in app/_layout.tsx during app initialization
  // No need to schedule it here to avoid duplicate scheduling

  if (!hasProfile) {
    // Show welcome screen while profile loads
    return (
      <View style={[styles.welcomeContainer, isDark && styles.darkWelcomeContainer]}>
        <Text style={[styles.welcomeText, isDark && styles.darkWelcomeText]}>
          Welcome to Overtime+
        </Text>
      </View>
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
        {/* Header */}
        <Text style={[styles.title, isDark && styles.darkText]}>
          Home
        </Text>

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
                rosteredStart={todayRoster.rosteredStart}
                rosteredFinish={todayRoster.rosteredFinish}
                isLogged={hasLoggedToday}
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
              activeShiftDraft ? styles.resetButton : styles.startButton
            ]}
            onPress={activeShiftDraft ? handleResetActiveShift : handleStartShift}
          >
            <Text style={styles.actionButtonText}>
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

        {/* Create Log Button */}
        <TouchableOpacity 
          style={[styles.actionButton, styles.createLogButton]}
          onPress={handleCreateLog}
        >
          <Text style={styles.actionButtonText}>Create Log</Text>
        </TouchableOpacity>

        {/* Analytics & Recent Logs - Combined Container */}
        <View style={[styles.statsCard, isDark && styles.darkCard]}>
          <TouchableOpacity onPress={() => router.push('/analytics')} activeOpacity={0.7}>
            <Text style={[styles.statsTitle, isDark && styles.darkText, { marginBottom: 16 }]}>Analytics & Recent Logs</Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, isDark && styles.darkText]}>
                  {normalLogs.length}
                </Text>
                <Text style={[styles.statLabel, isDark && styles.darkText]}>
                  Total Logs
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, isDark && styles.darkText]}>
                  {formatMinutes(normalLogs.reduce((sum, log) => sum + log.minutesOvertime, 0))}
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
          </TouchableOpacity>

          {normalLogs.length > 0 && (
            <>
              <View style={[styles.divider, isDark && styles.darkDivider]} />
              
              {normalLogs.slice(0, 3).map((log) => (
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
            </>
          )}
        </View>
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

      {/* Active Shift Warning Modal */}
      <Modal
        visible={showActiveShiftWarningModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowActiveShiftWarningModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, isDark && styles.darkText]}>
              Active Shift in Progress
            </Text>
            <Text style={[styles.modalMessage, isDark && styles.darkText]}>
              You have an active shift in progress. Would you like to edit the current shift log or create a new log?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleEditActiveShift}
              >
                <Text style={styles.modalButtonPrimaryText}>Edit Active Shift</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, isDark && styles.darkModalButtonSecondary]}
                onPress={handleCreateNewLogAnyway}
              >
                <Text style={[styles.modalButtonSecondaryText, isDark && styles.darkModalButtonSecondaryText]}>
                  Create New Log
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowActiveShiftWarningModal(false)}
              >
                <Text style={[styles.modalButtonCancelText, isDark && styles.darkText]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
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
  resetButton: {
    backgroundColor: '#FF9800',
  },
  endButton: {
    backgroundColor: '#FF4444',
  },
  createLogButton: {
    backgroundColor: '#007AFF',
    marginBottom: 20,
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
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  darkDivider: {
    backgroundColor: '#333',
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
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkWelcomeContainer: {
    backgroundColor: '#007AFF',
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  darkWelcomeText: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  darkModalContent: {
    backgroundColor: '#1c1c1e',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    gap: 12,
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  modalButtonSecondary: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkModalButtonSecondary: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  darkModalButtonSecondaryText: {
    color: '#5ac8fa',
  },
  modalButtonCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
});
