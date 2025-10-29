import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  useColorScheme,
} from 'react-native';
import { QUEENSLAND_HOSPITALS } from '../lib/data/hospitalDepartments';

interface HospitalDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function HospitalDropdown({
  value,
  onValueChange,
  placeholder = 'Select hospital',
  required = false,
  disabled = false,
}: HospitalDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleSelect = (hospitalName: string) => {
    onValueChange(hospitalName);
    setIsOpen(false);
  };

  const handleClear = () => {
    onValueChange('');
    setIsOpen(false);
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={[styles.modalContent, isDark && styles.darkModalContent]}>
            <View style={[styles.modalHeader, isDark && styles.darkModalHeader]}>
              <Text style={[styles.modalTitle, isDark && styles.darkModalTitle]}>
                Select Hospital
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
              {QUEENSLAND_HOSPITALS.map((hospital, index) => (
                <TouchableOpacity
                  key={hospital.id}
                  style={[
                    styles.option,
                    isDark && styles.darkOption,
                    value === hospital.name && styles.selectedOption,
                    value === hospital.name && isDark && styles.darkSelectedOption,
                  ]}
                  onPress={() => handleSelect(hospital.name)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isDark && styles.darkOptionText,
                      value === hospital.name && styles.selectedOptionText,
                    ]}
                  >
                    {hospital.name}
                  </Text>
                  {value === hospital.name && (
                    <Text style={[styles.checkmark, isDark && styles.darkCheckmark]}>
                      ✓
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
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
});
