import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UsualShift } from '../types';

interface ShiftsCalendarViewProps {
  shifts: UsualShift[];
  onDayPress?: (date: string, shifts: UsualShift[]) => void;
  isDark?: boolean;
}

interface DayInfo {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  shifts: UsualShift[];
  hasActiveShift: boolean;
  hasInactiveShift: boolean;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function ShiftsCalendarView({ shifts, onDayPress, isDark: isDarkProp }: ShiftsCalendarViewProps) {
  const colorScheme = useColorScheme();
  const isDark = isDarkProp ?? colorScheme === 'dark';
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<DayInfo[]>([]);

  useEffect(() => {
    generateCalendarDays();
  }, [currentDate, shifts]);

  const getWeekIndex = (date: Date): 1 | 2 => {
    const year = date.getFullYear();
    const firstSunday = new Date(year, 0, 1);
    
    while (firstSunday.getDay() !== 0) {
      firstSunday.setDate(firstSunday.getDate() + 1);
    }
    
    const daysSinceFirstSunday = Math.floor((date.getTime() - firstSunday.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysSinceFirstSunday / 7) + 1;
    
    return (weekNumber % 2 === 1) ? 1 : 2;
  };

  const getShiftsForDate = (date: Date): UsualShift[] => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    
    return shifts.filter(shift => {
      // Check if shift is for this day of week
      if (shift.dayOfWeek !== dayOfWeek) return false;
      
      // Check if shift is active on this date
      if (shift.activeFrom > dateStr) return false;
      if (shift.activeTo && shift.activeTo < dateStr) return false;
      
      // For biweekly shifts, check week index
      if (shift.type === 'biweekly' && shift.weekIndex) {
        const weekIndex = getWeekIndex(date);
        if (weekIndex !== shift.weekIndex) return false;
      }
      
      return true;
    });
  };

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Previous month days to fill the grid
    const prevMonthLastDay = new Date(year, month, 0);
    const prevMonthDays = prevMonthLastDay.getDate();
    
    const days: DayInfo[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Add previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayShifts = getShiftsForDate(date);
      
      days.push({
        date: dateStr,
        day: prevMonthDays - i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        shifts: dayShifts,
        hasActiveShift: dayShifts.some(s => !s.activeTo || s.activeTo >= todayStr),
        hasInactiveShift: dayShifts.some(s => s.activeTo && s.activeTo < todayStr),
      });
    }
    
    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayShifts = getShiftsForDate(date);
      
      days.push({
        date: dateStr,
        day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        shifts: dayShifts,
        hasActiveShift: dayShifts.some(s => !s.activeTo || s.activeTo >= todayStr),
        hasInactiveShift: dayShifts.some(s => s.activeTo && s.activeTo < todayStr),
      });
    }
    
    // Add next month days to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayShifts = getShiftsForDate(date);
      
      days.push({
        date: dateStr,
        day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        shifts: dayShifts,
        hasActiveShift: dayShifts.some(s => !s.activeTo || s.activeTo >= todayStr),
        hasInactiveShift: dayShifts.some(s => s.activeTo && s.activeTo < todayStr),
      });
    }
    
    setCalendarDays(days);
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayPress = (dayInfo: DayInfo) => {
    if (dayInfo.shifts.length > 0 && onDayPress) {
      onDayPress(dayInfo.date, dayInfo.shifts);
    }
  };

  const renderDayIndicators = (dayInfo: DayInfo) => {
    if (dayInfo.shifts.length === 0) return null;

    return (
      <View style={styles.indicatorsContainer}>
        {dayInfo.hasActiveShift && (
          <View style={[styles.indicator, styles.activeIndicator]} />
        )}
        {dayInfo.hasInactiveShift && (
          <View style={[styles.indicator, styles.inactiveIndicator]} />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      {/* Calendar Header */}
      <View style={[styles.header, isDark && styles.darkHeader]}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerText, isDark && styles.darkText]}>
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Text>
          <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
            <Text style={[styles.todayButtonText, isDark && styles.darkTodayButtonText]}>
              Today
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={[styles.legend, isDark && styles.darkLegend]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, styles.activeIndicator]} />
          <Text style={[styles.legendText, isDark && styles.darkText]}>Active Shift</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, styles.inactiveIndicator]} />
          <Text style={[styles.legendText, isDark && styles.darkText]}>Inactive Shift</Text>
        </View>
      </View>

      {/* Days of Week */}
      <View style={styles.daysOfWeekContainer}>
        {DAYS_OF_WEEK.map(day => (
          <View key={day} style={styles.dayOfWeekCell}>
            <Text style={[styles.dayOfWeekText, isDark && styles.darkDayOfWeekText]}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((dayInfo, index) => {
          const hasShifts = dayInfo.shifts.length > 0;
          const isDisabled = !dayInfo.isCurrentMonth;
          
          return (
            <TouchableOpacity
              key={`${dayInfo.date}-${index}`}
              style={[
                styles.dayCell,
                dayInfo.isToday && styles.todayCell,
                isDark && styles.darkDayCell,
                dayInfo.isToday && isDark && styles.darkTodayCell,
                isDisabled && styles.disabledCell,
              ]}
              onPress={() => handleDayPress(dayInfo)}
              disabled={!hasShifts}
            >
              <Text
                style={[
                  styles.dayText,
                  dayInfo.isToday && styles.todayText,
                  isDark && styles.darkDayText,
                  dayInfo.isToday && isDark && styles.darkTodayText,
                  isDisabled && styles.disabledText,
                  isDisabled && isDark && styles.darkDisabledText,
                  hasShifts && styles.hasShiftText,
                ]}
              >
                {dayInfo.day}
              </Text>
              {renderDayIndicators(dayInfo)}
              {hasShifts && dayInfo.shifts.length > 1 && (
                <View style={styles.multiShiftBadge}>
                  <Text style={styles.multiShiftText}>{dayInfo.shifts.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkContainer: {
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkHeader: {
    borderBottomColor: '#333',
  },
  navButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  darkText: {
    color: '#fff',
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  todayButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  darkTodayButtonText: {
    color: '#fff',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  darkLegend: {
    backgroundColor: '#2c2c2e',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  daysOfWeekContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayOfWeekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayOfWeekText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  darkDayOfWeekText: {
    color: '#999',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 0.5,
    borderColor: '#f0f0f0',
    paddingTop: 8,
  },
  darkDayCell: {
    borderColor: '#333',
  },
  todayCell: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  darkTodayCell: {
    backgroundColor: '#1a2942',
  },
  disabledCell: {
    // Don't use opacity on the whole cell, only on the text
  },
  dayText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
  },
  darkDayText: {
    color: '#fff',
  },
  todayText: {
    color: '#007AFF',
    fontWeight: '700',
  },
  darkTodayText: {
    color: '#007AFF',
  },
  disabledText: {
    color: '#ccc',
    opacity: 0.5,
  },
  darkDisabledText: {
    color: '#555',
    opacity: 0.5,
  },
  hasShiftText: {
    fontWeight: '700',
  },
  indicatorsContainer: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeIndicator: {
    backgroundColor: '#4CAF50',
  },
  inactiveIndicator: {
    backgroundColor: '#FF9800',
  },
  multiShiftBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  multiShiftText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

