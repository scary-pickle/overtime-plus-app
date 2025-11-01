import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { getInfoAsync } from 'expo-file-system';
import { useLogsStore } from '../../lib/state/logsStore';
import { useProfileStore } from '../../lib/state/profileStore';
import { formatMinutes } from '../../lib/time';
import { ExportBatch } from '../../types';
import { sendAVACEmail } from '../../lib/email/emailService';

export default function ExportsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { exportBatches, loadExportBatches, deleteExportBatch, updateExportBatch, markBatchAsSubmitted, isLoading } = useLogsStore();
  const { profile } = useProfileStore();
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [expandedActionIds, setExpandedActionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadExportBatches();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadExportBatches();
    setRefreshing(false);
  };

  const handleScroll = () => {
    // Close any expanded menus when user scrolls
    if (expandedActionIds.size > 0) {
      console.log('[EXPORTS] Scroll detected - closing menus');
      setExpandedActionIds(new Set());
    }
  };

  const handleViewPDF = (batch: ExportBatch) => {
    if (batch.pdfUri) {
      router.push(`/export/view?batchId=${batch.id}`);
    } else {
      Alert.alert('PDF Not Available', 'The PDF file is no longer available.');
    }
  };

  const handleSharePDF = async (batch: ExportBatch) => {
    if (!batch.pdfUri) {
      Alert.alert('PDF Not Available', 'The PDF file is no longer available.');
      return;
    }

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(batch.pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share AVAC Form',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Sharing failed:', error);
      Alert.alert('Sharing Failed', 'Failed to share PDF. Please try again.');
    }
  };

  const handleDeleteBatch = (batch: ExportBatch) => {
    console.log('[EXPORTS] handleDeleteBatch called', { batchId: batch.id });
    const batchId = batch.id;
    
    // Close the expanded menu immediately to prevent dismiss overlay from interfering
    console.log('[EXPORTS] Closing expanded menu for delete');
    setExpandedActionIds(prev => {
      const next = new Set(prev);
      next.delete(batchId);
      console.log('[EXPORTS] Expanded menu state updated, size:', next.size);
      return next;
    });
    
    // Execute the alert immediately - it will show even if menu closes
    console.log('[EXPORTS] Showing delete alert');
    Alert.alert(
      'Delete Export',
      'Are you sure you want to delete this export? This action cannot be undone.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => console.log('[EXPORTS] Delete cancelled')
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('[EXPORTS] Delete confirmed, calling deleteExportBatch');
            deleteExportBatch(batchId);
          },
        },
      ]
    );
  };

  const handleEditName = (batch: ExportBatch) => {
    console.log('[EXPORTS] handleEditName called', { batchId: batch.id });
    const batchId = batch.id;
    const customName = batch.customName || `Export #${batch.id.split('_')[1]}`;
    
    // Set state first, then close menu - this ensures modal opens
    console.log('[EXPORTS] Setting edit state', { batchId, customName });
    setEditingId(batchId);
    setEditName(customName);
    setShowEditModal(true);
    
    // Close the expanded menu after modal state is set
    console.log('[EXPORTS] Closing expanded menu for edit');
    setExpandedActionIds(prev => {
      const next = new Set(prev);
      next.delete(batchId);
      console.log('[EXPORTS] Expanded menu state updated, size:', next.size);
      return next;
    });
  };

  const toggleExpandedActions = (batchId: string) => {
    console.log('[EXPORTS] toggleExpandedActions called', { batchId });
    setExpandedActionIds(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
        console.log('[EXPORTS] Closing menu for batch:', batchId);
      } else {
        next.add(batchId);
        console.log('[EXPORTS] Opening menu for batch:', batchId);
      }
      console.log('[EXPORTS] Expanded menu size:', next.size);
      return next;
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      const batch = exportBatches.find(b => b.id === editingId);
      if (batch) {
        const updatedBatch = { ...batch, customName: editName.trim() || undefined };
        await updateExportBatch(updatedBatch);
      }
      setShowEditModal(false);
      setEditingId(null);
      setEditName('');
    } catch (error) {
      Alert.alert('Error', 'Failed to update export name. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingId(null);
    setEditName('');
  };

  const handleSubmitEmail = async (batch: ExportBatch) => {
    if (!profile) {
      Alert.alert('Profile Required', 'Please complete your profile before submitting AVAC forms.');
      return;
    }

    if (!profile.email) {
      Alert.alert('Email Required', 'Please add your email address in Settings before submitting AVAC forms.');
      return;
    }

    if (!batch.pdfUri) {
      Alert.alert('PDF Not Available', 'The PDF file is no longer available.');
      return;
    }

    setSubmittingId(batch.id);
    try {
      const result = await sendAVACEmail(profile, batch.pdfUri);
      
      if (result.success && result.useAppleMail) {
        // Apple Mail method - everything is pre-filled with attachment
        await markBatchAsSubmitted(batch.id, 'email');
        Alert.alert('Success', 'Email opened in Apple Mail with attachment and all details pre-filled. Please review and send.');
        setSubmittingId(null);
      } else if (result.success && result.useShareSheet) {
        // Share sheet method - copy info to clipboard and open share sheet
        const clipboardText = `To: ${result.recipientEmail}\nSubject: ${result.subject}\n\n${result.body}`;
        await Clipboard.setStringAsync(clipboardText);
        
        // Show brief notification then open share sheet
        Alert.alert(
          'Ready to Email',
          `✓ Email details copied to clipboard\n\nTo: ${result.recipientEmail}\n\nNext: Select your email app (e.g., Outlook), then paste (Cmd+V) the email details.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setSubmittingId(null) },
            {
              text: 'Continue',
              onPress: async () => {
                try {
                  // Open share sheet with PDF attachment
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(batch.pdfUri, {
                      mimeType: 'application/pdf',
                      dialogTitle: 'Share AVAC via Email',
                      UTI: 'com.adobe.pdf'
                    });
                    // Mark as submitted after sharing
                    await markBatchAsSubmitted(batch.id, 'email');
                  } else {
                    Alert.alert('Sharing not available', 'Sharing is not available on this device.');
                  }
                } catch (shareError) {
                  console.error('Sharing failed:', shareError);
                  Alert.alert('Sharing Failed', 'Failed to share PDF. Please try again.');
                } finally {
                  setSubmittingId(null);
                }
              }
            }
          ]
        );
      } else if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to get recipient information. Please try again.');
        setSubmittingId(null);
      }
    } catch (error) {
      console.error('Error submitting AVAC:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setSubmittingId(null);
    }
  };

  const getPDFInfo = async (batch: ExportBatch) => {
    if (!batch.pdfUri) return null;
    
    try {
      const info = await getInfoAsync(batch.pdfUri);
      return info;
    } catch (error) {
      console.error('Failed to get PDF info:', error);
      return null;
    }
  };

  const renderExportItem = ({ item }: { item: ExportBatch }) => {
    const totalHours = Math.floor(item.totalMinutes / 60);
    const remainingMinutes = item.totalMinutes % 60;
    const createdDate = new Date(item.createdAt);

    return (
      <View style={[styles.exportCard, isDark && styles.darkCard]}>
        <View style={styles.exportHeader}>
          <View style={styles.exportInfo}>
            <Text style={[styles.exportTitle, isDark && styles.darkText]}>
              {item.customName || `Export #${item.id.split('_')[1]}`}
            </Text>
            <Text style={[styles.exportDate, isDark && styles.darkText]}>
              {createdDate.toLocaleDateString('en-AU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.exportActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.submitButton]}
              onPress={() => handleSubmitEmail(item)}
              disabled={submittingId === item.id}
            >
              {submittingId === item.id ? (
                <ActivityIndicator size={16} color="#fff" />
              ) : (
                <Ionicons name="mail" size={16} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.shareButton]}
              onPress={() => handleSharePDF(item)}
            >
              <Ionicons name="share" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.moreButton]}
              onPress={() => toggleExpandedActions(item.id)}
            >
              <Ionicons name={expandedActionIds.has(item.id) ? 'close' : 'ellipsis-vertical'} size={16} color="#fff" />
            </TouchableOpacity>
            {expandedActionIds.has(item.id) && (
              <View style={styles.inlineOverlay} pointerEvents="auto">
                <View style={styles.inlineButtons} pointerEvents="auto">
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => {
                      console.log('[EXPORTS] Edit button pressed for batch:', item.id);
                      handleEditName(item);
                    }}
                  >
                    <Ionicons name="create" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => {
                      console.log('[EXPORTS] Delete button pressed for batch:', item.id);
                      handleDeleteBatch(item);
                    }}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.exportDetails}>
          <TouchableOpacity style={styles.viewLinkRow} onPress={() => handleViewPDF(item)}>
            <Text style={[styles.viewLinkText, isDark && styles.viewLinkTextDark]}>View PDF</Text>
          </TouchableOpacity>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isDark && styles.darkText]}>
              Logs:
            </Text>
            <Text style={[styles.detailValue, isDark && styles.darkText]}>
              {item.countLogs}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isDark && styles.darkText]}>
              Total Overtime:
            </Text>
            <Text style={[styles.detailValue, isDark && styles.darkText]}>
              {formatMinutes(item.totalMinutes)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isDark && styles.darkText]}>
              Status:
            </Text>
            <Text style={[styles.detailValue, isDark && styles.darkText]}>
              {item.submittedAt 
                ? `Submitted via ${item.submittedVia || 'email'} on ${new Date(item.submittedAt).toLocaleDateString('en-AU')}`
                : 'Not submitted'
              }
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={[styles.emptyContainer, isDark && styles.darkContainer]}>
      <Ionicons name="document-text-outline" size={64} color="#ccc" />
      <Text style={[styles.emptyTitle, isDark && styles.darkText]}>
        No Exports Yet
      </Text>
      <Text style={[styles.emptyMessage, isDark && styles.darkText]}>
        Export your ready logs to create your first AVAC form.
      </Text>
      <TouchableOpacity
        style={styles.createExportButton}
        onPress={() => router.push('/(tabs)/log')}
      >
        <Text style={styles.createExportButtonText}>Go to Logs</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading && exportBatches.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, isDark && styles.darkContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>
          Loading exports...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <FlatList
        data={exportBatches}
        renderItem={renderExportItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, isDark && styles.darkText]}>
              Edit Export Name
            </Text>
            <TextInput
              style={[styles.textInput, isDark && styles.darkTextInput]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter export name"
              placeholderTextColor={isDark ? '#666' : '#999'}
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelEdit}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  exportCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10, // Ensure cards are above dismiss overlay
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
  },
  exportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    position: 'relative',
  },
  exportInfo: {
    flex: 1,
  },
  exportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  darkText: {
    color: '#fff',
  },
  exportDate: {
    fontSize: 14,
    color: '#666',
  },
  exportActions: {
    flexDirection: 'row',
    gap: 8,
    position: 'relative',
    zIndex: 20, // Higher than card to ensure buttons are above dismiss overlay
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  shareButton: {
    backgroundColor: '#34C759',
  },
  editButton: {
    backgroundColor: '#FF9500',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  moreButton: {
    backgroundColor: '#8E8E93',
  },
  inlineOverlay: {
    position: 'absolute',
    right: 40, // keep space for kebab button
    top: 0,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100, // Higher than card to ensure it's above dismiss overlay
  },
  inlineButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  exportDetails: {
    gap: 8,
  },
  viewLinkRow: {
    marginBottom: 4,
  },
  viewLinkText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  viewLinkTextDark: {
    color: '#0A84FF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  createExportButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createExportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  darkModalContent: {
    backgroundColor: '#1c1c1e',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
  },
  darkTextInput: {
    borderColor: '#444',
    backgroundColor: '#2c2c2e',
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // removed menu styles (replaced by inline expansion)
});
