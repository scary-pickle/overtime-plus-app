import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  TextInput,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../lib/state/profileStore';
import { useLocalUserStore } from '../../lib/state/localUserStore';
import { useOnboardingStore } from '../../lib/state/onboardingStore';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { useLogsStore } from '../../lib/state/logsStore';
import { TimeInput } from '../../components/TimeInput';
import { CalendarPicker } from '../../components/CalendarPicker';
import { SharedTimePickerProvider } from '../../components/SharedTimePicker';
import { NAButton } from '../../components/NAButton';
import { StepIndicator, Hint, FieldHighlight } from '../../components/OnboardingGuidance';
import { computeMinutes, formatMinutes, getCurrentDate } from '../../lib/time';
import { OvertimeLog } from '../../types';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('OnboardingCreateFirstLog');

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

type OnboardingStep = 'date' | 'rostered-times' | 'actual-times' | 'meal-break' | 'category' | 'comments' | 'concurrent-employment' | 'review';

const STEP_HINTS: Record<OnboardingStep, string> = {
  'date': 'Select the date you worked overtime. This will be used to track when the overtime occurred.',
  'rostered-times': 'Enter your scheduled start and finish times. If you don\'t have rostered times, you can mark this as N/A.',
  'actual-times': 'Enter when you actually started and finished working. This is used to calculate your overtime hours.',
  'meal-break': 'Enter the duration of your meal break in minutes. This will be deducted from your total working time.',
  'category': 'Select the type of overtime you worked. This helps categorize your log for reporting.',
  'comments': 'Add any additional comments or notes about this log entry (optional).',
  'concurrent-employment': 'Indicate if you work in more than one job at the same time.',
  'review': 'Review your log details and calculation. You can save as draft to complete later, or mark as ready.',
};

