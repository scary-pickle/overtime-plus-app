import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { ShiftCard } from '../../components/ShiftCard';
import { EmptyState } from '../../components/EmptyState';
import { ShiftsCalendarView } from '../../components/ShiftsCalendarView';
import { UsualShift } from '../../types';

export default function ShiftsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { shifts, deleteShift, loadShifts } = useShiftsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔄 ShiftsScreen: Loading shifts...');
    loadShifts();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadShifts();
    setRefreshing(false);
  };

  const handleAddShift = () => {
    console.log('➕ ShiftsScreen: Add shift button pressed');
    router.push('/shifts/new');
  };

  const handleEditShift = (shift: UsualShift) => {
    console.log('✏️ ShiftsScreen: Edit shift pressed:', {
      id: shift.id,
      label: shift.label,
      day: shift.dayOfWeek,
      type: shift.type
    });
    router.push(`/shifts/${shift.id}`);
  };

  const handleDeleteShift = (shift: UsualShift) => {
    console.log('🗑️ ShiftsScreen: Delete shift requested:', {
      id: shift.id,
      label: shift.label,
      day: shift.dayOfWeek
    });
    Alert.alert(
      'Delete Shift',
      'Are you sure you want to delete this shift pattern?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('✅ ShiftsScreen: Confirming delete for shift:', shift.id);
            deleteShift(shift.id);
          },
        },
      ]
    );
  };

  const handleCalendarDayPress = (date: string, dayShifts: UsualShift[]) => {
    // Toggle selection: if clicking the same date, clear it; otherwise set new date
    if (selectedDate === date) {
      setSelectedDate(null);
    } else if (dayShifts.length > 0) {
      setSelectedDate(date);
    }
  };

  const getNextShiftOccurrence = (shift: UsualShift): string => {
    const today = new Date();
    const dayOfWeek = shift.dayOfWeek;
    
    // Start from today and look ahead up to 7 days
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      
      if (checkDate.getDay() === dayOfWeek) {
        const dateStr = checkDate.toISOString().split('T')[0];
        
        // Check if shift is active on this date
        if (shift.activeFrom <= dateStr && (!shift.activeTo || shift.activeTo >= dateStr)) {
          // For biweekly shifts, check week index
          if (shift.type === 'biweekly' && shift.weekIndex) {
            const weekIndex = getWeekIndex(checkDate);
            if (weekIndex === shift.weekIndex) {
              return dateStr;
            }
          } else if (shift.type === 'weekly') {
            return dateStr;
          }
        }
      }
    }
    
    // If no occurrence found in next 7 days, return a far future date for sorting
    return '9999-12-31';
  };

  const getWeekIndex = (date: Date): 1 | 2 => {
    const year = date.getFullYear();
    const firstSunday = new Date(year, 0, 1);
    
    // Find the first Sunday of the year
    while (firstSunday.getDay() !== 0) {
      firstSunday.setDate(firstSunday.getDate() + 1);
    }
    
    const daysSinceFirstSunday = Math.floor((date.getTime() - firstSunday.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysSinceFirstSunday / 7) + 1;
    
    return (weekNumber % 2 === 1) ? 1 : 2;
  };

  const getActiveShifts = () => {
    const today = new Date().toISOString().split('T')[0];
    const activeShifts = shifts.filter(shift => 
      shift.activeFrom <= today && 
      (!shift.activeTo || shift.activeTo >= today)
    );
    
    // Sort by day of week (Monday = 1, Tuesday = 2, ..., Sunday = 0)
    return activeShifts.sort((a, b) => {
      // Convert Sunday (0) to 7 for proper ordering
      const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
      const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
      return dayA - dayB;
    });
  };

  const getInactiveShifts = () => {
    const today = new Date().toISOString().split('T')[0];
    return shifts.filter(shift => 
      shift.activeTo && shift.activeTo < today
    );
  };

  const getShiftsForSelectedDate = (date: string): UsualShift[] => {
    const selectedDateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = selectedDateObj.getDay();
    
    return shifts.filter(shift => {
      // Check if shift is for this day of week
      if (shift.dayOfWeek !== dayOfWeek) return false;
      
      // Check if shift is active on this date
      if (shift.activeFrom > date) return false;
      if (shift.activeTo && shift.activeTo < date) return false;
      
      // For biweekly shifts, check week index
      if (shift.type === 'biweekly' && shift.weekIndex) {
        const weekIndex = getWeekIndex(selectedDateObj);
        if (weekIndex !== shift.weekIndex) return false;
      }
      
      return true;
    });
  };

  const allActiveShifts = getActiveShifts();
  const allInactiveShifts = getInactiveShifts();

  // Filter shifts if a date is selected
  const activeShifts = selectedDate 
    ? getShiftsForSelectedDate(selectedDate).filter(shift => 
        shift.activeFrom <= selectedDate && 
        (!shift.activeTo || shift.activeTo >= selectedDate)
      )
    : allActiveShifts;
    
  const inactiveShifts = selectedDate
    ? getShiftsForSelectedDate(selectedDate).filter(shift => 
        shift.activeTo && shift.activeTo < selectedDate
      )
    : allInactiveShifts;

  // Calculate the next shift once for all items
  const today = new Date().toISOString().split('T')[0];
  const nextShifts = activeShifts
    .map(shift => ({
      shift,
      nextDate: getNextShiftOccurrence(shift)
    }))
    .filter(({ nextDate }) => nextDate !== '9999-12-31' && nextDate >= today)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  
  const nextShiftId = nextShifts.length > 0 ? nextShifts[0].shift.id : null;

  const renderShiftItem = ({ item }: { item: UsualShift }) => {
    const nextOccurrence = getNextShiftOccurrence(item);
    const isNextShift = nextShiftId === item.id;
    
    return (
      <ShiftCard
        shift={item}
        onPress={() => handleEditShift(item)}
        onEdit={() => handleEditShift(item)}
        onDelete={() => handleDeleteShift(item)}
        showActions={true}
        nextOccurrence={nextOccurrence}
        isNextShift={isNextShift}
        isDark={isDark}
      />
    );
  };

  const renderSection = (title: string, data: UsualShift[], emptyMessage: string) => {
    if (data.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
          {title}
        </Text>
        <FlatList
          data={data}
          renderItem={renderShiftItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptySection}>
              <Text style={[styles.emptyText, isDark && styles.darkEmptyText]}>
                {emptyMessage}
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  if (shifts.length === 0) {
    return (
      <EmptyState
        title="No Shift Patterns"
        description="Create your usual shift patterns to quickly log overtime with pre-filled times."
        actionText="Add First Shift"
        onAction={handleAddShift}
        icon="📅"
      />
    );
  }

  const formatSelectedDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={
          <View style={styles.content}>
            {/* Calendar Picker */}
            <View style={styles.calendarSection}>
              <ShiftsCalendarView
                shifts={shifts}
                onDayPress={handleCalendarDayPress}
                selectedDate={selectedDate}
                isDark={isDark}
              />
            </View>

            {/* Selected Date Banner */}
            {selectedDate && (
              <View style={[styles.filterBanner, isDark && styles.darkFilterBanner]}>
                <View style={styles.filterBannerContent}>
                  <Ionicons 
                    name="calendar" 
                    size={20} 
                    color={isDark ? '#fff' : '#007AFF'} 
                  />
                  <Text style={[styles.filterBannerText, isDark && styles.darkText]}>
                    Showing shifts for {formatSelectedDate(selectedDate)}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedDate(null)}
                  style={styles.filterBannerClose}
                >
                  <Ionicons 
                    name="close-circle" 
                    size={24} 
                    color={isDark ? '#fff' : '#007AFF'} 
                  />
                </TouchableOpacity>
              </View>
            )}

            {renderSection(
              'Active Shifts',
              activeShifts,
              selectedDate ? 'No active shifts on this date' : 'No active shifts'
            )}
            {renderSection(
              'Inactive Shifts',
              inactiveShifts,
              selectedDate ? 'No inactive shifts on this date' : 'No inactive shifts'
            )}
          </View>
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddShift}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  calendarSection: {
    marginBottom: 8,
  },
  listContainer: {
    paddingBottom: 80,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  darkText: {
    color: '#fff',
  },
  emptySection: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  darkEmptyText: {
    color: '#999',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  filterBanner: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  darkFilterBanner: {
    backgroundColor: '#1a2942',
  },
  filterBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  filterBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    flex: 1,
    flexWrap: 'wrap',
  },
  filterBannerClose: {
    padding: 4,
  },
});
