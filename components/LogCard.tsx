import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OvertimeLog } from '../types';
import { formatMinutes } from '../lib/time';

interface LogCardProps {
  log: OvertimeLog;
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
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#FFA500';
      case 'ready': return '#4CAF50';
      case 'exported': return '#2196F3';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'ready': return 'Ready';
      case 'exported': return 'Exported';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
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
      onPress={onPress}
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
        
        <View style={styles.dateContainer}>
          <Text style={[styles.date, isDark && styles.darkText]}>{formatDate(log.date)}</Text>
          <Text style={[styles.time, isDark && styles.darkSecondaryText]}>
            {log.actualStart} - {log.actualFinish}
          </Text>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(log.status) }]}>
          <Text style={styles.statusText}>{getStatusText(log.status)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Show SMO categories if present, otherwise show regular category */}
        {log.smoCategories ? (
          <View style={styles.row}>
            <Text style={[styles.label, isDark && styles.darkSecondaryText]}>SMO Categories:</Text>
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
        ) : (
          <View style={styles.row}>
            <Text style={[styles.label, isDark && styles.darkSecondaryText]}>Category:</Text>
            <Text style={[styles.value, isDark && styles.darkText]}>{log.category}</Text>
          </View>
        )}
        
        <View style={styles.row}>
          <Text style={[styles.label, isDark && styles.darkSecondaryText]}>Overtime:</Text>
          <Text style={[styles.value, styles.overtimeValue, isDark && styles.darkOvertimeValue]}>
            {formatMinutes(log.minutesOvertime)}
          </Text>
        </View>
        
        {log.rosteredStart && log.rosteredFinish && (
          <View style={styles.row}>
            <Text style={[styles.label, isDark && styles.darkSecondaryText]}>Rostered:</Text>
            <Text style={[styles.value, isDark && styles.darkText]}>
              {log.rosteredStart} - {log.rosteredFinish}
            </Text>
          </View>
        )}
        
        {log.comments && (
          <View style={styles.row}>
            <Text style={[styles.label, isDark && styles.darkSecondaryText]}>Comments:</Text>
            <Text style={[styles.value, styles.commentsValue, isDark && styles.darkCommentsValue]} numberOfLines={2}>
              {log.comments}
            </Text>
          </View>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  dateContainer: {
    flex: 1,
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  time: {
    fontSize: 13,
    color: '#666',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  overtimeValue: {
    color: '#007AFF',
    fontWeight: '600',
  },
  commentsValue: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    flex: 2,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 8,
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
  darkOvertimeValue: {
    color: '#64B5F6',
  },
  darkCommentsValue: {
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
    flex: 2,
    justifyContent: 'flex-end',
  },
  smoCategoryBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 4,
    marginBottom: 4,
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
});
