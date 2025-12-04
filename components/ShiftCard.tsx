import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [isExpanded, setIsExpanded] = useState(false);

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
      case 'custom': return 'Once Only';
      default: return String(type);
    }
  };

  const getDayName = (dayOfWeek: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayOfWeek];
  };

  const getSubtitleText = () => {
    const parts: string[] = [];
    
    // Add day name (for custom shifts, show the date instead)
    if (shift.type === 'custom') {
      // Format the date nicely
      const date = new Date(shift.activeFrom + 'T00:00:00');
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      parts.push(dateStr);
    } else if (shift.dayOfWeek !== undefined) {
      parts.push(getDayName(shift.dayOfWeek));
    }
    
    // Add time range
    const startTime = shift.rosteredStart || '--:--';
    const finishTime = shift.rosteredFinish || '--:--';
    parts.push(`${startTime} – ${finishTime}`);
    
    // Add frequency if biweekly or custom
    if (shift.type === 'biweekly') {
      parts.push('(biweekly)');
    } else if (shift.type === 'custom') {
      parts.push('(one-time)');
    }
    
    return parts.join(' · ');
  };

  const handleCardPress = () => {
    setIsExpanded(!isExpanded);
  };

  const handleExpandPress = (e: any) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
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
      // Normalize both dates to midnight in local timezone for accurate comparison
      const date = new Date(nextOccurrence + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateMidnight = new Date(date);
      dateMidnight.setHours(0, 0, 0, 0);
      
      const diffTime = dateMidnight.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
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
      // Normalize both dates to midnight in local timezone for accurate comparison
      const date = new Date(nextOccurrence + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateMidnight = new Date(date);
      dateMidnight.setHours(0, 0, 0, 0);
      
      const diffTime = dateMidnight.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
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
      onPress={handleCardPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, isDark && styles.darkText, !isActive() && styles.inactiveText, !isActive() && isDark && styles.darkInactiveText]}>
            {shift.label || 'Unnamed Shift'}
          </Text>
          <Text style={[styles.subtitle, isDark && styles.darkSecondaryText, !isActive() && styles.inactiveText, !isActive() && isDark && styles.darkInactiveText]}>
            {getSubtitleText()}
          </Text>
        </View>
        
        <View style={styles.headerRight}>
          {isNextShift && (
            <View style={styles.nextUpBadge}>
              <Ionicons name="calendar" size={14} color="#fff" />
              <Text style={styles.nextUpText}>Next up</Text>
            </View>
          )}
          <TouchableOpacity 
            style={styles.expandButton}
            onPress={handleExpandPress}
          >
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={18} 
              color={isDark ? "#999" : "#6b7280"} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {isExpanded && (
        <>
          <View style={styles.expandedContent}>
            {shift.type === 'biweekly' && shift.weekIndex && (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={isDark ? "#999" : "#6b7280"} />
                <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                  Week {shift.weekIndex}
                </Text>
              </View>
            )}

            {shift.mealBreakMinutes && shift.mealBreakMinutes > 0 && (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color={isDark ? "#999" : "#6b7280"} />
                <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                  {shift.mealBreakMinutes}m meal break
                </Text>
              </View>
            )}

            <View style={styles.metaRow}>
              <Ionicons name="calendar" size={14} color={isDark ? "#999" : "#6b7280"} />
              <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                {nextOccurrence && nextOccurrence !== '9999-12-31' 
                  ? formatNextOccurrenceDate(nextOccurrence)
                  : formatDateRange(shift.activeFrom || '', shift.activeTo)
                }
              </Text>
            </View>

            {nextOccurrence && formatNextOccurrence(nextOccurrence) !== '' && (
              <View style={styles.metaRow}>
                <Ionicons name="arrow-forward" size={14} color={isDark ? "#999" : "#6b7280"} />
                <Text style={[styles.metaText, isDark && styles.darkNextOccurrence]}>
                  Next: {formatNextOccurrence(nextOccurrence)}
                </Text>
              </View>
            )}

            <View style={styles.metaRow}>
              <Ionicons name="repeat" size={14} color={isDark ? "#999" : "#6b7280"} />
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(shift.type) }]}>
                <Text style={styles.typeText}>{getTypeText(shift.type)}</Text>
              </View>
            </View>
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
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e9f1',
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2933',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#4b5563',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  nextUpText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  expandButton: {
    padding: 4,
  },
  expandedContent: {
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#4b5563',
    flex: 1,
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e4e9f1',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 50,
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
  inactiveText: {
    color: '#999',
  },
  // Dark mode styles
  darkCard: {
    backgroundColor: '#2c2c2e',
    borderColor: '#3a3a3c',
  },
  darkText: {
    color: '#fff',
  },
  darkSecondaryText: {
    color: '#999',
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
