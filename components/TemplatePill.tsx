import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShiftTemplate } from '../types';

interface TemplatePillProps {
  template: ShiftTemplate;
  isSelected: boolean;
  onSelect: (template: ShiftTemplate) => void;
}

export function TemplatePill({
  template,
  isSelected,
  onSelect,
}: TemplatePillProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleSelect = () => {
    onSelect(template);
  };

  return (
    <TouchableOpacity
      style={[
        styles.pill,
        isDark && !isSelected && styles.darkPill,
        isSelected && styles.selectedPill,
      ]}
      onPress={handleSelect}
      activeOpacity={0.85}
    >
      <View style={styles.pillContent}>
        <View style={styles.pillTextContainer}>
          <Text
            style={[
              styles.pillLabel,
              isDark && !isSelected && styles.darkText,
              isSelected && styles.selectedText,
            ]}
            numberOfLines={1}
          >
            {template.label}
          </Text>
          <Text
            style={[
              styles.pillTime,
              isDark && !isSelected && styles.darkTime,
              isSelected && styles.selectedTime,
            ]}
          >
            {template.rosteredStart} - {template.rosteredFinish}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 120,
    position: 'relative',
  },
  darkPill: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  selectedPill: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  darkText: {
    color: '#999',
  },
  selectedText: {
    color: '#fff',
  },
  pillTime: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  darkTime: {
    color: '#999',
  },
  selectedTime: {
    color: '#fff',
    opacity: 0.9,
  },
});
