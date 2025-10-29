import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UsualShift } from '../types';

interface ShiftCardProps {
  shift: UsualShift;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  nextOccurrence?: string;
  isNextShift?: boolean;
  isDark?: boolean;
}

export function ShiftCard({ 
  shift, 
  onPress, 
  onEdit, 
  onDelete, 
  showActions = true,
  nextOccurrence,
  isNextShift = false,
  isDark = false
}: ShiftCardProps) {
  const getTypeColor = (type: string) => {
    if (!type) return '#666';
    switch (type) {
      case 'weekly': return '#4CAF50';
      case 'biweekly': return '#FF9800';
      case 'custom': return '#9C27B0';
      default: return '#666';
    }
  };

  const getTypeText = (type: string) => {
    if (!type) return 'Unknown';
    switch (type) {
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Biweekly';
      case 'custom': return 'Custom';
      default: return String(type);
    }
  };

  const getDayName = (dayOfWeek: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayOfWeek];
  };

  const formatDateRange = (activeFrom: string, activeTo?: string) => {
    if (!activeFrom) return 'No start date';
    
    try {
      const from = new Date(activeFrom).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      
      if (!activeTo) {
        return `From ${from}`;
      }
      
      const to = new Date(activeTo).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      
      return `${from} - ${to}`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatNextOccurrence = (nextOccurrence?: string) => {
    if (!nextOccurrence || nextOccurrence === '9999-12-31') {
      return '';
    }
    
    try {
      const date = new Date(nextOccurrence);
      const today = new Date();
      const diffTime = date.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Tomorrow';
      } else if (diffDays <= 7) {
        return `In ${diffDays} days`;
      } else {
        return date.toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short'
        });
      }
    } catch (error) {
      return '';
    }
  };

  const formatNextOccurrenceDate = (nextOccurrence: string) => {
    try {
      const date = new Date(nextOccurrence);
      const today = new Date();
      const diffTime = date.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Tomorrow';
      } else {
        return date.toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
    } catch (error) {
      return 'Invalid date';
    }
  };

  const isActive = () => {
    if (!shift.activeFrom) return false;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      return shift.activeFrom <= today && (!shift.activeTo || shift.activeTo >= today);
    } catch (error) {
      return false;
    }
  };

  return (
    <TouchableOpacity 
      style={[
        styles.card,
        isDark && styles.darkCard,
        !isActive() && styles.inactiveCard,
        !isActive() && isDark && styles.darkInactiveCard,
        isNextShift && styles.nextShiftCard,
        isNextShift && isDark && styles.darkNextShiftCard
      ]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isDark && styles.darkText, !isActive() && styles.inactiveText, !isActive() && isDark && styles.darkInactiveText]}>
              {shift.label || 'Unnamed Shift'}
            </Text>
            {isNextShift && (
              <View style={styles.nextShiftBadge}>
                <Text style={styles.nextShiftText}>NEXT</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(shift.type) }]}>
          <Text style={styles.typeText}>{getTypeText(shift.type)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.timeContainer}>
          <Text style={[styles.timeLabel, isDark && styles.darkTimeLabel, !isActive() && styles.inactiveText, !isActive() && isDark && styles.darkInactiveText]}>
            {shift.rosteredStart || '--:--'} - {shift.rosteredFinish || '--:--'}
          </Text>
          {shift.mealBreakMinutes && shift.mealBreakMinutes > 0 && (
            <Text style={[styles.mealBreak, isDark && styles.darkSecondaryText, !isActive() && styles.inactiveText, !isActive() && isDark && styles.darkInactiveText]}>
              ({shift.mealBreakMinutes}m break)
            </Text>
          )}
        </View>
        
        {shift.type === 'biweekly' && shift.weekIndex && (
          <View style={styles.weekContainer}>
            <Text style={[styles.weekLabel, isDark && styles.darkWeekLabel, !isActive() && styles.inactiveText, !isActive() && isDark && styles.darkInactiveText]}>
              Week {shift.weekIndex}
            </Text>
          </View>
        )}
        
        <View style={styles.bottomRow}>
          <View style={styles.dateContainer}>
            {nextOccurrence && nextOccurrence !== '9999-12-31' ? (
              <Text style={[styles.dateLabel, isDark && styles.darkSecondaryText, !isActive() && styles.inactiveText, !isActive() && isDark && styles.darkInactiveText]}>
                {formatNextOccurrenceDate(nextOccurrence)}
              </Text>
            ) : (
              <Text style={[styles.dateLabel, isDark && styles.darkSecondaryText, !isActive() && styles.inactiveText, !isActive() && isDark && styles.darkInactiveText]}>
                {formatDateRange(shift.activeFrom || '', shift.activeTo)}
              </Text>
            )}
            {nextOccurrence && formatNextOccurrence(nextOccurrence) !== '' && (
              <Text style={[styles.nextOccurrenceLabel, isDark && styles.darkNextOccurrence, !isActive() && styles.inactiveText, !isActive() && isDark && styles.darkInactiveText]}>
                Next: {formatNextOccurrence(nextOccurrence)}
              </Text>
            )}
          </View>

          {showActions && (
            <View style={styles.actions}>
              {onEdit && (
                <TouchableOpacity 
                  style={[styles.actionButton, isDark && styles.darkActionButton]}
                  onPress={onEdit}
                >
                  <Text style={[styles.actionButtonText, isDark && styles.darkActionButtonText]}>Edit</Text>
                </TouchableOpacity>
              )}
              
              {onDelete && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.deleteButton, isDark && styles.darkDeleteButton]}
                  onPress={onDelete}
                >
                  <Text style={[styles.actionButtonText, styles.deleteButtonText, isDark && styles.darkDeleteButtonText]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginVertical: 3,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 3,
  },
  nextShiftCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  inactiveCard: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextShiftBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nextShiftText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  day: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    marginBottom: 0,
  },
  timeContainer: {
    marginBottom: 3,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  mealBreak: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  weekContainer: {
    marginBottom: 4,
  },
  weekLabel: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  dateContainer: {
    flex: 1,
    marginTop: 0,
  },
  dateLabel: {
    fontSize: 11,
    color: '#666',
  },
  nextOccurrenceLabel: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 0,
  },
  inactiveText: {
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 0,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 60,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#ffebee',
    borderColor: '#ffcdd2',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#d32f2f',
  },
  // Dark mode styles
  darkCard: {
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#333',
  },
  darkText: {
    color: '#fff',
  },
  darkSecondaryText: {
    color: '#999',
  },
  darkTimeLabel: {
    color: '#64B5F6',
  },
  darkWeekLabel: {
    color: '#FFB74D',
  },
  darkNextOccurrence: {
    color: '#64B5F6',
  },
  darkInactiveCard: {
    backgroundColor: '#2c2c2e',
    opacity: 0.6,
  },
  darkInactiveText: {
    color: '#666',
  },
  darkNextShiftCard: {
    backgroundColor: '#1a1a2e',
    borderColor: '#007AFF',
  },
  darkActionButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#48484a',
  },
  darkActionButtonText: {
    color: '#fff',
  },
  darkDeleteButton: {
    backgroundColor: '#2d1b1b',
    borderColor: '#4a2c2c',
  },
  darkDeleteButtonText: {
    color: '#ff6b6b',
  },
});
