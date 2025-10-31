import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../lib/state/profileStore';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { useLogsStore } from '../../lib/state/logsStore';
import { TimeInput } from '../../components/TimeInput';
import { CalendarPicker } from '../../components/CalendarPicker';
import { SharedTimePickerProvider } from '../../components/SharedTimePicker';
import { NAButton } from '../../components/NAButton';
import { computeMinutes, formatMinutes, getCurrentDate, getCurrentTime } from '../../lib/time';
import { getRosterForDate } from '../../lib/roster';
import { OvertimeLog } from '../../types';

const CATEGORIES = [
  'Overtime',
  'Oncall',
  'HP Emergency Clinical on Call',
  'HPDO Priority on Call',
  'Recall Offsite',
  'Recall Onsite',
  'Recall Offsite Normal Duties (QPSOOE award)',
  'Recall Telephone Advice (Medical)',
  'Change shift',
  'Change shift - cancel leave',
] as const;

export default function NewLogScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile, initials } = useProfileStore();
  const { shifts, getRosterFor } = useShiftsStore();
  const { addLog } = useLogsStore();
  
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  const [actualStart, setActualStart] = useState('');
  const [actualFinish, setActualFinish] = useState('');
  const [rosteredStart, setRosteredStart] = useState('');
  const [rosteredFinish, setRosteredFinish] = useState('');
  const [rosteredTimesNA, setRosteredTimesNA] = useState(false);
  const [actualTimesNA, setActualTimesNA] = useState(false);
  const [mealBreakMinutes, setMealBreakMinutes] = useState(30);
  const [showMealBreakPicker, setShowMealBreakPicker] = useState(false);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Overtime');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [comments, setComments] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [minutesCalculation, setMinutesCalculation] = useState<any>(null);
  const [finishTimeError, setFinishTimeError] = useState('');
  const [concurrentEmployment, setConcurrentEmployment] = useState(false);
  const [showOtherOptions, setShowOtherOptions] = useState(false);
  const [smoCategories, setSmoCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Preload rostered times when date changes
    const roster = getRosterFor(selectedDate);
    if (roster) {
      setRosteredStart(roster.rosteredStart || '');
      setRosteredFinish(roster.rosteredFinish || '');
      setMealBreakMinutes(roster.mealBreakMinutes || 0);
      
      // Initially set actual times to rostered times
      setActualStart(roster.rosteredStart || '');
      setActualFinish(roster.rosteredFinish || '');
    } else {
      // No roster for this date, leave actual times empty for user to select
      setActualStart('');
      setActualFinish('');
    }
  }, [selectedDate, shifts]);

  useEffect(() => {
    // Recalculate when times change
    if (actualStart && actualFinish) {
      calculateMinutes();
    }
  }, [actualStart, actualFinish, mealBreakMinutes, rosteredStart, rosteredFinish]);

  useEffect(() => {
    // Sync actual start time with rostered start time when rostered start changes
    if (rosteredStart) {
      setActualStart(rosteredStart);
    }
  }, [rosteredStart]);

  useEffect(() => {
    // Validate finish time in real-time
    // Skip validation if rostered times are N/A
    if (actualFinish && rosteredFinish && !rosteredTimesNA) {
      if (!validateFinishTime(actualFinish)) {
        setFinishTimeError('Finish time cannot be before rostered finish time');
      } else {
        setFinishTimeError('');
      }
    } else {
      setFinishTimeError('');
    }
  }, [actualFinish, rosteredFinish, rosteredTimesNA]);

  useEffect(() => {
    // Initialize concurrent employment from profile default
    if (profile?.concurrentEmploymentDefault !== undefined) {
      setConcurrentEmployment(profile.concurrentEmploymentDefault);
    }
  }, [profile]);

  const validateFinishTime = (finishTime: string) => {
    if (!finishTime || !rosteredFinish || rosteredFinish === 'N/A' || rosteredTimesNA) return true;
    
    // Convert times to minutes for comparison
    const finishMinutes = timeToMinutes(finishTime);
    const rosteredFinishMinutes = timeToMinutes(rosteredFinish);
    
    return finishMinutes >= rosteredFinishMinutes;
  };

  const timeToMinutes = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const handleRosteredTimesNA = () => {
    const newNAStatus = !rosteredTimesNA;
    setRosteredTimesNA(newNAStatus);
    
    if (newNAStatus) {
      setRosteredStart('N/A');
      setRosteredFinish('N/A');
      // Clear any finish time validation errors when N/A is selected
      setFinishTimeError('');
    } else {
      setRosteredStart('');
      setRosteredFinish('');
    }
  };

  const handleActualTimesNA = () => {
    const newNAStatus = !actualTimesNA;
    setActualTimesNA(newNAStatus);
    
    if (newNAStatus) {
      setActualStart('N/A');
      setActualFinish('N/A');
    } else {
      setActualStart('');
      setActualFinish('');
    }
  };

  const calculateMinutes = () => {
    if (!actualStart || !actualFinish || actualStart === 'N/A' || actualFinish === 'N/A') return;
    
    setIsCalculating(true);
    try {
      const calculation = computeMinutes(
        actualStart,
        actualFinish,
        rosteredStart || undefined,
        rosteredFinish || undefined,
        mealBreakMinutes
      );
      setMinutesCalculation(calculation);
    } catch (error) {
      console.error('Calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const isFormEmpty = () => {
    return !actualStart && !actualFinish && !rosteredStart && !rosteredFinish && !comments && !concurrentEmployment;
  };

  const hasRequiredFieldsForReady = () => {
    return actualStart && actualFinish && (rosteredStart || rosteredTimesNA) && (rosteredFinish || rosteredTimesNA);
  };

  const handleSave = async (status: 'draft' | 'ready') => {
    // Prevent saving completely empty forms
    if (isFormEmpty()) {
      Alert.alert('Empty Form', 'Please enter some information before saving.');
      return;
    }

    // For ready status, require all essential fields
    if (status === 'ready') {
      if (!hasRequiredFieldsForReady()) {
        Alert.alert(
          'Missing Required Fields', 
          'To mark as ready, please enter:\n• Actual start and finish times\n• Rostered start and finish times (or mark as N/A)'
        );
        return;
      }
    }

    // For draft, require at least actual times
    if (status === 'draft') {
      if (!actualStart || !actualFinish) {
        Alert.alert('Required Fields', 'Please enter actual start and finish times to save as draft.');
        return;
      }
    }

    // Validate finish time is not before rostered finish time
    if (!validateFinishTime(actualFinish)) {
      Alert.alert(
        'Invalid Finish Time', 
        'Actual finish time cannot be before your rostered finish time. You can only claim overtime for working later than your rostered hours.'
      );
      return;
    }

    if (!minutesCalculation) {
      Alert.alert('Calculation Error', 'Please check your times and try again.');
      return;
    }

    // Use profile's employeeInitial directly if initials from store is empty
    const logInitials = initials || profile?.employeeInitial || '';
    
    console.log('Creating log with initials:', { 
      initials, 
      profile: !!profile, 
      profileInitial: profile?.employeeInitial,
      logInitials 
    });
    
    const log: OvertimeLog = {
      id: `log_${Date.now()}`,
      date: selectedDate,
      rosteredStart: rosteredStart || undefined,
      rosteredFinish: rosteredFinish || undefined,
      actualStart,
      actualFinish,
      mealBreakMinutes: mealBreakMinutes || undefined,
      minutesOvertime: minutesCalculation.roundedOvertime,
      category,
      comments: comments || undefined,
      initials: logInitials,
      concurrentEmployment,
      smoCategories: profile?.isSMO ? smoCategories : undefined,
      status,
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await addLog(log);
      Alert.alert(
        'Success',
        `Log ${status === 'draft' ? 'saved as draft' : 'marked as ready'}!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save log. Please try again.');
    }
  };

  const renderSMOCategories = () => {
    const smoCategoryOptions = [
      { key: 'vmoAdditionalHours', label: 'VMO Additional Hours' },
      { key: 'overtime', label: 'Overtime' },
      { key: 'oncall', label: 'On-call' },
      { key: 'physicalRecall', label: 'Physical Recall' },
      { key: 'digitalRecall', label: 'Digital Recall' },
      { key: 'extraShift', label: 'Extra Shift' },
      { key: 'approvedForPayment', label: 'Approved for Payment' },
    ];

    return (
      <View style={[styles.section, isDark && styles.darkCard]}>
        <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
          SMO Categories (Select all that apply)
        </Text>
        {smoCategoryOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.smoCategoryOption, isDark && styles.darkSmoCategoryOption]}
            onPress={() => {
              setSmoCategories(prev => ({
                ...prev,
                [option.key]: !prev[option.key]
              }));
            }}
          >
            <View style={[styles.checkbox, smoCategories[option.key] && styles.checkboxChecked]}>
              {smoCategories[option.key] && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={[styles.smoCategoryLabel, isDark && styles.darkText]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderCategorySelector = () => {
    // Show SMO categories if user is SMO, otherwise show regular dropdown
    if (profile?.isSMO) {
      return renderSMOCategories();
    }

    return (
      <View style={[styles.section, isDark && styles.darkCard]}>
        <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
          Category
        </Text>
        <TouchableOpacity
          style={[styles.categoryDropdown, isDark && styles.darkInput]}
          onPress={() => setShowCategoryPicker(!showCategoryPicker)}
        >
          <Text style={[styles.categoryDropdownText, isDark && styles.darkText]}>
            {category}
          </Text>
          <Text style={[styles.dropdownArrow, isDark && styles.darkText]}>
            {showCategoryPicker ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        
        {showCategoryPicker && (
          <ScrollView style={[styles.categoryPickerContainer, isDark && styles.darkPickerContainer]} showsVerticalScrollIndicator={false}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryOption,
                  isDark && category !== cat && styles.darkCategoryOption,
                  category === cat && styles.selectedCategoryOption,
                ]}
                onPress={() => {
                  setCategory(cat);
                  setShowCategoryPicker(false);
                }}
              >
                <Text style={[
                  styles.categoryOptionText,
                  category === cat && styles.selectedCategoryOptionText,
                  isDark && category !== cat && styles.darkText,
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderCalculation = () => {
    if (!minutesCalculation) return null;

    return (
      <View style={[styles.calculationCard, isDark && styles.darkCalculationCard]}>
        <Text style={[styles.calculationTitle, isDark && styles.darkText]}>
          Overtime Calculation
        </Text>
        
        <View style={styles.calculationRow}>
          <Text style={[styles.calculationLabel, isDark && styles.darkText]}>
            Time Worked:
          </Text>
          <Text style={[styles.calculationValue, isDark && styles.darkText]}>
            {formatMinutes(minutesCalculation.minutesWorked)}
          </Text>
        </View>
        
        {rosteredStart && rosteredFinish && (
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, isDark && styles.darkText]}>
              Time Rostered:
            </Text>
            <Text style={[styles.calculationValue, isDark && styles.darkText]}>
              {formatMinutes(minutesCalculation.minutesRostered)}
            </Text>
          </View>
        )}
        
        <View style={[styles.calculationRow, styles.totalRow]}>
          <Text style={[styles.calculationLabel, styles.totalLabel, isDark && styles.darkText]}>
            Overtime:
          </Text>
          <Text style={[styles.calculationValue, styles.totalValue, isDark && styles.darkText]}>
            {formatMinutes(minutesCalculation.roundedOvertime)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SharedTimePickerProvider>
      <ScrollView style={[styles.container, isDark && styles.darkContainer]} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        {/* Date Selection */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Date
          </Text>
          <CalendarPicker
            value={selectedDate}
            onChange={setSelectedDate}
            placeholder="Select date"
          />
        </View>

        {/* Rostered Times */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
              Rostered Times
            </Text>
            <NAButton
              onPress={handleRosteredTimesNA}
              isActive={rosteredTimesNA}
            />
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeInput}>
              <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
              <TimeInput
                value={rosteredStart}
                onChange={setRosteredStart}
                placeholder="Select rostered start time"
                inputId="rostered-start"
                disabled={rosteredTimesNA}
              />
            </View>
            <View style={styles.timeInput}>
              <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
              <TimeInput
                value={rosteredFinish}
                onChange={setRosteredFinish}
                placeholder="Select rostered finish time"
                inputId="rostered-finish"
                disabled={rosteredTimesNA}
              />
            </View>
          </View>
        </View>

        {/* Actual Times */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
              Actual Times
            </Text>
            <NAButton
              onPress={handleActualTimesNA}
              isActive={actualTimesNA}
            />
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeInput}>
              <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
              <TimeInput
                value={actualStart}
                onChange={setActualStart}
                placeholder="Select start time"
                inputId="actual-start"
                disabled={actualTimesNA}
              />
            </View>
            <View style={styles.timeInput}>
              <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
              <TimeInput
                value={actualFinish}
                onChange={setActualFinish}
                placeholder="Select finish time"
                inputId="actual-finish"
                error={finishTimeError}
                disabled={actualTimesNA}
              />
            </View>
          </View>
        </View>

        {/* Meal Break */}
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
                    isDark && mealBreakMinutes !== minutes && styles.darkMealBreakOption,
                    mealBreakMinutes === minutes && styles.selectedMealBreakOption,
                  ]}
                  onPress={() => {
                    setMealBreakMinutes(minutes);
                    setShowMealBreakPicker(false);
                  }}
                >
                  <Text style={[
                    styles.mealBreakOptionText,
                    mealBreakMinutes === minutes && styles.selectedMealBreakOptionText,
                    isDark && mealBreakMinutes !== minutes && styles.darkText,
                  ]}>
                    {minutes} minutes
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Category */}
        {renderCategorySelector()}

        {/* Comments */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Comments (Optional)
          </Text>
          <TextInput
            style={[
              styles.commentsInput,
              isDark && styles.darkInput,
              isDark && styles.darkText,
            ]}
            value={comments}
            onChangeText={setComments}
            placeholder="Add comments..."
            placeholderTextColor={isDark ? '#666' : '#999'}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Other Options */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <TouchableOpacity
            style={styles.otherSectionHeader}
            onPress={() => setShowOtherOptions(!showOtherOptions)}
          >
            <Text style={[styles.otherSectionTitle, isDark && styles.darkText]}>
              Other Options
            </Text>
            <Text style={[styles.otherSectionArrow, isDark && styles.darkText]}>
              {showOtherOptions ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          
          {showOtherOptions && (
            <View style={styles.otherSectionContent}>
              {/* Concurrent Employment */}
              <View style={styles.otherOption}>
                <Text style={[styles.otherOptionTitle, isDark && styles.darkText]}>
                  Concurrent Employment
                </Text>
                <Text style={[styles.otherOptionDescription, isDark && styles.darkText]}>
                  Check if you work in more than one job at the same time
                </Text>
                <TouchableOpacity
                  style={[styles.toggleButton, isDark && styles.darkToggleButton]}
                  onPress={() => setConcurrentEmployment(!concurrentEmployment)}
                >
                  <View style={[styles.toggleContainer, isDark && styles.darkToggleContainer]}>
                    <View style={[
                      styles.toggleSwitch,
                      concurrentEmployment && styles.toggleSwitchActive,
                      isDark && styles.darkToggleSwitch,
                      concurrentEmployment && isDark && styles.darkToggleSwitchActive
                    ]}>
                      <View style={[
                        styles.toggleThumb,
                        concurrentEmployment && styles.toggleThumbActive,
                        isDark && styles.darkToggleThumb
                      ]} />
                    </View>
                    <Text style={[styles.toggleLabel, isDark && styles.darkText]}>
                      {concurrentEmployment ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Calculation */}
        {renderCalculation()}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.button, 
              styles.draftButton, 
              isDark && styles.darkDraftButton,
              isFormEmpty() && styles.disabledButton
            ]}
            onPress={() => handleSave('draft')}
            disabled={isFormEmpty()}
          >
            <Text style={[
              styles.draftButtonText, 
              isDark && styles.darkDraftButtonText,
              isFormEmpty() && styles.disabledButtonText
            ]}>Save as Draft</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.button, 
              styles.readyButton,
              (!hasRequiredFieldsForReady() || !minutesCalculation || minutesCalculation.roundedOvertime <= 0) && styles.disabledButton
            ]}
            onPress={() => handleSave('ready')}
            disabled={!hasRequiredFieldsForReady() || !minutesCalculation || minutesCalculation.roundedOvertime <= 0}
          >
            <Text style={[
              styles.readyButtonText,
              (!hasRequiredFieldsForReady() || !minutesCalculation || minutesCalculation.roundedOvertime <= 0) && styles.disabledButtonText
            ]}>Mark as Ready</Text>
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
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  darkText: {
    color: '#fff',
  },
  darkInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
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
  mealBreakButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    minHeight: 44,
    justifyContent: 'center',
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
  categoryDropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  categoryDropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  categoryPickerContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 200,
  },
  categoryOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkCategoryOption: {
    borderBottomColor: '#2c2c2e',
  },
  selectedCategoryOption: {
    backgroundColor: '#007AFF',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedCategoryOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  commentsInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    minHeight: 80,
    fontSize: 16,
    color: '#333',
  },
  calculationCard: {
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  darkCalculationCard: {
    backgroundColor: '#1a2e1a',
    borderColor: '#4CAF50',
  },
  calculationTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 12,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  calculationLabel: {
    fontSize: 14,
    color: '#666',
  },
  calculationValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#4CAF50',
    marginTop: 8,
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
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
  draftButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkDraftButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  readyButton: {
    backgroundColor: '#4CAF50',
  },
  draftButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  darkDraftButtonText: {
    color: '#fff',
  },
  readyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  toggleButton: {
    paddingVertical: 8,
  },
  darkToggleButton: {
    // No additional styling needed
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  darkToggleContainer: {
    // No additional styling needed
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  darkToggleSwitch: {
    backgroundColor: '#2c2c2e',
  },
  toggleSwitchActive: {
    backgroundColor: '#4CAF50',
  },
  darkToggleSwitchActive: {
    backgroundColor: '#4CAF50',
  },
  toggleThumb: {
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
  darkToggleThumb: {
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  otherSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  otherSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  otherSectionArrow: {
    fontSize: 12,
    color: '#666',
  },
  otherSectionContent: {
    marginTop: 16,
    gap: 20,
  },
  otherOption: {
    gap: 8,
  },
  otherOptionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  otherOptionDescription: {
    fontSize: 13,
    color: '#666',
  },
  disabledButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#999',
  },
  smoCategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkSmoCategoryOption: {
    borderBottomColor: '#2c2c2e',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  smoCategoryLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
});
