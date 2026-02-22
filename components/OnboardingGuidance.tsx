import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type OnboardingStep = 
  | 'date'
  | 'rostered-times' 
  | 'actual-times'
  | 'meal-break'
  | 'category'
  | 'comments'
  | 'concurrent-employment'
  | 'review';

interface StepIndicatorProps {
  currentStep: OnboardingStep;
  totalSteps?: number;
}

const STEP_ORDER: OnboardingStep[] = ['date', 'rostered-times', 'actual-times', 'meal-break', 'category', 'comments', 'concurrent-employment', 'review'];
const STEP_LABELS: Record<OnboardingStep, string> = {
  'date': 'Select Date',
  'rostered-times': 'Rostered Times',
  'actual-times': 'Actual Times',
  'meal-break': 'Meal Break',
  'category': 'Category',
  'comments': 'Comments',
  'concurrent-employment': 'Concurrent Employment',
  'review': 'Review & Save',
};

export function StepIndicator({ currentStep, totalSteps = 8 }: StepIndicatorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const stepNumber = currentIndex + 1;

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepText, isDark && styles.darkStepText]}>
          Step {stepNumber} of {totalSteps}
        </Text>
        <Text style={[styles.stepLabel, isDark && styles.darkStepLabel]}>
          {STEP_LABELS[currentStep]}
        </Text>
      </View>
      <View style={styles.progressBar}>
        {STEP_ORDER.slice(0, totalSteps).map((step, index) => (
          <View
            key={step}
            style={[
              styles.progressSegment,
              index < stepNumber && styles.progressSegmentCompleted,
              index === currentIndex && styles.progressSegmentCurrent,
              isDark && styles.darkProgressSegment,
              index < stepNumber && isDark && styles.darkProgressSegmentCompleted,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

interface HintProps {
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function Hint({ text, icon = 'information-circle-outline' }: HintProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.hintContainer, isDark && styles.darkHintContainer]}>
      <Ionicons name={icon} size={18} color={isDark ? '#4fc3f7' : '#007AFF'} />
      <Text style={[styles.hintText, isDark && styles.darkHintText]}>{text}</Text>
    </View>
  );
}

interface FieldHighlightProps {
  children: React.ReactNode;
  isActive: boolean;
  hint?: string;
}

export function FieldHighlight({ children, isActive, hint }: FieldHighlightProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View>
      <View
        style={[
          styles.fieldWrapper,
          isActive && styles.fieldWrapperActive,
          isActive && isDark && styles.darkFieldWrapperActive,
          !isActive && styles.fieldWrapperInactive,
        ]}
      >
        {children}
      </View>
      {isActive && hint && (
        <View style={styles.hintWrapper}>
          <Hint text={hint} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkContainer: {
    backgroundColor: '#1c1c1e',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  darkStepText: {
    color: '#4fc3f7',
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  darkStepLabel: {
    color: '#fff',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
    height: 4,
  },
  progressSegment: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  darkProgressSegment: {
    backgroundColor: '#333',
  },
  progressSegmentCompleted: {
    backgroundColor: '#4CAF50',
  },
  darkProgressSegmentCompleted: {
    backgroundColor: '#4CAF50',
  },
  progressSegmentCurrent: {
    backgroundColor: '#007AFF',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  darkHintContainer: {
    backgroundColor: '#1c1c1e',
    borderColor: '#2c2c2e',
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
  darkHintText: {
    color: '#a0c8f0',
  },
  fieldWrapper: {
    borderRadius: 12,
    padding: 3,
    marginBottom: 8,
  },
  fieldWrapperActive: {
    borderWidth: 3,
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  darkFieldWrapperActive: {
    borderColor: '#64b5f6',
    backgroundColor: '#1c1c1e',
    shadowColor: '#64b5f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 0,
  },
  fieldWrapperInactive: {
    opacity: 0.5,
  },
  hintWrapper: {
    marginTop: 8,
  },
});

