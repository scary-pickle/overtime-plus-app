import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  useColorScheme,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLogsStore } from '../../lib/state/logsStore';
import { useProfileStore } from '../../lib/state/profileStore';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { getCurrentTime, getCurrentDate } from '../../lib/time';
import { QuickEndShiftModal } from '../../components/QuickEndShiftModal';
import { updateWidgetStatus } from '../../lib/widget/widgetStatusUpdater';
import { OvertimeLog } from '../../types';

export default function WidgetConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ action: 'start-shift' | 'end-shift' }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile, loadProfile, initials } = useProfileStore();
  const { shifts, getRosterFor, loadShifts } = useShiftsStore();
  const { addLog, getActiveShiftDraft, loadLogs } = useLogsStore();
  const [showEndModal, setShowEndModal] = useState(false);
  const [endShiftDraft, setEndShiftDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const action = params.action || 'start-shift';

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([loadProfile(), loadShifts(), loadLogs()]);
      if (action === 'end-shift') {
        loadActiveShift();
      } else {
        setLoading(false);
      }
    };
    initialize();
  }, [action]);

  const loadActiveShift = async () => {
    try {
      // Ensure logs are loaded
      await loadLogs();
      const activeShift = getActiveShiftDraft();
      if (activeShift) {
        setEndShiftDraft(activeShift);
      } else {
        Alert.alert(
          'No Active Shift',
          'There is no active shift to end.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }
    } catch (error) {
      console.error('Error loading active shift:', error);
      Alert.alert(
        'Error',
        'Failed to load shift information.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (action === 'start-shift') {
      await handleStartShift();
    } else if (action === 'end-shift' && endShiftDraft) {
      setShowEndModal(true);
    }
  };

  const handleStartShift = async () => {
    if (!profile) {
      Alert.alert(
        'Profile Required',
        'Please complete your profile before logging overtime.',
        [{ text: 'OK', onPress: () => router.push('/(tabs)/profile') }]
      );
      return;
    }

    try {
      const today = getCurrentDate();
      const currentActualTime = getCurrentTime();
      const roster = getRosterFor(today);
      const logInitials = initials || profile?.employeeInitial || '';

      const draftLog: OvertimeLog = {
        id: `log_${Date.now()}`,
        date: today,
        rosteredStart: roster?.rosteredStart,
        rosteredFinish: roster?.rosteredFinish,
        actualStart: currentActualTime,
        actualFinish: 'N/A',
        mealBreakMinutes: roster?.mealBreakMinutes || 30,
        minutesOvertime: 0,
        category: 'Overtime',
        initials: logInitials,
        status: 'draft',
        isActiveShift: true,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addLog(draftLog);
      
      // Update widget status
      await updateWidgetStatus();

      const message = roster 
        ? `Shift started at ${currentActualTime}` 
        : `Shift started at ${currentActualTime} (no roster found)`;

      Alert.alert(
        'Shift Started',
        message,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/(tabs)/home');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error starting shift:', error);
      Alert.alert('Error', 'Failed to start shift. Please try again.');
    }
  };

  const handleEndShiftComplete = () => {
    setShowEndModal(false);
    router.replace('/(tabs)/home');
  };

  const handleCancel = () => {
    router.replace('/(tabs)/home');
  };

  if (loading) {
    return (
      <Modal visible={true} transparent animationType="fade">
        <View style={[styles.modalOverlay, isDark && styles.darkOverlay]}>
          <View style={[styles.modalContent, isDark && styles.darkModalContent]}>
            <Text style={[styles.loadingText, isDark && styles.darkText]}>
              Loading...
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (!profile) {
    return (
      <Modal visible={true} transparent animationType="fade">
        <View style={[styles.modalOverlay, isDark && styles.darkOverlay]}>
          <View style={[styles.modalContent, isDark && styles.darkModalContent]}>
            <Text style={[styles.title, isDark && styles.darkText]}>
              Profile Required
            </Text>
            <Text style={[styles.message, isDark && styles.darkText]}>
              Please complete your profile before using widgets.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => {
                router.replace('/(tabs)/profile');
              }}
            >
              <Text style={styles.buttonText}>Go to Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <>
      <Modal visible={true} transparent animationType="fade">
        <View style={[styles.modalOverlay, isDark && styles.darkOverlay]}>
          <View style={[styles.modalContent, isDark && styles.darkModalContent]}>
            <Text style={[styles.title, isDark && styles.darkText]}>
              {action === 'start-shift' ? 'Start Shift?' : 'End Shift?'}
            </Text>
            
            <Text style={[styles.message, isDark && styles.darkText]}>
              {action === 'start-shift'
                ? `Shift will start at ${getCurrentTime()}`
                : endShiftDraft
                ? `Shift started at ${endShiftDraft.actualStart || 'N/A'}. Finish at ${getCurrentTime()}?`
                : 'Finish current shift?'}
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, isDark && styles.darkCancelButton]}
                onPress={handleCancel}
              >
                <Text style={[styles.cancelButtonText, isDark && styles.darkText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>
                  {action === 'start-shift' ? 'Start' : 'End'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showEndModal && endShiftDraft && (
        <QuickEndShiftModal
          visible={showEndModal}
          draftLog={endShiftDraft}
          noRosterMode={true}
          onClose={() => setShowEndModal(false)}
          onComplete={handleEndShiftComplete}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  darkOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  darkModalContent: {
    backgroundColor: '#1c1c1e',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  darkText: {
    color: '#fff',
  },
  message: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkCancelButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#4a4a4c',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

