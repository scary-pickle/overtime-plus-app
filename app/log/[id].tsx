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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../lib/state/profileStore';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { useLogsStore } from '../../lib/state/logsStore';
import { TimeInput } from '../../components/TimeInput';
import { CalendarPicker } from '../../components/CalendarPicker';
import { SharedTimePickerProvider } from '../../components/SharedTimePicker';
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

export default function EditLogScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile, initials } = useProfileStore();
  const { shifts, getRosterFor } = useShiftsStore();
  const { logs, updateLog } = useLogsStore();
  
  const [log, setLog] = useState<OvertimeLog | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [actualStart, setActualStart] = useState('');
  const [actualFinish, setActualFinish] = useState('');
  const [rosteredStart, setRosteredStart] = useState('');
  const [rosteredFinish, setRosteredFinish] = useState('');
  const [mealBreakMinutes, setMealBreakMinutes] = useState(30);
  const [showMealBreakPicker, setShowMealBreakPicker] = useState(false);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Overtime');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [comments, setComments] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [minutesCalculation, setMinutesCalculation] = useState<any>(null);
  const [wasExported, setWasExported] = useState(false);
  const [showExportedWarning, setShowExportedWarning] = useState(false);

  useEffect(() => {
    if (id) {
      const foundLog = logs.find(l => l.id === id);
      if (foundLog) {
        setLog(foundLog);
        // Convert ISO date to YYYY-MM-DD format for CalendarPicker
        const logDate = new Date(foundLog.date).toISOString().split('T')[0];
        setSelectedDate(logDate);
        setActualStart(foundLog.actualStart);
        setActualFinish(foundLog.actualFinish);
        setRosteredStart(foundLog.rosteredStart || '');
        setRosteredFinish(foundLog.rosteredFinish || '');
        setMealBreakMinutes(foundLog.mealBreakMinutes || 30);
        setCategory(foundLog.category);
        setComments(foundLog.comments || '');
        setWasExported(foundLog.status === 'exported');
        
        // Show warning if log was previously exported
        if (foundLog.status === 'exported') {
          setShowExportedWarning(true);
        }
      } else {
        Alert.alert('Error', 'Log not found', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    }
  }, [id, logs]);

  useEffect(() => {
    // Recalculate when times change
    if (actualStart && actualFinish) {
      calculateMinutes();
    }
  }, [actualStart, actualFinish, mealBreakMinutes, rosteredStart, rosteredFinish]);

  const calculateMinutes = () => {
    if (!actualStart || !actualFinish) return;
    
    setIsCalculating(true);
    try {
      const calculation = computeMinutes(
        actualStart,
        actualFinish,
        rosteredStart,
        rosteredFinish,
        mealBreakMinutes
      );
      setMinutesCalculation(calculation);
    } catch (error) {
      console.error('Calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!actualStart) errors.push('Actual start time is required');
    if (!actualFinish) errors.push('Actual finish time is required');
    if (!category) errors.push('Category is required');
    
    if (actualStart && actualFinish && actualStart >= actualFinish) {
      errors.push('Finish time must be after start time');
    }
    
    return errors;
  };

  const handleSave = async () => {
    if (!log) return;
    
    const errors = validateForm();
    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }

    if (!minutesCalculation) {
      Alert.alert('Error', 'Please wait for calculation to complete');
      return;
    }

    // Use profile's employeeInitial directly if initials from store is empty
    const logInitials = initials || profile?.employeeInitial || '';
    
    console.log('Updating log with initials:', { 
      initials, 
      profile: !!profile, 
      profileInitial: profile?.employeeInitial,
      logInitials 
    });
    
    const updatedLog: OvertimeLog = {
      ...log,
      date: new Date(selectedDate).toISOString(), // Convert back to ISO format
      actualStart,
      actualFinish,
      rosteredStart: rosteredStart || undefined,
      rosteredFinish: rosteredFinish || undefined,
      mealBreakMinutes: mealBreakMinutes || undefined,
      minutesOvertime: minutesCalculation.roundedOvertime,
      category,
      comments: comments || undefined,
      initials: logInitials, // Update initials from current profile
      status: wasExported ? 'ready' : log.status, // Convert exported logs back to ready
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateLog(updatedLog);
      Alert.alert(
        'Success', 
        wasExported 
          ? 'Log updated and converted to ready status. This log was previously exported.'
          : 'Log updated successfully',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update log');
    }
  };

  const handleCancel = () => {
    if (wasExported) {
      Alert.alert(
        'Cancel Edit',
        'This log was previously exported. Are you sure you want to cancel without saving changes?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Cancel', style: 'destructive', onPress: () => router.back() }
        ]
      );
    } else {
      router.back();
    }
  };

  if (!log) {
    return (
      <View style={[styles.container, isDark && styles.darkContainer]}>
        <Text style={[styles.loadingText, isDark && styles.darkText]}>Loading...</Text>
      </View>
    );
  }

  const renderCategorySelector = () => (
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
        <View style={[styles.categoryPickerContainer, isDark && styles.darkPickerContainer]}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryOption,
                category === cat && styles.selectedCategoryOption,
                isDark && styles.darkCategoryOption,
              ]}
              onPress={() => {
                setCategory(cat);
                setShowCategoryPicker(false);
              }}
            >
              <Text style={[
                styles.categoryOptionText,
                category === cat && styles.selectedCategoryOptionText,
                isDark && styles.darkText,
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

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
      <View style={[styles.container, isDark && styles.darkContainer]}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleCancel}
            >
              <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text style={[styles.title, isDark && styles.darkText]}>Edit Log</Text>
            <TouchableOpacity 
              style={[styles.saveButton, isDark && styles.darkSaveButton]}
              onPress={handleSave}
            >
              <Text style={[styles.saveButtonText, isDark && styles.darkSaveButtonText]}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Previously Exported Warning */}
          {showExportedWarning && (
            <View style={[styles.warningBanner, isDark && styles.darkWarningBanner]}>
              <Ionicons name="warning" size={20} color="#ff6b35" />
              <Text style={[styles.warningText, isDark && styles.darkWarningText]}>
                This log was previously exported. Editing will convert it back to ready status.
              </Text>
            </View>
          )}

          <View style={styles.content}>
            {/* Date Selection */}
            <View style={[styles.section, isDark && styles.darkCard]}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Date</Text>
              <CalendarPicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Select date"
              />
            </View>

            {/* Rostered Times */}
            <View style={[styles.section, isDark && styles.darkCard]}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Rostered Times
              </Text>
              <View style={styles.timeRow}>
                <View style={styles.timeInput}>
                  <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
                  <TimeInput
                    value={rosteredStart}
                    onChange={setRosteredStart}
                    placeholder="Select rostered start time"
                    inputId="rostered-start"
                  />
                </View>
                <View style={styles.timeInput}>
                  <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
                  <TimeInput
                    value={rosteredFinish}
                    onChange={setRosteredFinish}
                    placeholder="Select rostered finish time"
                    inputId="rostered-finish"
                  />
                </View>
              </View>
            </View>

            {/* Actual Times */}
            <View style={[styles.section, isDark && styles.darkCard]}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Actual Times
              </Text>
              <View style={styles.timeRow}>
                <View style={styles.timeInput}>
                  <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
                  <TimeInput
                    value={actualStart}
                    onChange={setActualStart}
                    placeholder="Select start time"
                    inputId="actual-start"
                  />
                </View>
                <View style={styles.timeInput}>
                  <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
                  <TimeInput
                    value={actualFinish}
                    onChange={setActualFinish}
                    placeholder="Select finish time"
                    inputId="actual-finish"
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


            {/* Calculation */}
            {renderCalculation()}

            {/* Previously Exported Indicator */}
            {wasExported && (
              <View style={[styles.previouslyExportedCard, isDark && styles.darkPreviouslyExportedCard]}>
                <Ionicons name="information-circle" size={20} color="#007AFF" />
                <Text style={[styles.previouslyExportedText, isDark && styles.darkText]}>
                  Previously exported - will be converted to ready status when saved
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  darkSaveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  darkSaveButtonText: {
    color: '#fff',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  darkWarningBanner: {
    backgroundColor: '#2d2a1a',
    borderColor: '#ffc107',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
  },
  darkWarningText: {
    color: '#ffc107',
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
  previouslyExportedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  darkPreviouslyExportedCard: {
    backgroundColor: '#1a1a2e',
    borderColor: '#007AFF',
  },
  previouslyExportedText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 50,
  },
});
