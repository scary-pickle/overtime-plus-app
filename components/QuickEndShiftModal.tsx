import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useColorScheme,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { OvertimeLog } from '../types';
import { useProfileStore } from '../lib/state/profileStore';
import { useLogsStore, validateLogForReady } from '../lib/state/logsStore';
import { computeMinutes, formatMinutes, getCurrentTime, getShiftStartDate, getCurrentDate } from '../lib/time';
import { TimeInput } from './TimeInput';
import { SharedTimePickerProvider } from './SharedTimePicker';
import { NAButton } from './NAButton';

interface QuickEndShiftModalProps {
  visible: boolean;
  draftLog: OvertimeLog | null;
  noRosterMode?: boolean;
  onClose: () => void;
  onComplete: () => void;
}

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

export function QuickEndShiftModal({
  visible,
  draftLog,
  noRosterMode = false,
  onClose,
  onComplete,
}: QuickEndShiftModalProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile } = useProfileStore();
  const { updateLog, clearActiveShift } = useLogsStore();
  
  // State for editable fields
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Overtime');
  const [comments, setComments] = useState('');
  const [mealBreakMinutes, setMealBreakMinutes] = useState(30);
  const [showMealBreakPicker, setShowMealBreakPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [smoCategories, setSmoCategories] = useState<Record<string, boolean>>({});
  
  // No roster mode state
  const [rosteredStart, setRosteredStart] = useState('');
  const [rosteredFinish, setRosteredFinish] = useState('');
  const [actualStart, setActualStart] = useState('');
  const [actualFinish, setActualFinish] = useState('');
  const [rosteredTimesNA, setRosteredTimesNA] = useState(false);
  const [isEditingActualTimes, setIsEditingActualTimes] = useState(false);
  
  // Calculation
  const [minutesCalculation, setMinutesCalculation] = useState<any>(null);

  // Initialize from draft log
  useEffect(() => {
    if (draftLog) {
      setCategory(draftLog.category);
      setComments(draftLog.comments || '');
      setMealBreakMinutes(draftLog.mealBreakMinutes || 30);
      setSmoCategories(draftLog.smoCategories || {});
      
      if (noRosterMode) {
        setRosteredStart(draftLog.rosteredStart && draftLog.rosteredStart !== 'N/A' ? draftLog.rosteredStart : '');
        setRosteredFinish(draftLog.rosteredFinish && draftLog.rosteredFinish !== 'N/A' ? draftLog.rosteredFinish : '');
        setActualStart(draftLog.actualStart !== 'N/A' ? draftLog.actualStart : '');
        setActualFinish(draftLog.actualFinish !== 'N/A' ? draftLog.actualFinish : '');
        // Set N/A if rostered times are undefined or 'N/A'
        setRosteredTimesNA(!draftLog.rosteredStart || draftLog.rosteredStart === 'N/A' || 
                           !draftLog.rosteredFinish || draftLog.rosteredFinish === 'N/A');
        // Auto-enable editing if actual start is N/A (user needs to enter it)
        if (draftLog.actualStart === 'N/A' || !draftLog.actualStart) {
          setIsEditingActualTimes(true);
        }
      } else {
        // Initialize actual times for editing (even when not in noRosterMode)
        setActualStart(draftLog.actualStart !== 'N/A' ? draftLog.actualStart : '');
        setActualFinish(draftLog.actualFinish !== 'N/A' ? draftLog.actualFinish : '');
      }
      
      // Calculate minutes
      calculateMinutes();
    }
  }, [draftLog, noRosterMode]);

  // Recalculate when relevant fields change
  useEffect(() => {
    if (draftLog) {
      calculateMinutes();
    }
  }, [mealBreakMinutes, rosteredStart, rosteredFinish, actualStart, actualFinish, rosteredTimesNA, draftLog, isEditingActualTimes]);

  const calculateMinutes = () => {
    if (!draftLog) return;
    
    // Use editable times if editing, otherwise use draft log times
    const start = (isEditingActualTimes && actualStart) ? actualStart : 
                  (noRosterMode && actualStart) ? actualStart : 
                  draftLog.actualStart;
    const finish = (isEditingActualTimes && actualFinish) ? actualFinish : 
                   draftLog.actualFinish;
    const rStart = noRosterMode ? (rosteredTimesNA ? 'N/A' : rosteredStart) : draftLog.rosteredStart;
    const rFinish = noRosterMode ? (rosteredTimesNA ? 'N/A' : rosteredFinish) : draftLog.rosteredFinish;
    
    if (start && finish && start !== 'N/A' && finish !== 'N/A') {
      const calculation = computeMinutes(
        start,
        finish,
        rStart || undefined,
        rFinish || undefined,
        mealBreakMinutes
      );
      setMinutesCalculation(calculation);
    }
  };

  const handleRosteredTimesNA = () => {
    const newNAStatus = !rosteredTimesNA;
    setRosteredTimesNA(newNAStatus);
    if (newNAStatus) {
      // Set to 'N/A' to give visual feedback
      setRosteredStart('N/A');
      setRosteredFinish('N/A');
    } else {
      // Clear when unchecking N/A
      setRosteredStart('');
      setRosteredFinish('');
    }
  };

  const handleEdit = () => {
    if (!draftLog) return;
    onClose();
    router.push(`/log/${draftLog.id}`);
  };

  const handleMarkAsReady = async () => {
    if (!draftLog || !minutesCalculation) return;

    // Validation for editing actual times
    if (isEditingActualTimes) {
      if (!actualStart || !actualFinish) {
        Alert.alert('Missing Information', 'Please enter both actual start and finish times.');
        return;
      }
    }

    // Validation for no roster mode
    if (noRosterMode) {
      // Check if actual start is available (either from editing or draft log)
      const hasActualStart = isEditingActualTimes ? actualStart : draftLog.actualStart;
      if (!hasActualStart || hasActualStart === 'N/A') {
        Alert.alert('Missing Information', 'Please enter your actual start time.');
        return;
      }
      if (!rosteredTimesNA && (!rosteredStart || !rosteredFinish)) {
        Alert.alert('Missing Information', 'Please enter your rostered times or mark them as N/A.');
        return;
      }
    }

    // Check if overtime exceeds 6 hours (360 minutes)
    if (minutesCalculation.roundedOvertime > 360) {
      Alert.alert(
        'Overtime Exceeds 6 Hours',
        'The overtime logged exceeds 6 hours. Is this correct?',
        [
          { text: 'Re-edit', style: 'cancel' },
          { text: 'Confirm', onPress: () => saveLog() }
        ]
      );
    } else {
      await saveLog();
    }
  };

  const saveLog = async () => {
    if (!draftLog) return;

    try {
      // Determine the actual start and finish times
      // Use editable times if editing, otherwise use draft log times
      const finalActualStart = (isEditingActualTimes && actualStart) ? actualStart :
                               (noRosterMode && actualStart) ? actualStart : 
                               draftLog.actualStart;
      const finalActualFinish = (isEditingActualTimes && actualFinish) ? actualFinish : 
                                draftLog.actualFinish;
      
      // Calculate the correct date based on start and finish times
      // Use the draft log's date as the end date, or today if not available
      const endDate = draftLog.date || getCurrentDate();
      const shiftStartDate = getShiftStartDate(endDate, finalActualStart, finalActualFinish);
      
      const updatedLog: OvertimeLog = {
        ...draftLog,
        date: shiftStartDate, // Ensure date is based on start time
        rosteredStart: noRosterMode ? (rosteredTimesNA ? 'N/A' : rosteredStart || undefined) : draftLog.rosteredStart,
        rosteredFinish: noRosterMode ? (rosteredTimesNA ? 'N/A' : rosteredFinish || undefined) : draftLog.rosteredFinish,
        actualStart: finalActualStart,
        mealBreakMinutes,
        minutesOvertime: minutesCalculation.roundedOvertime,
        category,
        comments: comments || undefined,
        smoCategories: profile?.isSMO ? smoCategories : undefined,
        status: 'ready',
        isActiveShift: false,
        updatedAt: new Date().toISOString(),
      };

      // Validate that the log has all required fields before marking as ready
      const validation = validateLogForReady(updatedLog);
      if (!validation.isValid) {
        const errorMessage = `Cannot mark log as ready. Missing required fields:\n• ${validation.missingFields.join('\n• ')}`;
        Alert.alert('Cannot Mark as Ready', errorMessage);
        return;
      }

      await updateLog(updatedLog);
      
      // Clear active shift flag
      if (draftLog.isActiveShift) {
        await clearActiveShift(draftLog.id);
      }

      Alert.alert('Success', 'Shift logged successfully!', [
        { text: 'OK', onPress: () => {
          onComplete();
          onClose();
        }}
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save log. Please try again.');
    }
  };

  const formatTime12Hour = (time: string | 'N/A' | undefined) => {
    if (!time || time === 'N/A') return 'N/A';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
          Categories (Select all that apply)
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

  if (!draftLog) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isDark && styles.darkModalContent]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.darkText]}>End Shift</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Rostered Times */}
            <View style={[styles.section, isDark && styles.darkCard]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                  Rostered Times
                </Text>
                {noRosterMode && (
                  <NAButton
                    onPress={handleRosteredTimesNA}
                    isActive={rosteredTimesNA}
                  />
                )}
              </View>
              {noRosterMode ? (
                rosteredTimesNA ? (
                  <Text style={[styles.timeDisplay, isDark && styles.darkText]}>
                    N/A - N/A
                  </Text>
                ) : (
                  <View style={styles.timeRow}>
                    <View style={styles.timeInput}>
                      <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
                      <SharedTimePickerProvider>
                        <TimeInput
                          value={rosteredStart}
                          onChange={setRosteredStart}
                          placeholder="Select start time"
                          inputId="rostered-start-modal"
                        />
                      </SharedTimePickerProvider>
                    </View>
                    <View style={styles.timeInput}>
                      <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
                      <SharedTimePickerProvider>
                        <TimeInput
                          value={rosteredFinish}
                          onChange={setRosteredFinish}
                          placeholder="Select finish time"
                          inputId="rostered-finish-modal"
                        />
                      </SharedTimePickerProvider>
                    </View>
                  </View>
                )
              ) : (
                <Text style={[styles.timeDisplay, isDark && styles.darkText]}>
                  {formatTime12Hour(draftLog.rosteredStart)} - {formatTime12Hour(draftLog.rosteredFinish)}
                </Text>
              )}
            </View>

            {/* Actual Times */}
            <View style={[styles.section, isDark && styles.darkCard]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                  Actual Times
                </Text>
                {!isEditingActualTimes && (
                  <TouchableOpacity
                    onPress={() => setIsEditingActualTimes(true)}
                    style={[styles.editButtonSmall, isDark && styles.darkEditButtonSmall]}
                  >
                    <Text style={[styles.editButtonTextSmall, isDark && styles.darkEditButtonTextSmall]}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {isEditingActualTimes ? (
                <View style={styles.timeRow}>
                  <View style={styles.timeInput}>
                    <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
                    <SharedTimePickerProvider>
                      <TimeInput
                        value={actualStart}
                        onChange={setActualStart}
                        placeholder="Select start time"
                        inputId="actual-start-modal"
                      />
                    </SharedTimePickerProvider>
                  </View>
                  <View style={styles.timeInput}>
                    <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
                    <SharedTimePickerProvider>
                      <TimeInput
                        value={actualFinish}
                        onChange={setActualFinish}
                        placeholder="Select finish time"
                        inputId="actual-finish-modal"
                      />
                    </SharedTimePickerProvider>
                  </View>
                </View>
              ) : (
                <Text style={[styles.timeDisplay, isDark && styles.darkText]}>
                  {formatTime12Hour(actualStart || draftLog.actualStart)} - {formatTime12Hour(actualFinish || draftLog.actualFinish)}
                </Text>
              )}
            </View>

            {/* Category */}
            {profile?.isSMO ? (
              renderSMOCategories()
            ) : (
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
                  <ScrollView style={[styles.categoryPickerContainer, isDark && styles.darkPickerContainer]} nestedScrollEnabled>
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
                  </ScrollView>
                )}
              </View>
            )}

            {/* Comments */}
            <View style={[styles.section, isDark && styles.darkCard]}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Comments
              </Text>
              <TextInput
                style={[
                  styles.commentsInput,
                  isDark && styles.darkInput,
                  isDark && styles.darkText,
                ]}
                value={comments}
                onChangeText={setComments}
                placeholder="Reason for overtime..."
                placeholderTextColor={isDark ? '#666' : '#999'}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Meal Break */}
            <View style={[styles.section, isDark && styles.darkCard]}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Meal Break
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

            {/* Overtime Calculation */}
            {minutesCalculation && (
              <View style={[styles.calculationCard, isDark && styles.darkCalculationCard]}>
                <Text style={[styles.calculationTitle, isDark && styles.darkText]}>
                  Overtime
                </Text>
                <Text style={[styles.calculationValue, isDark && styles.darkText]}>
                  {formatMinutes(minutesCalculation.roundedOvertime)}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.editButton, isDark && styles.darkEditButton]}
              onPress={handleEdit}
            >
              <Text style={[styles.editButtonText, isDark && styles.darkEditButtonText]}>
                Edit
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.readyButton,
                !minutesCalculation && styles.disabledButton
              ]}
              onPress={handleMarkAsReady}
              disabled={!minutesCalculation}
            >
              <Text style={[
                styles.readyButtonText,
                !minutesCalculation && styles.disabledButtonText
              ]}>
                Mark as Ready
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  darkModalContent: {
    backgroundColor: '#1c1c1e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  modalBody: {
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  darkText: {
    color: '#fff',
  },
  timeDisplay: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
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
  categoryDropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  darkInput: {
    backgroundColor: '#3a3a3c',
    borderColor: '#4a4a4c',
  },
  categoryDropdownText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  categoryPickerContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 150,
  },
  darkPickerContainer: {
    backgroundColor: '#2c2c2e',
  },
  categoryOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkCategoryOption: {
    borderBottomColor: '#3a3a3c',
  },
  selectedCategoryOption: {
    backgroundColor: '#007AFF',
  },
  categoryOptionText: {
    fontSize: 14,
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
    minHeight: 60,
    fontSize: 14,
    color: '#333',
  },
  mealBreakButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  mealBreakText: {
    fontSize: 14,
    color: '#333',
  },
  mealBreakPickerContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  mealBreakOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkMealBreakOption: {
    borderBottomColor: '#3a3a3c',
  },
  selectedMealBreakOption: {
    backgroundColor: '#007AFF',
  },
  mealBreakOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectedMealBreakOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  calculationCard: {
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  darkCalculationCard: {
    backgroundColor: '#1a2e1a',
  },
  calculationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2e7d32',
    marginBottom: 4,
  },
  calculationValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkEditButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#4a4a4c',
  },
  readyButton: {
    backgroundColor: '#4CAF50',
  },
  editButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  darkEditButtonText: {
    color: '#fff',
  },
  readyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#999',
  },
  smoCategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkSmoCategoryOption: {
    borderBottomColor: '#3a3a3c',
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
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  editButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkEditButtonSmall: {
    backgroundColor: '#2c2c2e',
    borderColor: '#4a4a4c',
  },
  editButtonTextSmall: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  darkEditButtonTextSmall: {
    color: '#64B5F6',
  },
});

