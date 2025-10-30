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

type ViewMode = 'list' | 'calendar';

export default function ShiftsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { shifts, deleteShift, loadShifts } = useShiftsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

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
    if (dayShifts.length === 1) {
      handleEditShift(dayShifts[0]);
    } else if (dayShifts.length > 1) {
      // Show alert with list of shifts for that day
      const shiftLabels = dayShifts.map(s => `${s.label} (${s.rosteredStart} - ${s.rosteredFinish})`).join('\n');
      Alert.alert(
        'Multiple Shifts',
        `You have ${dayShifts.length} shifts on this day:\n\n${shiftLabels}`,
        [
          { text: 'OK', style: 'cancel' },
          ...dayShifts.map((shift, index) => ({
            text: `Edit ${shift.label}`,
            onPress: () => handleEditShift(shift),
          })),
        ]
      );
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

  const activeShifts = getActiveShifts();
  const inactiveShifts = getInactiveShifts();

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

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      {/* View Mode Toggle */}
      <View style={[styles.viewModeContainer, isDark && styles.darkViewModeContainer]}>
        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === 'calendar' && styles.activeViewModeButton,
            isDark && styles.darkViewModeButton,
            viewMode === 'calendar' && isDark && styles.darkActiveViewModeButton,
          ]}
          onPress={() => setViewMode('calendar')}
        >
          <Ionicons 
            name="calendar" 
            size={18} 
            color={viewMode === 'calendar' ? '#fff' : (isDark ? '#999' : '#666')} 
          />
          <Text style={[
            styles.viewModeText,
            viewMode === 'calendar' && styles.activeViewModeText,
            isDark && styles.darkViewModeText,
            viewMode === 'calendar' && isDark && styles.darkActiveViewModeText,
          ]}>
            Calendar
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === 'list' && styles.activeViewModeButton,
            isDark && styles.darkViewModeButton,
            viewMode === 'list' && isDark && styles.darkActiveViewModeButton,
          ]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons 
            name="list" 
            size={18} 
            color={viewMode === 'list' ? '#fff' : (isDark ? '#999' : '#666')} 
          />
          <Text style={[
            styles.viewModeText,
            viewMode === 'list' && styles.activeViewModeText,
            isDark && styles.darkViewModeText,
            viewMode === 'list' && isDark && styles.darkActiveViewModeText,
          ]}>
            List
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calendar View */}
      {viewMode === 'calendar' ? (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF"
            />
          }
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ShiftsCalendarView
            shifts={shifts}
            onDayPress={handleCalendarDayPress}
            isDark={isDark}
          />
          
          {/* List of Active Shifts Below Calendar */}
          {activeShifts.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Active Shifts
              </Text>
              {activeShifts.map((shift) => {
                const nextOccurrence = getNextShiftOccurrence(shift);
                const isNextShift = nextShiftId === shift.id;
                
                return (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onPress={() => handleEditShift(shift)}
                    onEdit={() => handleEditShift(shift)}
                    onDelete={() => handleDeleteShift(shift)}
                    showActions={true}
                    nextOccurrence={nextOccurrence}
                    isNextShift={isNextShift}
                    isDark={isDark}
                  />
                );
              })}
            </View>
          )}
          
          {/* Inactive Shifts */}
          {inactiveShifts.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                Inactive Shifts
              </Text>
              {inactiveShifts.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  onPress={() => handleEditShift(shift)}
                  onEdit={() => handleEditShift(shift)}
                  onDelete={() => handleDeleteShift(shift)}
                  showActions={true}
                  nextOccurrence="9999-12-31"
                  isNextShift={false}
                  isDark={isDark}
                />
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        /* List View */
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <View>
              {renderSection(
                'Active Shifts',
                activeShifts,
                'No active shifts'
              )}
              {renderSection(
                'Inactive Shifts',
                inactiveShifts,
                'No inactive shifts'
              )}
            </View>
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

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
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  darkViewModeContainer: {
    backgroundColor: '#1c1c1e',
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  darkViewModeButton: {
    backgroundColor: 'transparent',
  },
  activeViewModeButton: {
    backgroundColor: '#007AFF',
  },
  darkActiveViewModeButton: {
    backgroundColor: '#007AFF',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  darkViewModeText: {
    color: '#999',
  },
  activeViewModeText: {
    color: '#fff',
    fontWeight: '600',
  },
  darkActiveViewModeText: {
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  listContainer: {
    paddingVertical: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginHorizontal: 16,
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
});
