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
import { useAuthStore } from '../../lib/state/authStore';
import { useLogsStore } from '../../lib/state/logsStore';
import { TimeInput } from '../../components/TimeInput';
import { CalendarPicker } from '../../components/CalendarPicker';
import { SharedTimePickerProvider } from '../../components/SharedTimePicker';
import { NAButton } from '../../components/NAButton';
import { computeMinutes, formatMinutes, getCurrentDate } from '../../lib/time';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('ShiftSwap');

export default function ShiftSwapScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile, initials } = useProfileStore();
  const { user } = useAuthStore();
  const { addShiftSwapLogs } = useLogsStore();
  
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  const [mealBreakMinutes, setMealBreakMinutes] = useState(30);
  const [showMealBreakPicker, setShowMealBreakPicker] = useState(false);
  
  // Person A (current user)
  const [personAInitials, setPersonAInitials] = useState(initials || profile?.employeeInitial || '');
  const [personARosteredStart, setPersonARosteredStart] = useState('');
  const [personARosteredFinish, setPersonARosteredFinish] = useState('');
  const [personARosteredTimesNA, setPersonARosteredTimesNA] = useState(false);
  const [personAActualStart, setPersonAActualStart] = useState('');
  const [personAActualFinish, setPersonAActualFinish] = useState('');
  
  // Person B (swap partner)
  const [personBInitials, setPersonBInitials] = useState('');
  const [personBName, setPersonBName] = useState('');
  const [personBPayrollNumber, setPersonBPayrollNumber] = useState('');
  const [personBPayLevel, setPersonBPayLevel] = useState('');
  const [personBRosteredStart, setPersonBRosteredStart] = useState('');
  const [personBRosteredFinish, setPersonBRosteredFinish] = useState('');
  const [personBRosteredTimesNA, setPersonBRosteredTimesNA] = useState(false);
  const [personBActualStart, setPersonBActualStart] = useState('');
  const [personBActualFinish, setPersonBActualFinish] = useState('');
  
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [personACalculation, setPersonACalculation] = useState<any>(null);
  const [personBCalculation, setPersonBCalculation] = useState<any>(null);

  // Auto-populate Person B's times from Person A's times
  useEffect(() => {
    if (personARosteredTimesNA) {
      // If Person A's rostered times are N/A, Person B's actual times should also be N/A
      setPersonBActualStart('N/A');
      setPersonBActualFinish('N/A');
      // Person B's rostered times come from Person A's actual times (if set)
      if (personAActualStart && personAActualFinish && personAActualStart !== 'N/A' && personAActualFinish !== 'N/A') {
        setPersonBRosteredStart(personAActualStart);
        setPersonBRosteredFinish(personAActualFinish);
        setPersonBRosteredTimesNA(false);
      } else {
        setPersonBRosteredStart('');
        setPersonBRosteredFinish('');
        setPersonBRosteredTimesNA(false);
      }
    } else {
      // Person A's rostered times become Person B's actual times
      if (personARosteredStart && personARosteredFinish) {
        setPersonBActualStart(personARosteredStart);
        setPersonBActualFinish(personARosteredFinish);
      } else {
        setPersonBActualStart('');
        setPersonBActualFinish('');
      }
      // Person A's actual times become Person B's rostered times
      if (personAActualStart && personAActualFinish && personAActualStart !== 'N/A' && personAActualFinish !== 'N/A') {
        setPersonBRosteredStart(personAActualStart);
        setPersonBRosteredFinish(personAActualFinish);
        setPersonBRosteredTimesNA(false);
      } else {
        setPersonBRosteredStart('');
        setPersonBRosteredFinish('');
        setPersonBRosteredTimesNA(false);
      }
    }
  }, [personARosteredStart, personARosteredFinish, personAActualStart, personAActualFinish, personARosteredTimesNA]);

  useEffect(() => {
    // Auto-calculate when times change
    if (personAActualStart && personAActualFinish && personARosteredStart && personARosteredFinish && !personARosteredTimesNA) {
      try {
        const calc = computeMinutes(
          personAActualStart,
          personAActualFinish,
          personARosteredStart,
          personARosteredFinish,
          mealBreakMinutes
        );
        setPersonACalculation(calc);
      } catch (error) {
        debug.error('Person A calculation error:', error);
      }
    } else {
      setPersonACalculation(null);
    }
  }, [personAActualStart, personAActualFinish, personARosteredStart, personARosteredFinish, personARosteredTimesNA, mealBreakMinutes]);

  useEffect(() => {
    // Auto-calculate when times change
    // Person B's rostered times come from Person A's actual times
    // Person B's actual times come from Person A's rostered times
    if (personBActualStart && personBActualFinish && personBRosteredStart && personBRosteredFinish 
        && personBActualStart !== 'N/A' && personBActualFinish !== 'N/A'
        && personBRosteredStart !== 'N/A' && personBRosteredFinish !== 'N/A') {
      try {
        const calc = computeMinutes(
          personBActualStart,
          personBActualFinish,
          personBRosteredStart,
          personBRosteredFinish,
          mealBreakMinutes
        );
        setPersonBCalculation(calc);
      } catch (error) {
        debug.error('Person B calculation error:', error);
        setPersonBCalculation(null);
      }
    } else if (personBActualStart === 'N/A' && personBActualFinish === 'N/A') {
      // If Person B actual times are N/A, calculation should be null
      setPersonBCalculation(null);
    } else {
      // Times are not fully set yet
      setPersonBCalculation(null);
    }
  }, [personBActualStart, personBActualFinish, personBRosteredStart, personBRosteredFinish, mealBreakMinutes]);

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    // Person A validation - initials come from profile, no need to validate
    
    if (!personARosteredTimesNA) {
      if (!personARosteredStart || !personARosteredFinish) {
        errors.push('Person A rostered times are required (or mark as N/A)');
      }
    }
    
    if (!personAActualStart || !personAActualFinish) {
      errors.push('Person A actual times are required');
    }
    
    // Person B validation
    if (!personBInitials.trim()) {
      errors.push('Person B initials are required');
    } else if (personBInitials.trim().length < 2 || personBInitials.trim().length > 3) {
      errors.push('Person B initials must be 2-3 characters');
    }
    
    if (!personBName.trim()) {
      errors.push('Person B name is required');
    }
    
    if (!personBPayrollNumber.trim()) {
      errors.push('Person B payroll number is required');
    }
    
    // Person B times are auto-populated, so we just need to check they're set
    // Person B rostered times come from Person A's actual times
    if (!personARosteredTimesNA) {
      // If Person A has actual times, Person B should have rostered times
      if (personAActualStart && personAActualFinish && personAActualStart !== 'N/A' && personAActualFinish !== 'N/A') {
        if (!personBRosteredStart || !personBRosteredFinish) {
          errors.push('Person B rostered times should be auto-populated from Person A actual times');
        }
      }
    }
    
    // Person B actual times come from Person A's rostered times
    if (!personARosteredTimesNA) {
      if (personARosteredStart && personARosteredFinish) {
        if (!personBActualStart || !personBActualFinish || personBActualStart === 'N/A' || personBActualFinish === 'N/A') {
          errors.push('Person B actual times should be auto-populated from Person A rostered times');
        }
      }
    } else {
      // If Person A rostered is N/A, Person B actual should also be N/A
      if (personBActualStart !== 'N/A' || personBActualFinish !== 'N/A') {
        errors.push('Person B actual times should be N/A when Person A rostered times are N/A');
      }
    }
    
    return errors;
  };

  const isFormReadyForReady = (): boolean => {
    // Check all required fields are filled
    // Person A initials come from profile, no need to validate
    
    if (!personAActualStart || !personAActualFinish || personAActualStart === 'N/A' || personAActualFinish === 'N/A') {
      return false;
    }
    
    if (!personARosteredTimesNA && (!personARosteredStart || !personARosteredFinish)) {
      return false;
    }
    
    if (!personBInitials.trim() || personBInitials.trim().length < 2 || personBInitials.trim().length > 3) {
      return false;
    }
    
    if (!personBName.trim()) {
      return false;
    }
    
    if (!personBPayrollNumber.trim()) {
      return false;
    }
    
    // Person B times should be auto-populated
    if (!personARosteredTimesNA) {
      if (!personBActualStart || !personBActualFinish || personBActualStart === 'N/A' || personBActualFinish === 'N/A') {
        return false;
      }
      if (personAActualStart && personAActualFinish && personAActualStart !== 'N/A' && personAActualFinish !== 'N/A') {
        if (!personBRosteredStart || !personBRosteredFinish) {
          return false;
        }
      }
    } else {
      // If Person A rostered is N/A, Person B actual should be N/A
      if (personBActualStart !== 'N/A' || personBActualFinish !== 'N/A') {
        return false;
      }
    }
    
    // Check that calculations exist; allow 0m overtime for shift swaps
    if (!personACalculation) {
      return false;
    }
    
    // Person B calculation might be 0m for a straight swap; just require it exists
    if (!personBCalculation) {
      return false;
    }
    
    return true;
  };

  const handleSave = async (status: 'draft' | 'ready') => {
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }
    
    setValidationErrors([]);
    
    if (!personACalculation || !personBCalculation) {
      Alert.alert('Calculation Error', 'Please check your times and try again.');
      return;
    }

    try {
      await addShiftSwapLogs(
        {
          date: selectedDate,
          personAInitials: (initials || profile?.employeeInitial || '').trim().toUpperCase(),
          personARosteredStart: personARosteredTimesNA ? 'N/A' : personARosteredStart,
          personARosteredFinish: personARosteredTimesNA ? 'N/A' : personARosteredFinish,
          personAActualStart,
          personAActualFinish,
          personBInitials: personBInitials.trim().toUpperCase(),
          personBName: personBName.trim(),
          personBPayrollNumber: personBPayrollNumber.trim(),
          personBPayLevel: personBPayLevel.trim() || undefined,
          personBRosteredStart: personBRosteredTimesNA ? 'N/A' : personBRosteredStart,
          personBRosteredFinish: personBRosteredTimesNA ? 'N/A' : personBRosteredFinish,
          personBActualStart,
          personBActualFinish,
          mealBreakMinutes,
          status,
        },
        user?.id
      );
      
      Alert.alert(
        'Success',
        `Shift swap ${status === 'draft' ? 'saved as draft' : 'marked as ready'}!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      debug.error('Shift swap creation error:', error);
      Alert.alert('Error', `Failed to save shift swap: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  };

  const renderPersonSection = (
    title: string,
    personInitials: string,
    setPersonInitials: (val: string) => void,
    rosteredStart: string,
    setRosteredStart: (val: string) => void,
    rosteredFinish: string,
    setRosteredFinish: (val: string) => void,
    rosteredTimesNA: boolean,
    setRosteredTimesNA: (val: boolean) => void,
    actualStart: string,
    setActualStart: (val: string) => void,
    actualFinish: string,
    setActualFinish: (val: string) => void,
    calculation: any,
    showInitials: boolean = true
  ) => {
    return (
      <View style={[styles.section, isDark && styles.darkCard]}>
        <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
          {title}
        </Text>
        
        {/* Initials - only show if showInitials is true */}
        {showInitials && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDark && styles.darkText]}>Initials *</Text>
            <TextInput
              style={[styles.initialsInput, isDark && styles.darkInput, isDark && styles.darkText]}
              value={personInitials}
              onChangeText={(text) => setPersonInitials(text.toUpperCase())}
              placeholder="e.g., JS"
              placeholderTextColor={isDark ? '#666' : '#999'}
              maxLength={3}
              autoCapitalize="characters"
            />
          </View>
        )}
        
        {/* Rostered Times */}
        <View style={styles.inputGroup}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.label, isDark && styles.darkText]}>Rostered Times</Text>
            <NAButton
              onPress={() => {
                const newNAStatus = !rosteredTimesNA;
                setRosteredTimesNA(newNAStatus);
                if (newNAStatus) {
                  setRosteredStart('N/A');
                  setRosteredFinish('N/A');
                } else {
                  setRosteredStart('');
                  setRosteredFinish('');
                }
              }}
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
                inputId={`${title.toLowerCase()}-rostered-start`}
                disabled={rosteredTimesNA}
              />
            </View>
            <View style={styles.timeInput}>
              <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
              <TimeInput
                value={rosteredFinish}
                onChange={setRosteredFinish}
                placeholder="Select rostered finish time"
                inputId={`${title.toLowerCase()}-rostered-finish`}
                disabled={rosteredTimesNA}
              />
            </View>
          </View>
        </View>
        
        {/* Actual Times */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, isDark && styles.darkText]}>Actual Times (New Shift) *</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeInput}>
              <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
              <TimeInput
                value={actualStart}
                onChange={setActualStart}
                placeholder="Select actual start time"
                inputId={`${title.toLowerCase()}-actual-start`}
              />
            </View>
            <View style={styles.timeInput}>
              <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
              <TimeInput
                value={actualFinish}
                onChange={setActualFinish}
                placeholder="Select actual finish time"
                inputId={`${title.toLowerCase()}-actual-finish`}
              />
            </View>
          </View>
        </View>
        
        {/* Calculation */}
        {calculation && (
          <View style={[styles.calculationCard, isDark && styles.darkCalculationCard]}>
            <Text style={[styles.calculationTitle, isDark && styles.darkText]}>
              Overtime Calculation
            </Text>
            <View style={styles.calculationRow}>
              <Text style={[styles.calculationLabel, isDark && styles.darkText]}>
                Overtime:
              </Text>
              <Text style={[styles.calculationValue, isDark && styles.darkText]}>
                {formatMinutes(calculation.roundedOvertime)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SharedTimePickerProvider>
      <ScrollView style={[styles.container, isDark && styles.darkContainer]} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Info Banner */}
            <View style={[styles.infoBanner, isDark && styles.darkInfoBanner]}>
              <Text style={[styles.infoText, isDark && styles.darkText]}>
                Create a shift swap entry. Person B's times will automatically populate from Person A's times. Enter Person A's shift details, then fill in Person B's name and details.
              </Text>
            </View>

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

            {/* Person A Section */}
            {renderPersonSection(
              'Person A (You)',
              personAInitials,
              setPersonAInitials,
              personARosteredStart,
              setPersonARosteredStart,
              personARosteredFinish,
              setPersonARosteredFinish,
              personARosteredTimesNA,
              setPersonARosteredTimesNA,
              personAActualStart,
              setPersonAActualStart,
              personAActualFinish,
              setPersonAActualFinish,
              personACalculation,
              false // Don't show initials for Person A (they're in profile)
            )}

            {/* Person B Section */}
            <View style={[styles.section, isDark && styles.darkCard]}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Person B (Swap Partner)
              </Text>
              
              {/* Initials */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.darkText]}>Initials *</Text>
                <TextInput
                  style={[styles.initialsInput, isDark && styles.darkInput, isDark && styles.darkText]}
                  value={personBInitials}
                  onChangeText={(text) => setPersonBInitials(text.toUpperCase())}
                  placeholder="e.g., AB"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  maxLength={3}
                  autoCapitalize="characters"
                />
              </View>

              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.darkText]}>Full Name *</Text>
                <TextInput
                  style={[styles.textInput, isDark && styles.darkInput, isDark && styles.darkText]}
                  value={personBName}
                  onChangeText={setPersonBName}
                  placeholder="Enter full name"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                />
              </View>

              {/* Payroll Number */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.darkText]}>Personal Assignment Number *</Text>
                <TextInput
                  style={[styles.textInput, isDark && styles.darkInput, isDark && styles.darkText]}
                  value={personBPayrollNumber}
                  onChangeText={setPersonBPayrollNumber}
                  placeholder="Enter payroll number"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                />
              </View>

              {/* Pay Level (Optional) */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.darkText]}>Pay Level (Optional)</Text>
                <TextInput
                  style={[styles.textInput, isDark && styles.darkInput, isDark && styles.darkText]}
                  value={personBPayLevel}
                  onChangeText={setPersonBPayLevel}
                  placeholder="Enter pay level"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                />
              </View>
              
              {/* Rostered Times (Auto-populated from Person A's actual times) */}
              <View style={styles.inputGroup}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.label, isDark && styles.darkText]}>Rostered Times</Text>
                  <Text style={[styles.autoPopulatedLabel, isDark && styles.darkSecondaryText]}>
                    (Auto from Person A's actual times)
                  </Text>
                </View>
                <View style={styles.timeRow}>
                  <View style={styles.timeInput}>
                    <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
                    <TimeInput
                      value={personBRosteredStart}
                      onChange={setPersonBRosteredStart}
                      placeholder="Auto-populated"
                      inputId="person-b-rostered-start"
                      disabled={true}
                    />
                  </View>
                  <View style={styles.timeInput}>
                    <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
                    <TimeInput
                      value={personBRosteredFinish}
                      onChange={setPersonBRosteredFinish}
                      placeholder="Auto-populated"
                      inputId="person-b-rostered-finish"
                      disabled={true}
                    />
                  </View>
                </View>
              </View>
              
              {/* Actual Times (Auto-populated from Person A's rostered times) */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.darkText]}>
                  Actual Times (New Shift) *
                  <Text style={[styles.autoPopulatedLabel, isDark && styles.darkSecondaryText]}>
                    {' '}(Auto from Person A's rostered times)
                  </Text>
                </Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeInput}>
                    <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
                    <TimeInput
                      value={personBActualStart}
                      onChange={setPersonBActualStart}
                      placeholder="Auto-populated"
                      inputId="person-b-actual-start"
                      disabled={true}
                    />
                  </View>
                  <View style={styles.timeInput}>
                    <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
                    <TimeInput
                      value={personBActualFinish}
                      onChange={setPersonBActualFinish}
                      placeholder="Auto-populated"
                      inputId="person-b-actual-finish"
                      disabled={true}
                    />
                  </View>
                </View>
              </View>
              
              {/* Calculation */}
              {personBCalculation && (
                <View style={[styles.calculationCard, isDark && styles.darkCalculationCard]}>
                  <Text style={[styles.calculationTitle, isDark && styles.darkText]}>
                    Overtime Calculation
                  </Text>
                  <View style={styles.calculationRow}>
                    <Text style={[styles.calculationLabel, isDark && styles.darkText]}>
                      Overtime:
                    </Text>
                    <Text style={[styles.calculationValue, isDark && styles.darkText]}>
                      {formatMinutes(personBCalculation.roundedOvertime)}
                    </Text>
                  </View>
                </View>
              )}
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

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.button, 
                  styles.draftButton, 
                  isDark && styles.darkDraftButton,
                ]}
                onPress={() => handleSave('draft')}
              >
                <Text style={[
                  styles.draftButtonText, 
                  isDark && styles.darkDraftButtonText,
                ]}>Save as Draft</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.button, 
                  styles.readyButton,
                  !isFormReadyForReady() && styles.disabledButton
                ]}
                onPress={() => handleSave('ready')}
                disabled={!isFormReadyForReady()}
              >
                <Text style={[
                  styles.readyButtonText,
                  !isFormReadyForReady() && styles.disabledButtonText
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
  infoBanner: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  darkInfoBanner: {
    backgroundColor: '#1a237e',
    borderColor: '#3f51b5',
  },
  infoText: {
    fontSize: 13,
    color: '#1976d2',
    lineHeight: 18,
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
    marginBottom: 8,
  },
  darkText: {
    color: '#fff',
  },
  darkInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  initialsInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    maxWidth: 100,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#333',
  },
  autoPopulatedLabel: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
    marginLeft: 8,
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
  calculationCard: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  darkCalculationCard: {
    backgroundColor: '#1a2e1a',
    borderColor: '#4CAF50',
  },
  calculationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calculationLabel: {
    fontSize: 13,
    color: '#666',
  },
  calculationValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
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
  disabledButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#999',
  },
});

