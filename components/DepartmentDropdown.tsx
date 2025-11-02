import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  useColorScheme,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DepartmentDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  departments: string[];
  customDepartments?: string[];
  onCustomDepartmentAdd?: (department: string) => void;
}

export function DepartmentDropdown({
  value,
  onValueChange,
  placeholder = 'Select department',
  required = false,
  disabled = false,
  departments,
  customDepartments = [],
  onCustomDepartmentAdd,
}: DepartmentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customDepartmentName, setCustomDepartmentName] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Combine predefined and custom departments
  const allDepartments = [
    ...departments,
    ...customDepartments.filter(d => !departments.includes(d))
  ];

  const handleSelect = (department: string) => {
    onValueChange(department);
    setIsOpen(false);
  };

  const handleClear = () => {
    onValueChange('');
    setIsOpen(false);
  };

  useEffect(() => {
    console.log('showAddModal changed to:', showAddModal);
  }, [showAddModal]);

  const handleAddCustom = () => {
    const trimmedName = customDepartmentName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a department name');
      return;
    }

    if (allDepartments.some(d => d.toLowerCase() === trimmedName.toLowerCase())) {
      Alert.alert('Error', 'This department already exists');
      return;
    }

    if (onCustomDepartmentAdd) {
      onCustomDepartmentAdd(trimmedName);
    }
    handleSelect(trimmedName);
    setCustomDepartmentName('');
    setShowAddModal(false);
    setIsOpen(false); // Close the selection modal as well
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.dropdown,
          isDark && styles.darkDropdown,
          disabled && styles.disabledDropdown,
          disabled && isDark && styles.darkDisabledDropdown,
        ]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.dropdownText,
            isDark && styles.darkDropdownText,
            !value && styles.placeholderText,
            disabled && styles.disabledText,
          ]}
        >
          {value || placeholder}
        </Text>
        <Text style={[styles.arrow, isDark && styles.darkArrow]}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          <View style={[styles.modalContent, isDark && styles.darkModalContent]}>
            <View style={[styles.modalHeader, isDark && styles.darkModalHeader]}>
              <Text style={[styles.modalTitle, isDark && styles.darkModalTitle]}>
                Select Department
              </Text>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClear}
              >
                <Text style={[styles.clearButtonText, isDark && styles.darkClearButtonText]}>
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator>
              {allDepartments.map((departmentName, index) => {
                const isCustom = customDepartments.includes(departmentName);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.option,
                      isDark && styles.darkOption,
                      value === departmentName && styles.selectedOption,
                      value === departmentName && isDark && styles.darkSelectedOption,
                    ]}
                    onPress={() => handleSelect(departmentName)}
                  >
                    <View style={styles.optionContent}>
                      <Text
                        style={[
                          styles.optionText,
                          isDark && styles.darkOptionText,
                          value === departmentName && styles.selectedOptionText,
                        ]}
                      >
                        {departmentName}
                      </Text>
                      {isCustom && (
                        <Text style={[styles.customBadge, isDark && styles.darkCustomBadge]}>
                          Custom
                        </Text>
                      )}
                    </View>
                    {value === departmentName && (
                      <Text style={[styles.checkmark, isDark && styles.darkCheckmark]}>
                        ✓
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.addButton, isDark && styles.darkAddButton]}
                onPress={() => {
                  console.log('Add Custom Department button pressed');
                  console.log('Current isOpen:', isOpen);
                  console.log('Current showAddModal:', showAddModal);
                  setIsOpen(false);
                  // Use setTimeout to ensure the selection modal closes first
                  setTimeout(() => {
                    console.log('Opening add modal now');
                    setShowAddModal(true);
                  }, 100);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={20} color={isDark ? "#4CAF50" : "#4CAF50"} />
                <Text style={[styles.addButtonText, isDark && styles.darkAddButtonText]}>
                  Add Custom Department
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Custom Department Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAddModal(false);
          setCustomDepartmentName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setShowAddModal(false);
              setCustomDepartmentName('');
            }}
          />
          <View 
            style={[styles.modalContent, isDark && styles.darkModalContent]}
          >
            <View style={[styles.modalHeader, isDark && styles.darkModalHeader]}>
              <Text style={[styles.modalTitle, isDark && styles.darkModalTitle]}>
                Add Custom Department
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setCustomDepartmentName('');
                }}
              >
                <Ionicons name="close" size={24} color={isDark ? "#fff" : "#333"} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.addForm}>
              <Text style={[styles.inputLabel, isDark && styles.darkInputLabel]}>
                Department Name
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  isDark && styles.darkTextInput,
                ]}
                value={customDepartmentName}
                onChangeText={setCustomDepartmentName}
                placeholder="Enter department name"
                placeholderTextColor={isDark ? '#666' : '#999'}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAddCustom}
              />
              <View style={styles.addButtonRow}>
                <TouchableOpacity
                  style={[styles.cancelAddButton, isDark && styles.darkCancelAddButton]}
                  onPress={() => {
                    setShowAddModal(false);
                    setCustomDepartmentName('');
                  }}
                >
                  <Text style={[styles.cancelAddButtonText, isDark && styles.darkCancelAddButtonText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmAddButton, isDark && styles.darkConfirmAddButton]}
                  onPress={handleAddCustom}
                >
                  <Text style={styles.confirmAddButtonText}>
                    Add
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  darkDropdown: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  disabledDropdown: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  darkDisabledDropdown: {
    backgroundColor: '#2c2c2e',
    borderColor: '#48484a',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  darkDropdownText: {
    color: '#fff',
  },
  placeholderText: {
    color: '#999',
  },
  disabledText: {
    color: '#666',
  },
  arrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  darkArrow: {
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  darkModalContent: {
    backgroundColor: '#1c1c1e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkModalHeader: {
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  darkModalTitle: {
    color: '#fff',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  clearButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  darkClearButtonText: {
    color: '#999',
  },
  scrollView: {
    maxHeight: 400,
  },
  option: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  darkOption: {
    borderBottomColor: '#333',
  },
  selectedOption: {
    backgroundColor: '#e3f2fd',
  },
  darkSelectedOption: {
    backgroundColor: '#2c2c2e',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  darkOptionText: {
    color: '#fff',
  },
  selectedOptionText: {
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#2196f3',
    marginLeft: 8,
  },
  darkCheckmark: {
    color: '#4fc3f7',
  },
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customBadge: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  darkCustomBadge: {
    color: '#81C784',
    backgroundColor: '#1b2e1b',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#f9f9f9',
    gap: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  darkAddButton: {
    borderTopColor: '#333',
    backgroundColor: '#2c2c2e',
  },
  addButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  darkAddButtonText: {
    color: '#81C784',
  },
  addForm: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  darkInputLabel: {
    color: '#fff',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
    marginBottom: 16,
  },
  darkTextInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
    color: '#fff',
  },
  addButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelAddButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  darkCancelAddButton: {
    backgroundColor: '#2c2c2e',
  },
  cancelAddButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  darkCancelAddButtonText: {
    color: '#999',
  },
  confirmAddButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  darkConfirmAddButton: {
    backgroundColor: '#4CAF50',
  },
  confirmAddButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