export default function OnboardingCreateFirstLog() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: 'profile' }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isTestMode = params?.from === 'profile';
  const insets = useSafeAreaInsets();
  
  const { profile, initials } = useProfileStore();
  const { localUserId } = useLocalUserStore();
  const { completeOnboarding } = useOnboardingStore();
  const { shifts, getRosterFor } = useShiftsStore();
  const { addLog } = useLogsStore();
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('date');
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
  const [minutesCalculation, setMinutesCalculation] = useState<any>(null);
  const [finishTimeError, setFinishTimeError] = useState('');
  const [concurrentEmployment, setConcurrentEmployment] = useState(false);
  const [smoCategories, setSmoCategories] = useState<Record<string, boolean>>({});

  // Refs for scrollable guided experience
  const scrollViewRef = useRef<ScrollView | null>(null);
  const contentViewRef = useRef<View | null>(null);
  const fieldRefs = useRef<Record<OnboardingStep, View | null>>({
    'date': null,
    'rostered-times': null,
    'actual-times': null,
    'meal-break': null,
    'category': null,
    'comments': null,
    'concurrent-employment': null,
    'review': null,
  });
  const fieldPositions = useRef<Record<OnboardingStep, number>>({
    'date': 0,
    'rostered-times': 0,
    'actual-times': 0,
    'meal-break': 0,
    'category': 0,
    'comments': 0,
    'concurrent-employment': 0,
    'review': 0,
  });

  // Auto-scroll to the active field when step changes, so it appears at the top of the screen
  useEffect(() => {
    const fieldRef = fieldRefs.current[currentStep];
    if (fieldRef && scrollViewRef.current && contentViewRef.current) {
      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        // Additional delay to ensure ScrollView has rendered and layout is stable
        setTimeout(() => {
          // Use measureLayout to get the position relative to the content View
          fieldRef.measureLayout(
            contentViewRef.current as any,
            (x, y, width, height) => {
              // y is the position relative to the content View (which has padding: 12)
              // The content View is inside the ScrollView, so y is already the scroll position we need
              // We want to scroll so the top of the FieldHighlight wrapper is at the top of the visible area
              // Since the content has padding: 12, we subtract that to align the field with the top
              const scrollY = Math.max(0, y - 12);
              scrollViewRef.current?.scrollTo({
                y: scrollY,
                animated: true,
              });
            },
            (error) => {
              // Fallback to using stored position if measureLayout fails
              const position = fieldPositions.current[currentStep];
              if (position >= 0) {
                // Position is already relative to content View, subtract padding to align with top
                const scrollY = Math.max(0, position - 12);
                scrollViewRef.current?.scrollTo({
                  y: scrollY,
                  animated: true,
                });
              }
            }
          );
        }, 200);
      });
    }
  }, [currentStep]);


  useEffect(() => {
    // Preload rostered times when date changes
    const roster = getRosterFor(selectedDate);
    if (roster) {
      setRosteredStart(roster.rosteredStart || '');
      setRosteredFinish(roster.rosteredFinish || '');
      setMealBreakMinutes(roster.mealBreakMinutes || 0);
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
    if (rosteredStart && !actualStart) {
      setActualStart(rosteredStart);
    }
  }, [rosteredStart]);

  useEffect(() => {
    // Validate finish time in real-time
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
    const finishMinutes = timeToMinutes(finishTime);
    const rosteredFinishMinutes = timeToMinutes(rosteredFinish);
    return finishMinutes >= rosteredFinishMinutes;
  };

  const timeToMinutes = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const calculateMinutes = () => {
    if (!actualStart || !actualFinish || actualStart === 'N/A' || actualFinish === 'N/A') return;
    
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
      debug.error('Calculation error:', error);
    }
  };

  const handleRosteredTimesNA = () => {
    const newNAStatus = !rosteredTimesNA;
    setRosteredTimesNA(newNAStatus);
    
    if (newNAStatus) {
      setRosteredStart('N/A');
      setRosteredFinish('N/A');
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

  const canProceedToNextStep = (): boolean => {
    switch (currentStep) {
      case 'date':
        return !!selectedDate;
      case 'rostered-times':
        return rosteredTimesNA || (!!rosteredStart && !!rosteredFinish);
      case 'actual-times':
        return actualTimesNA || (!!actualStart && !!actualFinish);
      case 'meal-break':
        return true; // Meal break is always valid (has default value)
      case 'category':
        return !!category;
      case 'comments':
        return true; // Comments are optional
      case 'concurrent-employment':
        return true; // Concurrent employment is always valid
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceedToNextStep()) {
      Alert.alert('Incomplete', 'Please complete the current step before continuing.');
      return;
    }

    const steps: OnboardingStep[] = ['date', 'rostered-times', 'actual-times', 'meal-break', 'category', 'comments', 'concurrent-employment', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      setCurrentStep(nextStep);
    }
  };

  const handlePrevious = () => {
    const steps: OnboardingStep[] = ['date', 'rostered-times', 'actual-times', 'meal-break', 'category', 'comments', 'concurrent-employment', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleSkip = async () => {
    if (isTestMode) {
      router.back();
      return;
    }

    Alert.alert(
      'Skip Creating Your First Log?',
      'You can always create logs later from the Logs tab. Would you like to skip this step?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            try {
              router.push('/onboarding/complete');
            } catch (error) {
              debug.error('Error navigating:', error);
              router.push('/onboarding/complete');
            }
          },
        },
      ]
    );
  };

  const handleSave = async (status: 'draft' | 'ready') => {
    if (!actualStart || !actualFinish) {
      Alert.alert('Required Fields', 'Please enter actual start and finish times.');
      return;
    }

    if (status === 'ready' && !rosteredStart && !rosteredTimesNA) {
      Alert.alert('Missing Required Fields', 'To mark as ready, please enter rostered times or mark as N/A.');
      return;
    }

    if (!validateFinishTime(actualFinish)) {
      Alert.alert('Invalid Finish Time', 'Actual finish time cannot be before your rostered finish time.');
      return;
    }

    if (!minutesCalculation) {
      Alert.alert('Calculation Error', 'Please check your times and try again.');
      return;
    }

    const logInitials = initials || profile?.employeeInitial || '';
    
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
      router.push('/onboarding/complete');
    } catch (error) {
      Alert.alert('Error', 'Failed to save log. Please try again.');
    }
  };

  const handleCompleteAndNavigate = async () => {
    if (!actualStart || !actualFinish) {
      Alert.alert('Required Fields', 'Please enter actual start and finish times.');
      return;
    }

    if (!rosteredStart && !rosteredTimesNA) {
      Alert.alert('Missing Required Fields', 'Please enter rostered times or mark as N/A.');
      return;
    }

    if (!validateFinishTime(actualFinish)) {
      Alert.alert('Invalid Finish Time', 'Actual finish time cannot be before your rostered finish time.');
      return;
    }

    if (!minutesCalculation) {
      Alert.alert('Calculation Error', 'Please check your times and try again.');
      return;
    }

    const logInitials = initials || profile?.employeeInitial || '';
    
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
      status: 'ready',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await addLog(log);
      await completeOnboarding(localUserId);
      router.replace('/(tabs)/home');
    } catch (error) {
      debug.error('Error completing onboarding:', error);
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
          <Text style={[styles.calculationLabel, isDark && styles.darkCalculationLabel]}>
            Time Worked:
          </Text>
          <Text style={[styles.calculationValue, isDark && styles.darkCalculationValue]}>
            {formatMinutes(minutesCalculation.minutesWorked)}
          </Text>
        </View>
        
        {rosteredStart && rosteredFinish && (
          <View style={styles.calculationRow}>
            <Text style={[styles.calculationLabel, isDark && styles.darkCalculationLabel]}>
              Time Rostered:
            </Text>
            <Text style={[styles.calculationValue, isDark && styles.darkCalculationValue]}>
              {formatMinutes(minutesCalculation.minutesRostered)}
            </Text>
          </View>
        )}
        
        <View style={[styles.calculationRow, styles.totalRow, isDark && styles.darkTotalRow]}>
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
    <SafeAreaView style={[styles.safeArea, isDark && styles.darkSafeArea]} edges={['top']}>
      <SharedTimePickerProvider>
        <View style={styles.mainContainer}>
          {/* Header */}
          <View style={[styles.header, isDark && styles.darkHeader]}>
            <View style={styles.headerContent}>
              <Text style={[styles.headerTitle, isDark && styles.darkHeaderTitle]}>
                Create Your First Log
              </Text>
              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={[styles.skipButtonText, isDark && styles.darkSkipButtonText]}>
                  Skip
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Step Indicator */}
          <View style={styles.stepIndicatorContainer}>
            <StepIndicator currentStep={currentStep} />
          </View>

          {/* Scrollable Form - Show all fields */}
          <ScrollView 
            ref={scrollViewRef}
            style={[styles.container, isDark && styles.darkContainer]} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            scrollEnabled={true}
            scrollEventThrottle={16}
          >
          <View ref={contentViewRef} style={styles.content}>
            {/* Date Selection */}
            <View
              ref={(ref) => { fieldRefs.current['date'] = ref; }}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                fieldPositions.current['date'] = y;
              }}
            >
              <FieldHighlight 
                isActive={currentStep === 'date'}
                hint={currentStep === 'date' ? STEP_HINTS.date : undefined}
              >
                <View 
                  style={[
                    styles.section, 
                    isDark && styles.darkCard,
                    currentStep !== 'date' && styles.disabledSection
                  ]}
                  pointerEvents={currentStep === 'date' ? 'auto' : 'none'}
                >
                <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                  Date
                </Text>
                <CalendarPicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  placeholder="Select date"
                  disabled={currentStep !== 'date'}
                />
              </View>
            </FieldHighlight>
            </View>

            {/* Rostered Times */}
            <View
              ref={(ref) => { fieldRefs.current['rostered-times'] = ref; }}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                fieldPositions.current['rostered-times'] = y;
              }}
            >
              <FieldHighlight 
                isActive={currentStep === 'rostered-times'}
                hint={currentStep === 'rostered-times' ? STEP_HINTS['rostered-times'] : undefined}
              >
                <View 
                  style={[
                    styles.section, 
                    isDark && styles.darkCard,
                    currentStep !== 'rostered-times' && styles.disabledSection
                  ]}
                  pointerEvents={currentStep === 'rostered-times' ? 'auto' : 'none'}
                >
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                    Rostered Times
                  </Text>
                  <NAButton
                    onPress={handleRosteredTimesNA}
                    isActive={rosteredTimesNA}
                    disabled={currentStep !== 'rostered-times'}
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
                      disabled={rosteredTimesNA || currentStep !== 'rostered-times'}
                    />
                  </View>
                  <View style={styles.timeInput}>
                    <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
                    <TimeInput
                      value={rosteredFinish}
                      onChange={setRosteredFinish}
                      placeholder="Select rostered finish time"
                      inputId="rostered-finish"
                      disabled={rosteredTimesNA || currentStep !== 'rostered-times'}
                    />
                  </View>
                </View>
              </View>
              </FieldHighlight>
            </View>

            {/* Actual Times */}
            <View
              ref={(ref) => { fieldRefs.current['actual-times'] = ref; }}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                fieldPositions.current['actual-times'] = y;
              }}
            >
              <FieldHighlight 
                isActive={currentStep === 'actual-times'}
                hint={currentStep === 'actual-times' ? STEP_HINTS['actual-times'] : undefined}
              >
                <View 
                  style={[
                    styles.section, 
                    isDark && styles.darkCard,
                    currentStep !== 'actual-times' && styles.disabledSection
                  ]}
                  pointerEvents={currentStep === 'actual-times' ? 'auto' : 'none'}
                >
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                    Actual Times
                  </Text>
                  <NAButton
                    onPress={handleActualTimesNA}
                    isActive={actualTimesNA}
                    disabled={currentStep !== 'actual-times'}
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
                      disabled={actualTimesNA || currentStep !== 'actual-times'}
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
                      disabled={actualTimesNA || currentStep !== 'actual-times'}
                    />
                  </View>
                </View>
              </View>
              </FieldHighlight>
            </View>

            {/* Show calculation preview when actual times are filled */}
            {currentStep === 'actual-times' && renderCalculation()}

            {/* Meal Break */}
            <View
              ref={(ref) => { fieldRefs.current['meal-break'] = ref; }}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                fieldPositions.current['meal-break'] = y;
              }}
            >
              <FieldHighlight 
                isActive={currentStep === 'meal-break'}
                hint={currentStep === 'meal-break' ? STEP_HINTS['meal-break'] : undefined}
              >
                <View 
                  style={[
                    styles.section, 
                    isDark && styles.darkCard,
                    currentStep !== 'meal-break' && styles.disabledSection
                  ]}
                  pointerEvents={currentStep === 'meal-break' ? 'auto' : 'none'}
                >
                <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                  Meal Break (minutes)
                </Text>
                <TouchableOpacity
                  style={[
                    styles.mealBreakButton, 
                    isDark && styles.darkInput,
                    currentStep !== 'meal-break' && styles.disabledButton
                  ]}
                  onPress={() => setShowMealBreakPicker(!showMealBreakPicker)}
                  disabled={currentStep !== 'meal-break'}
                >
                  <Text style={[
                    styles.mealBreakText, 
                    isDark && styles.darkText,
                    currentStep !== 'meal-break' && styles.disabledText
                  ]}>
                    {mealBreakMinutes} minutes
                  </Text>
                </TouchableOpacity>
                
                {showMealBreakPicker && currentStep === 'meal-break' && (
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
              </FieldHighlight>
            </View>

            {/* Category */}
            <View
              ref={(ref) => { fieldRefs.current['category'] = ref; }}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                fieldPositions.current['category'] = y;
              }}
            >
              <FieldHighlight 
                isActive={currentStep === 'category'}
                hint={currentStep === 'category' ? STEP_HINTS.category : undefined}
              >
                <View 
                  style={currentStep !== 'category' && styles.disabledSection}
                  pointerEvents={currentStep === 'category' ? 'auto' : 'none'}
                >
                  {renderCategorySelector()}
                </View>
              </FieldHighlight>
            </View>

            {/* Comments */}
            <View
              ref={(ref) => { fieldRefs.current['comments'] = ref; }}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                fieldPositions.current['comments'] = y;
              }}
            >
              <FieldHighlight 
                isActive={currentStep === 'comments'}
                hint={currentStep === 'comments' ? STEP_HINTS.comments : undefined}
              >
                <View 
                  style={[
                    styles.section, 
                    isDark && styles.darkCard,
                    currentStep !== 'comments' && styles.disabledSection
                  ]}
                  pointerEvents={currentStep === 'comments' ? 'auto' : 'none'}
                >
                <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                  Comments (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.commentsInput,
                    isDark && styles.darkInput,
                    isDark && styles.darkText,
                    currentStep !== 'comments' && styles.disabledInput
                  ]}
                  value={comments}
                  onChangeText={setComments}
                  placeholder="Add comments..."
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={currentStep === 'comments'}
                />
              </View>
              </FieldHighlight>
            </View>

            {/* Concurrent Employment */}
            <View
              ref={(ref) => { fieldRefs.current['concurrent-employment'] = ref; }}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                fieldPositions.current['concurrent-employment'] = y;
              }}
            >
              <FieldHighlight 
                isActive={currentStep === 'concurrent-employment'}
                hint={currentStep === 'concurrent-employment' ? STEP_HINTS['concurrent-employment'] : undefined}
              >
                <View 
                  style={[
                    styles.section, 
                    isDark && styles.darkCard,
                    currentStep !== 'concurrent-employment' && styles.disabledSection
                  ]}
                  pointerEvents={currentStep === 'concurrent-employment' ? 'auto' : 'none'}
                >
                <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                  Concurrent Employment
                </Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton, 
                    isDark && styles.darkToggleButton,
                    currentStep !== 'concurrent-employment' && styles.disabledButton
                  ]}
                  onPress={() => setConcurrentEmployment(!concurrentEmployment)}
                  disabled={currentStep !== 'concurrent-employment'}
                >
                  <View style={[styles.toggleContainer, isDark && styles.darkToggleContainer]}>
                    <View style={[
                      styles.toggleSwitch,
                      concurrentEmployment && styles.toggleSwitchActive,
                      isDark && styles.darkToggleSwitch,
                      concurrentEmployment && isDark && styles.darkToggleSwitchActive,
                      currentStep !== 'concurrent-employment' && styles.disabledToggleSwitch
                    ]}>
                      <View style={[
                        styles.toggleThumb,
                        concurrentEmployment && styles.toggleThumbActive,
                        isDark && styles.darkToggleThumb
                      ]} />
                    </View>
                    <Text style={[
                      styles.toggleLabel, 
                      isDark && styles.darkText,
                      currentStep !== 'concurrent-employment' && styles.disabledText
                    ]}>
                      {concurrentEmployment ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              </FieldHighlight>
            </View>

            {/* Review Step - Show Summary */}
            {currentStep === 'review' && (
              <View
                ref={(ref) => { fieldRefs.current['review'] = ref; }}
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  fieldPositions.current['review'] = y;
                }}
              >
                <FieldHighlight 
                  isActive={true}
                  hint={STEP_HINTS.review}
                >
                  <View 
                    style={[styles.section, isDark && styles.darkCard]}
                  >
                  <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                    Review Your Log
                  </Text>
                  <View style={styles.reviewSummary}>
                    <View style={styles.reviewRow}>
                      <Text style={[styles.reviewLabel, isDark && styles.darkReviewLabel]}>Date:</Text>
                      <Text style={[styles.reviewValue, isDark && styles.darkReviewValue]}>{selectedDate}</Text>
                    </View>
                    <View style={styles.reviewRow}>
                      <Text style={[styles.reviewLabel, isDark && styles.darkReviewLabel]}>Actual Times:</Text>
                      <Text style={[styles.reviewValue, isDark && styles.darkReviewValue]}>{actualStart} - {actualFinish}</Text>
                    </View>
                    {(rosteredStart && rosteredFinish) && (
                      <View style={styles.reviewRow}>
                        <Text style={[styles.reviewLabel, isDark && styles.darkReviewLabel]}>Rostered Times:</Text>
                        <Text style={[styles.reviewValue, isDark && styles.darkReviewValue]}>{rosteredStart} - {rosteredFinish}</Text>
                      </View>
                    )}
                    <View style={styles.reviewRow}>
                      <Text style={[styles.reviewLabel, isDark && styles.darkReviewLabel]}>Meal Break:</Text>
                      <Text style={[styles.reviewValue, isDark && styles.darkReviewValue]}>{mealBreakMinutes} minutes</Text>
                    </View>
                    <View style={styles.reviewRow}>
                      <Text style={[styles.reviewLabel, isDark && styles.darkReviewLabel]}>Category:</Text>
                      <Text style={[styles.reviewValue, isDark && styles.darkReviewValue]}>{category}</Text>
                    </View>
                    <View style={styles.reviewRow}>
                      <Text style={[styles.reviewLabel, isDark && styles.darkReviewLabel]}>Concurrent Employment:</Text>
                      <Text style={[styles.reviewValue, isDark && styles.darkReviewValue]}>{concurrentEmployment ? 'Yes' : 'No'}</Text>
                    </View>
                    {comments && (
                      <View style={styles.reviewRow}>
                        <Text style={[styles.reviewLabel, isDark && styles.darkReviewLabel]}>Comments:</Text>
                        <Text style={[styles.reviewValue, isDark && styles.darkReviewValue]}>{comments}</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                  {/* Show calculation in review */}
                  {renderCalculation()}
                </FieldHighlight>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={[
          styles.navigationBar, 
          isDark && styles.darkNavigationBar,
          { paddingBottom: Math.max(insets.bottom, 12) }
        ]}>
          {currentStep !== 'date' && (
            <TouchableOpacity
              style={[styles.navButton, styles.prevButton, isDark && styles.darkNavButton]}
              onPress={handlePrevious}
              activeOpacity={0.7}
            >
              <View style={styles.navButtonContent}>
                <Ionicons name="chevron-back" size={22} color={isDark ? '#4fc3f7' : '#007AFF'} />
                <Text style={[styles.navButtonText, isDark && styles.darkNavButtonText]}>
                  Previous
                </Text>
              </View>
            </TouchableOpacity>
          )}
          
          {currentStep !== 'review' ? (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.nextButton,
                !canProceedToNextStep() && styles.navButtonDisabled,
                !canProceedToNextStep() && isDark && styles.darkNavButtonDisabled,
              ]}
              onPress={handleNext}
              disabled={!canProceedToNextStep()}
              activeOpacity={0.8}
            >
              <View style={styles.navButtonContent}>
                <Text style={[
                  styles.navButtonText,
                  styles.nextButtonText,
                  !canProceedToNextStep() && styles.navButtonTextDisabled,
                  !canProceedToNextStep() && isDark && styles.darkNavButtonTextDisabled,
                ]}>
                  Next
                </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={22} 
                  color={!canProceedToNextStep() ? (isDark ? '#666' : '#999') : '#fff'} 
                />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.nextButton,
              ]}
              onPress={handleCompleteAndNavigate}
              activeOpacity={0.8}
            >
              <View style={styles.navButtonContent}>
                <Text style={[
                  styles.navButtonText,
                  styles.nextButtonText,
                ]}>
                  Next
                </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={22} 
                  color="#fff" 
                />
              </View>
            </TouchableOpacity>
          )}
        </View>
        </View>
      </SharedTimePickerProvider>
    </SafeAreaView>
  );
}

