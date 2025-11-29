import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OvertimeLog } from '../types';
import { formatMinutes } from '../lib/time';

interface LogCardProps {
  log: OvertimeLog;
  linkedLog?: OvertimeLog; // For shift swaps
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMarkReady?: () => void;
  showActions?: boolean;
  isSelected?: boolean;
  showSelection?: boolean;
  onToggleSelection?: () => void;
  isDark?: boolean;
}

export function LogCard({ 
  log, 
  linkedLog,
  onPress, 
  onEdit, 
  onDelete, 
  onMarkReady, 
  showActions = true,
  isSelected = false,
  showSelection = false,
  onToggleSelection,
  isDark = false
}: LogCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatCompactDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short'
    });
  };

  const getCategoryDisplayName = () => {
    if (log.isShiftSwap) {
      return 'Shift Swap';
    }
    if (log.smoCategories) {
      const activeCategories = Object.entries(log.smoCategories)
        .filter(([_, value]) => value)
        .map(([key, _]) => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()));
      return activeCategories.join(', ') || 'SMO Categories';
    }
    return log.category;
  };

  const getSubtitleText = () => {
    const parts: string[] = [];
    
    // Add date
    parts.push(formatCompactDate(log.date));
    
    // For shift swaps, show both people's initials and total overtime
    if (log.isShiftSwap && linkedLog) {
      const totalOvertime = log.minutesOvertime + linkedLog.minutesOvertime;
      parts.push(`${log.initials} ↔ ${linkedLog.initials}`);
      parts.push(formatMinutes(totalOvertime));
      parts.push('Shift swap');
    } else {
      // Add hours
      parts.push(formatMinutes(log.minutesOvertime));
      
      // Add description (comments or shift info)
      if (log.comments) {
        parts.push(log.comments);
      } else if (log.rosteredStart && log.rosteredFinish && log.rosteredStart !== 'N/A' && log.rosteredFinish !== 'N/A') {
        parts.push(`${log.rosteredStart} - ${log.rosteredFinish} rostered`);
      } else if (log.actualStart !== 'N/A' && log.actualFinish !== 'N/A') {
        parts.push(`${log.actualStart} - ${log.actualFinish}`);
      } else if (log.status === 'draft') {
        parts.push('Needs delegate details before export');
      }
    }
    
    return parts.join(' · ');
  };

  const handleCardPress = () => {
    if (showSelection && onToggleSelection) {
      onToggleSelection();
    } else {
      // Tapping the card expands/collapses it
      setIsExpanded(!isExpanded);
    }
  };

  const handleExpandPress = (e: any) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const getStatusBadge = () => {
    if (log.status === 'ready') {
      return (
        <View style={[styles.statusBadge, styles.readyBadge]}>
          <Ionicons name="checkmark-circle" size={14} color="#1b5728" />
          <Text style={styles.readyText}>Ready</Text>
        </View>
      );
    } else if (log.status === 'draft') {
      return (
        <View style={[styles.statusBadge, styles.draftBadge]}>
          <Ionicons name="ellipse" size={12} color="#a15c07" />
          <Text style={styles.draftText}>Draft</Text>
        </View>
      );
    } else if (log.status === 'exported') {
      return (
        <View style={[styles.statusBadge, styles.exportedBadge]}>
          <Ionicons name="checkmark-circle" size={14} color="#1e40af" />
          <Text style={styles.exportedText}>Exported</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <TouchableOpacity 
      style={[
        styles.card,
        isDark && styles.darkCard,
        isSelected && styles.selectedCard,
        isSelected && isDark && styles.darkSelectedCard,
        showSelection && styles.selectionCard
      ]} 
      onPress={handleCardPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        {showSelection && (
          <TouchableOpacity 
            style={styles.selectionButton}
            onPress={onToggleSelection}
          >
            <Ionicons 
              name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={isSelected ? "#007AFF" : "#ccc"} 
            />
          </TouchableOpacity>
        )}
        
        <View style={styles.titleContainer}>
          <Text style={[styles.title, isDark && styles.darkText]}>
            {getCategoryDisplayName()}
          </Text>
        </View>
        
        <View style={styles.headerRight}>
          {getStatusBadge()}
          {!showSelection && (
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
          )}
        </View>
      </View>

      <Text style={[styles.subtitle, isDark && styles.darkSecondaryText]}>
        {getSubtitleText()}
      </Text>

      {isExpanded && (
        <>
          <View style={styles.expandedContent}>
            {log.isShiftSwap && linkedLog ? (
              <>
                {/* Person A Entry */}
                <View style={[styles.shiftSwapSection, isDark && styles.darkShiftSwapSection]}>
                  <Text style={[styles.shiftSwapPersonTitle, isDark && styles.darkText]}>
                    {log.initials}
                  </Text>
                  {log.rosteredStart && log.rosteredFinish && log.rosteredStart !== 'N/A' && log.rosteredFinish !== 'N/A' && (
                    <View style={styles.metaRow}>
                      <Ionicons name="time" size={14} color={isDark ? "#999" : "#6b7280"} />
                      <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                        Rostered: {log.rosteredStart} - {log.rosteredFinish}
                      </Text>
                    </View>
                  )}
                  {log.actualStart !== 'N/A' && log.actualFinish !== 'N/A' && (
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={14} color={isDark ? "#999" : "#6b7280"} />
                      <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                        Actual: {log.actualStart} - {log.actualFinish}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Ionicons name="hourglass" size={14} color={isDark ? "#999" : "#6b7280"} />
                    <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                      Overtime: {formatMinutes(log.minutesOvertime)}
                    </Text>
                  </View>
                </View>

                {/* Person B Entry */}
                <View style={[styles.shiftSwapSection, isDark && styles.darkShiftSwapSection]}>
                  <Text style={[styles.shiftSwapPersonTitle, isDark && styles.darkText]}>
                    {linkedLog.initials}
                  </Text>
                  {linkedLog.rosteredStart && linkedLog.rosteredFinish && linkedLog.rosteredStart !== 'N/A' && linkedLog.rosteredFinish !== 'N/A' && (
                    <View style={styles.metaRow}>
                      <Ionicons name="time" size={14} color={isDark ? "#999" : "#6b7280"} />
                      <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                        Rostered: {linkedLog.rosteredStart} - {linkedLog.rosteredFinish}
                      </Text>
                    </View>
                  )}
                  {linkedLog.actualStart !== 'N/A' && linkedLog.actualFinish !== 'N/A' && (
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={14} color={isDark ? "#999" : "#6b7280"} />
                      <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                        Actual: {linkedLog.actualStart} - {linkedLog.actualFinish}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Ionicons name="hourglass" size={14} color={isDark ? "#999" : "#6b7280"} />
                    <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                      Overtime: {formatMinutes(linkedLog.minutesOvertime)}
                    </Text>
                  </View>
                </View>

                {/* Total */}
                <View style={[styles.shiftSwapTotal, isDark && styles.darkShiftSwapTotal]}>
                  <Text style={[styles.shiftSwapTotalText, isDark && styles.darkText]}>
                    Total Overtime: {formatMinutes(log.minutesOvertime + linkedLog.minutesOvertime)}
                  </Text>
                </View>
              </>
            ) : (
              <>
                {log.rosteredStart && log.rosteredFinish && log.rosteredStart !== 'N/A' && log.rosteredFinish !== 'N/A' && (
                  <View style={styles.metaRow}>
                    <Ionicons name="time" size={14} color={isDark ? "#999" : "#6b7280"} />
                    <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                      Rostered: {log.rosteredStart} - {log.rosteredFinish}
                    </Text>
                  </View>
                )}
                
                {log.actualStart !== 'N/A' && log.actualFinish !== 'N/A' && (
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={14} color={isDark ? "#999" : "#6b7280"} />
                    <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                      Actual: {log.actualStart} - {log.actualFinish}
                    </Text>
                  </View>
                )}

                {log.smoCategories && (
                  <View style={styles.metaRow}>
                    <Ionicons name="list" size={14} color={isDark ? "#999" : "#6b7280"} />
                    <View style={styles.smoCategoriesContainer}>
                      {Object.entries(log.smoCategories)
                        .filter(([_, value]) => value)
                        .map(([key, _]) => (
                          <View key={key} style={[styles.smoCategoryBadge, isDark && styles.darkSmoCategoryBadge]}>
                            <Text style={[styles.smoCategoryText, isDark && styles.darkSmoCategoryText]}>
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </Text>
                          </View>
                        ))}
                    </View>
                  </View>
                )}

                {log.comments && (
                  <View style={styles.metaRow}>
                    <Ionicons name="document-text" size={14} color={isDark ? "#999" : "#6b7280"} />
                    <Text style={[styles.metaText, isDark && styles.darkSecondaryText]} numberOfLines={3}>
                      {log.comments}
                    </Text>
                  </View>
                )}

                {log.status === 'draft' && !log.comments && (
                  <Text style={[styles.draftHelperText, isDark && styles.darkSecondaryText]}>
                    Draft logs stay here until you're ready to submit.
                  </Text>
                )}
              </>
            )}
          </View>

          {showActions && (
            <View style={styles.actions}>
              {log.status === 'draft' && onMarkReady && (
                <TouchableOpacity 
                  style={[styles.actionButton, isDark && styles.darkActionButton]}
                  onPress={onMarkReady}
                >
                  <Text style={[styles.actionButtonText, isDark && styles.darkActionButtonText]}>Mark Ready</Text>
                </TouchableOpacity>
              )}
              
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
    borderColor: '#e5e7eb',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  readyBadge: {
    backgroundColor: '#d1fae5',
  },
  draftBadge: {
    backgroundColor: '#fef3c7',
  },
  exportedBadge: {
    backgroundColor: '#dbeafe',
  },
  readyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1b5728',
  },
  draftText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a15c07',
  },
  exportedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
  expandedContent: {
    marginTop: 8,
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
    color: '#6b7280',
    flex: 1,
  },
  draftHelperText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
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
  expandButton: {
    padding: 4,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  selectionCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectionButton: {
    marginRight: 12,
    padding: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
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
  darkSelectedCard: {
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
  smoCategoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: 6,
  },
  smoCategoryBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  darkSmoCategoryBadge: {
    backgroundColor: '#1a237e',
  },
  smoCategoryText: {
    fontSize: 11,
    color: '#1976d2',
    fontWeight: '500',
  },
  darkSmoCategoryText: {
    color: '#90caf9',
  },
  shiftSwapSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  darkShiftSwapSection: {
    backgroundColor: '#2c2c2e',
    borderColor: '#3a3a3c',
  },
  shiftSwapPersonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  shiftSwapTotal: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  darkShiftSwapTotal: {
    backgroundColor: '#1a2e1a',
    borderColor: '#4CAF50',
  },
  shiftSwapTotalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    textAlign: 'center',
  },
});
