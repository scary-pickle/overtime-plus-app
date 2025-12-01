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
  selectedDate?: string | null;
  isDark?: boolean;
  viewMode?: 'month' | 'week';
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

export function ShiftsCalendarView({
  shifts,
  onDayPress,
  selectedDate,
  isDark: isDarkProp,
  viewMode = 'month',
}: ShiftsCalendarViewProps) {
  const colorScheme = useColorScheme();
  const isDark = isDarkProp ?? colorScheme === 'dark';
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<DayInfo[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [weekDays, setWeekDays] = useState<DayInfo[]>([]);

  useEffect(() => {
    generateCalendarDays();
  }, [currentDate, shifts]);

  useEffect(() => {
    generateWeekDays(currentWeekStart);
  }, [currentWeekStart, shifts]);

  useEffect(() => {
    if (viewMode !== 'week') return;
    if (selectedDate) {
      const targetDate = new Date(selectedDate + 'T00:00:00');
      setCurrentWeekStart(getStartOfWeek(targetDate));
    } else {
      setCurrentWeekStart(getStartOfWeek(new Date()));
    }
  }, [viewMode, selectedDate]);

  // Helper to get date string in local timezone (avoid UTC conversion issues)
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  function getStartOfWeek(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    return start;
  }

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

  const buildDayInfo = (date: Date, options?: { isCurrentMonth?: boolean }): DayInfo => {
    const dateStr = getLocalDateString(date);
    const todayStr = getLocalDateString(new Date());
    const dayShifts = getShiftsForDate(date);
    
    return {
      date: dateStr,
      day: date.getDate(),
      isCurrentMonth: options?.isCurrentMonth ?? true,
      isToday: dateStr === todayStr,
      shifts: dayShifts,
      hasActiveShift: dayShifts.some(s => !s.activeTo || s.activeTo >= todayStr),
      hasInactiveShift: dayShifts.some(s => s.activeTo && s.activeTo < todayStr),
    };
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
    
    // Add previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      days.push(buildDayInfo(date, { isCurrentMonth: false }));
    }
    
    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push(buildDayInfo(date, { isCurrentMonth: true }));
    }
    
    // Add next month days to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push(buildDayInfo(date, { isCurrentMonth: false }));
    }
    
    setCalendarDays(days);
  };

  const generateWeekDays = (startDate: Date) => {
    const days: DayInfo[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(buildDayInfo(date));
    }
    setWeekDays(days);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return next;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setCurrentWeekStart(getStartOfWeek(today));
    
    // Get today's date string and shifts
    const todayStr = getLocalDateString(today);
    const todayShifts = getShiftsForDate(today);
    
    // If there are shifts for today, select today's date
    if (todayShifts.length > 0 && onDayPress) {
      onDayPress(todayStr, todayShifts);
    } else if (onDayPress) {
      // Even if no shifts, still select today to show "no shifts" message
      onDayPress(todayStr, []);
    }
  };

  const formatWeekRange = (startDate: Date): string => {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };


  const handleDayPress = (dayInfo: DayInfo) => {
    if (dayInfo.shifts.length > 0 && onDayPress) {
      // If clicking a day from another month, navigate to that month
      if (!dayInfo.isCurrentMonth) {
        const clickedDate = new Date(dayInfo.date + 'T00:00:00');
        setCurrentDate(new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1));
      }
      
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

  const renderWeekIndicators = (dayInfo: DayInfo) => {
    if (dayInfo.shifts.length === 0) return null;
    
    return (
      <View style={styles.weekIndicators}>
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
      {/* Monthly Calendar View */}
      {viewMode === 'month' && (
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
              const isOtherMonth = !dayInfo.isCurrentMonth;
              const isSelected = selectedDate === dayInfo.date;
              
              return (
                <TouchableOpacity
                  key={`${dayInfo.date}-${index}`}
                  style={[
                    styles.dayCell,
                    dayInfo.isToday && styles.todayCell,
                    hasShifts && styles.hasShiftCell,
                    isSelected && styles.selectedCell,
                    isSelected && isDark && styles.darkSelectedCell,
                  ]}
                  onPress={() => handleDayPress(dayInfo)}
                  disabled={!hasShifts}
                >
                  <Text
                    style={[
                      styles.dayText,
                      dayInfo.isToday && styles.todayDayText,
                      hasShifts && styles.hasShiftText,
                      isDark && styles.darkDayText,
                      isOtherMonth && styles.disabledText,
                      isOtherMonth && isDark && styles.darkDisabledText,
                      isSelected && styles.selectedDayText,
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

      {/* Weekly Calendar View */}
      {viewMode === 'week' && (
        <View style={[styles.calendarContainer, isDark && styles.darkCalendarContainer]}>
          <View style={[styles.weekHeader, isDark && styles.darkHeader]}>
            <TouchableOpacity
              style={[styles.navButton, isDark && styles.darkNavButton]}
              onPress={() => navigateWeek('prev')}
            >
              <Text style={[styles.navButtonText, isDark && styles.darkText]}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.weekRangeText, isDark && styles.darkText]}>
              {formatWeekRange(currentWeekStart)}
            </Text>
            <TouchableOpacity
              style={[styles.navButton, isDark && styles.darkNavButton]}
              onPress={() => navigateWeek('next')}
            >
              <Text style={[styles.navButtonText, isDark && styles.darkText]}>›</Text>
            </TouchableOpacity>
          </View>

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

          <View style={styles.weekDayRow}>
            {weekDays.map((dayInfo, index) => {
              const hasShifts = dayInfo.shifts.length > 0;
              const isSelected = selectedDate === dayInfo.date;
              const dayLabel = DAYS_OF_WEEK[new Date(dayInfo.date + 'T00:00:00').getDay()];

              return (
                <TouchableOpacity
                  key={`${dayInfo.date}-${index}`}
                  style={[
                    styles.weekDayCell,
                    isDark && styles.darkWeekDayCell,
                    dayInfo.isToday && styles.weekTodayCell,
                    isSelected && styles.weekSelectedCell,
                    isSelected && isDark && styles.darkWeekSelectedCell,
                    !hasShifts && styles.weekDisabledCell,
                    !hasShifts && isDark && styles.darkWeekDisabledCell,
                  ]}
                  onPress={() => handleDayPress(dayInfo)}
                  disabled={!hasShifts}
                >
                  <Text
                    style={[
                      styles.weekDayName,
                      isDark && !isSelected && styles.darkWeekDayName,
                      isSelected && styles.weekSelectedDayName,
                    ]}
                  >
                    {dayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.weekDayNumber,
                      isDark && !isSelected && styles.darkWeekDayNumber,
                      isSelected && styles.weekSelectedDayNumber,
                    ]}
                  >
                    {dayInfo.day}
                  </Text>
                  {renderWeekIndicators(dayInfo)}
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
    marginBottom: -70,
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
  selectedCell: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  darkSelectedCell: {
    backgroundColor: '#0A84FF',
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
  selectedDayText: {
    color: '#fff',
    fontWeight: '700',
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
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  weekRangeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  weekDayRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  weekDayCell: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  darkWeekDayCell: {
    backgroundColor: '#2c2c2e',
  },
  weekTodayCell: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  weekSelectedCell: {
    backgroundColor: '#007AFF',
  },
  darkWeekSelectedCell: {
    backgroundColor: '#0A84FF',
  },
  weekDisabledCell: {
    opacity: 0.4,
  },
  darkWeekDisabledCell: {
    opacity: 0.3,
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  darkWeekDayName: {
    color: '#a0a0a0',
  },
  weekSelectedDayName: {
    color: '#fff',
  },
  weekDayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  darkWeekDayNumber: {
    color: '#fff',
  },
  weekSelectedDayNumber: {
    color: '#fff',
  },
  weekIndicators: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
    justifyContent: 'center',
  },
});


