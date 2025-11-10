import React from 'react';
import { TouchableOpacity, Text, StyleSheet, useColorScheme } from 'react-native';

interface NAButtonProps {
  onPress: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

export function NAButton({ onPress, isActive = false, disabled = false }: NAButtonProps) {
  const isDark = useColorScheme() === 'dark';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isActive && styles.activeButton,
        disabled && styles.disabledButton,
        isDark && styles.darkButton,
        isActive && isDark && styles.darkActiveButton,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[
        styles.buttonText,
        isActive && styles.activeButtonText,
        disabled && styles.disabledButtonText,
        isDark && styles.darkButtonText,
        isActive && isDark && styles.darkActiveButtonText,
      ]}>
        N/A
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    opacity: 0.6,
  },
  darkButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#444',
  },
  darkActiveButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  activeButtonText: {
    color: '#fff',
  },
  disabledButtonText: {
    color: '#999',
  },
  darkButtonText: {
    color: '#fff',
  },
  darkActiveButtonText: {
    color: '#fff',
  },
});





