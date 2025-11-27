import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ScrollView,
  Modal,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLogsStore } from '../../lib/state/logsStore';
import { useProfileStore } from '../../lib/state/profileStore';
import { useAuthStore } from '../../lib/state/authStore';
import { LogCard } from '../../components/LogCard';
import { EmptyState } from '../../components/EmptyState';
import { OvertimeLog } from '../../types';

type FilterStatus = 'all' | 'draft' | 'ready' | 'exported';
type FilterType = 'category' | 'time';
type TimeFilter = 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear';

export default function LogScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Get user from auth store for userId
  const { user } = useAuthStore();
  const { logs, deleteLog, markReady, loadLogs, getReadyLogs, getExportedLogs, resetLogsToReady, getYesterdayLog, isLoading } = useLogsStore();
  const { profile } = useProfileStore();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState<FilterType>('category');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilter>('all');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [isTimeExpanded, setIsTimeExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuAnimation] = useState(new Animated.Value(0));

  // Load logs when screen comes into focus (similar to home screen)
  useFocusEffect(
    React.useCallback(() => {
      loadLogs(user?.id);
    }, [loadLogs, user?.id])
  );

  const handleToggleFilter = () => {
    setIsFilterExpanded(!isFilterExpanded);
  };


  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs(user?.id);
    setRefreshing(false);
  };

  const handleAddLog = () => {
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

  const handleNewLog = () => {
    handleCloseAddMenu();
    router.push('/log/new');
  };

  const handleNewFromYesterday = () => {
    handleCloseAddMenu();
    const yesterdayLog = getYesterdayLog();
    if (!yesterdayLog) {
      Alert.alert('No Log Found', 'There is no log from yesterday to copy from.');
      return;
    }
    router.push({
      pathname: '/log/new',
      params: { from: 'yesterday' }
    });
  };

  const handleNewFromTemplate = () => {
    handleCloseAddMenu();
    router.push({
      pathname: '/log/new',
      params: { from: 'template' }
    });
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

  const handleMarkReady = async (log: OvertimeLog) => {
    try {
      await markReady(log.id);
    } catch (error) {
      // Automatically navigate to edit screen if validation fails
      handleEditLog(log);
    }
  };

  const ensureProfileReadyForExport = () => {
    if (!profile) {
      Alert.alert(
        'Profile Required',
        'Please complete your profile details before exporting AVAC forms.',
        [{ text: 'OK' }]
      );
      return false;
    }

    const missingDelegateInfo = !profile.delegateName?.trim() ||
      !profile.delegatePosition?.trim() ||
      !profile.delegatePhone?.trim() ||
      !profile.delegateAreaCode?.trim();

    const missingOrgUnitNo = !profile.orgUnitNo || profile.orgUnitNo.trim().length === 0;

    if (!missingDelegateInfo && !missingOrgUnitNo) {
      return true;
    }

    let title = 'Profile Details Required';
    let message = '';

    if (missingDelegateInfo && missingOrgUnitNo) {
      message = 'Delegate information and organisation unit number are required to generate AVAC forms. Please complete these details in your profile.';
    } else if (missingDelegateInfo) {
      title = 'Delegate Information Required';
      message = 'Delegate information is required to generate AVAC forms. Please complete your delegate details in your profile.';
    } else {
      title = 'Organisation Unit Number Required';
      message = 'Your organisation unit number is required to generate AVAC forms. Please add it to your profile.';
    }

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Go to Profile',
          onPress: () => {
            router.push('/(tabs)/profile');
          }
        }
      ]
    );

    return false;
  };

  const handleExportReady = () => {
    if (!ensureProfileReadyForExport()) {
      return;
    }
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
    setSelectedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const filtered = getFilteredLogs();
    const selectableLogs = filtered.filter(log => log.status === 'ready' || log.status === 'exported');
    if (selectedLogs.size === selectableLogs.length) {
      setSelectedLogs(new Set());
    } else {
      setSelectedLogs(new Set(selectableLogs.map(log => log.id)));
    }
  };

  const handleExportSelected = async () => {
    if (selectedLogs.size === 0) {
      Alert.alert('No Selection', 'Please select logs to export.');
      return;
    }

    if (!ensureProfileReadyForExport()) {
      return;
    }

    const selectedLogsArray = Array.from(selectedLogs);
    const selectedLogsData = logs.filter(log => selectedLogsArray.includes(log.id));
    const readyLogs = selectedLogsData.filter(log => log.status === 'ready');
    const exportedLogs = selectedLogsData.filter(log => log.status === 'exported');

    // If there are any exported logs, show warning
    if (exportedLogs.length > 0) {
      const exportedCount = exportedLogs.length;
      const readyCount = readyLogs.length;
      let message = '';
      
      if (readyCount > 0 && exportedCount > 0) {
        message = `You have selected ${readyCount} ready log${readyCount !== 1 ? 's' : ''} and ${exportedCount} already exported log${exportedCount !== 1 ? 's' : ''}. The exported logs will be reset to ready status and re-exported. Are you sure you want to continue?`;
      } else {
        message = `You have selected ${exportedCount} already exported log${exportedCount !== 1 ? 's' : ''}. These will be reset to ready status and re-exported. Are you sure you want to continue?`;
      }

      Alert.alert(
        'Export Already Exported Logs',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              try {
                // Reset exported logs to ready status
                if (exportedLogs.length > 0) {
                  await resetLogsToReady(exportedLogs.map(log => log.id));
                }
                
                // Navigate to export preview with selected log IDs
                setSelectedLogs(new Set());
                setIsSelectionMode(false);
                router.push({
                  pathname: '/export/preview',
                  params: { logIds: selectedLogsArray.join(',') }
                });
              } catch (error) {
                Alert.alert('Error', 'Failed to reset logs. Please try again.');
              }
            },
          },
        ]
      );
    } else {
      // Only ready logs, export directly
      setSelectedLogs(new Set());
      setIsSelectionMode(false);
      router.push({
        pathname: '/export/preview',
        params: { logIds: selectedLogsArray.join(',') }
      });
    }
  };

  const handleCancelSelection = () => {
    setSelectedLogs(new Set());
    setIsSelectionMode(false);
  };

  const handleFilterChange = (status: FilterStatus) => {
    // Toggle behavior: if clicking the same status, deselect (show all)
    // Otherwise, select the new status
    if (filterStatus === status) {
      setFilterStatus('all');
    } else {
      setFilterStatus(status);
    }
    // Reset selection when changing filters
    setSelectedLogs(new Set());
    setIsSelectionMode(false);
  };

  const handleCategoryFilterChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedLogs(new Set());
    setIsSelectionMode(false);
  };

  const handleTimeFilterChange = (timeFilter: TimeFilter) => {
    setSelectedTimeFilter(timeFilter);
    setSelectedLogs(new Set());
    setIsSelectionMode(false);
  };

  const handleFilterTypeChange = (type: FilterType) => {
    setFilterType(type);
    // Toggle the expanded state for the clicked filter type
    if (type === 'category') {
      setIsCategoryExpanded(!isCategoryExpanded);
      setIsTimeExpanded(false);
    } else {
      setIsTimeExpanded(!isTimeExpanded);
      setIsCategoryExpanded(false);
    }
    setSelectedLogs(new Set());
    setIsSelectionMode(false);
  };

  const getFilteredLogs = () => {
    let filtered = logs;

    // In selection mode, hide drafts and only show ready/exported
    if (isSelectionMode) {
      filtered = filtered.filter(log => log.status === 'ready' || log.status === 'exported');
    }

    // Apply status filter (but not in selection mode)
    if (!isSelectionMode && filterStatus !== 'all') {
      filtered = filtered.filter(log => log.status === filterStatus);
    }

    // Apply category or time filter
    if (filterType === 'category' && selectedCategory !== 'all') {
      filtered = filtered.filter(log => log.category === selectedCategory);
    } else if (filterType === 'time' && selectedTimeFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(log => {
        const logDate = new Date(log.date);
        const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());

        switch (selectedTimeFilter) {
          case 'today':
            return logDateOnly.getTime() === today.getTime();
          
          case 'thisWeek': {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
            weekStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            return logDateOnly.getTime() >= weekStart.getTime() && logDateOnly.getTime() <= todayEnd.getTime();
          }
          
          case 'thisMonth':
            return logDate.getMonth() === now.getMonth() && 
                   logDate.getFullYear() === now.getFullYear();
          
          case 'lastMonth': {
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            lastMonthStart.setHours(0, 0, 0, 0);
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            thisMonthStart.setHours(0, 0, 0, 0);
            return logDateOnly.getTime() >= lastMonthStart.getTime() && logDateOnly.getTime() < thisMonthStart.getTime();
          }
          
          case 'thisYear':
            return logDate.getFullYear() === now.getFullYear();
          
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  const getUniqueCategories = () => {
    const categories = new Set(logs.map(log => log.category));
    return Array.from(categories).sort();
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

  const renderListHeader = () => (
    <>
      {/* Filter Dropdown - Expands Below Header */}
      {isFilterExpanded && (
        <View style={[styles.filterDropdown, isDark && styles.darkFilterDropdown]}>
          <ScrollView style={styles.filterDropdownContent} showsVerticalScrollIndicator={false}>
            {/* Status Filters */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, isDark && styles.darkText]}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilterScroll}>
                <View style={styles.filterButtonRow}>
                  {renderFilterButton('ready', 'Ready')}
                  {renderFilterButton('exported', 'Exported')}
                  {renderFilterButton('draft', 'Draft')}
                </View>
              </ScrollView>
            </View>

            {/* Category Filter Section */}
            <View style={styles.filterSection}>
              <TouchableOpacity
                style={[
                  styles.filterTypeHeader,
                  isCategoryExpanded && styles.filterTypeHeaderExpanded,
                  isDark && styles.darkFilterTypeHeader,
                  isCategoryExpanded && isDark && styles.darkFilterTypeHeaderExpanded,
                ]}
                onPress={() => {
                  setIsCategoryExpanded(!isCategoryExpanded);
                  setIsTimeExpanded(false);
                  if (!isCategoryExpanded) {
                    setFilterType('category');
                  }
                }}
              >
                <View style={styles.filterTypeHeaderContent}>
                  <View style={[
                    styles.filterTypeIconContainer,
                    selectedCategory !== 'all' && styles.filterTypeIconContainerActive,
                    isDark && styles.darkFilterTypeIconContainer,
                    selectedCategory !== 'all' && isDark && styles.darkFilterTypeIconContainerActive,
                  ]}>
                    <Ionicons 
                      name="pricetag" 
                      size={14} 
                      color={selectedCategory !== 'all' ? '#fff' : (isDark ? '#999' : '#666')} 
                    />
                  </View>
                  <View style={styles.filterTypeTextContainer}>
                    <Text style={[styles.filterSectionTitle, isDark && styles.darkText]}>Category</Text>
                    {selectedCategory !== 'all' && (
                      <Text style={[styles.filterActiveIndicator, isDark && styles.darkFilterActiveIndicator]}>
                        {selectedCategory}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.filterTypeChevronContainer}>
                  <Ionicons 
                    name={isCategoryExpanded ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color={isDark ? '#999' : '#666'} 
                  />
                </View>
              </TouchableOpacity>
              
              {isCategoryExpanded && (
                <View style={[
                  styles.expandedContentContainer,
                  isDark && styles.darkExpandedContentContainer,
                ]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.secondaryFilterScroll}>
                    {renderSecondaryFilterButton('all', 'All Categories', selectedCategory === 'all')}
                    {uniqueCategories.map(category => (
                      <View key={category}>
                        {renderSecondaryFilterButton(category, category, selectedCategory === category)}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Time Filter Section */}
            <View style={styles.filterSection}>
              <TouchableOpacity
                style={[
                  styles.filterTypeHeader,
                  isTimeExpanded && styles.filterTypeHeaderExpanded,
                  isDark && styles.darkFilterTypeHeader,
                  isTimeExpanded && isDark && styles.darkFilterTypeHeaderExpanded,
                ]}
                onPress={() => {
                  setIsTimeExpanded(!isTimeExpanded);
                  setIsCategoryExpanded(false);
                  if (!isTimeExpanded) {
                    setFilterType('time');
                  }
                }}
              >
                <View style={styles.filterTypeHeaderContent}>
                  <View style={[
                    styles.filterTypeIconContainer,
                    selectedTimeFilter !== 'all' && styles.filterTypeIconContainerActive,
                    isDark && styles.darkFilterTypeIconContainer,
                    selectedTimeFilter !== 'all' && isDark && styles.darkFilterTypeIconContainerActive,
                  ]}>
                    <Ionicons 
                      name="calendar" 
                      size={14} 
                      color={selectedTimeFilter !== 'all' ? '#fff' : (isDark ? '#999' : '#666')} 
                    />
                  </View>
                  <View style={styles.filterTypeTextContainer}>
                    <Text style={[styles.filterSectionTitle, isDark && styles.darkText]}>Time</Text>
                    {selectedTimeFilter !== 'all' && (
                      <Text style={[styles.filterActiveIndicator, isDark && styles.darkFilterActiveIndicator]}>
                        {selectedTimeFilter === 'today' ? 'Today' :
                         selectedTimeFilter === 'thisWeek' ? 'This Week' :
                         selectedTimeFilter === 'thisMonth' ? 'This Month' :
                         selectedTimeFilter === 'lastMonth' ? 'Last Month' :
                         selectedTimeFilter === 'thisYear' ? 'This Year' : selectedTimeFilter}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.filterTypeChevronContainer}>
                  <Ionicons 
                    name={isTimeExpanded ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color={isDark ? '#999' : '#666'} 
                  />
                </View>
              </TouchableOpacity>
              
              {isTimeExpanded && (
                <View style={[
                  styles.expandedContentContainer,
                  isDark && styles.darkExpandedContentContainer,
                ]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.secondaryFilterScroll}>
                    {renderSecondaryFilterButton('all', 'All Time', selectedTimeFilter === 'all')}
                    {renderSecondaryFilterButton('today', 'Today', selectedTimeFilter === 'today')}
                    {renderSecondaryFilterButton('thisWeek', 'This Week', selectedTimeFilter === 'thisWeek')}
                    {renderSecondaryFilterButton('thisMonth', 'This Month', selectedTimeFilter === 'thisMonth')}
                    {renderSecondaryFilterButton('lastMonth', 'Last Month', selectedTimeFilter === 'lastMonth')}
                    {renderSecondaryFilterButton('thisYear', 'This Year', selectedTimeFilter === 'thisYear')}
                  </ScrollView>
                </View>
              )}
            </View>

              {/* Clear All Button */}
              {(filterStatus !== 'all' || selectedCategory !== 'all' || selectedTimeFilter !== 'all') && (
                <TouchableOpacity
                  style={[styles.clearAllButton, isDark && styles.darkClearAllButton]}
                  onPress={() => {
                    setFilterStatus('all');
                    setSelectedCategory('all');
                    setSelectedTimeFilter('all');
                  }}
                >
                  <Ionicons name="refresh" size={16} color={isDark ? '#fff' : '#007AFF'} />
                  <Text style={[styles.clearAllButtonText, isDark && styles.darkClearAllButtonText]}>
                    Clear All Filters
                  </Text>
                </TouchableOpacity>
              )}
          </ScrollView>
        </View>
      )}

      {/* Export Section - Only show when not in selection mode */}
      {!isSelectionMode && getReadyLogs().length > 0 && (
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

      {/* Export Section for Selection Mode */}
      {isSelectionMode && selectedLogs.size > 0 && (
        <View style={[styles.exportContainer, isDark && styles.darkExportContainer]}>
          <View style={styles.exportInfo}>
            <Text style={[styles.exportTitle, isDark && styles.darkText]}>
              Export Selected Logs
            </Text>
            <Text style={[styles.exportSubtitle, isDark && styles.darkText]}>
              {selectedLogs.size} log{selectedLogs.size !== 1 ? 's' : ''} selected for export
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.exportButton, isDark && styles.darkExportButton]}
            onPress={handleExportSelected}
          >
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={styles.exportButtonText}>Export PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selection Mode Info Bar */}
      {isSelectionMode && (
        <View style={[styles.selectionBar, isDark && styles.darkSelectionBar]}>
          <TouchableOpacity
            style={styles.selectionBarButton}
            onPress={handleSelectAll}
          >
            <Text style={[styles.selectionBarButtonText, isDark && styles.selectionBarButtonTextDark]}>
              {(() => {
                const filtered = getFilteredLogs();
                const selectableLogs = filtered.filter(log => log.status === 'ready' || log.status === 'exported');
                return selectedLogs.size === selectableLogs.length ? 'Deselect All' : 'Select All';
              })()}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.selectionCount, isDark && styles.selectionCountDark]}>
            {selectedLogs.size} selected
          </Text>
        </View>
      )}

      {/* Re-export Section for Exported Logs - Only show when not in selection mode */}
      {!isSelectionMode && filterStatus === 'exported' && getExportedLogs().length > 0 && (
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
                {selectedLogs.size} of {getExportedLogs().length} selected
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
                  style={[styles.selectionActionButton, isDark && styles.darkSelectionActionButton]}
                  onPress={() => setIsSelectionMode(true)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                  <Text style={[styles.selectionActionButtonText, isDark && styles.darkSelectionActionButtonText]}>
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
                    {selectedLogs.size} of {getExportedLogs().length} selected
                  </Text>
                </View>
                
                <View style={styles.bulkActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.selectAllButton]}
                    onPress={handleSelectAll}
                  >
                    <Ionicons name="checkmark-done" size={16} color="#fff" />
                    <Text style={styles.actionButtonText}>
                      {selectedLogs.size === getExportedLogs().length ? 'Clear All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                  
                  {selectedLogs.size > 0 && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.reExportButton]}
                      onPress={handleExportSelected}
                    >
                      <Ionicons name="refresh" size={16} color="#fff" />
                      <Text style={styles.actionButtonText}>
                        Re-export ({selectedLogs.size})
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
    </>
  );

  const renderLogItem = ({ item }: { item: OvertimeLog }) => {
    const isSelected = selectedLogs.has(item.id);
    
    return (
      <LogCard
        log={item}
        onPress={() => {
          if (isSelectionMode) {
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
        showSelection={isSelectionMode}
        onToggleSelection={() => handleToggleSelection(item.id)}
        isDark={isDark}
      />
    );
  };

  const renderFilterButton = (status: FilterStatus, label: string) => {
    const isActive = filterStatus === status && filterStatus !== 'all';
    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          isActive && styles.activeFilterButton,
          isDark && styles.darkFilterButton,
          isActive && isDark && styles.darkActiveFilterButton,
        ]}
        onPress={() => handleFilterChange(status)}
      >
        <Text
          style={[
            styles.filterButtonText,
            isActive && styles.activeFilterButtonText,
            isDark && styles.darkFilterButtonText,
            isActive && isDark && styles.darkActiveFilterButtonText,
          ]}
        >
          {label} ({statusCounts[status]})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSecondaryFilterButton = (value: string, label: string, isActive: boolean) => (
    <TouchableOpacity
      style={[
        styles.secondaryFilterButton,
        isActive && styles.activeSecondaryFilterButton,
        isDark && styles.darkSecondaryFilterButton,
        isActive && isDark && styles.darkActiveSecondaryFilterButton,
      ]}
      onPress={() => {
        if (filterType === 'category') {
          handleCategoryFilterChange(value);
        } else {
          handleTimeFilterChange(value as TimeFilter);
        }
      }}
    >
      <Text
        style={[
          styles.secondaryFilterButtonText,
          isActive && styles.activeSecondaryFilterButtonText,
          isDark && styles.darkSecondaryFilterButtonText,
          isActive && isDark && styles.darkActiveSecondaryFilterButtonText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  // Show empty state only if not loading and logs are empty
  if (!isLoading && logs.length === 0) {
    return (
      <EmptyState
        title="No Overtime Logs"
        description="Start tracking your overtime by creating your first log."
        actionText="Add First Log"
        onAction={handleNewLog}
        icon="📝"
      />
    );
  }

  const uniqueCategories = getUniqueCategories();

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={[styles.title, isDark && styles.darkText]}>
          Logs
        </Text>
        {isSelectionMode ? (
          <TouchableOpacity
            onPress={handleCancelSelection}
            style={[styles.filterButton, isDark && styles.darkFilterButton]}
          >
            <Ionicons 
              name="close" 
              size={18} 
              color={isDark ? '#999' : '#666'} 
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.normalModeButtons}>
            <TouchableOpacity
              onPress={() => setIsSelectionMode(true)}
              style={[styles.filterButton, isDark && styles.darkFilterButton]}
            >
              <Ionicons name="checkbox-outline" size={18} color={isDark ? '#999' : '#666'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleToggleFilter}
              style={[styles.filterButton, isDark && styles.darkFilterButton]}
            >
              <Ionicons 
                name={isFilterExpanded ? "chevron-up" : "options"} 
                size={18} 
                color={(filterStatus !== 'all' || selectedCategory !== 'all' || selectedTimeFilter !== 'all') ? '#007AFF' : (isDark ? '#999' : '#666')} 
              />
              {((filterStatus !== 'all' || selectedCategory !== 'all' || selectedTimeFilter !== 'all')) && (
                <View style={styles.filterButtonBadge}>
                  <View style={styles.filterButtonDot} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Logs List */}
      <FlatList
        data={filteredLogs}
        renderItem={renderLogItem}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderListHeader}
      />

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddLog}
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
          <View style={styles.modalOverlay}>
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
                  onPress={handleNewLog}
                >
                  <Ionicons name="document-text-outline" size={20} color={isDark ? '#fff' : '#333'} />
                  <Text style={[styles.menuItemText, isDark && styles.darkMenuItemText]}>
                    New Log
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleNewFromYesterday}
                  disabled={!getYesterdayLog()}
                >
                  <Ionicons name="calendar-outline" size={20} color={getYesterdayLog() ? (isDark ? '#fff' : '#333') : '#999'} />
                  <Text style={[
                    styles.menuItemText,
                    isDark && styles.darkMenuItemText,
                    !getYesterdayLog() && styles.disabledMenuItemText
                  ]}>
                    New from Yesterday
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleNewFromTemplate}
                >
                  <Ionicons name="copy-outline" size={20} color={isDark ? '#fff' : '#333'} />
                  <Text style={[styles.menuItemText, isDark && styles.darkMenuItemText]}>
                    New from Template
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    handleCloseAddMenu();
                    router.push('/log/template/new');
                  }}
                >
                  <Ionicons name="bookmark-outline" size={20} color={isDark ? '#fff' : '#333'} />
                  <Text style={[styles.menuItemText, isDark && styles.darkMenuItemText]}>
                    Create Template
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 40,
    position: 'relative',
    overflow: 'hidden',
  },
  darkFilterButton: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
  },
  filterButtonBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  filterButtonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
  },
  headerFilterButton: {
    marginRight: 8,
    padding: 8,
    position: 'relative',
  },
  headerFilterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerFilterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
  },
  activeFilterButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
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
  filterTypeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  filterTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterTypeButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  darkFilterTypeButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  darkActiveFilterTypeButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterTypeButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterTypeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  darkFilterTypeButtonText: {
    color: '#999',
  },
  darkActiveFilterTypeButtonText: {
    color: '#fff',
  },
  secondaryFilterScroll: {
    flexGrow: 0,
  },
  secondaryFilterButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeSecondaryFilterButton: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  darkSecondaryFilterButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  darkActiveSecondaryFilterButton: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  secondaryFilterButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  activeSecondaryFilterButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  darkSecondaryFilterButtonText: {
    color: '#999',
  },
  darkActiveSecondaryFilterButtonText: {
    color: '#fff',
  },
  listContainer: {
    paddingTop: 8,
    paddingBottom: 8,
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
  modalOverlay: {
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
  disabledMenuItemText: {
    color: '#999',
    opacity: 0.6,
  },
  exportContainer: {
    backgroundColor: '#e8f5e8',
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
  selectionActionButton: {
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
  darkSelectionActionButton: {
    backgroundColor: '#1c1c1e',
    borderColor: '#007AFF',
  },
  selectionActionButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  darkSelectionActionButtonText: {
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
  // Filter Dropdown Styles
  filterDropdown: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: 400,
  },
  darkFilterDropdown: {
    backgroundColor: '#1c1c1e',
  },
  filterDropdownContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusFilterScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  filterButtonRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  filterTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  filterTypeHeaderExpanded: {
    backgroundColor: 'transparent',
  },
  darkFilterTypeHeader: {
    backgroundColor: 'transparent',
  },
  darkFilterTypeHeaderExpanded: {
    backgroundColor: 'transparent',
  },
  filterTypeHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  filterTypeIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTypeIconContainerActive: {
    backgroundColor: '#007AFF',
  },
  darkFilterTypeIconContainer: {
    backgroundColor: 'transparent',
  },
  darkFilterTypeIconContainerActive: {
    backgroundColor: '#007AFF',
  },
  filterTypeTextContainer: {
    flex: 1,
  },
  filterActiveIndicator: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 1,
  },
  darkFilterActiveIndicator: {
    color: '#007AFF',
  },
  filterTypeChevronContainer: {
    marginLeft: 4,
  },
  expandedContentContainer: {
    paddingTop: 4,
    paddingBottom: 2,
    paddingHorizontal: 0,
    marginTop: 2,
  },
  darkExpandedContentContainer: {
    backgroundColor: 'transparent',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 8,
  },
  darkClearAllButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  clearAllButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  darkClearAllButtonText: {
    color: '#007AFF',
  },
  // Selection Mode Styles
  normalModeButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  darkSelectionBar: {
    backgroundColor: '#1c1c1e',
    borderBottomColor: '#333',
  },
  selectionBarButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  selectionBarButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  selectionBarButtonTextDark: {
    color: '#0A84FF',
  },
  selectionCount: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  selectionCountDark: {
    color: '#999',
  },
});
