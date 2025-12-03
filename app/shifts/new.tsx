import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { useShiftTemplatesStore } from '../../lib/state/shiftTemplatesStore';
import { useAuthStore } from '../../lib/state/authStore';
import { TimeInput } from '../../components/TimeInput';
import { CalendarPicker } from '../../components/CalendarPicker';
import { SharedTimePickerProvider } from '../../components/SharedTimePicker';
import { TextInputModal } from '../../components/TextInputModal';
import { getCurrentDate, getCurrentTime } from '../../lib/time';
import { validateShift } from '../../lib/roster';
import { UsualShift, ShiftTemplate } from '../../types';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('NewShift');

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
  const { templates, loadTemplates, addTemplate } = useShiftTemplatesStore();
  const { user } = useAuthStore();
  
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
  const [createdFromTemplate, setCreatedFromTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const dateRangeSectionY = useRef<number>(0);

  useEffect(() => {
    // Load templates on mount
    loadTemplates(user?.id);
  }, [user?.id, loadTemplates]);

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

  const handleTemplateSelect = (template: ShiftTemplate) => {
    setLabel(template.label);
    setRosteredStart(template.rosteredStart);
    setRosteredFinish(template.rosteredFinish);
    setMealBreakMinutes(template.mealBreakMinutes || 0);
    setCreatedFromTemplate(true);
    setSelectedTemplateId(template.id);
  };

  const handleClearTemplate = () => {
    setCreatedFromTemplate(false);
    setSelectedTemplateId(null);
    // Reset form fields to defaults
    setLabel('');
    setRosteredStart(getCurrentTime());
    setRosteredFinish('');
    setMealBreakMinutes(30);
  };

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

  const handleSave = async (saveAsTemplate: boolean = false, skipPrompt: boolean = false) => {
    debug.debug('Save button pressed');
    debug.debug('Form data:', {
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
      debug.debug('Validation failed:', validationErrors);
      Alert.alert('Validation Error', validationErrors.join('\n'));
      return;
    }

    // If not created from template and not already saving as template, show prompt
    // Skip prompt if explicitly requested (e.g., when user already chose an option)
    if (!createdFromTemplate && !saveAsTemplate && !skipPrompt && label && rosteredStart && rosteredFinish) {
      Alert.alert(
        'Save as Template?',
        'Would you like to save this shift configuration as a template for quick selection next time?',
        [
          { text: 'Save Shift Only', style: 'cancel', onPress: () => handleSave(false, true) },
          { text: 'Save Shift & Template', onPress: () => handleSave(true, true) },
        ]
      );
      return;
    }

    try {
      // Save as template if requested
      if (saveAsTemplate && label && rosteredStart && rosteredFinish) {
        const template: ShiftTemplate = {
          id: `template_${Date.now()}`,
          label,
          rosteredStart,
          rosteredFinish,
          mealBreakMinutes: mealBreakMinutes || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await addTemplate(template, user?.id);
        debug.debug('Template saved successfully');
      }

      debug.debug('Creating shifts for days:', selectedDays);
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
        debug.debug(`Creating shift ${index + 1}/${selectedDays.length}:`, {
          id: shift.id,
          label: shift.label,
          day: shift.dayOfWeek,
          type: shift.type
        });
        return addShift(shift);
      });

      await Promise.all(shiftPromises);
      debug.debug('All shifts created successfully');
      
      Alert.alert(
        'Success',
        `Created ${selectedDays.length} shift pattern${selectedDays.length > 1 ? 's' : ''} successfully!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      debug.error('Failed to create shifts:', error);
      Alert.alert('Error', 'Failed to create shift patterns. Please try again.');
    }
  };

  const renderTypeSelector = () => (
    <View style={[styles.section, isDark && styles.darkCard]}>
      <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
        Shift Type
      </Text>
      <View style={styles.typeContainer}>
        {SHIFT_TYPES.map((shiftType) => (
          <TouchableOpacity
            key={shiftType.value}
            style={[
              styles.typeButton,
              isDark && type !== shiftType.value && styles.darkTypeButton,
              type === shiftType.value && styles.selectedTypeButton,
            ]}
            onPress={() => setType(shiftType.value)}
          >
            <Text
              style={[
                styles.typeButtonText,
                isDark && type !== shiftType.value && styles.darkTypeButtonText,
                type === shiftType.value && styles.selectedTypeButtonText,
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
      <View style={[styles.section, isDark && styles.darkCard]}>
        <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
          Week Index
        </Text>
        <View style={styles.weekIndexContainer}>
          {WEEK_INDEXES.map((week) => (
            <TouchableOpacity
              key={week.value}
              style={[
                styles.weekIndexButton,
                isDark && weekIndex !== week.value && styles.darkWeekIndexButton,
                weekIndex === week.value && styles.selectedWeekIndexButton,
              ]}
              onPress={() => setWeekIndex(week.value)}
            >
              <Text
                style={[
                  styles.weekIndexButtonText,
                  isDark && weekIndex !== week.value && styles.darkWeekIndexButtonText,
                  weekIndex === week.value && styles.selectedWeekIndexButtonText,
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
    <View style={[styles.section, isDark && styles.darkCard]}>
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
              isDark && !selectedDays.includes(day.value) && styles.darkDayButton,
              selectedDays.includes(day.value) && styles.selectedDayButton,
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
                isDark && !selectedDays.includes(day.value) && styles.darkDayButtonText,
                selectedDays.includes(day.value) && styles.selectedDayButtonText,
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
    <View style={[styles.section, isDark && styles.darkCard]}>
      <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
        Rostered Times
      </Text>
      <View style={styles.timeRow}>
        <View style={styles.timeInput}>
          <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
          <TimeInput
            value={rosteredStart}
            onChange={(value) => {
              setRosteredStart(value);
              // Reset template flag if manually edited
              if (createdFromTemplate) {
                setCreatedFromTemplate(false);
                setSelectedTemplateId(null);
              }
            }}
            placeholder="Select start time"
            inputId="shift-rostered-start"
          />
        </View>
        <View style={styles.timeInput}>
          <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
          <TimeInput
            value={rosteredFinish}
            onChange={(value) => {
              setRosteredFinish(value);
              // Reset template flag if manually edited
              if (createdFromTemplate) {
                setCreatedFromTemplate(false);
                setSelectedTemplateId(null);
              }
            }}
            placeholder="Select finish time"
            inputId="shift-rostered-finish"
          />
        </View>
      </View>
    </View>
  );

  const renderMealBreak = () => (
    <View style={[styles.section, isDark && styles.darkCard]}>
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
                // Reset template flag if manually edited
                if (createdFromTemplate) {
                  setCreatedFromTemplate(false);
                  setSelectedTemplateId(null);
                }
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

  const handleToDateOpen = () => {
    // Scroll to show the "To" date input and calendar when it opens
    // The calendar appears below the input, so we scroll to approximately where
    // the "To" input is (section title ~30px + From input ~80px + gap ~12px = ~122px offset)
    if (scrollViewRef.current && dateRangeSectionY.current > 0) {
      // Scroll to show the "To" input field and the calendar below it
      scrollViewRef.current.scrollTo({ y: dateRangeSectionY.current + 120, animated: true });
    }
  };

  const renderDateRange = () => (
    <View 
      onLayout={(event) => {
        // Store the Y position of the date range section relative to ScrollView content
        dateRangeSectionY.current = event.nativeEvent.layout.y;
      }}
      style={[styles.section, isDark && styles.darkCard]}
    >
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
            onOpen={handleToDateOpen}
          />
        </View>
      </View>
    </View>
  );

  const renderTemplateSelection = () => {
    if (templates.length === 0) return null;

    return (
      <View style={[styles.section, isDark && styles.darkCard]}>
        <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
          Quick Select Template
        </Text>
        <Text style={[styles.sectionSubtitle, isDark && styles.darkText]}>
          Select a template to quickly fill in shift times
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.templateScrollView}
          contentContainerStyle={styles.templateContainer}
        >
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={[
                styles.templateButton,
                isDark && selectedTemplateId !== template.id && styles.darkTemplateButton,
                selectedTemplateId === template.id && styles.selectedTemplateButton,
              ]}
              onPress={() => handleTemplateSelect(template)}
            >
              <Text
                style={[
                  styles.templateButtonText,
                  isDark && selectedTemplateId !== template.id && styles.darkTemplateButtonText,
                  selectedTemplateId === template.id && styles.selectedTemplateButtonText,
                ]}
              >
                {template.label}
              </Text>
              <Text
                style={[
                  styles.templateButtonSubtext,
                  isDark && selectedTemplateId !== template.id && styles.darkTemplateButtonSubtext,
                  selectedTemplateId === template.id && styles.selectedTemplateButtonSubtext,
                ]}
              >
                {template.rosteredStart} - {template.rosteredFinish}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {selectedTemplateId && (
          <TouchableOpacity
            style={[styles.clearTemplateButton, isDark && styles.darkClearTemplateButton]}
            onPress={handleClearTemplate}
          >
            <Text style={[styles.clearTemplateButtonText, isDark && styles.darkClearTemplateButtonText]}>
              Clear Template
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderLabelInput = () => (
    <View style={[styles.section, isDark && styles.darkCard]}>
      <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
        Label
      </Text>
      <Text style={[styles.sectionSubtitle, isDark && styles.darkText]}>
        Give this shift pattern a name (e.g., "Morning Shift", "Weekend")
      </Text>
      <TouchableOpacity
        style={[styles.labelButton, isDark && styles.darkInput]}
        onPress={() => setShowLabelModal(true)}
      >
        <Text style={[styles.labelText, isDark && styles.darkText]}>
          {label || 'Enter shift label...'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SharedTimePickerProvider>
      <ScrollView 
        ref={scrollViewRef}
        style={[styles.container, isDark && styles.darkContainer]} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
        {/* Template Selection */}
        {renderTemplateSelection()}

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
            style={[styles.button, styles.cancelButton, isDark && styles.darkCancelButton]}
            onPress={() => router.back()}
          >
            <Text style={[styles.cancelButtonText, isDark && styles.darkCancelButtonText]}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={() => handleSave(false)}
          >
            <Text style={styles.saveButtonText}>Save Shift</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
    <TextInputModal
      visible={showLabelModal}
      title="Shift Label"
      message="Enter a name for this shift pattern:"
      placeholder="Enter shift label..."
      initialValue={label}
      onConfirm={(text) => {
        setLabel(text);
        setShowLabelModal(false);
        // Reset template flag if manually edited
        if (createdFromTemplate) {
          setCreatedFromTemplate(false);
          setSelectedTemplateId(null);
        }
      }}
      onCancel={() => setShowLabelModal(false)}
      confirmText="OK"
      cancelText="Cancel"
    />
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
  darkCancelButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#48484a',
  },
  darkCancelButtonText: {
    color: '#fff',
  },

  // Template selection
  templateScrollView: {
    marginTop: 8,
  },
  templateContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  templateButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 120,
    alignItems: 'center',
  },
  selectedTemplateButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  darkTemplateButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  templateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  selectedTemplateButtonText: {
    color: '#fff',
  },
  darkTemplateButtonText: {
    color: '#999',
  },
  templateButtonSubtext: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  selectedTemplateButtonSubtext: {
    color: '#fff',
  },
  darkTemplateButtonSubtext: {
    color: '#999',
  },
  clearTemplateButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    alignSelf: 'flex-start',
  },
  darkClearTemplateButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  clearTemplateButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  darkClearTemplateButtonText: {
    color: '#999',
  },
});
