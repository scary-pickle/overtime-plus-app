import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { TimeInput } from '../../components/TimeInput';
import { CalendarPicker } from '../../components/CalendarPicker';
import { SharedTimePickerProvider } from '../../components/SharedTimePicker';
import { validateShift } from '../../lib/roster';
import { getPreviousISODate } from '../../lib/time';
import { UsualShift } from '../../types';

const SHIFT_TYPES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'custom', label: 'Custom' },
] as const;

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

const WEEK_INDEXES = [
  { value: 1, label: 'Week 1' },
  { value: 2, label: 'Week 2' },
] as const;

export default function EditShiftScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { shifts, updateShift, deleteShift, addShift } = useShiftsStore();
  
  const [shift, setShift] = useState<UsualShift | null>(null);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<'weekly' | 'biweekly' | 'custom'>('weekly');
  const [weekIndex, setWeekIndex] = useState<1 | 2>(1);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [rosteredStart, setRosteredStart] = useState('');
  const [rosteredFinish, setRosteredFinish] = useState('');
  const [mealBreakMinutes, setMealBreakMinutes] = useState(0);
  const [showMealBreakPicker, setShowMealBreakPicker] = useState(false);
  const [activeFrom, setActiveFrom] = useState('');
  const [activeTo, setActiveTo] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      const foundShift = shifts.find(s => s.id === id);
      if (foundShift) {
        setShift(foundShift);
        setLabel(foundShift.label);
        setType(foundShift.type);
        setWeekIndex(foundShift.weekIndex || 1);
        setSelectedDays([foundShift.dayOfWeek]);
        setRosteredStart(foundShift.rosteredStart);
        setRosteredFinish(foundShift.rosteredFinish);
        setMealBreakMinutes(foundShift.mealBreakMinutes || 0);
        setActiveFrom(foundShift.activeFrom);
        setActiveTo(foundShift.activeTo || '');
      } else {
        Alert.alert('Error', 'Shift not found', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    }
  }, [id, shifts]);

  const validateForm = () => {
    if (selectedDays.length === 0) {
      setValidationErrors(['Please select at least one day of the week']);
      return false;
    }

    // For editing, we only validate the first selected day since we're editing a single shift
    const shiftData: UsualShift = {
      id: id || '',
      label,
      type,
      weekIndex: type === 'biweekly' ? weekIndex : undefined,
      dayOfWeek: selectedDays[0] as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      rosteredStart,
      rosteredFinish,
      mealBreakMinutes: mealBreakMinutes || undefined,
      activeFrom,
      activeTo: activeTo || undefined,
    };

    const errors = validateShift(shiftData);
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleUpdate = async () => {
    if (!shift) return;

    console.log('💾 EditShiftScreen: Update button pressed');
    console.log('📝 EditShiftScreen: Form data:', {
      id: shift.id,
      label,
      type,
      selectedDays,
      rosteredStart,
      rosteredFinish,
      mealBreakMinutes,
      activeFrom,
      activeTo
    });

    if (!validateForm()) {
      console.log('❌ EditShiftScreen: Validation failed:', validationErrors);
      Alert.alert('Validation Error', validationErrors.join('\n'));
      return;
    }

    const updatedShift: UsualShift = {
      ...shift,
      label,
      type,
      weekIndex: type === 'biweekly' ? weekIndex : undefined,
      dayOfWeek: selectedDays[0] as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      rosteredStart,
      rosteredFinish,
      mealBreakMinutes: mealBreakMinutes || undefined,
      activeFrom,
      activeTo: activeTo || undefined,
    };

    try {
      console.log('🔄 EditShiftScreen: Updating shift:', {
        id: updatedShift.id,
        label: updatedShift.label,
        day: updatedShift.dayOfWeek,
        type: updatedShift.type
      });
      await updateShift(updatedShift);
      console.log('✅ EditShiftScreen: Shift updated successfully');
      Alert.alert(
        'Success',
        'Shift pattern updated successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('❌ EditShiftScreen: Failed to update shift:', error);
      Alert.alert('Error', 'Failed to update shift pattern. Please try again.');
    }
  };

  const handleUpdateFuture = async () => {
    if (!shift) return;

    console.log('💾 EditShiftScreen: Update Future button pressed');
    console.log('📝 EditShiftScreen: Form data:', {
      id: shift.id,
      label,
      type,
      selectedDays,
      rosteredStart,
      rosteredFinish,
      mealBreakMinutes,
      activeFrom,
      activeTo
    });

    if (!validateForm()) {
      console.log('❌ EditShiftScreen: Validation failed:', validationErrors);
      Alert.alert('Validation Error', validationErrors.join('\n'));
      return;
    }

    // Use activeFrom as effective date, default to today if empty
    const effectiveFrom = activeFrom || new Date().toISOString().split('T')[0];
    
    // Check if effective date is valid
    if (shift.activeFrom > effectiveFrom) {
      Alert.alert(
        'Invalid Date',
        'The effective date cannot be before the original shift start date. Please choose a date on or after the original start date.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Calculate previous day for the split
    const previousDay = getPreviousISODate(effectiveFrom);
    
    // Handle edge case where previous day is before original activeFrom
    const splitDate = previousDay < shift.activeFrom ? shift.activeFrom : previousDay;

    // Show confirmation dialog
    Alert.alert(
      'Update Future Shifts',
      `This will update the shift pattern starting from ${effectiveFrom}.\n\nAll future occurrences will use the new times:\n• Start: ${rosteredStart}\n• Finish: ${rosteredFinish}\n• Meal Break: ${mealBreakMinutes} minutes\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update Future',
          onPress: async () => {
            try {
              console.log('🔄 EditShiftScreen: Updating shift series:', {
                originalId: shift.id,
                effectiveFrom,
                splitDate
              });

              // 1) Update existing record's activeTo
              const updatedShift: UsualShift = {
                ...shift,
                activeTo: splitDate,
              };
              await updateShift(updatedShift);

              // 2) Create new record for future with new times
              const newShift: UsualShift = {
                id: crypto.randomUUID(),
                label,
                type,
                weekIndex: type === 'biweekly' ? weekIndex : undefined,
                dayOfWeek: selectedDays[0] as 0 | 1 | 2 | 3 | 4 | 5 | 6,
                rosteredStart,
                rosteredFinish,
                mealBreakMinutes: mealBreakMinutes || 0,
                activeFrom: effectiveFrom,
                activeTo: shift.activeTo, // Preserve original end date
              };
              await addShift(newShift);

              console.log('✅ EditShiftScreen: Shift series updated successfully');
              Alert.alert(
                'Success',
                'Updated this shift and all future occurrences successfully!',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error) {
              console.error('❌ EditShiftScreen: Failed to update shift series:', error);
              Alert.alert('Error', 'Failed to update shift series. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!shift) return;

    console.log('🗑️ EditShiftScreen: Delete button pressed for shift:', {
      id: shift.id,
      label: shift.label,
      day: shift.dayOfWeek
    });

    Alert.alert(
      'Delete Shift',
      'Are you sure you want to delete this shift pattern? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔄 EditShiftScreen: Confirming delete for shift:', shift.id);
              await deleteShift(shift.id);
              console.log('✅ EditShiftScreen: Shift deleted successfully');
              Alert.alert(
                'Success',
                'Shift pattern deleted successfully!',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error) {
              console.error('❌ EditShiftScreen: Failed to delete shift:', error);
              Alert.alert('Error', 'Failed to delete shift pattern. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderTypeSelector = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
        Shift Type
      </Text>
      <View style={styles.typeContainer}>
        {SHIFT_TYPES.map((shiftType) => (
          <TouchableOpacity
            key={shiftType.value}
            style={[
              styles.typeButton,
              type === shiftType.value && styles.selectedTypeButton,
              isDark && styles.darkTypeButton,
            ]}
            onPress={() => setType(shiftType.value)}
          >
            <Text
              style={[
                styles.typeButtonText,
                type === shiftType.value && styles.selectedTypeButtonText,
                isDark && styles.darkTypeButtonText,
              ]}
            >
              {shiftType.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderWeekIndexSelector = () => {
    if (type !== 'biweekly') return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
          Week Index
        </Text>
        <View style={styles.weekIndexContainer}>
          {WEEK_INDEXES.map((week) => (
            <TouchableOpacity
              key={week.value}
              style={[
                styles.weekIndexButton,
                weekIndex === week.value && styles.selectedWeekIndexButton,
                isDark && styles.darkWeekIndexButton,
              ]}
              onPress={() => setWeekIndex(week.value)}
            >
              <Text
                style={[
                  styles.weekIndexButtonText,
                  weekIndex === week.value && styles.selectedWeekIndexButtonText,
                  isDark && styles.darkWeekIndexButtonText,
                ]}
              >
                {week.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderDaySelector = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
        Day of Week
      </Text>
      <Text style={[styles.sectionSubtitle, isDark && styles.darkText]}>
        This shift is for {DAYS_OF_WEEK[selectedDays[0]]?.label || 'Unknown'}
      </Text>
      <View style={styles.dayContainer}>
        {DAYS_OF_WEEK.map((day) => (
          <TouchableOpacity
            key={day.value}
            style={[
              styles.dayButton,
              selectedDays.includes(day.value) && styles.selectedDayButton,
              isDark && styles.darkDayButton,
            ]}
            onPress={() => {
              // For editing, we only allow changing to a single day
              setSelectedDays([day.value]);
            }}
          >
            <Text
              style={[
                styles.dayButtonText,
                selectedDays.includes(day.value) && styles.selectedDayButtonText,
                isDark && styles.darkDayButtonText,
              ]}
            >
              {day.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTimeInputs = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
        Rostered Times
      </Text>
      <View style={styles.timeRow}>
        <View style={styles.timeInput}>
          <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
          <TimeInput
            value={rosteredStart}
            onChange={setRosteredStart}
            placeholder="Select start time"
            inputId="edit-shift-rostered-start"
          />
        </View>
        <View style={styles.timeInput}>
          <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
          <TimeInput
            value={rosteredFinish}
            onChange={setRosteredFinish}
            placeholder="Select finish time"
            inputId="edit-shift-rostered-finish"
          />
        </View>
      </View>
    </View>
  );

  const renderMealBreak = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
        Meal Break (minutes)
      </Text>
      <TouchableOpacity
        style={[styles.mealBreakButton, isDark && styles.darkInput]}
        onPress={() => setShowMealBreakPicker(!showMealBreakPicker)}
      >
        <Text style={[styles.mealBreakText, isDark && styles.darkText]}>
          {mealBreakMinutes} minutes
        </Text>
      </TouchableOpacity>
      
      {showMealBreakPicker && (
        <View style={[styles.mealBreakPickerContainer, isDark && styles.darkPickerContainer]}>
          {[0, 15, 30, 45, 60].map((minutes) => (
            <TouchableOpacity
              key={minutes}
              style={[
                styles.mealBreakOption,
                mealBreakMinutes === minutes && styles.selectedMealBreakOption,
                isDark && styles.darkMealBreakOption,
              ]}
              onPress={() => {
                setMealBreakMinutes(minutes);
                setShowMealBreakPicker(false);
              }}
            >
              <Text style={[
                styles.mealBreakOptionText,
                mealBreakMinutes === minutes && styles.selectedMealBreakOptionText,
                isDark && styles.darkText,
              ]}>
                {minutes} minutes
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderDateRange = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
        Active Date Range
      </Text>
      
      <View style={styles.dateRow}>
        <View style={styles.dateInput}>
          <Text style={[styles.dateLabel, isDark && styles.darkText]}>From</Text>
          <CalendarPicker
            value={activeFrom}
            onChange={setActiveFrom}
            placeholder="Select start date"
          />
        </View>
        
        <View style={styles.dateInput}>
          <Text style={[styles.dateLabel, isDark && styles.darkText]}>To (Optional)</Text>
          <CalendarPicker
            value={activeTo}
            onChange={setActiveTo}
            placeholder="Select end date"
          />
        </View>
      </View>
    </View>
  );

  const renderLabelInput = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
        Label
      </Text>
      <Text style={[styles.sectionSubtitle, isDark && styles.darkText]}>
        Give this shift pattern a name
      </Text>
      <TouchableOpacity
        style={[styles.labelButton, isDark && styles.darkInput]}
        onPress={() => {
          Alert.prompt(
            'Shift Label',
            'Enter a name for this shift pattern:',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'OK', onPress: (text?: string) => setLabel(text || '') }
            ],
            'plain-text',
            label
          );
        }}
      >
        <Text style={[styles.labelText, isDark && styles.darkText]}>
          {label || 'Enter shift label...'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (!shift) {
    return (
      <View style={[styles.container, styles.loadingContainer, isDark && styles.darkContainer]}>
        <Text style={[styles.loadingText, isDark && styles.darkText]}>Loading...</Text>
      </View>
    );
  }

  return (
    <SharedTimePickerProvider>
      <ScrollView style={[styles.container, isDark && styles.darkContainer]}>
        <View style={styles.content}>
        {/* Label */}
        {renderLabelInput()}

        {/* Shift Type */}
        {renderTypeSelector()}

        {/* Week Index (for biweekly) */}
        {renderWeekIndexSelector()}

        {/* Day of Week */}
        {renderDaySelector()}

        {/* Rostered Times */}
        {renderTimeInputs()}

        {/* Meal Break */}
        {renderMealBreak()}

        {/* Date Range */}
        {renderDateRange()}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.updateButton]}
            onPress={handleUpdate}
          >
            <Text style={styles.updateButtonText}>Update</Text>
          </TouchableOpacity>
          
          {/* Only show future update button for weekly and biweekly shifts */}
          {(type === 'weekly' || type === 'biweekly') && (
            <TouchableOpacity
              style={[styles.button, styles.updateFutureButton]}
              onPress={handleUpdateFuture}
            >
              <Text style={styles.updateFutureButtonText}>Update This & Future Shifts</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    padding: 12,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  darkText: {
    color: '#fff',
  },
  
  // Type selector
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedTypeButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  darkTypeButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedTypeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  darkTypeButtonText: {
    color: '#999',
  },

  // Week index selector
  weekIndexContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  weekIndexButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  selectedWeekIndexButton: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  darkWeekIndexButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  weekIndexButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedWeekIndexButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  darkWeekIndexButtonText: {
    color: '#999',
  },

  // Day selector
  dayContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedDayButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  darkDayButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  dayButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  selectedDayButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  darkDayButtonText: {
    color: '#999',
  },

  // Time inputs
  timeRow: {
    gap: 8,
  },
  timeInput: {
    width: '100%',
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },

  // Meal break
  mealBreakButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  darkInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  mealBreakText: {
    fontSize: 16,
    color: '#333',
  },
  mealBreakPickerContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkPickerContainer: {
    backgroundColor: '#1c1c1e',
  },
  mealBreakOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkMealBreakOption: {
    borderBottomColor: '#2c2c2e',
  },
  selectedMealBreakOption: {
    backgroundColor: '#007AFF',
  },
  mealBreakOptionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedMealBreakOptionText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Date range
  dateRow: {
    gap: 12,
  },
  dateInput: {
    width: '100%',
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },

  // Label input
  labelButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  labelText: {
    fontSize: 16,
    color: '#333',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  updateFutureButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButtonText: {
    color: '#d32f2f',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  updateFutureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
