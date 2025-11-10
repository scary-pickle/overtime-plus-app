import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useDeletedItemsStore } from '../lib/state/deletedItemsStore';
import { useAuthStore } from '../lib/state/authStore';
import { OvertimeLog, UsualShift, ExportBatch } from '../types';

type DeletedItemType = 'log' | 'shift' | 'batch';

interface DeletedItem {
  id: string;
  type: DeletedItemType;
  title: string;
  subtitle: string;
  deletedAt: string;
  data: OvertimeLog | UsualShift | ExportBatch;
}

export default function RecentlyDeletedScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { user } = useAuthStore();
  const {
    deletedLogs,
    deletedShifts,
    deletedBatches,
    isLoading,
    error,
    loadDeletedItems,
    restoreLog,
    restoreShift,
    restoreBatch,
    permanentlyDeleteLog,
    permanentlyDeleteShift,
    permanentlyDeleteBatch,
    cleanupOldItems,
    clearError,
  } = useDeletedItemsStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDeletedItems(user?.id);
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDeletedItems(user?.id);
    setRefreshing(false);
  };

  // Combine all deleted items into a single list
  const allDeletedItems: DeletedItem[] = [
    ...deletedLogs.map(log => ({
      id: log.id,
      type: 'log' as const,
      title: `Log - ${log.date}`,
      subtitle: `${log.category} • ${log.minutesOvertime} min`,
      deletedAt: log.deletedAt!,
      data: log,
    })),
    ...deletedShifts.map(shift => ({
      id: shift.id,
      type: 'shift' as const,
      title: `Shift - ${shift.label}`,
      subtitle: `${shift.rosteredStart} - ${shift.rosteredFinish}`,
      deletedAt: shift.deletedAt!,
      data: shift,
    })),
    ...deletedBatches.map(batch => ({
      id: batch.id,
      type: 'batch' as const,
      title: `Export - ${batch.customName || 'Untitled'}`,
      subtitle: `${batch.countLogs} logs • ${batch.totalMinutes} min`,
      deletedAt: batch.deletedAt!,
      data: batch,
    })),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  const handleRestore = (item: DeletedItem) => {
    Alert.alert(
      'Restore Item',
      `Are you sure you want to restore this ${item.type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              if (item.type === 'log') {
                await restoreLog(item.id, user?.id);
                Alert.alert('Success', 'Log restored successfully');
              } else if (item.type === 'shift') {
                await restoreShift(item.id, user?.id);
                Alert.alert('Success', 'Shift restored successfully');
              } else if (item.type === 'batch') {
                await restoreBatch(item.id, user?.id);
                Alert.alert('Success', 'Export batch restored successfully');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to restore item. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handlePermanentDelete = (item: DeletedItem) => {
    Alert.alert(
      'Permanently Delete',
      `Are you sure you want to permanently delete this ${item.type}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.type === 'log') {
                await permanentlyDeleteLog(item.id, user?.id);
                Alert.alert('Success', 'Log permanently deleted');
              } else if (item.type === 'shift') {
                await permanentlyDeleteShift(item.id, user?.id);
                Alert.alert('Success', 'Shift permanently deleted');
              } else if (item.type === 'batch') {
                await permanentlyDeleteBatch(item.id, user?.id);
                Alert.alert('Success', 'Export batch permanently deleted');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCleanupOld = () => {
    Alert.alert(
      'Clean Up Old Items',
      'This will permanently delete all items that were deleted more than 30 days ago. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clean Up',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await cleanupOldItems(user?.id);
              const total = result.logsDeleted + result.shiftsDeleted + result.batchesDeleted;
              if (total > 0) {
                Alert.alert('Success', `Cleaned up ${total} old item(s)`);
              } else {
                Alert.alert('Info', 'No old items to clean up');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to clean up old items. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDeletedDate = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    const now = new Date();
    const diffMs = now.getTime() - deletedDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const getIconName = (type: DeletedItemType): keyof typeof Ionicons.glyphMap => {
    if (type === 'log') return 'document-text-outline';
    if (type === 'shift') return 'calendar-outline';
    return 'folder-outline';
  };

  const getIconColor = (type: DeletedItemType) => {
    if (isDark) {
      if (type === 'log') return '#64B5F6';
      if (type === 'shift') return '#81C784';
      return '#BA68C8';
    } else {
      if (type === 'log') return '#2196F3';
      if (type === 'shift') return '#4CAF50';
      return '#9C27B0';
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, isDark && styles.darkHeader]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.darkHeaderTitle]}>
          Recently Deleted
        </Text>
        <TouchableOpacity
          style={styles.cleanupButton}
          onPress={handleCleanupOld}
        >
          <Ionicons name="trash-outline" size={22} color={isDark ? '#ff6b6b' : '#d32f2f'} />
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={[styles.infoBanner, isDark && styles.darkInfoBanner]}>
        <View style={[styles.infoIconContainer, isDark && styles.darkInfoIconContainer]}>
          <Ionicons name="information-circle" size={20} color={isDark ? '#64b5f6' : '#2196F3'} />
        </View>
        <Text style={[styles.infoBannerText, isDark && styles.darkInfoBannerText]}>
          Items are automatically deleted after 30 days
        </Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={isDark ? '#64b5f6' : '#2196F3'}
          />
        }
      >
        {allDeletedItems.length === 0 && !isLoading ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, isDark && styles.darkEmptyIconContainer]}>
              <Ionicons 
                name="trash-outline" 
                size={64} 
                color={isDark ? '#48484a' : '#bdbdbd'} 
              />
            </View>
            <Text style={[styles.emptyStateTitle, isDark && styles.darkEmptyStateTitle]}>
              No Recently Deleted Items
            </Text>
            <Text style={[styles.emptyStateSubtitle, isDark && styles.darkEmptyStateSubtitle]}>
              Items you delete will appear here for 30 days
            </Text>
          </View>
        ) : (
          allDeletedItems.map((item) => (
            <View 
              key={`${item.type}-${item.id}`} 
              style={[styles.itemCard, isDark && styles.darkCard]}
            >
              <View style={[styles.itemIconContainer, isDark && styles.darkItemIconContainer]}>
                <Ionicons 
                  name={getIconName(item.type)} 
                  size={28} 
                  color={getIconColor(item.type)} 
                />
              </View>
              <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, isDark && styles.darkItemTitle]}>
                  {item.title}
                </Text>
                <Text style={[styles.itemSubtitle, isDark && styles.darkItemSubtitle]}>
                  {item.subtitle}
                </Text>
                <View style={styles.itemDeletedAtContainer}>
                  <Ionicons 
                    name="time-outline" 
                    size={12} 
                    color={isDark ? '#666' : '#999'} 
                    style={styles.deletedAtIcon}
                  />
                  <Text style={[styles.itemDeletedAt, isDark && styles.darkItemDeletedAt]}>
                    Deleted {formatDeletedDate(item.deletedAt)}
                  </Text>
                </View>
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.restoreButton, isDark && styles.darkRestoreButton]}
                  onPress={() => handleRestore(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-undo" size={20} color={isDark ? '#81C784' : '#4CAF50'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton, isDark && styles.darkDeleteButton]}
                  onPress={() => handlePermanentDelete(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash" size={20} color={isDark ? '#ef5350' : '#d32f2f'} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 16,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 0,
  },
  darkHeader: {
    backgroundColor: '#000000',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  darkHeaderTitle: {
    color: '#ffffff',
  },
  cleanupButton: {
    padding: 8,
    marginRight: -8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  darkInfoBanner: {
    backgroundColor: '#1a2332',
    borderColor: '#2d3a4e',
  },
  infoIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkInfoIconContainer: {
    // Same styling for dark mode
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#1565c0',
    fontWeight: '500',
    lineHeight: 20,
  },
  darkInfoBannerText: {
    color: '#90caf9',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  darkEmptyIconContainer: {
    backgroundColor: '#1c1c1e',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  darkEmptyStateTitle: {
    color: '#ffffff',
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  darkEmptyStateSubtitle: {
    color: '#999999',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
    borderColor: '#2c2c2e',
    shadowOpacity: 0.3,
  },
  itemIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  darkItemIconContainer: {
    backgroundColor: '#2c2c2e',
  },
  itemContent: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  darkItemTitle: {
    color: '#ffffff',
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
    fontWeight: '500',
  },
  darkItemSubtitle: {
    color: '#999999',
  },
  itemDeletedAtContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  deletedAtIcon: {
    marginRight: 4,
  },
  itemDeletedAt: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '500',
  },
  darkItemDeletedAt: {
    color: '#666666',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  restoreButton: {
    backgroundColor: '#e8f5e9',
  },
  darkRestoreButton: {
    backgroundColor: '#1b3e1b',
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  darkDeleteButton: {
    backgroundColor: '#3e1b1b',
  },
});

