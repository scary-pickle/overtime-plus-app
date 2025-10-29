import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { useSharedTimePicker } from './SharedTimePicker';

interface TimeInputProps {
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  inputId: string;
}

export function TimeInput({ value, onChange, placeholder = "Select time", disabled = false, error, inputId }: TimeInputProps) {
  const { openPicker, activeInputId, renderPicker, closePicker } = useSharedTimePicker();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    if (disabled) return;
    
    // Toggle: if this input's picker is already open, close it
    if (activeInputId === inputId) {
      closePicker();
      return;
    }
    
    const date = getDateFromTimeString(value);
    openPicker(inputId, date, onChange);
  };

  const formatDisplayTime = (timeString: string) => {
    if (!timeString) return placeholder;
    
    // Handle N/A values
    if (timeString === 'N/A') return 'N/A';
    
    const [hour, minute] = timeString.split(':').map(Number);
    
    // Convert to 12-hour format for display
    let hour12 = hour;
    let period = 'AM';
    
    if (hour === 0) {
      hour12 = 12;
      period = 'AM';
    } else if (hour < 12) {
      hour12 = hour;
      period = 'AM';
    } else if (hour === 12) {
      hour12 = 12;
      period = 'PM';
    } else {
      hour12 = hour - 12;
      period = 'PM';
    }
    
    return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const getDateFromTimeString = (timeString: string): Date => {
    if (!timeString || timeString === 'N/A') return new Date();
    const [hour, minute] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.input,
          error && styles.inputError,
          disabled && styles.inputDisabled,
          isDark && styles.darkInput
        ]}
        onPress={handlePress}
        disabled={disabled}
      >
        <Text style={[
          styles.inputText,
          !value && styles.placeholder,
          disabled && styles.disabledText,
          isDark && styles.darkText
        ]}>
          {formatDisplayTime(value)}
        </Text>
      </TouchableOpacity>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      {activeInputId === inputId && renderPicker()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    minHeight: 44,
    justifyContent: 'center',
  },
  darkInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  placeholder: {
    color: '#999',
  },
  disabledText: {
    color: '#999',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
  },
});