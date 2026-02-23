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
import { useProfileStore } from '../../../lib/state/profileStore';
import { useTemplatesStore } from '../../../lib/state/templatesStore';
import { useLocalUserStore } from '../../../lib/state/localUserStore';
import { NAButton } from '../../../components/NAButton';
import { SharedTimePickerProvider } from '../../../components/SharedTimePicker';
import { TimeInput } from '../../../components/TimeInput';
import { LogTemplate } from '../../../types';
import { createScopedLogger } from '../../../lib/utils/logger';

const debug = createScopedLogger('LogTemplateNew');

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

export default function NewTemplateScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile } = useProfileStore();
  const { localUserId } = useLocalUserStore();
  const { addTemplate } = useTemplatesStore();
  
  const [templateName, setTemplateName] = useState('');
  const [rosteredStart, setRosteredStart] = useState('');
  const [rosteredFinish, setRosteredFinish] = useState('');
  const [rosteredTimesNA, setRosteredTimesNA] = useState(false);
  const [mealBreakMinutes, setMealBreakMinutes] = useState(30);
  const [showMealBreakPicker, setShowMealBreakPicker] = useState(false);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Overtime');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [comments, setComments] = useState('');
  const [concurrentEmployment, setConcurrentEmployment] = useState(false);
  const [showOtherOptions, setShowOtherOptions] = useState(false);
  const [smoCategories, setSmoCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Initialize concurrent employment from profile default
    if (profile?.concurrentEmploymentDefault !== undefined) {
      setConcurrentEmployment(profile.concurrentEmploymentDefault);
    }
  }, [profile]);

  const handleRosteredTimesNA = () => {
    const newNAStatus = !rosteredTimesNA;
    setRosteredTimesNA(newNAStatus);
    
    if (newNAStatus) {
      setRosteredStart('N/A');
      setRosteredFinish('N/A');
    } else {
      setRosteredStart('');
      setRosteredFinish('');
    }
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a template name.');
      return;
    }

    // Validate rostered times if not N/A
    if (!rosteredTimesNA) {
      if (!rosteredStart || !rosteredFinish) {
        Alert.alert('Error', 'Please enter rostered start and finish times, or mark them as N/A.');
        return;
      }
    }

    const template: LogTemplate = {
      id: `template_${Date.now()}`,
      name: templateName.trim(),
      rosteredStart: rosteredTimesNA ? 'N/A' : (rosteredStart || undefined),
      rosteredFinish: rosteredTimesNA ? 'N/A' : (rosteredFinish || undefined),
      mealBreakMinutes: mealBreakMinutes || undefined,
      category,
      comments: comments || undefined,
      concurrentEmployment: concurrentEmployment || undefined,
      smoCategories: profile?.isSMO ? smoCategories : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await addTemplate(template, localUserId);
      Alert.alert('Success', 'Template created successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      debug.error('Template creation error:', error);
      Alert.alert('Error', `Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
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

  return (
    <SharedTimePickerProvider>
      <View style={[styles.container, isDark && styles.darkContainer]}>
        <View style={[styles.header, isDark && styles.darkHeader]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, isDark && styles.darkText]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, isDark && styles.darkText]}>Create Template</Text>
          <TouchableOpacity 
            style={[styles.saveButton, isDark && styles.darkSaveButton]}
            onPress={handleSave}
          >
            <Text style={[styles.saveButtonText, isDark && styles.darkSaveButtonText]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={[styles.scrollView, isDark && styles.darkContainer]} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Template Name */}
            <View style={[styles.section, isDark && styles.darkCard]}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Template Name *
              </Text>
              <TextInput
                style={[styles.nameInput, isDark && styles.darkInput, isDark && styles.darkText]}
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="e.g., Weekend ED Call, Night Shift"
                placeholderTextColor={isDark ? '#666' : '#999'}
                maxLength={50}
                autoFocus
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
                    inputId="template-rostered-start"
                    disabled={rosteredTimesNA}
                  />
                </View>
                <View style={styles.timeInput}>
                  <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
                  <TimeInput
                    value={rosteredFinish}
                    onChange={setRosteredFinish}
                    placeholder="Select rostered finish time"
                    inputId="template-rostered-finish"
                    disabled={rosteredTimesNA}
                  />
                </View>
              </View>
              <Text style={[styles.hintText, isDark && styles.darkText]}>
                Note: Actual times are not saved in templates. You'll fill those in when using the template.
              </Text>
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
  darkHeader: {
    backgroundColor: '#1c1c1e',
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scrollView: {
    flex: 1,
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
  nameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#333',
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
  hintText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
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
  toggleButton: {
    paddingVertical: 8,
  },
  darkToggleButton: {},
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  darkToggleContainer: {},
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
