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
import { useLocalUserStore } from '../../lib/state/localUserStore';
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
  const { localUserId } = useLocalUserStore();
  const { addShiftSwapLogs } = useLogsStore();
  
  const [personADate, setPersonADate] = useState(getCurrentDate());
  const [personBDate, setPersonBDate] = useState(getCurrentDate()); // Default to same date
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
  
  // Track if dates are different
  const isDifferentDates = personADate !== personBDate;
  
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [personACalculation, setPersonACalculation] = useState<any>(null);
  const [personBCalculation, setPersonBCalculation] = useState<any>(null);

  // Auto-populate Person B's times from Person A's times
  // Simplified: User only enters Person A rostered and actual times
  useEffect(() => {
    if (isDifferentDates) {
      // DIFFERENT DATES:
      // Person B actual times (Date 1) = Person A rostered times (Date 1)
      if (personARosteredStart && personARosteredFinish && !personARosteredTimesNA) {
        setPersonBActualStart(personARosteredStart);
        setPersonBActualFinish(personARosteredFinish);
      } else {
        setPersonBActualStart('');
        setPersonBActualFinish('');
      }
      
      // Person B rostered times (Date 2) = Person A actual times (Date 2)
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
      // SAME DATE: Use existing logic
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
    }
  }, [personARosteredStart, personARosteredFinish, personAActualStart, personAActualFinish, personARosteredTimesNA, isDifferentDates]);
  
  // Sync Person B date with Person A date when they're the same (for convenience)
  useEffect(() => {
    if (!isDifferentDates && personADate !== personBDate) {
      setPersonBDate(personADate);
    }
  }, [personADate, isDifferentDates]);

  useEffect(() => {
    // Auto-calculate when times change
    if (isDifferentDates) {
      // For different dates, we need to calculate for Person A Date 1 (rostered filled, actual 'N/A')
      // This represents the original shift that wasn't worked
      if (personARosteredStart && personARosteredFinish && !personARosteredTimesNA) {
        try {
          const calc = computeMinutes(
            'N/A', // Actual times are N/A for Date 1
            'N/A',
            personARosteredStart,
            personARosteredFinish,
            mealBreakMinutes
          );
          setPersonACalculation(calc);
        } catch (error) {
          debug.error('Person A calculation error:', error);
          setPersonACalculation(null);
        }
      } else {
        setPersonACalculation(null);
      }
    } else {
      // Same date: existing logic
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
    }
  }, [personAActualStart, personAActualFinish, personARosteredStart, personARosteredFinish, personARosteredTimesNA, mealBreakMinutes, isDifferentDates]);

  useEffect(() => {
    // Auto-calculate when times change
    if (isDifferentDates) {
      // For different dates, Person B Date 2: rostered filled (from Person A actual), actual 'N/A'
      // We calculate for Date 2 (original shift with rostered, actual 'N/A')
      // Person B's rostered = Person A's actual (auto-populated)
      // Person B's actual on Date 2 is always 'N/A' (they didn't work their original shift)
      // Use Person A's actual times directly since they auto-populate Person B's rostered
      if (personAActualStart && personAActualFinish && personAActualStart !== 'N/A' && personAActualFinish !== 'N/A') {
        try {
          const calc = computeMinutes(
            'N/A',
            'N/A',
            personAActualStart, // Person B's rostered = Person A's actual
            personAActualFinish,
            mealBreakMinutes
          );
          setPersonBCalculation(calc);
        } catch (error) {
          debug.error('Person B calculation error:', error);
          setPersonBCalculation(null);
        }
      } else {
        setPersonBCalculation(null);
      }
    } else {
      // Same date: existing logic
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
    }
  }, [personBActualStart, personBActualFinish, personBRosteredStart, personBRosteredFinish, personAActualStart, personAActualFinish, mealBreakMinutes, isDifferentDates]);

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    // Person A validation - initials come from profile, no need to validate
    
    if (!personARosteredTimesNA) {
      if (!personARosteredStart || !personARosteredFinish) {
        errors.push('Person A rostered times are required (or mark as N/A)');
      }
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
    
    if (isDifferentDates) {
      // DIFFERENT DATES validation - simplified
      // Person A Date 1: rostered filled, actual 'N/A' (handled in store, not validated here)
      // Person A Date 2: rostered 'N/A', actual filled (user enters this)
      if (!personAActualStart || !personAActualFinish || personAActualStart === 'N/A' || personAActualFinish === 'N/A') {
        errors.push('Person A actual times are required (these represent the shift worked on Date 2)');
      }
      
      // Person A rostered times are required for Date 1
      if (!personARosteredTimesNA && (!personARosteredStart || !personARosteredFinish)) {
        errors.push('Person A rostered times are required (or mark as N/A)');
      }
      
      // Person B times are auto-populated, so we just verify they're set
      // Person B actual (Date 1) = Person A rostered (auto-populated)
      if (!personARosteredTimesNA) {
        if (!personBActualStart || !personBActualFinish || personBActualStart === 'N/A' || personBActualFinish === 'N/A') {
          errors.push('Person B actual times should be auto-populated from Person A rostered times');
        }
      }
      
      // Person B rostered (Date 2) = Person A actual (auto-populated)
      if (!personBRosteredStart || !personBRosteredFinish || personBRosteredStart === 'N/A' || personBRosteredFinish === 'N/A') {
        errors.push('Person B rostered times should be auto-populated from Person A actual times');
      }
    } else {
      // SAME DATE validation (existing logic)
      if (!personAActualStart || !personAActualFinish) {
        errors.push('Person A actual times are required');
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
    }
    
    return errors;
  };

  const isFormReadyForReady = (): boolean => {
    // Check all required fields are filled
    // Person A initials come from profile, no need to validate
    
    if (!personBInitials.trim() || personBInitials.trim().length < 2 || personBInitials.trim().length > 3) {
      debug.debug('Validation failed: Person B initials');
      return false;
    }
    
    if (!personBName.trim()) {
      debug.debug('Validation failed: Person B name');
      return false;
    }
    
    if (!personBPayrollNumber.trim()) {
      debug.debug('Validation failed: Person B payroll number');
      return false;
    }
    
    if (isDifferentDates) {
      // DIFFERENT DATES validation - simplified
      // Person A rostered times (Date 1)
      if (!personARosteredTimesNA && (!personARosteredStart || !personARosteredFinish)) {
        debug.debug('Validation failed: Person A rostered times', { personARosteredStart, personARosteredFinish, personARosteredTimesNA });
        return false;
      }
      
      // Person A actual times (Date 2)
      if (!personAActualStart || !personAActualFinish || personAActualStart === 'N/A' || personAActualFinish === 'N/A') {
        debug.debug('Validation failed: Person A actual times', { personAActualStart, personAActualFinish });
        return false;
      }
      
      // Person B times are auto-populated, verify they're set
      if (!personARosteredTimesNA) {
        if (!personBActualStart || !personBActualFinish || personBActualStart === 'N/A' || personBActualFinish === 'N/A') {
          debug.debug('Validation failed: Person B actual times', { personBActualStart, personBActualFinish, personARosteredTimesNA });
          return false;
        }
      }
      
      if (!personBRosteredStart || !personBRosteredFinish || personBRosteredStart === 'N/A' || personBRosteredFinish === 'N/A') {
        debug.debug('Validation failed: Person B rostered times', { personBRosteredStart, personBRosteredFinish });
        return false;
      }
      
      // Check calculations exist
      if (!personACalculation) {
        debug.debug('Validation failed: Person A calculation missing', { personACalculation });
        return false;
      }
      if (!personBCalculation) {
        debug.debug('Validation failed: Person B calculation missing', { personBCalculation });
        return false;
      }
    } else {
      // SAME DATE validation (existing logic)
      if (!personAActualStart || !personAActualFinish || personAActualStart === 'N/A' || personAActualFinish === 'N/A') {
        return false;
      }
      
      if (!personARosteredTimesNA && (!personARosteredStart || !personARosteredFinish)) {
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
          personADate,
          personBDate,
          personAInitials: (initials || profile?.employeeInitial || '').trim().toUpperCase(),
          personARosteredStart: personARosteredTimesNA ? 'N/A' : personARosteredStart,
          personARosteredFinish: personARosteredTimesNA ? 'N/A' : personARosteredFinish,
          personAActualStart, // For different dates, this represents Person A's actual times on Date 2 (Person B's rostered)
          personAActualFinish, // For different dates, this represents Person A's actual times on Date 2 (Person B's rostered)
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
        localUserId
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
          <Text style={[styles.label, isDark && styles.darkText]}>
            Actual Times {isDifferentDates && title === 'Person A (You)' ? '(Date 2: the shift you worked)' : ''} *
          </Text>
          <View style={styles.timeRow}>
            <View style={styles.timeInput}>
              <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
              <TimeInput
                value={actualStart}
                onChange={setActualStart}
                placeholder={isDifferentDates && title === 'Person A (You)' ? "Enter shift start time (Date 2)" : "Select actual start time"}
                inputId={`${title.toLowerCase()}-actual-start`}
              />
            </View>
            <View style={styles.timeInput}>
              <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
              <TimeInput
                value={actualFinish}
                onChange={setActualFinish}
                placeholder={isDifferentDates && title === 'Person A (You)' ? "Enter shift finish time (Date 2)" : "Select actual finish time"}
                inputId={`${title.toLowerCase()}-actual-finish`}
              />
            </View>
          </View>
          {isDifferentDates && title === 'Person A (You)' && (
            <Text style={[styles.autoPopulatedLabel, isDark && styles.darkSecondaryText, { marginTop: 4 }]}>
              This becomes Person B's rostered times for Date 2
            </Text>
          )}
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
                {isDifferentDates 
                  ? 'Create a shift swap across different dates. Enter Person A\'s rostered times (Date 1) and actual times (Date 2). Person B\'s times will auto-populate. This creates 4 log entries.'
                  : 'Create a shift swap entry. Person B\'s times will automatically populate from Person A\'s times. Enter Person A\'s shift details, then fill in Person B\'s name and details.'}
              </Text>
            </View>

            {/* Date Selection */}
            <View style={[styles.section, isDark && styles.darkCard]}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Dates
              </Text>
              
              {/* Person A Date */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.darkText]}>
                  Person A's Original Shift Date
                </Text>
                <CalendarPicker
                  value={personADate}
                  onChange={setPersonADate}
                  placeholder="Select Person A's date"
                />
              </View>
              
              {/* Person B Date */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.darkText]}>
                  Person B's Original Shift Date
                </Text>
                <CalendarPicker
                  value={personBDate}
                  onChange={setPersonBDate}
                  placeholder="Select Person B's date"
                />
                {isDifferentDates && (
                  <Text style={[styles.infoText, isDark && styles.darkSecondaryText, { marginTop: 8, fontSize: 12 }]}>
                    Different dates selected - will create 4 log entries
                  </Text>
                )}
                {!isDifferentDates && (
                  <Text style={[styles.infoText, isDark && styles.darkSecondaryText, { marginTop: 8, fontSize: 12 }]}>
                    Same date - will create 2 log entries (same date swap)
                  </Text>
                )}
              </View>
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
              
              {/* Rostered Times */}
              <View style={styles.inputGroup}>
                <View>
                  <Text style={[styles.label, isDark && styles.darkText]}>
                    Rostered Times {isDifferentDates ? '(Date 2: Person B\'s original shift)' : ''}
                  </Text>
                  <Text style={[styles.autoPopulatedLabel, isDark && styles.darkSecondaryText, { marginLeft: 0, marginTop: 4 }]}>
                    {isDifferentDates ? 'Auto-populated from Person A\'s actual times (Date 2)' : '(Auto from Person A\'s actual times)'}
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
              
              {/* Actual Times */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && styles.darkText]}>
                  Actual Times {isDifferentDates ? '(Date 1: Person B worked Person A\'s shift)' : '(New Shift)'} *
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
                {isDifferentDates && (
                  <Text style={[styles.autoPopulatedLabel, isDark && styles.darkSecondaryText, { marginTop: 4 }]}>
                    Auto-populated from Person A's rostered times (Date 1)
                  </Text>
                )}
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
  darkSecondaryText: {
    color: '#999',
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
    flexWrap: 'wrap',
    flexShrink: 1,
    flex: 1,
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

