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
import { useRouter } from 'expo-router';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { TimeInput } from '../../components/TimeInput';
import { CalendarPicker } from '../../components/CalendarPicker';
import { SharedTimePickerProvider } from '../../components/SharedTimePicker';
import { getCurrentDate, getCurrentTime } from '../../lib/time';
import { validateShift } from '../../lib/roster';
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

export default function NewShiftScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { addShift } = useShiftsStore();
  
  const [label, setLabel] = useState('');
  const [type, setType] = useState<'weekly' | 'biweekly' | 'custom'>('weekly');
  const [weekIndex, setWeekIndex] = useState<1 | 2>(1);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]); // Monday by default
  const [rosteredStart, setRosteredStart] = useState(getCurrentTime());
  const [rosteredFinish, setRosteredFinish] = useState('');
  const [mealBreakMinutes, setMealBreakMinutes] = useState(30);
  const [showMealBreakPicker, setShowMealBreakPicker] = useState(false);
  const [activeFrom, setActiveFrom] = useState(getCurrentDate());
  const [activeTo, setActiveTo] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    // Set finish time to 8 hours after start time by default
    if (rosteredStart && !rosteredFinish) {
      const startMinutes = parseInt(rosteredStart.split(':')[0]) * 60 + parseInt(rosteredStart.split(':')[1]);
      const finishMinutes = startMinutes + (8 * 60); // 8 hours later
      
      // Handle overnight shifts (finish time next day)
      const finishHours = finishMinutes >= 24 * 60 ? Math.floor(finishMinutes / 60) - 24 : Math.floor(finishMinutes / 60);
      const finishMins = finishMinutes % 60;
      
      setRosteredFinish(`${finishHours.toString().padStart(2, '0')}:${finishMins.toString().padStart(2, '0')}`);
    }
  }, [rosteredStart]);

  const validateForm = () => {
    if (selectedDays.length === 0) {
      setValidationErrors(['Please select at least one day of the week']);
      return false;
    }

    // Validate each selected day
    for (const dayOfWeek of selectedDays) {
      const shift: UsualShift = {
        id: '', // Will be generated
        label,
        type,
        weekIndex: type === 'biweekly' ? weekIndex : undefined,
        dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        rosteredStart,
        rosteredFinish,
        mealBreakMinutes: mealBreakMinutes || undefined,
        activeFrom,
        activeTo: activeTo || undefined,
      };

      const errors = validateShift(shift);
      if (errors.length > 0) {
        setValidationErrors(errors);
        return false;
      }
    }

    setValidationErrors([]);
    return true;
  };

  const handleSave = async () => {
    console.log('💾 NewShiftScreen: Save button pressed');
    console.log('📝 NewShiftScreen: Form data:', {
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
      console.log('❌ NewShiftScreen: Validation failed:', validationErrors);
      Alert.alert('Validation Error', validationErrors.join('\n'));
      return;
    }

    try {
      console.log('🔄 NewShiftScreen: Creating shifts for days:', selectedDays);
      // Create a separate shift for each selected day
      const shiftPromises = selectedDays.map((dayOfWeek, index) => {
        const shift: UsualShift = {
          id: `shift_${Date.now()}_${index}`,
          label: selectedDays.length > 1 ? `${label} (${DAYS_OF_WEEK[dayOfWeek].label})` : label,
          type,
          weekIndex: type === 'biweekly' ? weekIndex : undefined,
          dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          rosteredStart,
          rosteredFinish,
          mealBreakMinutes: mealBreakMinutes || undefined,
          activeFrom,
          activeTo: activeTo || undefined,
        };
        console.log(`➕ NewShiftScreen: Creating shift ${index + 1}/${selectedDays.length}:`, {
          id: shift.id,
          label: shift.label,
          day: shift.dayOfWeek,
          type: shift.type
        });
        return addShift(shift);
      });

      await Promise.all(shiftPromises);
      console.log('✅ NewShiftScreen: All shifts created successfully');
      
      Alert.alert(
        'Success',
        `Created ${selectedDays.length} shift pattern${selectedDays.length > 1 ? 's' : ''} successfully!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('❌ NewShiftScreen: Failed to create shifts:', error);
      Alert.alert('Error', 'Failed to create shift patterns. Please try again.');
    }
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
        Days of Week
      </Text>
      <Text style={[styles.sectionSubtitle, isDark && styles.darkText]}>
        Select all days this shift applies to
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
              if (selectedDays.includes(day.value)) {
                setSelectedDays(selectedDays.filter(d => d !== day.value));
              } else {
                setSelectedDays([...selectedDays, day.value]);
              }
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
      {selectedDays.length === 0 && (
        <Text style={[styles.errorText, isDark && styles.darkErrorText]}>
          Please select at least one day
        </Text>
      )}
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
            inputId="shift-rostered-start"
          />
        </View>
        <View style={styles.timeInput}>
          <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
          <TimeInput
            value={rosteredFinish}
            onChange={setRosteredFinish}
            placeholder="Select finish time"
            inputId="shift-rostered-finish"
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
        Give this shift pattern a name (e.g., "Morning Shift", "Weekend")
      </Text>
      <TouchableOpacity
        style={[styles.labelButton, isDark && styles.darkInput]}
        onPress={() => {
          // TODO: Implement text input modal
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
            style={[styles.button, styles.cancelButton]}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save Shift</Text>
          </TouchableOpacity>
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
  darkErrorText: {
    color: '#ff6b6b',
  },
  errorText: {
    fontSize: 12,
    color: '#d32f2f',
    marginTop: 8,
    fontStyle: 'italic',
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
    padding: 10,
    backgroundColor: '#fff',
    minHeight: 44,
    justifyContent: 'center',
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
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
