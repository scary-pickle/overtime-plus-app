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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLogsStore } from '../../lib/state/logsStore';
import { LogCard } from '../../components/LogCard';
import { EmptyState } from '../../components/EmptyState';
import { OvertimeLog } from '../../types';

type FilterStatus = 'all' | 'draft' | 'ready' | 'exported';

export default function LogScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { logs, deleteLog, markReady, loadLogs, getReadyLogs, getExportedLogs, resetLogsToReady } = useLogsStore();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const handleAddLog = () => {
    router.push('/log/new');
  };

  const handleEditLog = (log: OvertimeLog) => {
    if (log.status === 'exported') {
      Alert.alert(
        'Edit Exported Log',
        'This log has already been exported. Editing will convert it back to ready status and you\'ll need to re-export it. Do you want to continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue Editing', 
            style: 'default',
            onPress: () => router.push(`/log/${log.id}`)
          }
        ]
      );
    } else {
      router.push(`/log/${log.id}`);
    }
  };

  const handleDeleteLog = (log: OvertimeLog) => {
    Alert.alert(
      'Delete Log',
      'Are you sure you want to delete this log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteLog(log.id),
        },
      ]
    );
  };

  const handleMarkReady = (log: OvertimeLog) => {
    markReady(log.id);
  };

  const handleExportReady = () => {
    const readyLogs = getReadyLogs();
    if (readyLogs.length === 0) {
      Alert.alert(
        'No Ready Logs',
        'You need to have at least one ready log to export.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/export/preview');
  };

  const handleToggleSelection = (logId: string) => {
    if (selectedLogs.includes(logId)) {
      setSelectedLogs(selectedLogs.filter(id => id !== logId));
    } else {
      setSelectedLogs([...selectedLogs, logId]);
    }
  };

  const handleSelectAll = () => {
    const exportedLogs = getExportedLogs();
    if (selectedLogs.length === exportedLogs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(exportedLogs.map(log => log.id));
    }
  };

  const handleReExportSelected = () => {
    if (selectedLogs.length === 0) {
      Alert.alert('No Selection', 'Please select logs to re-export.');
      return;
    }

    Alert.alert(
      'Re-export Selected Logs',
      `Are you sure you want to re-export ${selectedLogs.length} log${selectedLogs.length !== 1 ? 's' : ''}? This will reset them to ready status and create a new export.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-export',
          onPress: async () => {
            try {
              // Reset selected logs to ready status
              await resetLogsToReady(selectedLogs);
              setSelectedLogs([]);
              setIsSelectionMode(false);
              
              // Navigate to export preview
              router.push('/export/preview');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset logs. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCancelSelection = () => {
    setSelectedLogs([]);
    setIsSelectionMode(false);
  };

  const handleFilterChange = (status: FilterStatus) => {
    setFilterStatus(status);
    // Reset selection when changing filters
    setSelectedLogs([]);
    setIsSelectionMode(false);
  };

  const getFilteredLogs = () => {
    if (filterStatus === 'all') return logs;
    return logs.filter(log => log.status === filterStatus);
  };

  const getStatusCounts = () => {
    return {
      all: logs.length,
      draft: logs.filter(log => log.status === 'draft').length,
      ready: logs.filter(log => log.status === 'ready').length,
      exported: logs.filter(log => log.status === 'exported').length,
    };
  };

  const statusCounts = getStatusCounts();
  const filteredLogs = getFilteredLogs();

  const renderLogItem = ({ item }: { item: OvertimeLog }) => {
    const isSelected = selectedLogs.includes(item.id);
    const isExported = item.status === 'exported';
    
    return (
      <LogCard
        log={item}
        onPress={() => {
          if (isSelectionMode && isExported) {
            handleToggleSelection(item.id);
          } else {
            handleEditLog(item);
          }
        }}
        onEdit={() => handleEditLog(item)}
        onDelete={() => handleDeleteLog(item)}
        onMarkReady={() => handleMarkReady(item)}
        showActions={!isSelectionMode}
        isSelected={isSelected}
        showSelection={isSelectionMode && isExported}
        onToggleSelection={() => handleToggleSelection(item.id)}
        isDark={isDark}
      />
    );
  };

  const renderFilterButton = (status: FilterStatus, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filterStatus === status && styles.activeFilterButton,
        isDark && styles.darkFilterButton,
        filterStatus === status && isDark && styles.darkActiveFilterButton,
      ]}
      onPress={() => handleFilterChange(status)}
    >
      <Text
        style={[
          styles.filterButtonText,
          filterStatus === status && styles.activeFilterButtonText,
          isDark && styles.darkFilterButtonText,
          filterStatus === status && isDark && styles.darkActiveFilterButtonText,
        ]}
      >
        {label} ({statusCounts[status]})
      </Text>
    </TouchableOpacity>
  );

  if (logs.length === 0) {
    return (
      <EmptyState
        title="No Overtime Logs"
        description="Start tracking your overtime by creating your first log."
        actionText="Add First Log"
        onAction={handleAddLog}
        icon="📝"
      />
    );
  }

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      {/* Filter Buttons */}
      <View style={[styles.filterContainer, isDark && styles.darkFilterContainer]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderFilterButton('all', 'All')}
          {renderFilterButton('draft', 'Draft')}
          {renderFilterButton('ready', 'Ready')}
          {renderFilterButton('exported', 'Exported')}
        </ScrollView>
      </View>

      {/* Export Section */}
      {getReadyLogs().length > 0 && (
        <View style={[styles.exportContainer, isDark && styles.darkExportContainer]}>
          <View style={styles.exportInfo}>
            <Text style={[styles.exportTitle, isDark && styles.darkText]}>
              Ready to Export
            </Text>
            <Text style={[styles.exportSubtitle, isDark && styles.darkText]}>
              {getReadyLogs().length} log{getReadyLogs().length !== 1 ? 's' : ''} ready for AVAC form
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.exportButton, isDark && styles.darkExportButton]}
            onPress={handleExportReady}
          >
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={styles.exportButtonText}>Export PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Re-export Section for Exported Logs */}
      {filterStatus === 'exported' && getExportedLogs().length > 0 && (
        <View style={[styles.reExportContainer, isDark && styles.darkReExportContainer]}>
          {!isSelectionMode ? (
            <View style={styles.reExportInfo}>
              <Text style={[styles.reExportTitle, isDark && styles.darkText]}>
                Re-export Logs
              </Text>
              <Text style={[styles.reExportSubtitle, isDark && styles.darkText]}>
                Select exported logs to re-export them
              </Text>
            </View>
          ) : (
            <View style={styles.selectionInfo}>
              <Text style={[styles.selectionTitle, isDark && styles.darkText]}>
                {selectedLogs.length} of {getExportedLogs().length} selected
              </Text>
              <Text style={[styles.selectionSubtitle, isDark && styles.darkText]}>
                Tap logs to select them for re-export
              </Text>
            </View>
          )}
          
          <View style={styles.reExportActions}>
            {!isSelectionMode ? (
              <View style={styles.selectionControls}>
                <TouchableOpacity
                  style={[styles.selectionButton, isDark && styles.darkSelectionButton]}
                  onPress={() => setIsSelectionMode(true)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                  <Text style={[styles.selectionButtonText, isDark && styles.darkSelectionButtonText]}>
                    Select Logs
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.selectionHint, isDark && styles.darkSelectionHint]}>
                  Tap to select exported logs for re-export
                </Text>
              </View>
            ) : (
              <View style={styles.selectionModeControls}>
                <View style={styles.selectionInfo}>
                  <Text style={[styles.selectionCounter, isDark && styles.darkSelectionCounter]}>
                    {selectedLogs.length} of {getExportedLogs().length} selected
                  </Text>
                </View>
                
                <View style={styles.bulkActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.selectAllButton]}
                    onPress={handleSelectAll}
                  >
                    <Ionicons name="checkmark-done" size={16} color="#fff" />
                    <Text style={styles.actionButtonText}>
                      {selectedLogs.length === getExportedLogs().length ? 'Clear All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                  
                  {selectedLogs.length > 0 && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.reExportButton]}
                      onPress={handleReExportSelected}
                    >
                      <Ionicons name="refresh" size={16} color="#fff" />
                      <Text style={styles.actionButtonText}>
                        Re-export ({selectedLogs.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={handleCancelSelection}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                    <Text style={styles.actionButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Logs List */}
      <FlatList
        data={filteredLogs}
        renderItem={renderLogItem}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddLog}
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
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  darkFilterContainer: {
    backgroundColor: '#1c1c1e',
    borderBottomColor: '#333',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  darkFilterButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  darkActiveFilterButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  darkFilterButtonText: {
    color: '#999',
  },
  darkActiveFilterButtonText: {
    color: '#fff',
  },
  listContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
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
  exportContainer: {
    backgroundColor: '#e8f5e8',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  darkExportContainer: {
    backgroundColor: '#1a2e1a',
    borderColor: '#4CAF50',
  },
  exportInfo: {
    flex: 1,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 4,
  },
  darkText: {
    color: '#fff',
  },
  exportSubtitle: {
    fontSize: 14,
    color: '#4CAF50',
  },
  exportButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  darkExportButton: {
    backgroundColor: '#4CAF50',
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reExportContainer: {
    backgroundColor: '#fff3cd',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  darkReExportContainer: {
    backgroundColor: '#2d2a1a',
    borderColor: '#ffc107',
  },
  reExportInfo: {
    marginBottom: 12,
  },
  reExportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  reExportSubtitle: {
    fontSize: 14,
    color: '#b8860b',
  },
  selectionInfo: {
    marginBottom: 12,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  selectionSubtitle: {
    fontSize: 14,
    color: '#b8860b',
  },
  reExportActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  selectionControls: {
    flex: 1,
  },
  selectionHint: {
    fontSize: 12,
    color: '#b8860b',
    marginTop: 4,
    fontStyle: 'italic',
  },
  darkSelectionHint: {
    color: '#ffc107',
  },
  selectionModeControls: {
    flex: 1,
  },
  selectionCounter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    textAlign: 'center',
  },
  darkSelectionCounter: {
    color: '#ffc107',
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  selectionButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  darkSelectionButton: {
    backgroundColor: '#1c1c1e',
    borderColor: '#007AFF',
  },
  selectionButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  darkSelectionButtonText: {
    color: '#007AFF',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectAllButton: {
    backgroundColor: '#6c757d',
  },
  reExportButton: {
    backgroundColor: '#28a745',
  },
  cancelButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
