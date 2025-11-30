import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';

interface CalendarPickerProps {
  value: string; // ISO date string
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onOpen?: () => void;
}

export function CalendarPicker({ value, onChange, placeholder = "Select date", disabled = false, onOpen }: CalendarPickerProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  // Parse the initial date properly to avoid timezone issues
  const getInitialDate = () => {
    if (value) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date();
  };
  
  const [selectedDate, setSelectedDate] = useState(getInitialDate());
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const [displayYear, setDisplayYear] = useState(selectedDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(selectedDate.getMonth());

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(displayYear, displayMonth, day);
    setSelectedDate(newDate);
    
    // Auto-confirm on selection
    const year = newDate.getFullYear();
    const month = (newDate.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = newDate.getDate().toString().padStart(2, '0');
    const dateString = `${year}-${month}-${dayStr}`;
    onChange(dateString);
    setIsVisible(false);
  };

  const togglePicker = () => {
    if (disabled) return;
    
    if (isVisible) {
      // Close picker
      setIsVisible(false);
    } else {
      // Open picker
      if (value) {
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        setSelectedDate(date);
        setDisplayYear(year);
        setDisplayMonth(month - 1);
      } else {
        setDisplayYear(selectedDate.getFullYear());
        setDisplayMonth(selectedDate.getMonth());
      }
      setIsVisible(true);
      // Call onOpen callback if provided
      if (onOpen) {
        // Use setTimeout to ensure the calendar is rendered before scrolling
        setTimeout(() => {
          onOpen();
        }, 100);
      }
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (displayMonth === 0) {
        setDisplayMonth(11);
        setDisplayYear(displayYear - 1);
      } else {
        setDisplayMonth(displayMonth - 1);
      }
    } else {
      if (displayMonth === 11) {
        setDisplayMonth(0);
        setDisplayYear(displayYear + 1);
      } else {
        setDisplayMonth(displayMonth + 1);
      }
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(displayYear, displayMonth);
    const firstDay = getFirstDayOfMonth(displayYear, displayMonth);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(displayYear, displayMonth, day);
      const isCurrentDay = isToday(date);
      const isSelectedDay = isSelected(date);
      
      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            isCurrentDay && styles.todayCell,
            isSelectedDay && styles.selectedCell,
          ]}
          onPress={() => handleDateSelect(day)}
        >
          <Text style={[
            styles.dayText,
            isCurrentDay && styles.todayText,
            isSelectedDay && styles.selectedText,
            isDark && styles.darkDayText,
          ]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return days;
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return placeholder;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.input,
          disabled && styles.inputDisabled,
          isDark && styles.darkInput,
        ]}
        onPress={togglePicker}
        disabled={disabled}
      >
        <Text style={[
          styles.inputText,
          !value && styles.placeholder,
          disabled && styles.disabledText,
          isDark && styles.darkText,
        ]}>
          {formatDisplayDate(value)}
        </Text>
      </TouchableOpacity>
      
      {isVisible && (
        <View style={[styles.pickerContainer, isDark && styles.darkPickerContainer]}>
          {/* Header */}
          <View style={[styles.header, isDark && styles.darkHeader]}>
            <Text style={[styles.monthYear, isDark && styles.darkText]}>
              {monthNames[displayMonth]} {displayYear}
            </Text>
            <View style={styles.navigationButtons}>
              <TouchableOpacity
                style={[styles.navButton, isDark && styles.darkNavButton]}
                onPress={() => navigateMonth('prev')}
              >
                <Text style={[styles.navButtonText, isDark && styles.darkText]}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navButton, isDark && styles.darkNavButton]}
                onPress={() => navigateMonth('next')}
              >
                <Text style={[styles.navButtonText, isDark && styles.darkText]}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Day labels */}
          <View style={styles.dayLabels}>
            {dayNames.map(day => (
              <Text key={day} style={[styles.dayLabel, isDark && styles.darkText]}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.calendarGrid}>
            {renderCalendar()}
          </View>
        </View>
      )}
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
  pickerContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  darkPickerContainer: {
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  darkHeader: {
  },
  monthYear: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkNavButton: {
    backgroundColor: '#2c2c2e',
  },
  navButtonText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  dayLabels: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  selectedCell: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 20,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  darkDayText: {
    color: '#fff',
  },
  todayText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  selectedText: {
    color: '#fff',
    fontWeight: '600',
  },
});
