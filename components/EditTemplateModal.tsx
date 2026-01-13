import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShiftTemplate } from '../types';
import { TimeInput } from './TimeInput';
import { SharedTimePickerProvider } from './SharedTimePicker';

interface EditTemplateModalProps {
  visible: boolean;
  template: ShiftTemplate | null;
  onSave: (template: ShiftTemplate) => Promise<void>;
  onCancel: () => void;
}

export function EditTemplateModal({
  visible,
  template,
  onSave,
  onCancel,
}: EditTemplateModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [label, setLabel] = useState('');
  const [rosteredStart, setRosteredStart] = useState('');
  const [rosteredFinish, setRosteredFinish] = useState('');
  const [mealBreakMinutes, setMealBreakMinutes] = useState(30);
  const [showMealBreakPicker, setShowMealBreakPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize form when template changes or modal opens
  useEffect(() => {
    if (visible && template) {
      setLabel(template.label);
      setRosteredStart(template.rosteredStart);
      setRosteredFinish(template.rosteredFinish);
      setMealBreakMinutes(template.mealBreakMinutes || 0);
      setErrors([]);
    }
  }, [visible, template]);

  const validate = (): boolean => {
    const newErrors: string[] = [];

    if (!label.trim()) {
      newErrors.push('Label is required');
    }

    if (!rosteredStart) {
      newErrors.push('Start time is required');
    }

    if (!rosteredFinish) {
      newErrors.push('Finish time is required');
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (rosteredStart && !timeRegex.test(rosteredStart)) {
      newErrors.push('Start time must be in HH:mm format');
    }
    if (rosteredFinish && !timeRegex.test(rosteredFinish)) {
      newErrors.push('Finish time must be in HH:mm format');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!template || !validate()) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedTemplate: ShiftTemplate = {
        ...template,
        label: label.trim(),
        rosteredStart,
        rosteredFinish,
        mealBreakMinutes,
        updatedAt: new Date().toISOString(),
      };

      await onSave(updatedTemplate);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to save template']);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setErrors([]);
    onCancel();
  };

  if (!template) return null;

  return (
    <SharedTimePickerProvider>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoider}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleCancel}
          >
            <TouchableOpacity 
              style={[styles.modalContent, isDark && styles.darkModalContent]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, isDark && styles.darkModalHeader]}>
                <Text style={[styles.modalTitle, isDark && styles.darkText]}>
                  Edit Template
                </Text>
                <View style={styles.headerButtons}>
                  <TouchableOpacity
                    style={styles.saveHeaderButton}
                    onPress={handleSave}
                    disabled={isSaving}
                  >
                    <Text style={styles.saveHeaderButtonText}>
                      {isSaving ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color={isDark ? '#fff' : '#333'} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {errors.length > 0 && (
                  <View style={styles.errorContainer}>
                    {errors.map((error, index) => (
                      <Text key={index} style={styles.errorText}>
                        {error}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Label Input */}
                <View style={styles.section}>
                  <Text style={[styles.label, isDark && styles.darkText]}>Label</Text>
                  <TextInput
                    style={[styles.textInput, isDark && styles.darkTextInput]}
                    value={label}
                    onChangeText={setLabel}
                    placeholder="Enter template label"
                    placeholderTextColor={isDark ? '#666' : '#999'}
                    returnKeyType="done"
                    autoFocus={true}
                  />
                </View>

                {/* Time Inputs */}
                <View style={styles.section}>
                  <Text style={[styles.label, isDark && styles.darkText]}>
                    Rostered Times
                  </Text>
                  <View style={styles.timeRow}>
                    <View style={styles.timeInput}>
                      <Text style={[styles.timeLabel, isDark && styles.darkText]}>
                        Start
                      </Text>
                      <TimeInput
                        value={rosteredStart}
                        onChange={setRosteredStart}
                        placeholder="HH:mm"
                        inputId="edit-template-start"
                      />
                    </View>
                    <View style={styles.timeInput}>
                      <Text style={[styles.timeLabel, isDark && styles.darkText]}>
                        Finish
                      </Text>
                      <TimeInput
                        value={rosteredFinish}
                        onChange={setRosteredFinish}
                        placeholder="HH:mm"
                        inputId="edit-template-finish"
                      />
                    </View>
                  </View>
                </View>

                {/* Meal Break */}
                <View style={styles.section}>
                  <Text style={[styles.label, isDark && styles.darkText]}>
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
                    <View
                      style={[
                        styles.mealBreakPickerContainer,
                        isDark && styles.darkPickerContainer,
                      ]}
                    >
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
                          <Text
                            style={[
                              styles.mealBreakOptionText,
                              mealBreakMinutes === minutes &&
                                styles.selectedMealBreakOptionText,
                              isDark && styles.darkText,
                            ]}
                          >
                            {minutes} minutes
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SharedTimePickerProvider>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
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
    flex: 1,
  },
  darkModalContent: {
    backgroundColor: '#1c1c1e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  darkModalHeader: {
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveHeaderButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveHeaderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    marginBottom: 4,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  darkTextInput: {
    borderColor: '#444',
    backgroundColor: '#2c2c2e',
    color: '#fff',
  },
  timeRow: {
    gap: 12,
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
    padding: 12,
    backgroundColor: '#fff',
    minHeight: 44,
    justifyContent: 'center',
  },
  darkInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#444',
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
    borderColor: '#333',
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
});
