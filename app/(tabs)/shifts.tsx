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
  Modal,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useShiftsStore } from '../../lib/state/shiftsStore';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('Shifts');
import { useLocalUserStore } from '../../lib/state/localUserStore';
import { ShiftCard } from '../../components/ShiftCard';
import { ShiftsCalendarView } from '../../components/ShiftsCalendarView';
import { UsualShift } from '../../types';
import { formatDateToISO } from '../../lib/time';

export default function ShiftsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { localUserId } = useLocalUserStore();
  const { shifts, deleteShift, loadShifts } = useShiftsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week'>('week');
  const [isViewModeMenuOpen, setIsViewModeMenuOpen] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    debug.debug('Loading shifts...');
    loadShifts(localUserId);
  }, [localUserId]);

  // Reload shifts when screen comes into focus (e.g., when navigating back from creating a shift)
  useFocusEffect(
    React.useCallback(() => {
      debug.debug('Shifts screen focused, reloading shifts...');
      loadShifts(localUserId);
    }, [loadShifts, localUserId])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadShifts(localUserId);
    setRefreshing(false);
  };

  const handleAddShift = () => {
    debug.debug('Add shift button pressed');
    setShowAddMenu(true);
    Animated.spring(menuAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const handleCloseAddMenu = () => {
    setShowAddMenu(false);
    menuAnimation.setValue(0);
  };

  const handleCreateShiftPattern = () => {
    handleCloseAddMenu();
    router.push('/shifts/new');
  };

  const handleQuickShift = () => {
    handleCloseAddMenu();
    router.push('/shifts/quick-add');
  };

  const handleEditShift = (shift: UsualShift) => {
    debug.debug('Edit shift pressed:', {
      id: shift.id,
      label: shift.label,
      day: shift.dayOfWeek,
      type: shift.type
    });
    router.push(`/shifts/${shift.id}`);
  };

  const handleDeleteShift = (shift: UsualShift) => {
    debug.debug('Delete shift requested:', {
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
            debug.debug('Confirming delete for shift:', shift.id);
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
    } else {
      // Allow selecting any date, even if no shifts (useful for "Go to Today")
      setSelectedDate(date);
    }
  };

  const getNextShiftOccurrence = (shift: UsualShift): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight for accurate date comparison
    const todayStr = formatDateToISO(today);
    
    // Custom shifts are one-time only, so check if activeFrom is today or in the future
    if (shift.type === 'custom') {
      if (shift.activeFrom >= todayStr) {
        return shift.activeFrom;
      }
      // Already passed, return far future date for sorting
      return '9999-12-31';
    }
    
    const dayOfWeek = shift.dayOfWeek;
    
    // Start from today and look ahead up to 14 days (to handle biweekly shifts)
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      checkDate.setHours(0, 0, 0, 0); // Normalize to midnight
      const dateStr = formatDateToISO(checkDate);
      
      // Check if shift is active on this date
      // Use string comparison for dates to avoid timezone issues
      if (shift.activeFrom <= dateStr && (!shift.activeTo || shift.activeTo >= dateStr)) {
        // Check if this date matches the shift's day of week
        if (checkDate.getDay() === dayOfWeek) {
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
    
    // If no occurrence found in next 14 days, return a far future date for sorting
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
    const today = formatDateToISO(new Date());
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
    const today = formatDateToISO(new Date());
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
  let activeShifts = selectedDate 
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
  const today = formatDateToISO(new Date());
  const nextShifts = activeShifts
    .map(shift => {
      const nextDate = getNextShiftOccurrence(shift);
      return {
        shift,
        nextDate
      };
    })
    .filter(({ nextDate }) => {
      // Include shifts that have a valid next occurrence (not far future date)
      // and that occur today or in the future
      return nextDate !== '9999-12-31' && nextDate >= today;
    })
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  
  const nextShiftId = nextShifts.length > 0 ? nextShifts[0].shift.id : null;

  // Sort active shifts: next shift first, then by day of week
  if (!selectedDate && nextShiftId) {
    activeShifts = [...activeShifts].sort((a, b) => {
      // Put the next shift first
      if (a.id === nextShiftId) return -1;
      if (b.id === nextShiftId) return 1;
      
      // Then sort the rest by day of week (Monday = 1, Tuesday = 2, ..., Sunday = 0)
      const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
      const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
      return dayA - dayB;
    });
  }

  const renderShiftItem = ({ item }: { item: UsualShift }) => {
    // When a date is selected, show that date as the occurrence (since we're filtering for that date)
    // Otherwise, calculate the next occurrence from today
    const nextOccurrence = selectedDate 
      ? selectedDate 
      : getNextShiftOccurrence(item);
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
      <View style={[styles.container, isDark && styles.darkContainer]}>
        <View style={styles.headerContainer}>
          <Text style={[styles.title, isDark && styles.darkText]}>
            Shifts
          </Text>
          <View style={[styles.viewModeChip, styles.viewModeChipDisabled, isDark && styles.darkViewModeChipDisabled]}>
            <Text style={[styles.viewModeChipText, isDark && styles.darkViewModeChipTextDisabled]}>Weekly</Text>
            <Ionicons name="chevron-down" size={16} color={isDark ? '#666' : '#A0A6AD'} />
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.firstRunScroll}
          showsVerticalScrollIndicator={false}
        >

          <View style={[styles.previewCard, isDark && styles.darkPreviewCard]}>
            <Text style={[styles.previewTitle, isDark && styles.darkText]}>
              Calendar preview
            </Text>
            <Text style={[styles.previewDescription, isDark && styles.darkDescription]}>
              Your shift patterns appear on the calendar so you always know what's coming up.
            </Text>
            
            {/* Week Day Row */}
            <View style={styles.previewWeekDayRow}>
              {[
                { name: 'SUN', day: 11, hasShift: true },
                { name: 'MON', day: 12, hasShift: false },
                { name: 'TUE', day: 13, hasShift: true },
                { name: 'WED', day: 14, hasShift: false },
                { name: 'THU', day: 15, hasShift: true },
                { name: 'FRI', day: 16, hasShift: false },
                { name: 'SAT', day: 17, hasShift: false },
              ].map((dayInfo, index) => (
                <View
                  key={index}
                  style={[
                    styles.previewWeekDayCell,
                    isDark && styles.darkPreviewWeekDayCell,
                    dayInfo.day === 13 && styles.previewWeekTodayCell,
                  ]}
                >
                  <Text
                    style={[
                      styles.previewWeekDayName,
                      isDark && styles.darkText,
                      dayInfo.day === 13 && styles.previewWeekTodayDayName,
                    ]}
                  >
                    {dayInfo.name}
                  </Text>
                  <Text
                    style={[
                      styles.previewWeekDayNumber,
                      isDark && styles.darkText,
                      dayInfo.day === 13 && styles.previewWeekTodayDayNumber,
                    ]}
                  >
                    {dayInfo.day}
                  </Text>
                  {dayInfo.hasShift && (
                    <View style={styles.previewWeekIndicators}>
                      <View style={[styles.previewWeekIndicator, styles.previewActiveIndicator]} />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.previewCard, isDark && styles.darkPreviewCard]}>
            <Text style={[styles.previewTitle, isDark && styles.darkText]}>
              Shift cards preview
            </Text>
            <Text style={[styles.previewDescription, isDark && styles.darkDescription]}>
              Each pattern shows the day, time and next occurrence. Tap to edit or duplicate.
            </Text>
            {[
              { title: 'Day shift', subtitle: 'Mon · 07:00 – 15:00' },
              { title: 'Night float', subtitle: 'Thu · 18:00 – 06:00 (biweekly)' },
            ].map((item) => (
              <View key={item.title} style={[styles.previewShiftCard, isDark && styles.darkPreviewShiftCard]}>
                <View>
                  <Text style={[styles.previewShiftTitle, isDark && styles.darkText]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.previewShiftSubtitle, isDark && styles.darkDescription]}>
                    {item.subtitle}
                  </Text>
                </View>
                <View style={styles.previewBadge}>
                  <Ionicons name="calendar" size={14} color="#fff" />
                  <Text style={styles.previewBadgeText}>Next up</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.previewHelperText, isDark && styles.darkDescription]}>
            Create your usual shift patterns to quickly log overtime with pre-filled times.
          </Text>
        </ScrollView>
        <>
          <TouchableOpacity style={styles.previewCTAButton} onPress={handleAddShift}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.previewCTAText}>Add first shift</Text>
        </>

        {/* Add Menu Modal */}
        <Modal
          visible={showAddMenu}
          transparent={true}
          animationType="none"
          onRequestClose={handleCloseAddMenu}
        >
          <TouchableWithoutFeedback onPress={handleCloseAddMenu}>
            <View style={styles.addMenuOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <Animated.View
                  style={[
                    styles.addMenuContainer,
                    isDark && styles.darkAddMenuContainer,
                    {
                      transform: [
                        {
                          scale: menuAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1],
                          }),
                        },
                        {
                          translateY: menuAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [20, 0],
                          }),
                        },
                      ],
                      opacity: menuAnimation,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleQuickShift}
                  >
                    <Ionicons name="flash-outline" size={20} color={isDark ? '#fff' : '#333'} />
                    <Text style={[styles.menuItemText, isDark && styles.darkMenuItemText]}>
                      Quick Shift
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleCreateShiftPattern}
                  >
                    <Ionicons name="calendar-outline" size={20} color={isDark ? '#fff' : '#333'} />
                    <Text style={[styles.menuItemText, isDark && styles.darkMenuItemText]}>
                      Create Shift Pattern
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
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
      {/* Header - Fixed at top */}
      <View style={styles.headerContainer}>
        <Text style={[styles.title, isDark && styles.darkText]}>
          Shifts
        </Text>
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[
              styles.viewModeChip,
              isDark && styles.darkViewModeChip,
              isViewModeMenuOpen && styles.viewModeChipOpen,
            ]}
            onPress={() => setIsViewModeMenuOpen(prev => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewModeChipText}>
              {calendarViewMode === 'month' ? 'Monthly' : 'Weekly'}
            </Text>
            <Ionicons
              name={isViewModeMenuOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#007AFF"
            />
          </TouchableOpacity>
          {isViewModeMenuOpen && (
            <View style={[styles.viewModeMenu, isDark && styles.darkViewModeMenu]}>
              <TouchableOpacity
                style={styles.viewModeMenuItem}
                onPress={() => {
                  setCalendarViewMode('month');
                  setIsViewModeMenuOpen(false);
                }}
              >
                <Text style={[
                  styles.viewModeMenuText,
                  calendarViewMode === 'month' && styles.viewModeMenuTextActive,
                ]}>
                  Monthly
                </Text>
                {calendarViewMode === 'month' && (
                  <Ionicons name="checkmark" size={16} color="#007AFF" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewModeMenuItem}
                onPress={() => {
                  setCalendarViewMode('week');
                  setIsViewModeMenuOpen(false);
                }}
              >
                <Text style={[
                  styles.viewModeMenuText,
                  calendarViewMode === 'week' && styles.viewModeMenuTextActive,
                ]}>
                  Weekly
                </Text>
                {calendarViewMode === 'week' && (
                  <Ionicons name="checkmark" size={16} color="#007AFF" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Scrollable Content */}
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
                viewMode={calendarViewMode}
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

      {/* Add Menu Modal */}
      <Modal
        visible={showAddMenu}
        transparent={true}
        animationType="none"
        onRequestClose={handleCloseAddMenu}
      >
        <TouchableWithoutFeedback onPress={handleCloseAddMenu}>
          <View style={styles.addMenuOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <Animated.View
                style={[
                  styles.addMenuContainer,
                  isDark && styles.darkAddMenuContainer,
                  {
                    transform: [
                      {
                        scale: menuAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                      {
                        translateY: menuAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                    opacity: menuAnimation,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleQuickShift}
                >
                  <Ionicons name="flash-outline" size={20} color={isDark ? '#fff' : '#333'} />
                  <Text style={[styles.menuItemText, isDark && styles.darkMenuItemText]}>
                    Quick Shift
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleCreateShiftPattern}
                >
                  <Ionicons name="calendar-outline" size={20} color={isDark ? '#fff' : '#333'} />
                  <Text style={[styles.menuItemText, isDark && styles.darkMenuItemText]}>
                    Create Shift Pattern
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  calendarSection: {
    marginBottom: 8,
  },
  viewModeContainer: {
    position: 'relative',
  },
  viewModeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#dfe2e6',
  },
  darkViewModeChip: {
    backgroundColor: '#1c1c1e',
    borderColor: '#2c2c2e',
  },
  viewModeChipOpen: {
    borderColor: '#007AFF',
  },
  viewModeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  viewModeMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    zIndex: 10,
  },
  darkViewModeMenu: {
    backgroundColor: '#2c2c2e',
    borderColor: '#3a3a3c',
  },
  viewModeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  viewModeMenuText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  viewModeMenuTextActive: {
    color: '#007AFF',
    fontWeight: '600',
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
  firstRunScroll: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 40,
    gap: 20,
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  darkPreviewCard: {
    backgroundColor: '#1c1c1e',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  previewDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  darkDescription: {
    color: '#a0a0a0',
  },
  previewWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
    marginBottom: 8,
  },
  darkPreviewWeekHeader: {
    backgroundColor: '#2c2c2e',
  },
  previewNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkPreviewNavButton: {
    backgroundColor: '#1c1c1e',
  },
  previewWeekRange: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  previewTodayButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
  },
  darkPreviewTodayButton: {
    backgroundColor: '#1a2942',
  },
  previewTodayButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  previewLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  darkPreviewLegend: {
    backgroundColor: '#2c2c2e',
  },
  previewLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewLegendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  previewActiveIndicator: {
    backgroundColor: '#4CAF50',
  },
  previewInactiveIndicator: {
    backgroundColor: '#FF9800',
  },
  previewLegendText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  previewWeekDayRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 0,
  },
  previewWeekDayCell: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  darkPreviewWeekDayCell: {
    backgroundColor: '#2c2c2e',
  },
  previewWeekTodayCell: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  previewWeekDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  previewWeekTodayDayName: {
    color: '#007AFF',
  },
  previewWeekDayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  previewWeekTodayDayNumber: {
    color: '#007AFF',
  },
  previewWeekIndicators: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
    justifyContent: 'center',
  },
  previewWeekIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  previewShiftCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e4e9f1',
  },
  darkPreviewShiftCard: {
    backgroundColor: '#2c2c2e',
    borderColor: '#3a3a3c',
  },
  previewShiftTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2933',
    marginBottom: 2,
  },
  previewShiftSubtitle: {
    fontSize: 13,
    color: '#4b5563',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  previewBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  previewHelperText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  previewCTAButton: {
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
  previewCTAText: {
    position: 'absolute',
    bottom: 46,
    right: 90,
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    lineHeight: 20,
  },
  viewModeChipDisabled: {
    borderColor: '#dfe2e6',
    opacity: 0.7,
  },
  darkViewModeChipDisabled: {
    borderColor: '#333',
    backgroundColor: '#1c1c1e',
  },
  darkViewModeChipTextDisabled: {
    color: '#666',
  },
  addMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 90,
    paddingRight: 20,
  },
  addMenuContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  darkAddMenuContainer: {
    backgroundColor: '#1c1c1e',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  darkMenuItemText: {
    color: '#fff',
  },
});
