import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { useShiftTemplatesStore } from '../../lib/state/shiftTemplatesStore';
import { useAuthStore } from '../../lib/state/authStore';
import { TimeInput } from '../../components/TimeInput';
import { CalendarPicker } from '../../components/CalendarPicker';
import { SharedTimePickerProvider } from '../../components/SharedTimePicker';
import { getCurrentDate, getCurrentTime } from '../../lib/time';
import { UsualShift, ShiftTemplate } from '../../types';
import { getWeekIndex } from '../../lib/roster';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('QuickAddShift');

type QuickShiftEntry = {
  id: string;
  date: string;
  startTime: string;
  finishTime: string;
  mealBreakMinutes: number;
  repeatType: 'never' | 'weekly' | 'biweekly';
};

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export default function QuickAddShiftScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { addShift } = useShiftsStore();
  const { templates, loadTemplates } = useShiftTemplatesStore();
  const { user } = useAuthStore();
  
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  const [startTime, setStartTime] = useState(getCurrentTime());
  const [finishTime, setFinishTime] = useState('');
  const [repeatType, setRepeatType] = useState<'never' | 'weekly' | 'biweekly'>('never');
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ShiftTemplate | null>(null);
  const [addedShifts, setAddedShifts] = useState<QuickShiftEntry[]>([]);

  useEffect(() => {
    loadTemplates(user?.id);
  }, [user?.id, loadTemplates]);

  // Validate date is today or future
  const isDateValid = (date: string): boolean => {
    const today = getCurrentDate();
    return date >= today;
  };

  // Validate form
  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!selectedDate) {
      errors.push('Please select a date');
    } else if (!isDateValid(selectedDate)) {
      errors.push('Date must be today or in the future');
    }
    
    if (!startTime) {
      errors.push('Please enter start time');
    }
    
    if (!finishTime) {
      errors.push('Please enter finish time');
    }
    
    if (addedShifts.length >= 7) {
      errors.push('Maximum 7 shifts allowed per session');
    }
    
    return errors;
  };

  // Handle template selection
  const handleTemplateSelect = (template: ShiftTemplate) => {
    setSelectedTemplate(template);
    setStartTime(template.rosteredStart);
    setFinishTime(template.rosteredFinish);
  };

  // Generate label for shift
  const generateLabel = (entry: QuickShiftEntry): string => {
    const date = new Date(entry.date + 'T00:00:00');
    const dayName = DAYS_OF_WEEK[date.getDay()];
    const timeStr = `${entry.startTime} - ${entry.finishTime}`;
    
    if (entry.repeatType === 'never') {
      return `${dayName} ${timeStr}`;
    } else if (entry.repeatType === 'weekly') {
      return `${dayName} ${timeStr}`;
    } else {
      return `${dayName} ${timeStr} (biweekly)`;
    }
  };

  // Add shift to list
  const handleAddShift = () => {
    const errors = validateForm();
    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }

    if (!isDateValid(selectedDate)) {
      Alert.alert('Invalid Date', 'Date must be today or in the future');
      return;
    }

    const newEntry: QuickShiftEntry = {
      id: `quick_${Date.now()}_${Math.random()}`,
      date: selectedDate,
      startTime,
      finishTime,
      mealBreakMinutes: 30, // Default 30 minutes
      repeatType,
    };

    setAddedShifts([...addedShifts, newEntry]);
    
    // Clear form but keep date
    setStartTime(getCurrentTime());
    setFinishTime('');
    setSelectedTemplate(null);
    setRepeatType('never');
    
    debug.debug('Shift added to list:', newEntry);
  };

  // Remove shift from list
  const handleRemoveShift = (id: string) => {
    setAddedShifts(addedShifts.filter(shift => shift.id !== id));
  };

  // Save all shifts
  const handleSave = async () => {
    if (addedShifts.length === 0) {
      Alert.alert('No Shifts', 'Please add at least one shift before saving');
      return;
    }

    try {
      const shiftPromises = addedShifts.map(entry => {
        const date = new Date(entry.date + 'T00:00:00');
        const dayOfWeek = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
        
        let shiftType: 'custom' | 'weekly' | 'biweekly';
        let weekIndex: 1 | 2 | undefined;
        let activeTo: string | undefined;

        if (entry.repeatType === 'never') {
          shiftType = 'custom';
          activeTo = entry.date; // One-time only
        } else if (entry.repeatType === 'weekly') {
          shiftType = 'weekly';
          activeTo = undefined; // No end date
        } else {
          shiftType = 'biweekly';
          weekIndex = getWeekIndex(date);
          activeTo = undefined; // No end date
        }

        const shift: UsualShift = {
          id: `shift_${Date.now()}_${Math.random()}`,
          label: generateLabel(entry),
          type: shiftType,
          weekIndex,
          dayOfWeek,
          rosteredStart: entry.startTime,
          rosteredFinish: entry.finishTime,
          mealBreakMinutes: entry.mealBreakMinutes,
          activeFrom: entry.date,
          activeTo,
        };

        return addShift(shift, user?.id);
      });

      await Promise.all(shiftPromises);
      
      debug.debug('All shifts saved successfully');
      Alert.alert(
        'Success',
        `${addedShifts.length} shift${addedShifts.length > 1 ? 's' : ''} saved successfully`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      debug.error('Failed to save shifts:', error);
      Alert.alert('Error', 'Failed to save shifts. Please try again.');
    }
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <SharedTimePickerProvider>
      <View style={[styles.container, isDark && styles.darkContainer]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
            <Text style={[styles.title, isDark && styles.darkText]}>Quick Shift</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Template Selection */}
          {templates.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Templates
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.templateContainer}
              >
                {templates.map(template => (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.templatePill,
                      isDark && styles.darkTemplatePill,
                      selectedTemplate?.id === template.id && styles.selectedTemplatePill,
                    ]}
                    onPress={() => handleTemplateSelect(template)}
                  >
                    <Text
                      style={[
                        styles.templateLabel,
                        isDark && styles.darkText,
                        selectedTemplate?.id === template.id && styles.selectedTemplateText,
                      ]}
                      numberOfLines={1}
                    >
                      {template.label}
                    </Text>
                    <Text
                      style={[
                        styles.templateTime,
                        isDark && styles.darkDescription,
                        selectedTemplate?.id === template.id && styles.selectedTemplateTime,
                      ]}
                    >
                      {template.rosteredStart} - {template.rosteredFinish}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Date Picker */}
          <View style={styles.section}>
            <Text style={[styles.label, isDark && styles.darkText]}>Date</Text>
            <CalendarPicker
              value={selectedDate}
              onChange={(date) => {
                if (isDateValid(date)) {
                  setSelectedDate(date);
                } else {
                  Alert.alert('Invalid Date', 'Please select today or a future date');
                }
              }}
              placeholder="Select date"
              minDate={getCurrentDate()}
            />
          </View>

          {/* Time Inputs */}
          <View style={styles.section}>
            <Text style={[styles.label, isDark && styles.darkText]}>Start Time</Text>
            <TimeInput
              value={startTime}
              onChange={setStartTime}
              placeholder="HH:mm"
              inputId="quick-add-start-time"
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, isDark && styles.darkText]}>Finish Time</Text>
            <TimeInput
              value={finishTime}
              onChange={setFinishTime}
              placeholder="HH:mm"
              inputId="quick-add-finish-time"
            />
          </View>

          {/* Repeat Selector */}
          <View style={styles.section}>
            <View style={[styles.repeatInputContainer, isDark && styles.darkRepeatInputContainer]}>
              <View style={styles.repeatContainer}>
                <View style={styles.repeatLabelContainer}>
                  <Ionicons
                    name="repeat-outline"
                    size={18}
                    color={isDark ? '#fff' : '#333'}
                  />
                  <Text style={[styles.repeatLabel, isDark && styles.darkText]}>Repeat</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.repeatSwitch,
                    isDark && styles.darkRepeatSwitch,
                    repeatType !== 'never' && styles.repeatSwitchActive,
                  ]}
                  onPress={() => {
                    if (repeatType === 'never') {
                      // Turn on - open picker to select type
                      setShowRepeatPicker(true);
                    } else {
                      // Turn off - set to never
                      setRepeatType('never');
                    }
                  }}
                >
                  <View
                    style={[
                      styles.repeatSwitchThumb,
                      repeatType !== 'never' && styles.repeatSwitchThumbActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>
            {repeatType !== 'never' && (
              <TouchableOpacity
                style={[
                  styles.repeatTypeButton,
                  isDark && styles.darkRepeatTypeButton,
                ]}
                onPress={() => setShowRepeatPicker(true)}
              >
                <Text style={[styles.repeatTypeButtonText, isDark && styles.darkText]}>
                  {repeatType === 'weekly' ? 'Weekly' : 'Biweekly'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={isDark ? '#fff' : '#333'} />
              </TouchableOpacity>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            {addedShifts.length > 0 ? (
              <View style={styles.twoButtonRow}>
                <TouchableOpacity
                  style={[styles.addAnotherButton, isDark && styles.darkAddAnotherButton]}
                  onPress={handleAddShift}
                >
                  <Ionicons name="add" size={20} color={isDark ? '#fff' : '#007AFF'} />
                  <Text style={[styles.addAnotherButtonText, isDark && styles.darkAddAnotherButtonText]}>
                    Add Another
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, isDark && styles.darkSaveButton]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveButtonText}>
                    Save & Exit
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addButton, isDark && styles.darkAddButton]}
                onPress={handleAddShift}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add Shift</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Added Shifts List */}
          {addedShifts.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Added Shifts ({addedShifts.length}/7)
              </Text>
              {addedShifts.map(shift => (
                <View
                  key={shift.id}
                  style={[styles.addedShiftCard, isDark && styles.darkAddedShiftCard]}
                >
                  <View style={styles.addedShiftInfo}>
                    <Text style={[styles.addedShiftDate, isDark && styles.darkText]}>
                      {formatDate(shift.date)}
                    </Text>
                    <Text style={[styles.addedShiftTime, isDark && styles.darkDescription]}>
                      {shift.startTime} - {shift.finishTime}
                    </Text>
                    {shift.repeatType !== 'never' && (
                      <Text style={[styles.addedShiftRepeat, isDark && styles.darkDescription]}>
                        {shift.repeatType === 'weekly' ? 'Weekly' : 'Biweekly'}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveShift(shift.id)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Repeat Picker Modal */}
        <Modal
          visible={showRepeatPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowRepeatPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowRepeatPicker(false)}
          >
            <View
              style={[styles.modalContent, isDark && styles.darkModalContent]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.modalTitle, isDark && styles.darkText]}>
                Repeat Pattern
              </Text>
              {(['never', 'weekly', 'biweekly'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.modalOption,
                    repeatType === type && styles.modalOptionActive,
                  ]}
                  onPress={() => {
                    setRepeatType(type);
                    setShowRepeatPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isDark && styles.darkText,
                      repeatType === type && styles.modalOptionTextActive,
                    ]}
                  >
                    {type === 'never' ? 'Never' : type === 'weekly' ? 'Weekly' : 'Biweekly'}
                  </Text>
                  {repeatType === type && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SharedTimePickerProvider>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: 8,
  },
  backButton: {
    padding: 4,
  },
  placeholder: {
    width: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  darkDescription: {
    color: '#a0a0a0',
  },
  templateContainer: {
    gap: 8,
    paddingRight: 16,
  },
  templatePill: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 120,
  },
  darkTemplatePill: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
  },
  selectedTemplatePill: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  templateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  selectedTemplateText: {
    color: '#fff',
  },
  templateTime: {
    fontSize: 12,
    color: '#666',
  },
  selectedTemplateTime: {
    color: '#fff',
    opacity: 0.9,
  },
  repeatInputContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkRepeatInputContainer: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  repeatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  repeatLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repeatLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  repeatSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    padding: 2,
    justifyContent: 'center',
  },
  darkRepeatSwitch: {
    backgroundColor: '#333',
  },
  repeatSwitchActive: {
    backgroundColor: '#007AFF',
  },
  repeatSwitchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  repeatSwitchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  repeatTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  darkRepeatTypeButton: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
  },
  repeatTypeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  actionButtonsContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  twoButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
  },
  darkAddButton: {
    backgroundColor: '#007AFF',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
    flex: 1,
  },
  darkAddAnotherButton: {
    backgroundColor: '#1c1c1e',
    borderColor: '#007AFF',
  },
  addAnotherButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  darkAddAnotherButtonText: {
    color: '#007AFF',
  },
  addedShiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  darkAddedShiftCard: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
  },
  addedShiftInfo: {
    flex: 1,
  },
  addedShiftDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  addedShiftTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  addedShiftRepeat: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  removeButton: {
    padding: 4,
  },
  saveButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
  },
  darkSaveButton: {
    backgroundColor: '#34C759',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  darkModalContent: {
    backgroundColor: '#1c1c1e',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalOptionActive: {
    backgroundColor: '#E3F2FD',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

