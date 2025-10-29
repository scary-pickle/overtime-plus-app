import React, { useState, createContext, useContext } from 'react';
import { View, StyleSheet, useColorScheme, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface SharedTimePickerContextType {
  showPicker: boolean;
  pickerValue: Date;
  activeInputId: string | null;
  openPicker: (inputId: string, value: Date, onTimeChange: (time: string) => void) => void;
  closePicker: () => void;
  renderPicker: () => React.ReactNode;
}

const SharedTimePickerContext = createContext<SharedTimePickerContextType | null>(null);

export function SharedTimePickerProvider({ children }: { children: React.ReactNode }) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(new Date());
  const [activeInputId, setActiveInputId] = useState<string | null>(null);
  const [onTimeChange, setOnTimeChange] = useState<((time: string) => void) | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const openPicker = (inputId: string, value: Date, timeChangeCallback: (time: string) => void) => {
    setPickerValue(value);
    setActiveInputId(inputId);
    setOnTimeChange(() => timeChangeCallback);
    setShowPicker(true);
  };

  const closePicker = () => {
    setShowPicker(false);
    setActiveInputId(null);
    setOnTimeChange(null);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    
    if (selectedDate && onTimeChange) {
      const hours = selectedDate.getHours();
      const minutes = selectedDate.getMinutes();
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      onTimeChange(timeString);
    }
  };

  const renderPicker = () => {
    if (!showPicker) return null;
    
    return (
      <DateTimePicker
        value={pickerValue}
        mode="time"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={handleTimeChange}
        textColor={isDark ? '#fff' : '#000'}
        style={styles.picker}
      />
    );
  };

  const contextValue: SharedTimePickerContextType = {
    showPicker,
    pickerValue,
    activeInputId,
    openPicker,
    closePicker,
    renderPicker,
  };

  return (
    <SharedTimePickerContext.Provider value={contextValue}>
      {children}
    </SharedTimePickerContext.Provider>
  );
}

export function useSharedTimePicker() {
  const context = useContext(SharedTimePickerContext);
  if (!context) {
    throw new Error('useSharedTimePicker must be used within a SharedTimePickerProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  picker: {
    height: 200,
  },
});