// Styles - reusing from new.tsx with additions
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkSafeArea: {
    backgroundColor: '#0a0a0a',
  },
  mainContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  darkHeader: {
    backgroundColor: '#1c1c1e',
    borderBottomColor: '#2c2c2e',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.3,
  },
  darkHeaderTitle: {
    color: '#fff',
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: -0.2,
  },
  darkSkipButtonText: {
    color: '#64b5f6',
  },
  stepIndicatorContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    paddingBottom: 12,
  },
  content: {
    padding: 12,
  },
  disabledSection: {
    opacity: 0.4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledInput: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.6,
  },
  disabledToggleSwitch: {
    opacity: 0.5,
  },
  disabledSection: {
    opacity: 0.4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledInput: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.6,
  },
  disabledToggleSwitch: {
    opacity: 0.5,
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
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 0.5,
    borderColor: '#2c2c2e',
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
    borderColor: '#3a3a3c',
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
    borderColor: '#2c2c2e',
  },
  mealBreakOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkMealBreakOption: {
    borderBottomColor: '#2c2c2e',
    backgroundColor: '#1c1c1e',
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
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  categoryPickerContainer: {
    marginTop: 8,
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  categoryOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkCategoryOption: {
    borderBottomColor: '#2c2c2e',
    backgroundColor: '#1c1c1e',
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
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  toggleButton: {
    marginTop: 8,
  },
  darkToggleButton: {
    // Additional dark styles if needed
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  darkToggleContainer: {
    // Additional dark styles if needed
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    padding: 2,
  },
  darkToggleSwitch: {
    backgroundColor: '#444',
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
    color: '#333',
  },
  smoCategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  darkSmoCategoryOption: {
    // Additional dark styles if needed
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  smoCategoryLabel: {
    fontSize: 16,
    color: '#333',
  },
  calculationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  darkCalculationCard: {
    backgroundColor: '#1c1c1e',
    borderColor: '#4CAF50',
    borderWidth: 1.5,
  },
  calculationTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calculationLabel: {
    fontSize: 14,
    color: '#666',
  },
  darkCalculationLabel: {
    color: '#999',
  },
  calculationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  darkCalculationValue: {
    color: '#fff',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  darkTotalRow: {
    borderTopColor: '#2c2c2e',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  reviewSummary: {
    marginTop: 12,
    gap: 12,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  reviewLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  darkReviewLabel: {
    color: '#999',
  },
  reviewValue: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  darkReviewValue: {
    color: '#fff',
  },
  reviewHighlight: {
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 8,
  },
  navigationBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  darkNavigationBar: {
    backgroundColor: '#1c1c1e',
    borderTopColor: '#2c2c2e',
    shadowOpacity: 0,
    elevation: 0,
  },
  navButton: {
    borderRadius: 12,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  prevButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
    minWidth: 120,
  },
  darkNavButton: {
    borderColor: '#64b5f6',
  },
  nextButton: {
    backgroundColor: '#007AFF',
    flex: 1,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  navButtonDisabled: {
    backgroundColor: '#e0e0e0',
    shadowOpacity: 0,
    elevation: 0,
  },
  darkNavButtonDisabled: {
    backgroundColor: '#2c2c2e',
  },
  navButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 0.3,
  },
  nextButtonText: {
    color: '#fff',
  },
  darkNavButtonText: {
    color: '#64b5f6',
  },
  navButtonTextDisabled: {
    color: '#999',
  },
  darkNavButtonTextDisabled: {
    color: '#666',
  },
  reviewActions: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  draftButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  darkDraftButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#3a3a3c',
  },
  readyButton: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 0.3,
  },
  readyButtonText: {
    color: '#fff',
  },
  darkDraftButtonText: {
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});

