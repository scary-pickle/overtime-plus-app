import React, { useState, useRef, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../lib/state/profileStore';
import { useAuthStore } from '../../lib/state/authStore';
import { useLogsStore } from '../../lib/state/logsStore';
import { TimeInput } from '../../components/TimeInput';
import { CalendarPicker } from '../../components/CalendarPicker';
import { SharedTimePickerProvider } from '../../components/SharedTimePicker';
import { NAButton } from '../../components/NAButton';
import { getCurrentDate } from '../../lib/time';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('Leave');

type LeaveEntry = {
  id: string;
  date: string;
  rosteredStart: string;
  rosteredFinish: string;
  rosteredTimesNA: boolean;
};

export default function LeaveScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollViewRef = useRef<ScrollView>(null);
  
  const { profile, initials } = useProfileStore();
  const { user } = useAuthStore();
  const { addLeaveLogs } = useLogsStore();
  
  const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([
    {
      id: `entry_${Date.now()}`,
      date: getCurrentDate(),
      rosteredStart: '',
      rosteredFinish: '',
      rosteredTimesNA: false,
    },
  ]);
  
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set([leaveEntries[0]?.id].filter(Boolean))
  );
  
  const [comments, setComments] = useState('Sick leave');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-collapse filled entries (except the last one if it's not filled)
  useEffect(() => {
    setExpandedEntries(prev => {
      const newSet = new Set<string>();
      leaveEntries.forEach((entry, index) => {
        const isFilled = isEntryFilled(entry);
        const isLast = index === leaveEntries.length - 1;
        
        // Keep expanded if:
        // - It's not filled (user is still working on it)
        // - It's the last entry (most recent entry should stay expanded for editing)
        if (!isFilled || isLast) {
          newSet.add(entry.id);
        }
      });
      return newSet;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(leaveEntries.map(e => ({ id: e.id, date: e.date, rosteredStart: e.rosteredStart, rosteredFinish: e.rosteredFinish, rosteredTimesNA: e.rosteredTimesNA })))]);

  const isEntryFilled = (entry: LeaveEntry): boolean => {
    if (!entry.date) return false;
    if (entry.rosteredTimesNA) return true;
    return !!(entry.rosteredStart && entry.rosteredFinish);
  };

  const toggleEntryExpanded = (id: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const addLeaveEntry = (copyFromPrevious: boolean = false) => {
    // Get the last entry to copy from if requested
    const lastEntry = leaveEntries.length > 0 ? leaveEntries[leaveEntries.length - 1] : null;
    
    // If copying from previous, set date to next day after the last entry's date
    let newDate = getCurrentDate();
    if (copyFromPrevious && lastEntry && lastEntry.date) {
      const lastDate = new Date(lastEntry.date);
      lastDate.setDate(lastDate.getDate() + 1);
      newDate = lastDate.toISOString().split('T')[0];
    }
    
    const newEntry: LeaveEntry = {
      id: `entry_${Date.now()}_${leaveEntries.length}`,
      date: newDate,
      rosteredStart: copyFromPrevious && lastEntry ? lastEntry.rosteredStart : '',
      rosteredFinish: copyFromPrevious && lastEntry ? lastEntry.rosteredFinish : '',
      rosteredTimesNA: copyFromPrevious && lastEntry ? lastEntry.rosteredTimesNA : false,
    };
    
    // Collapse all previous entries that are filled out
    const newExpanded = new Set<string>();
    leaveEntries.forEach(entry => {
      if (!isEntryFilled(entry)) {
        // Keep unfilled entries expanded
        newExpanded.add(entry.id);
      }
    });
    
    // Expand the new entry
    newExpanded.add(newEntry.id);
    
    setExpandedEntries(newExpanded);
    setLeaveEntries([...leaveEntries, newEntry]);
    
    // Scroll to bottom after a short delay to allow render
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const removeLeaveEntry = (id: string) => {
    if (leaveEntries.length <= 1) {
      Alert.alert('Cannot Remove', 'At least one leave entry is required.');
      return;
    }
    setLeaveEntries(leaveEntries.filter(entry => entry.id !== id));
  };

  const updateLeaveEntry = (id: string, updates: Partial<LeaveEntry>) => {
    setLeaveEntries(
      leaveEntries.map(entry => 
        entry.id === id ? { ...entry, ...updates } : entry
      )
    );
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (leaveEntries.length === 0) {
      errors.push('At least one leave entry is required');
    }
    
    leaveEntries.forEach((entry, index) => {
      if (!entry.date) {
        errors.push(`Leave entry ${index + 1} is missing a date`);
      }
      
      if (!entry.rosteredTimesNA) {
        if (!entry.rosteredStart || !entry.rosteredFinish) {
          errors.push(`Leave entry ${index + 1} rostered times are required (or mark as N/A)`);
        }
      }
    });
    
    return errors;
  };

  const isFormReadyForReady = (): boolean => {
    if (leaveEntries.length === 0) {
      return false;
    }
    
    for (const entry of leaveEntries) {
      if (!entry.date) {
        return false;
      }
      
      if (!entry.rosteredTimesNA && (!entry.rosteredStart || !entry.rosteredFinish)) {
        return false;
      }
    }
    
    return true;
  };

  const handleSave = async (status: 'draft' | 'ready') => {
    // Prevent double-submission
    if (isSaving) {
      return;
    }

    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }
    
    setValidationErrors([]);
    setIsSaving(true);

    try {
      await addLeaveLogs(
        {
          leaveEntries: leaveEntries.map(entry => ({
            date: entry.date,
            rosteredStart: entry.rosteredTimesNA ? 'N/A' : entry.rosteredStart,
            rosteredFinish: entry.rosteredTimesNA ? 'N/A' : entry.rosteredFinish,
          })),
          comments: comments.trim() || 'Sick leave',
          status,
        },
        user?.id
      );
      
      Alert.alert(
        'Success',
        `Leave ${status === 'draft' ? 'saved as draft' : 'marked as ready'}!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      debug.error('Leave creation error:', error);
      Alert.alert('Error', `Failed to save leave: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCompactDate = (dateString: string) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderLeaveEntry = (entry: LeaveEntry, index: number) => {
    const isExpanded = expandedEntries.has(entry.id);
    const isFilled = isEntryFilled(entry);
    
    return (
      <View key={entry.id} style={[styles.leaveEntryCard, isDark && styles.darkCard]}>
        <TouchableOpacity
          style={styles.leaveEntryHeader}
          onPress={() => toggleEntryExpanded(entry.id)}
          activeOpacity={0.7}
        >
          <View style={styles.leaveEntryHeaderLeft}>
            <Text style={[styles.leaveEntryTitle, isDark && styles.darkText]}>
              Leave Day {index + 1}
            </Text>
            {isFilled && !isExpanded && (
              <Text style={[styles.leaveEntrySummary, isDark && styles.darkSecondaryText]}>
                {formatCompactDate(entry.date)}
                {entry.rosteredTimesNA 
                  ? ' · N/A' 
                  : entry.rosteredStart && entry.rosteredFinish 
                    ? ` · ${entry.rosteredStart} - ${entry.rosteredFinish}`
                    : ''}
              </Text>
            )}
          </View>
          <View style={styles.leaveEntryHeaderRight}>
            {leaveEntries.length > 1 && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={(e) => {
                  e.stopPropagation();
                  removeLeaveEntry(entry.id);
                }}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            )}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={isDark ? '#999' : '#666'}
              style={styles.expandIcon}
            />
          </View>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={[styles.expandedContent, isDark && styles.darkExpandedContent]}>
            {/* Date */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isDark && styles.darkText]}>Date *</Text>
              <CalendarPicker
                value={entry.date}
                onChange={(date) => updateLeaveEntry(entry.id, { date })}
                placeholder="Select date"
              />
            </View>
            
            {/* Rostered Times */}
            <View style={styles.inputGroup}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.label, isDark && styles.darkText]}>Rostered Times</Text>
                <NAButton
                  onPress={() => {
                    const newNAStatus = !entry.rosteredTimesNA;
                    updateLeaveEntry(entry.id, {
                      rosteredTimesNA: newNAStatus,
                      rosteredStart: newNAStatus ? 'N/A' : '',
                      rosteredFinish: newNAStatus ? 'N/A' : '',
                    });
                  }}
                  isActive={entry.rosteredTimesNA}
                />
              </View>
              <View style={styles.timeRow}>
                <View style={styles.timeInput}>
                  <Text style={[styles.timeLabel, isDark && styles.darkText]}>Start</Text>
                  <TimeInput
                    value={entry.rosteredStart}
                    onChange={(value) => updateLeaveEntry(entry.id, { rosteredStart: value })}
                    placeholder="Select rostered start time"
                    inputId={`leave-${entry.id}-rostered-start`}
                    disabled={entry.rosteredTimesNA}
                  />
                </View>
                <View style={styles.timeInput}>
                  <Text style={[styles.timeLabel, isDark && styles.darkText]}>Finish</Text>
                  <TimeInput
                    value={entry.rosteredFinish}
                    onChange={(value) => updateLeaveEntry(entry.id, { rosteredFinish: value })}
                    placeholder="Select rostered finish time"
                    inputId={`leave-${entry.id}-rostered-finish`}
                    disabled={entry.rosteredTimesNA}
                  />
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SharedTimePickerProvider>
      <ScrollView 
        ref={scrollViewRef}
        style={[styles.container, isDark && styles.darkContainer]} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Info Banner */}
          <View style={[styles.infoBanner, isDark && styles.darkInfoBanner]}>
            <Text style={[styles.infoText, isDark && styles.darkText]}>
              Create leave entries for sick leave or other types of leave. Each day will create a separate log entry that will be grouped together. Actual times are automatically set to N/A (displayed as "-" in the generated log).
            </Text>
          </View>

          {/* Leave Entries */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Leave Days
              </Text>
            </View>
            
            {leaveEntries.map((entry, index) => renderLeaveEntry(entry, index))}
            
            {/* Add Buttons at Bottom */}
            <View style={styles.addButtonContainer}>
              <View style={styles.addButtonGroup}>
                {leaveEntries.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.addButton, 
                      styles.addSameShiftButton, 
                      isDark && styles.darkAddSameShiftButton
                    ]}
                    onPress={() => addLeaveEntry(true)}
                  >
                    <Text style={[
                      styles.addSameShiftButtonText, 
                      isDark && styles.darkAddSameShiftButtonText
                    ]}>+ Add (Same Shift)</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.addButton, isDark && styles.darkAddButton]}
                  onPress={() => addLeaveEntry(false)}
                >
                  <Text style={[styles.addButtonText, isDark && styles.darkText]}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Comments */}
          <View style={[styles.section, isDark && styles.darkCard]}>
            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
              Leave Type / Comments
            </Text>
            <TextInput
              style={[
                styles.commentsInput,
                isDark && styles.darkInput,
                isDark && styles.darkText,
              ]}
              value={comments}
              onChangeText={setComments}
              placeholder="e.g., Sick leave, Reproductive leave, Flood leave"
              placeholderTextColor={isDark ? '#666' : '#999'}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={[styles.hintText, isDark && styles.darkSecondaryText]}>
              Default: "Sick leave" - you can edit this to specify the type of leave
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.button, 
                styles.draftButton, 
                isDark && styles.darkDraftButton,
                isSaving && styles.disabledButton,
              ]}
              onPress={() => handleSave('draft')}
              disabled={isSaving}
            >
              <Text style={[
                styles.draftButtonText, 
                isDark && styles.darkDraftButtonText,
                isSaving && styles.disabledButtonText,
              ]}>Save as Draft</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button, 
                styles.readyButton,
                (!isFormReadyForReady() || isSaving) && styles.disabledButton
              ]}
              onPress={() => handleSave('ready')}
              disabled={!isFormReadyForReady() || isSaving}
            >
              <Text style={[
                styles.readyButtonText,
                (!isFormReadyForReady() || isSaving) && styles.disabledButtonText
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
    marginBottom: 12,
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
  leaveEntryCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  leaveEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  leaveEntryHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  leaveEntryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaveEntryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  leaveEntrySummary: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  expandIcon: {
    marginLeft: 8,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  darkExpandedContent: {
    borderTopColor: '#333',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ef5350',
  },
  removeButtonText: {
    color: '#d32f2f',
    fontSize: 12,
    fontWeight: '600',
  },
  addButtonContainer: {
    marginTop: 16,
  },
  addButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  addButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#90caf9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSameShiftButton: {
    backgroundColor: '#f3e5f5',
    borderColor: '#ce93d8',
  },
  darkAddButton: {
    backgroundColor: '#1a237e',
    borderColor: '#3f51b5',
  },
  darkAddSameShiftButton: {
    backgroundColor: '#4a148c',
    borderColor: '#7b1fa2',
  },
  addButtonText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '600',
  },
  addSameShiftButtonText: {
    color: '#7b1fa2',
    fontSize: 14,
    fontWeight: '600',
  },
  darkAddSameShiftButtonText: {
    color: '#ce93d8',
  },
  commentsInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#333',
    minHeight: 80,
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
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

