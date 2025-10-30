import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
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

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function ShiftsCalendarView({ shifts, onDayPress, isDark: isDarkProp }: ShiftsCalendarViewProps) {
  const colorScheme = useColorScheme();
  const isDark = isDarkProp ?? colorScheme === 'dark';
  
  const [isVisible, setIsVisible] = useState(true); // Open by default
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<DayInfo[]>([]);

  useEffect(() => {
    generateCalendarDays();
  }, [currentDate, shifts]);

  // Helper to get date string in local timezone (avoid UTC conversion issues)
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
    const dateStr = getLocalDateString(date);
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
    const todayStr = getLocalDateString(today);
    
    // Add previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      const dateStr = getLocalDateString(date);
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
      const dateStr = getLocalDateString(date);
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
      const dateStr = getLocalDateString(date);
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

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const togglePicker = () => {
    setIsVisible(!isVisible);
  };

  const handleDayPress = (dayInfo: DayInfo) => {
    if (dayInfo.shifts.length > 0 && onDayPress) {
      onDayPress(dayInfo.date, dayInfo.shifts);
      // Keep calendar open after selecting a day
    }
  };

  const getShiftsSummary = () => {
    const today = getLocalDateString(new Date());
    const activeCount = shifts.filter(s => !s.activeTo || s.activeTo >= today).length;
    const inactiveCount = shifts.filter(s => s.activeTo && s.activeTo < today).length;
    
    const parts = [];
    if (activeCount > 0) parts.push(`${activeCount} active`);
    if (inactiveCount > 0) parts.push(`${inactiveCount} inactive`);
    
    return parts.length > 0 ? parts.join(', ') : 'No shift patterns';
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
    <View style={styles.container}>
      {/* Segmented Control Toggle */}
      <View style={[styles.segmentedControl, isDark && styles.darkSegmentedControl]}>
        <TouchableOpacity
          style={[
            styles.segment,
            isVisible && styles.activeSegment,
            isDark && styles.darkSegment,
            isVisible && isDark && styles.darkActiveSegment,
          ]}
          onPress={() => setIsVisible(true)}
        >
          <Text style={[
            styles.segmentText,
            isVisible && styles.activeSegmentText,
            isDark && styles.darkSegmentText,
            isVisible && isDark && styles.darkActiveSegmentText,
          ]}>
            📅 Calendar
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.segment,
            !isVisible && styles.activeSegment,
            isDark && styles.darkSegment,
            !isVisible && isDark && styles.darkActiveSegment,
          ]}
          onPress={() => setIsVisible(false)}
        >
          <Text style={[
            styles.segmentText,
            !isVisible && styles.activeSegmentText,
            isDark && styles.darkSegmentText,
            !isVisible && isDark && styles.darkActiveSegmentText,
          ]}>
            ☰ List
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calendar View */}
      {isVisible && (
        <View style={[styles.calendarContainer, isDark && styles.darkCalendarContainer]}>
          {/* Header */}
          <View style={[styles.header, isDark && styles.darkHeader]}>
            <Text style={[styles.monthYear, isDark && styles.darkText]}>
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
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

          {/* Today Button */}
          <TouchableOpacity
            style={[styles.todayButton, isDark && styles.darkTodayButton]}
            onPress={goToToday}
          >
            <Text style={[styles.todayButtonText, isDark && styles.darkTodayButtonText]}>
              Go to Today
            </Text>
          </TouchableOpacity>

          {/* Legend */}
          <View style={[styles.legend, isDark && styles.darkLegend]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, styles.activeIndicator]} />
              <Text style={[styles.legendText, isDark && styles.darkText]}>Active</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, styles.inactiveIndicator]} />
              <Text style={[styles.legendText, isDark && styles.darkText]}>Inactive</Text>
            </View>
          </View>

          {/* Day Labels */}
          <View style={styles.dayLabels}>
            {DAYS_OF_WEEK.map(day => (
              <Text key={day} style={[styles.dayLabel, isDark && styles.darkText]}>
                {day}
              </Text>
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
                    hasShifts && styles.hasShiftCell,
                  ]}
                  onPress={() => handleDayPress(dayInfo)}
                  disabled={!hasShifts || isDisabled}
                >
                  <Text
                    style={[
                      styles.dayText,
                      dayInfo.isToday && styles.todayDayText,
                      hasShifts && styles.hasShiftText,
                      isDark && styles.darkDayText,
                      isDisabled && styles.disabledText,
                      isDisabled && isDark && styles.darkDisabledText,
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  darkSegmentedControl: {
    backgroundColor: '#2c2c2e',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkSegment: {
    backgroundColor: 'transparent',
  },
  activeSegment: {
    backgroundColor: '#007AFF',
  },
  darkActiveSegment: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  darkSegmentText: {
    color: '#999',
  },
  activeSegmentText: {
    color: '#fff',
    fontWeight: '600',
  },
  darkActiveSegmentText: {
    color: '#fff',
  },
  darkText: {
    color: '#fff',
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkCalendarContainer: {
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  darkHeader: {
    // No additional styles
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
  todayButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
  },
  darkTodayButton: {
    backgroundColor: '#1a2942',
  },
  todayButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  darkTodayButtonText: {
    color: '#007AFF',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
    marginHorizontal: 12,
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  dayLabels: {
    flexDirection: 'row',
    paddingHorizontal: 12,
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
    paddingHorizontal: 12,
    paddingBottom: 0,
    marginBottom: -4,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    position: 'relative',
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 20,
  },
  hasShiftCell: {
    // Has shifts indicator is shown via dot
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  todayDayText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  darkDayText: {
    color: '#fff',
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
    bottom: 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  indicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
    minWidth: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  multiShiftText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});


