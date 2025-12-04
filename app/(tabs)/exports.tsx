import React, { useState, useEffect, useCallback } from 'react';
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
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import { getInfoAsync, readAsStringAsync, writeAsStringAsync, deleteAsync } from 'expo-file-system/legacy';
import { PDFDocument } from 'pdf-lib';
import { useLogsStore } from '../../lib/state/logsStore';
import { useProfileStore } from '../../lib/state/profileStore';
import { useAuthStore } from '../../lib/state/authStore';
import { formatMinutes } from '../../lib/time';
import { ExportBatch } from '../../types';
import { sendAVACEmail, sendAVACEmailWithAttachment, getAVACRecipientInfo } from '../../lib/email/emailService';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('Exports');
import { getExportFileName, getExportDisplayName } from '../../lib/utils/exportFilename';

type SubmissionStatusFilter = 'all' | 'submitted' | 'notSubmitted';
type DateFilter = 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear';

export default function ExportsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { user } = useAuthStore();
  const { exportBatches, loadExportBatches, deleteExportBatch, updateExportBatch, markBatchAsSubmitted, isLoading, hasLoadedExportBatchesOnce } = useLogsStore();
  const { profile } = useProfileStore();
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<SubmissionStatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [isDateExpanded, setIsDateExpanded] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [isBatchSharing, setIsBatchSharing] = useState(false);

  useEffect(() => {
    loadExportBatches(user?.id);
  }, [user?.id]);

  // Reload export batches when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadExportBatches(user?.id);
    }, [loadExportBatches, user?.id])
  );

  // Check and schedule unsubmitted AVAC notification when export batches change
  useEffect(() => {
    if (user?.id && exportBatches.length > 0) {
      const { notificationManager } = require('../../lib/notifications');
      // Create a stable reference for the notification check
      const batchesForNotification = exportBatches.map(b => ({
        id: b.id,
        createdAt: b.createdAt,
        submittedAt: b.submittedAt
      }));
      notificationManager.checkAndScheduleUnsubmittedAVACNotification(batchesForNotification).catch((err: unknown) => {
        debug.error('Failed to check unsubmitted AVAC notification:', err);
      });
    }
  }, [exportBatches.length, user?.id]);

  const handleToggleFilter = () => {
    setIsFilterExpanded(!isFilterExpanded);
  };


  const handleSubmissionStatusFilterChange = (status: 'submitted' | 'notSubmitted') => {
    if (submissionStatusFilter === status) {
      // Toggle off - deselect and show all
      setSubmissionStatusFilter('all');
    } else {
      // Select the new filter
      setSubmissionStatusFilter(status);
    }
  };

  const handleDateFilterChange = (filter: DateFilter) => {
    if (dateFilter === filter) {
      setDateFilter('all');
    } else {
      setDateFilter(filter);
    }
  };

  const getUnsubmittedBatches = () => {
    return exportBatches.filter(batch => !batch.submittedAt);
  };

  const getFilteredBatches = () => {
    let filtered = exportBatches;

    // Apply submission status filter
    if (submissionStatusFilter !== 'all') {
      filtered = filtered.filter(batch => {
        if (submissionStatusFilter === 'submitted') {
          return batch.submittedAt !== undefined;
        } else {
          return batch.submittedAt === undefined;
        }
      });
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(batch => {
        const batchDate = new Date(batch.createdAt);
        const batchDateOnly = new Date(batchDate.getFullYear(), batchDate.getMonth(), batchDate.getDate());

        switch (dateFilter) {
          case 'today':
            return batchDateOnly.getTime() === today.getTime();
          
          case 'thisWeek': {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
            weekStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            return batchDateOnly.getTime() >= weekStart.getTime() && batchDateOnly.getTime() <= todayEnd.getTime();
          }
          
          case 'thisMonth':
            return batchDate.getMonth() === now.getMonth() && 
                   batchDate.getFullYear() === now.getFullYear();
          
          case 'lastMonth': {
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            lastMonthStart.setHours(0, 0, 0, 0);
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            thisMonthStart.setHours(0, 0, 0, 0);
            return batchDateOnly.getTime() >= lastMonthStart.getTime() && batchDateOnly.getTime() < thisMonthStart.getTime();
          }
          
          case 'thisYear':
            return batchDate.getFullYear() === now.getFullYear();
          
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  const renderFilterButton = (status: 'submitted' | 'notSubmitted', label: string) => {
    const isActive = submissionStatusFilter === status;
    const count = status === 'submitted' ? exportBatches.filter(b => b.submittedAt).length :
                  exportBatches.filter(b => !b.submittedAt).length;
    
    return (
      <TouchableOpacity
        style={[
          styles.secondaryFilterButton,
          isActive && styles.activeSecondaryFilterButton,
          isDark && styles.darkSecondaryFilterButton,
          isActive && isDark && styles.darkActiveSecondaryFilterButton,
        ]}
        onPress={() => handleSubmissionStatusFilterChange(status)}
      >
        <Text
          style={[
            styles.secondaryFilterButtonText,
            isActive && styles.activeSecondaryFilterButtonText,
            isDark && styles.darkSecondaryFilterButtonText,
            isActive && isDark && styles.darkActiveSecondaryFilterButtonText,
          ]}
        >
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDateFilterButton = (filter: DateFilter, label: string, isActive: boolean) => (
    <TouchableOpacity
      style={[
        styles.secondaryFilterButton,
        isActive && styles.activeSecondaryFilterButton,
        isDark && styles.darkSecondaryFilterButton,
        isActive && isDark && styles.darkActiveSecondaryFilterButton,
      ]}
      onPress={() => handleDateFilterChange(filter)}
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadExportBatches(user?.id);
    setRefreshing(false);
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
      // Handle cloud URLs - download to cache if needed
      let pdfUri = batch.pdfUri;
      const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
      const { getExportFileName } = await import('../../lib/utils/exportFilename');
      const { profile } = useProfileStore.getState();
      
      if (isCloudURL(batch.pdfUri)) {
        try {
          // Get the preferred filename from export batch
          const preferredFileName = getExportFileName(batch, profile);
          pdfUri = await downloadPDFFromStorage(batch.pdfUri, batch.id, preferredFileName);
        } catch (error) {
          debug.error('Failed to download PDF from cloud:', error);
          Alert.alert('Error', 'Failed to download PDF from cloud. Please check your connection.');
          return;
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share AVAC Form',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      debug.error('Sharing failed:', error);
      Alert.alert('Sharing Failed', 'Failed to share PDF. Please try again.');
    }
  };

  const handleDeleteBatch = (batch: ExportBatch) => {
    debug.debug('handleDeleteBatch called', { batchId: batch.id });
    const batchId = batch.id;

    // Close the expanded card if it's open
    setExpandedCardIds(prev => {
      const next = new Set(prev);
      next.delete(batchId);
      return next;
    });

    // Execute the alert immediately
    debug.debug('Showing delete alert');
    Alert.alert(
      'Delete Export',
      'Are you sure you want to delete this export? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => debug.debug('Delete cancelled')
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            debug.debug('Delete confirmed, calling deleteExportBatch');
            deleteExportBatch(batchId);
          },
        },
      ]
    );
  };

  const handleEditName = (batch: ExportBatch) => {
    debug.debug('handleEditName called', { batchId: batch.id });
    const batchId = batch.id;
    // Get the display name for editing (use customName if available, otherwise use shortened display name)
    const customName = batch.customName || getExportDisplayName(batch, profile);
    
    // Set state first, then close card - this ensures modal opens
    debug.debug('Setting edit state', { batchId, customName });
    setEditingId(batchId);
    setEditName(customName);
    setShowEditModal(true);
    
    // Close the expanded card after modal state is set
    setExpandedCardIds(prev => {
      const next = new Set(prev);
      next.delete(batchId);
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
      const result = await sendAVACEmail(profile, batch.pdfUri, batch);
      
      if (result.success && result.useAppleMail) {
        // Apple Mail method - everything is pre-filled with attachment
        await markBatchAsSubmitted(batch.id, 'email');
        Alert.alert('Success', 'Email opened in Apple Mail with attachment and all details pre-filled. Please review and send.');
        setSubmittingId(null);
      } else if (result.success && result.useShareSheet) {
        // Share sheet method - prepare email details for clipboard (optional recipient)
        const emailParts: string[] = [];
        if (result.recipientEmail) {
          emailParts.push(`To: ${result.recipientEmail}`);
        }
        if (result.subject) {
          emailParts.push(`Subject: ${result.subject}`);
        }
        if (result.body) {
          emailParts.push(`\n${result.body}`);
        }
        const clipboardText = emailParts.join('\n');
        
        // Copy to clipboard if we have email details
        if (clipboardText.trim()) {
          await Clipboard.setStringAsync(clipboardText);
        }
        
        // Show brief notification then open share sheet
        const alertMessage = result.recipientEmail 
          ? `✓ Email details copied to clipboard\n\nTo: ${result.recipientEmail}\n\nNext: Select your email app (e.g., Outlook), then paste (Cmd+V) the email details.`
          : `✓ Email details copied to clipboard\n\nNext: Select your email app (e.g., Outlook), choose your recipient, then paste (Cmd+V) the email details.`;
        
        Alert.alert(
          'Ready to Email',
          alertMessage,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setSubmittingId(null) },
            {
              text: 'Continue',
              onPress: async () => {
                try {
                  // Ensure PDF is a local file path before sharing
                  let localPdfPath = batch.pdfUri;
                  const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
                  const { getExportFileName } = await import('../../lib/utils/exportFilename');
                  const { profile } = useProfileStore.getState();
                  
                  if (isCloudURL(batch.pdfUri)) {
                    try {
                      debug.debug('Downloading PDF from cloud storage...');
                      // Get the preferred filename from export batch
                      const preferredFileName = getExportFileName(batch, profile);
                      localPdfPath = await downloadPDFFromStorage(batch.pdfUri, batch.id, preferredFileName);
                      debug.debug('PDF downloaded to local path:', localPdfPath);
                    } catch (downloadError) {
                      debug.error('Failed to download PDF:', downloadError);
                      Alert.alert('Error', 'Failed to download PDF file. Please check your connection and try again.');
                      setSubmittingId(null);
                      return;
                    }
                  }
                  
                  // Open share sheet with PDF attachment
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(localPdfPath, {
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
                  debug.error('Sharing failed:', shareError);
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
      debug.error('Error submitting AVAC:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setSubmittingId(null);
    }
  };

  const getPDFInfo = async (batch: ExportBatch) => {
    if (!batch.pdfUri) return null;
    
    // Only get info for local files, not cloud URLs
    const { isCloudURL } = await import('../../lib/storage/pdfStorage');
    if (isCloudURL(batch.pdfUri)) {
      debug.debug('Skipping file info for cloud URL');
      return null;
    }
    
    // Check if it's a local file path
    if (!batch.pdfUri.startsWith('file://') && !batch.pdfUri.startsWith('/')) {
      debug.debug('Skipping file info for non-local file');
      return null;
    }
    
    try {
      const info = await getInfoAsync(batch.pdfUri);
      return info;
    } catch (error) {
      debug.error('Failed to get PDF info:', error);
      return null;
    }
  };

  const handleToggleBatchSelection = (batchId: string) => {
    setSelectedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const filtered = getFilteredBatches();
    const allBatchIds = new Set(filtered.map(batch => batch.id));
    setSelectedBatchIds(allBatchIds);
  };

  const handleDeselectAll = () => {
    setSelectedBatchIds(new Set());
  };

  const handleCancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedBatchIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedBatchIds.size === 0) return;

    const filtered = getFilteredBatches();
    const selectedBatches = filtered.filter(batch => 
      selectedBatchIds.has(batch.id)
    );

    if (selectedBatches.length === 0) return;

    const batchCount = selectedBatches.length;
    const batchNames = selectedBatches
      .slice(0, 3)
      .map(batch => getExportDisplayName(batch, profile))
      .join('\n');
    const moreText = batchCount > 3 ? `\n...and ${batchCount - 3} more` : '';

    Alert.alert(
      'Delete Exports',
      `Are you sure you want to delete ${batchCount} export${batchCount > 1 ? 's' : ''}? This action cannot be undone.\n\n${batchNames}${moreText}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => debug.debug('Batch delete cancelled')
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            debug.debug('Batch delete confirmed, deleting', batchCount, 'exports');
            
            // Delete all selected batches
            selectedBatches.forEach(batch => {
              deleteExportBatch(batch.id);
            });
            
            // Exit selection mode
            setSelectionMode(false);
            setSelectedBatchIds(new Set());
          },
        },
      ]
    );
  }, [selectedBatchIds, exportBatches, submissionStatusFilter, dateFilter, deleteExportBatch]);

  const handleBatchShare = useCallback(async () => {
    if (selectedBatchIds.size === 0) return;

    const filtered = getFilteredBatches();
    const selectedBatches = filtered.filter(batch => 
      selectedBatchIds.has(batch.id) && batch.pdfUri
    );

    if (selectedBatches.length === 0) {
      Alert.alert('No Valid Exports', 'Selected exports do not have PDF files available.');
      return;
    }

    if (selectedBatches.length === 1) {
      // Single file - just share it normally
      handleSharePDF(selectedBatches[0]);
      setSelectionMode(false);
      setSelectedBatchIds(new Set());
      return;
    }

    // Multiple files - merge PDFs into one and share it
    setIsBatchSharing(true);
    
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
        setIsBatchSharing(false);
        return;
      }

      // Create a new PDF document to merge all PDFs into
      const mergedPdf = await PDFDocument.create();
      
      // Read all PDF files and merge their pages into the merged PDF
      const { getExportFileName } = await import('../../lib/utils/exportFilename');
      const { profile } = useProfileStore.getState();
      
      for (const batch of selectedBatches) {
        try {
          // Handle cloud URLs - download to cache if needed
          let pdfUri = batch.pdfUri;
          const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
          
          if (isCloudURL(batch.pdfUri)) {
            try {
              // Get the preferred filename from export batch (for batch merge, we still use batch ID for temp files)
              // but this ensures consistency if the file is accessed later
              const preferredFileName = getExportFileName(batch, profile);
              pdfUri = await downloadPDFFromStorage(batch.pdfUri, batch.id, preferredFileName);
            } catch (error) {
              debug.error(`Failed to download PDF ${batch.id} from cloud:`, error);
              Alert.alert('Error', `Failed to download PDF: ${batch.customName || batch.id}. Skipping...`);
              continue;
            }
          }
          
          // Read PDF file as base64
          const pdfBase64 = await readAsStringAsync(pdfUri, {
            encoding: 'base64',
          });
          
          // Convert base64 to Uint8Array
          const binaryString = atob(pdfBase64);
          const pdfBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            pdfBytes[i] = binaryString.charCodeAt(i);
          }
          
          // Load the PDF document
          const pdfDoc = await PDFDocument.load(pdfBytes);
          
          // Copy all pages from this PDF to the merged PDF
          const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
          pages.forEach((page) => mergedPdf.addPage(page));
          
        } catch (error) {
          debug.error(`Failed to read or merge PDF ${batch.id}:`, error);
          Alert.alert('Error', `Failed to read PDF: ${batch.customName || batch.id}. Skipping...`);
        }
      }

      // Generate the merged PDF bytes
      const mergedPdfBytes = await mergedPdf.save();
      
      // Convert Uint8Array to base64 string
      let base64String: string;
      try {
        const binaryString = String.fromCharCode(...mergedPdfBytes);
        base64String = btoa(binaryString);
      } catch (error) {
        // Fallback for large files
        const chunks: string[] = [];
        const chunkSize = 8192;
        for (let i = 0; i < mergedPdfBytes.length; i += chunkSize) {
          const chunk = mergedPdfBytes.slice(i, i + chunkSize);
          chunks.push(String.fromCharCode(...chunk));
        }
        base64String = btoa(chunks.join(''));
      }
      
      // Save merged PDF file to temporary directory
      const mergedFileName = `AVAC_Merged_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      const mergedPdfUri = `${Paths.cache.uri}/${mergedFileName}`;
      
      // Write merged PDF file
      await writeAsStringAsync(mergedPdfUri, base64String, {
        encoding: 'base64',
      });

      // Share the merged PDF file
      await Sharing.shareAsync(mergedPdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Merged AVAC Export${selectedBatches.length > 1 ? 's' : ''} (${selectedBatches.length} file${selectedBatches.length > 1 ? 's' : ''} merged)`,
        UTI: 'com.adobe.pdf',
      });

      // Clean up merged PDF file after a delay
      setTimeout(async () => {
        try {
          // Only get info for local files
          if (mergedPdfUri && (mergedPdfUri.startsWith('file://') || mergedPdfUri.startsWith('/'))) {
            const fileInfo = await getInfoAsync(mergedPdfUri);
            if (fileInfo.exists) {
              await deleteAsync(mergedPdfUri, { idempotent: true });
            }
          }
        } catch (error) {
          debug.error('Failed to clean up merged PDF file:', error);
        }
      }, 10000); // Clean up after 10 seconds

      setSelectionMode(false);
      setSelectedBatchIds(new Set());
    } catch (error) {
      debug.error('Batch sharing failed:', error);
      Alert.alert('Sharing Failed', 'Failed to merge or share PDF files. Please try again.');
    } finally {
      setIsBatchSharing(false);
    }
  }, [selectedBatchIds, exportBatches, submissionStatusFilter, dateFilter, handleSharePDF]);

  const renderFilterDropdown = () => (
        <View style={[styles.filterDropdown, isDark && styles.darkFilterDropdown]}>
          <ScrollView style={styles.filterDropdownContent} showsVerticalScrollIndicator={false}>
            {/* Submission Status Filters */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, isDark && styles.darkText]}>Submission Status</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.statusFilterScroll}
                contentContainerStyle={styles.statusFilterScrollContent}
              >
                <View style={styles.filterButtonRow}>
                  {renderFilterButton('submitted', 'Submitted')}
                  {renderFilterButton('notSubmitted', 'Not Submitted')}
                </View>
              </ScrollView>
            </View>

            {/* Date Filter Section */}
            <View style={styles.filterSection}>
              <TouchableOpacity
                style={[
                  styles.filterTypeHeader,
                  isDateExpanded && styles.filterTypeHeaderExpanded,
                  isDark && styles.darkFilterTypeHeader,
                  isDateExpanded && isDark && styles.darkFilterTypeHeaderExpanded,
                ]}
                onPress={() => setIsDateExpanded(!isDateExpanded)}
              >
                <View style={styles.filterTypeHeaderContent}>
                  <View style={[
                    styles.filterTypeIconContainer,
                    dateFilter !== 'all' && styles.filterTypeIconContainerActive,
                    isDark && styles.darkFilterTypeIconContainer,
                    dateFilter !== 'all' && isDark && styles.darkFilterTypeIconContainerActive,
                  ]}>
                    <Ionicons 
                      name="calendar" 
                      size={14} 
                      color={dateFilter !== 'all' ? '#fff' : (isDark ? '#999' : '#666')} 
                    />
                  </View>
                  <View style={styles.filterTypeTextContainer}>
                    <Text style={[styles.filterSectionTitle, isDark && styles.darkText]}>Date</Text>
                    {dateFilter !== 'all' && (
                      <Text style={[styles.filterActiveIndicator, isDark && styles.darkFilterActiveIndicator]}>
                        {dateFilter === 'today' ? 'Today' :
                         dateFilter === 'thisWeek' ? 'This Week' :
                         dateFilter === 'thisMonth' ? 'This Month' :
                         dateFilter === 'lastMonth' ? 'Last Month' :
                         dateFilter === 'thisYear' ? 'This Year' : dateFilter}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.filterTypeChevronContainer}>
                  <Ionicons 
                    name={isDateExpanded ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color={isDark ? '#999' : '#666'} 
                  />
                </View>
              </TouchableOpacity>
              
              {isDateExpanded && (
                <View style={[
                  styles.expandedContentContainer,
                  isDark && styles.darkExpandedContentContainer,
                ]}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.secondaryFilterScroll}
                    contentContainerStyle={styles.secondaryFilterScrollContent}
                  >
                    {renderDateFilterButton('all', 'All Time', dateFilter === 'all')}
                    {renderDateFilterButton('today', 'Today', dateFilter === 'today')}
                    {renderDateFilterButton('thisWeek', 'This Week', dateFilter === 'thisWeek')}
                    {renderDateFilterButton('thisMonth', 'This Month', dateFilter === 'thisMonth')}
                    {renderDateFilterButton('lastMonth', 'Last Month', dateFilter === 'lastMonth')}
                    {renderDateFilterButton('thisYear', 'This Year', dateFilter === 'thisYear')}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Clear All Button */}
            {(submissionStatusFilter !== 'all' || dateFilter !== 'all') && (
              <TouchableOpacity
                style={[styles.clearAllButton, isDark && styles.darkClearAllButton]}
                onPress={() => {
                  setSubmissionStatusFilter('all');
                  setDateFilter('all');
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
  );

  const renderListHeader = () => (
    <>
      {/* Filter Dropdown - Show before submit section when not in selection mode */}
      {!selectionMode && isFilterExpanded && renderFilterDropdown()}

      {/* Submit Section - Show when there are unsubmitted exports */}
      {(() => {
        const unsubmittedBatches = getUnsubmittedBatches();
        const hasUnsubmitted = unsubmittedBatches.length > 0;
        
        if (!selectionMode && hasUnsubmitted) {
          // Initial state - show all unsubmitted
          return (
            <View style={[styles.submitContainer, isDark && styles.darkSubmitContainer]}>
              <View style={styles.submitInfo}>
                <Text style={[styles.submitTitle, isDark && styles.darkText]}>
                  Ready to Submit
                </Text>
                <Text style={[styles.submitSubtitle, isDark && styles.darkSubmitSubtitle]}>
                  {unsubmittedBatches.length} export{unsubmittedBatches.length !== 1 ? 's' : ''} ready for submission
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.submitButton, isDark && styles.darkSubmitButton]}
                onPress={handleSubmitModeEnter}
              >
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          );
        }
        
        if (selectionMode && !hasUnsubmitted) {
          // In selection mode with no unsubmitted exports - show message about resending
          return (
            <View style={[styles.resendContainer, isDark && styles.darkResendContainer]}>
              <Text style={[styles.resendText, isDark && styles.darkResendText]}>
                You are sending already submitted AVACs
              </Text>
            </View>
          );
        }
        
        return null;
      })()}

      {/* Selection Bar and Action Buttons */}
      {selectionMode && (
        <>
          {/* Action Buttons - Show when any batches are selected */}
          {selectedBatchIds.size > 0 && (
            <View style={[styles.submitActionButtons, isDark && styles.darkSubmitActionButtons]}>
              <Text style={[styles.submitActionInstructions, isDark && styles.darkSubmitActionInstructions]}>
                Submit via one of these options:
              </Text>
              <View style={styles.submitActionButtonsRow}>
                <TouchableOpacity
                  style={[styles.submitActionButtonLarge, styles.emailActionButton]}
                  onPress={async () => {
                    await handleBatchEmailSubmit();
                  }}
                >
                  <Ionicons name="mail-outline" size={18} color="#fff" />
                  <Text style={styles.submitActionButtonTextLarge}>Submit via Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitActionButtonLarge, styles.shareActionButtonLarge]}
                  onPress={async () => {
                    await handleBatchShare();
                  }}
                >
                  <Ionicons name="share-outline" size={18} color="#fff" />
                  <Text style={styles.submitActionButtonTextLarge}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Selection Bar - Show after action buttons */}
        <View style={[styles.selectionBar, isDark && styles.darkSelectionBar]}>
          <TouchableOpacity
            style={styles.selectionButton}
            onPress={() => {
              const filtered = getFilteredBatches();
              if (selectedBatchIds.size === filtered.length) {
                handleDeselectAll();
              } else {
                handleSelectAll();
              }
            }}
          >
            <Text style={[styles.selectionButtonText, isDark && styles.selectionButtonTextDark]}>
              {(() => {
                const filtered = getFilteredBatches();
                return selectedBatchIds.size === filtered.length ? 'Deselect All' : 'Select All';
              })()}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.selectionCount, isDark && styles.selectionCountDark]}>
            {selectedBatchIds.size} selected
          </Text>
        </View>
          
          {/* Filter Dropdown - Show after selection bar when in selection mode */}
          {selectionMode && isFilterExpanded && renderFilterDropdown()}
        </>
      )}
    </>
  );

  const toggleCardExpansion = (batchId: string) => {
    setExpandedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const handleCardPress = (item: ExportBatch) => {
    if (selectionMode) {
      handleToggleBatchSelection(item.id);
    } else {
      toggleCardExpansion(item.id);
    }
  };

  const handleSubmitModeEnter = async () => {
    // Simplified flow: directly open share sheet with email details copied
    const unsubmittedBatches = getUnsubmittedBatches();
    
    if (unsubmittedBatches.length === 0) {
      return;
    }

    if (!profile) {
      Alert.alert('Profile Required', 'Please complete your profile before submitting AVAC forms.');
      return;
    }

    if (!profile.email) {
      Alert.alert('Email Required', 'Please add your email address in Settings before submitting AVAC forms.');
      return;
    }

    // Check all batches have PDFs
    const validBatches = unsubmittedBatches.filter(batch => batch.pdfUri);
    if (validBatches.length === 0) {
      Alert.alert('No Valid Exports', 'Selected exports do not have PDF files available.');
      return;
    }

    setSubmittingId(validBatches[0].id);

    try {
      // Get email details for the first batch (or create a merged batch for multiple)
      let pdfUri: string;
      let batchForEmail: ExportBatch;

      if (validBatches.length === 1) {
        // Single batch - use it directly
        pdfUri = validBatches[0].pdfUri!;
        batchForEmail = validBatches[0];
      } else {
        // Multiple batches - merge them first
        const mergedPdf = await PDFDocument.create();
        const { getExportFileName } = await import('../../lib/utils/exportFilename');
        
        for (const batch of validBatches) {
          try {
            let localPdfUri = batch.pdfUri!;
            const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
            
            if (isCloudURL(batch.pdfUri!)) {
              const preferredFileName = getExportFileName(batch, profile);
              localPdfUri = await downloadPDFFromStorage(batch.pdfUri!, batch.id, preferredFileName);
            }
            
            const pdfBase64 = await readAsStringAsync(localPdfUri, { encoding: 'base64' });
            const binaryString = atob(pdfBase64);
            const pdfBytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              pdfBytes[i] = binaryString.charCodeAt(i);
            }
            
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            pages.forEach((page) => mergedPdf.addPage(page));
          } catch (error) {
            debug.error(`Failed to read or merge PDF ${batch.id}:`, error);
          }
        }

        const mergedPdfBytes = await mergedPdf.save();
        let base64String: string;
        try {
          const binaryString = String.fromCharCode(...mergedPdfBytes);
          base64String = btoa(binaryString);
        } catch (error) {
          const chunks: string[] = [];
          const chunkSize = 8192;
          for (let i = 0; i < mergedPdfBytes.length; i += chunkSize) {
            const chunk = mergedPdfBytes.slice(i, i + chunkSize);
            chunks.push(String.fromCharCode(...chunk));
          }
          base64String = btoa(chunks.join(''));
        }
        
        const mergedFileName = `AVAC_Merged_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
        pdfUri = `${Paths.cache.uri}/${mergedFileName}`;
        await writeAsStringAsync(pdfUri, base64String, { encoding: 'base64' });

        // Create a merged batch object for email details
        batchForEmail = {
          id: `merged_${Date.now()}`,
          createdAt: new Date().toISOString(),
          pdfUri: pdfUri,
          countLogs: validBatches.reduce((sum, b) => sum + b.countLogs, 0),
          totalMinutes: validBatches.reduce((sum, b) => sum + b.totalMinutes, 0),
          customName: `Merged AVAC (${validBatches.length} exports)`,
        };
      }

      // Get email details and copy to clipboard
      const result = await sendAVACEmail(profile, pdfUri, batchForEmail);
      
      if (result.success) {
        const emailParts: string[] = [];
        if (result.recipientEmail) {
          emailParts.push(`To: ${result.recipientEmail}`);
        }
        if (result.subject) {
          emailParts.push(`Subject: ${result.subject}`);
        }
        if (result.body) {
          emailParts.push(`\n${result.body}`);
        }
        const clipboardText = emailParts.join('\n');
        
        // Copy to clipboard if we have email details
        if (clipboardText.trim()) {
          await Clipboard.setStringAsync(clipboardText);
        }

        // Ensure PDF is a local file path before sharing
        let localPdfPath = pdfUri;
        const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
        const { getExportFileName } = await import('../../lib/utils/exportFilename');
        
        if (isCloudURL(pdfUri)) {
          try {
            const preferredFileName = getExportFileName(batchForEmail, profile);
            localPdfPath = await downloadPDFFromStorage(pdfUri, batchForEmail.id, preferredFileName);
          } catch (downloadError) {
            debug.error('Failed to download PDF:', downloadError);
            Alert.alert('Error', 'Failed to download PDF file. Please check your connection and try again.');
            setSubmittingId(null);
            return;
          }
        } else if (validBatches.length > 1) {
          // For merged PDFs, we need to ensure the file exists
          const fileInfo = await getInfoAsync(localPdfPath);
          if (!fileInfo.exists) {
            Alert.alert('Error', 'Failed to create merged PDF. Please try again.');
            setSubmittingId(null);
            return;
          }
        }
        
        // Open share sheet with PDF attachment
        if (await Sharing.isAvailableAsync()) {
          const alertMessage = result.recipientEmail 
            ? `✓ Email details copied to clipboard\n\nTo: ${result.recipientEmail}\n\nNext: Select your email app (e.g., Outlook), then paste (Cmd+V) the email details.`
            : `✓ Email details copied to clipboard\n\nNext: Select your email app (e.g., Outlook), choose your recipient, then paste (Cmd+V) the email details.`;
          
          Alert.alert(
            'Ready to Submit',
            alertMessage,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setSubmittingId(null) },
              {
                text: 'Continue',
                onPress: async () => {
                  try {
                    await Sharing.shareAsync(localPdfPath, {
                      mimeType: 'application/pdf',
                      dialogTitle: 'Share AVAC Form',
                      UTI: 'com.adobe.pdf'
                    });
                    
                    // Mark all batches as submitted after sharing
                    for (const batch of validBatches) {
                      await markBatchAsSubmitted(batch.id, 'email');
                    }
                    
                    // Clean up merged PDF if created
                    if (validBatches.length > 1 && localPdfPath.startsWith(Paths.cache.uri)) {
                      setTimeout(async () => {
                        try {
                          const fileInfo = await getInfoAsync(localPdfPath);
                          if (fileInfo.exists) {
                            await deleteAsync(localPdfPath, { idempotent: true });
                          }
                        } catch (error) {
                          debug.error('Failed to clean up merged PDF file:', error);
                        }
                      }, 10000);
                    }
                  } catch (shareError) {
                    debug.error('Sharing failed:', shareError);
                    Alert.alert('Sharing Failed', 'Failed to share PDF. Please try again.');
                  } finally {
                    setSubmittingId(null);
                  }
                }
              }
            ]
          );
        } else {
          Alert.alert('Sharing not available', 'Sharing is not available on this device.');
          setSubmittingId(null);
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to get recipient information. Please try again.');
        setSubmittingId(null);
      }
    } catch (error) {
      debug.error('Error submitting AVAC:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setSubmittingId(null);
    }
  };


  const handleBatchEmailSubmit = useCallback(async () => {
    if (selectedBatchIds.size === 0) return;

    const filtered = getFilteredBatches();
    const selectedBatches = filtered.filter(batch => 
      selectedBatchIds.has(batch.id) && batch.pdfUri
    );

    if (selectedBatches.length === 0) {
      Alert.alert('No Valid Exports', 'Selected exports do not have PDF files available.');
      return;
    }

    // For selection mode, always prefer Apple Mail method
    if (selectedBatches.length === 1) {
      // Single file - try Apple Mail first, fallback to share sheet
      const batch = selectedBatches[0];
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
        // Try Apple Mail first
        const appleMailResult = await sendAVACEmailWithAttachment(profile, batch.pdfUri, batch);
        
        if (appleMailResult.success) {
          // Apple Mail worked - mark as submitted
          await markBatchAsSubmitted(batch.id, 'email');
          Alert.alert('Success', 'Email opened in Apple Mail with attachment and all details pre-filled. Please review and send.');
          setSubmittingId(null);
          setSelectionMode(false);
          setSelectedBatchIds(new Set());
          return;
        }

        // Apple Mail not available - fallback to share sheet method
        const recipientInfo = await getAVACRecipientInfo(profile, batch);
        
        if (!recipientInfo.success) {
          Alert.alert('Error', recipientInfo.error || 'Failed to get recipient information. Please try again.');
          setSubmittingId(null);
          return;
        }

        // Prepare email details for clipboard
        const emailParts: string[] = [];
        if (recipientInfo.recipientEmail) {
          emailParts.push(`To: ${recipientInfo.recipientEmail}`);
        }
        if (recipientInfo.subject) {
          emailParts.push(`Subject: ${recipientInfo.subject}`);
        }
        if (recipientInfo.body) {
          emailParts.push(`\n${recipientInfo.body}`);
        }
        const clipboardText = emailParts.join('\n');
        
        // Copy to clipboard if we have email details
        if (clipboardText.trim()) {
          await Clipboard.setStringAsync(clipboardText);
        }

        // Ensure PDF is a local file path before sharing
        let localPdfPath = batch.pdfUri;
        const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
        const { getExportFileName } = await import('../../lib/utils/exportFilename');
        
        if (isCloudURL(batch.pdfUri)) {
          try {
            const preferredFileName = getExportFileName(batch, profile);
            localPdfPath = await downloadPDFFromStorage(batch.pdfUri, batch.id, preferredFileName);
          } catch (downloadError) {
            debug.error('Failed to download PDF:', downloadError);
            Alert.alert('Error', 'Failed to download PDF file. Please check your connection and try again.');
            setSubmittingId(null);
            return;
          }
        }

        // Show alert with instructions
        const alertMessage = recipientInfo.recipientEmail 
          ? `✓ Email details copied to clipboard\n\nTo: ${recipientInfo.recipientEmail}\n\nNext: Select your email app (e.g., Outlook), then paste (Cmd+V) the email details.`
          : `✓ Email details copied to clipboard\n\nNext: Select your email app (e.g., Outlook), choose your recipient, then paste (Cmd+V) the email details.`;
        
        Alert.alert(
          'Ready to Email',
          alertMessage,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setSubmittingId(null) },
            {
              text: 'Continue',
              onPress: async () => {
                try {
                  // Open share sheet with PDF attachment
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(localPdfPath, {
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
                  debug.error('Sharing failed:', shareError);
                  Alert.alert('Sharing Failed', 'Failed to share PDF. Please try again.');
                } finally {
                  setSubmittingId(null);
                  setSelectionMode(false);
                  setSelectedBatchIds(new Set());
                }
              }
            }
          ]
        );
      } catch (error) {
        debug.error('Error submitting AVAC:', error);
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
        setSubmittingId(null);
      }
      return;
    }

    // Multiple files - merge PDFs into one and send it
    setSubmittingId(selectedBatches[0].id); // Use first batch ID for loading state
    try {
      // Create a new PDF document to merge all PDFs into
      const mergedPdf = await PDFDocument.create();
      
      // Read all PDF files and merge their pages into the merged PDF
      const { getExportFileName } = await import('../../lib/utils/exportFilename');
      const { profile } = useProfileStore.getState();
      
      for (const batch of selectedBatches) {
        try {
          // Handle cloud URLs - download to cache if needed
          let pdfUri = batch.pdfUri;
          const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
          
          if (isCloudURL(batch.pdfUri)) {
            try {
              const preferredFileName = getExportFileName(batch, profile);
              pdfUri = await downloadPDFFromStorage(batch.pdfUri, batch.id, preferredFileName);
            } catch (error) {
              debug.error(`Failed to download PDF ${batch.id} from cloud:`, error);
              Alert.alert('Error', `Failed to download PDF: ${batch.customName || batch.id}. Skipping...`);
              continue;
            }
          }
          
          // Read PDF file as base64
          const pdfBase64 = await readAsStringAsync(pdfUri, {
            encoding: 'base64',
          });
          
          // Convert base64 to Uint8Array
          const binaryString = atob(pdfBase64);
          const pdfBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            pdfBytes[i] = binaryString.charCodeAt(i);
          }
          
          // Load the PDF document
          const pdfDoc = await PDFDocument.load(pdfBytes);
          
          // Copy all pages from this PDF to the merged PDF
          const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
          pages.forEach((page) => mergedPdf.addPage(page));
          
        } catch (error) {
          debug.error(`Failed to read or merge PDF ${batch.id}:`, error);
          Alert.alert('Error', `Failed to read PDF: ${batch.customName || batch.id}. Skipping...`);
        }
      }

      // Generate the merged PDF bytes
      const mergedPdfBytes = await mergedPdf.save();
      
      // Convert Uint8Array to base64 string
      let base64String: string;
      try {
        const binaryString = String.fromCharCode(...mergedPdfBytes);
        base64String = btoa(binaryString);
      } catch (error) {
        // Fallback for large files
        const chunks: string[] = [];
        const chunkSize = 8192;
        for (let i = 0; i < mergedPdfBytes.length; i += chunkSize) {
          const chunk = mergedPdfBytes.slice(i, i + chunkSize);
          chunks.push(String.fromCharCode(...chunk));
        }
        base64String = btoa(chunks.join(''));
      }
      
      // Save merged PDF file to temporary directory
      const mergedFileName = `AVAC_Merged_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      const mergedPdfUri = `${Paths.cache.uri}/${mergedFileName}`;
      
      // Write merged PDF file
      await writeAsStringAsync(mergedPdfUri, base64String, {
        encoding: 'base64',
      });

      // Create a temporary export batch object for the merged PDF
      const mergedBatch: ExportBatch = {
        id: `merged_${Date.now()}`,
        createdAt: new Date().toISOString(),
        pdfUri: mergedPdfUri,
        countLogs: selectedBatches.reduce((sum, b) => sum + b.countLogs, 0),
        totalMinutes: selectedBatches.reduce((sum, b) => sum + b.totalMinutes, 0),
        customName: `Merged AVAC (${selectedBatches.length} exports)`,
      };

      if (!profile) {
        Alert.alert('Error', 'Profile not found. Please complete your profile setup.');
        setSubmittingId(null);
        return;
      }

      // Try Apple Mail first (preferred method for selection mode)
      const appleMailResult = await sendAVACEmailWithAttachment(profile, mergedPdfUri, mergedBatch);
      
      if (appleMailResult.success) {
        // Apple Mail method - mark all as submitted
        for (const batch of selectedBatches) {
          await markBatchAsSubmitted(batch.id, 'email');
        }
        Alert.alert('Success', 'Email opened in Apple Mail with merged PDF attachment. Please review and send.');
        setSubmittingId(null);
        setSelectionMode(false);
        setSelectedBatchIds(new Set());
      } else {
        // Apple Mail not available - fallback to share sheet method
        const recipientInfo = await getAVACRecipientInfo(profile, mergedBatch);
        
        if (!recipientInfo.success) {
          Alert.alert('Error', recipientInfo.error || 'Failed to get recipient information. Please try again.');
          setSubmittingId(null);
          return;
        }

        // Prepare email details for clipboard
        const emailParts: string[] = [];
        if (recipientInfo.recipientEmail) {
          emailParts.push(`To: ${recipientInfo.recipientEmail}`);
        }
        if (recipientInfo.subject) {
          emailParts.push(`Subject: ${recipientInfo.subject}`);
        }
        if (recipientInfo.body) {
          emailParts.push(`\n${recipientInfo.body}`);
        }
        const clipboardText = emailParts.join('\n');
        
        // Copy to clipboard if we have email details
        if (clipboardText.trim()) {
          await Clipboard.setStringAsync(clipboardText);
        }

        // Ensure PDF is a local file path before sharing
        let localPdfPath = mergedPdfUri;
        const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
        const { getExportFileName } = await import('../../lib/utils/exportFilename');
        
        // For merged PDFs, it should already be local, but verify
        const fileInfo = await getInfoAsync(localPdfPath);
        if (!fileInfo.exists) {
          Alert.alert('Error', 'Failed to create merged PDF. Please try again.');
          setSubmittingId(null);
          return;
        }

        // Show alert with instructions
        const alertMessage = recipientInfo.recipientEmail 
          ? `✓ Email details copied to clipboard\n\nTo: ${recipientInfo.recipientEmail}\n\nNext: Select your email app (e.g., Outlook), then paste (Cmd+V) the email details.`
          : `✓ Email details copied to clipboard\n\nNext: Select your email app (e.g., Outlook), choose your recipient, then paste (Cmd+V) the email details.`;
        
        Alert.alert(
          'Ready to Email',
          alertMessage,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setSubmittingId(null) },
            {
              text: 'Continue',
              onPress: async () => {
                try {
                  // Open share sheet with merged PDF attachment
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(localPdfPath, {
                      mimeType: 'application/pdf',
                      dialogTitle: 'Share Merged AVAC via Email',
                      UTI: 'com.adobe.pdf'
                    });
                    // Mark all batches as submitted after sharing
                    for (const batch of selectedBatches) {
                      await markBatchAsSubmitted(batch.id, 'email');
                    }
                    setSelectionMode(false);
                    setSelectedBatchIds(new Set());
                  } else {
                    Alert.alert('Sharing not available', 'Sharing is not available on this device.');
                  }
                } catch (shareError) {
                  debug.error('Sharing failed:', shareError);
                  Alert.alert('Sharing Failed', 'Failed to share PDF. Please try again.');
                } finally {
                  setSubmittingId(null);
                }
              }
            }
          ]
        );
      }

      // Clean up merged PDF file after a delay
      setTimeout(async () => {
        try {
          if (mergedPdfUri && (mergedPdfUri.startsWith('file://') || mergedPdfUri.startsWith('/'))) {
            const fileInfo = await getInfoAsync(mergedPdfUri);
            if (fileInfo.exists) {
              await deleteAsync(mergedPdfUri, { idempotent: true });
            }
          }
        } catch (error) {
          debug.error('Failed to clean up merged PDF file:', error);
        }
      }, 10000); // Clean up after 10 seconds

      setSelectionMode(false);
      setSelectedBatchIds(new Set());
    } catch (error) {
      debug.error('Batch email submission failed:', error);
      Alert.alert('Email Failed', 'Failed to merge or send PDF files. Please try again.');
      setSubmittingId(null);
    }
  }, [selectedBatchIds, submissionStatusFilter, dateFilter, exportBatches, handleSubmitEmail]);

  const handleBatchSubmit = useCallback(() => {
    if (selectedBatchIds.size === 0) return;

    const filtered = getFilteredBatches();
    const selectedBatches = filtered.filter(batch => 
      selectedBatchIds.has(batch.id) && batch.pdfUri
    );

    if (selectedBatches.length === 0) {
      Alert.alert('No Valid Exports', 'Selected exports do not have PDF files available.');
      return;
    }

    Alert.alert(
      'Submit Exports',
      `How would you like to submit ${selectedBatches.length} export${selectedBatches.length > 1 ? 's' : ''}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Email',
          onPress: async () => {
            await handleBatchEmailSubmit();
          },
        },
        {
          text: 'Share',
          onPress: async () => {
            // Use existing batch share logic
            await handleBatchShare();
          },
        },
      ]
    );
  }, [selectedBatchIds, submissionStatusFilter, dateFilter, exportBatches, handleBatchEmailSubmit, handleBatchShare]);

  const handleExpandPress = (e: any, batchId: string) => {
    e.stopPropagation();
    toggleCardExpansion(batchId);
  };

  const renderExportItem = ({ item }: { item: ExportBatch }) => {
    const totalHours = Math.floor(item.totalMinutes / 60);
    const remainingMinutes = item.totalMinutes % 60;
    const createdDate = new Date(item.createdAt);
    const isSelected = selectedBatchIds.has(item.id);
    const isExpanded = expandedCardIds.has(item.id);
    
    // Get the shortened display name (without person's name)
    const displayName = getExportDisplayName(item, profile);

    const formatCompactDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const getSubtitleText = () => {
      const parts: string[] = [];
      parts.push(formatCompactDate(item.createdAt));
      parts.push(`${item.countLogs} log${item.countLogs !== 1 ? 's' : ''}`);
      parts.push(formatMinutes(item.totalMinutes));
      return parts.join(' · ');
    };

    const getStatusBadge = () => {
      if (item.submittedAt) {
        return (
          <View style={[styles.statusBadge, styles.submittedBadge]}>
            <Ionicons name="checkmark-circle" size={14} color="#1e40af" />
            <Text style={styles.submittedText}>Submitted</Text>
          </View>
        );
      } else {
        return (
          <View style={[styles.statusBadge, styles.notSubmittedBadge]}>
            <Ionicons name="ellipse" size={12} color="#a15c07" />
            <Text style={styles.notSubmittedText}>Not submitted</Text>
          </View>
        );
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.exportCard,
          isDark && styles.darkCard,
          selectionMode && isSelected && styles.selectedCard,
          selectionMode && isSelected && isDark && styles.darkSelectedCard,
          selectionMode && !isSelected && styles.unselectedCard,
          selectionMode && !isSelected && isDark && styles.darkUnselectedCard,
          selectionMode && styles.selectionCard,
        ]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.exportHeader}>
          {selectionMode && (
            <TouchableOpacity 
              style={styles.selectionCheckboxButton}
              onPress={() => handleToggleBatchSelection(item.id)}
            >
              <Ionicons 
                name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                size={24} 
                color={isSelected ? "#007AFF" : "#ccc"} 
              />
            </TouchableOpacity>
          )}
          
          <View style={[styles.titleContainer, selectionMode && styles.exportInfoWithCheckbox]}>
            <Text style={[styles.exportTitle, isDark && styles.darkText]}>
              {displayName}
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            {getStatusBadge()}
            {!selectionMode && (
              <TouchableOpacity 
                style={styles.expandButton}
                onPress={(e) => handleExpandPress(e, item.id)}
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

        <Text style={[styles.exportSubtitle, isDark && styles.darkSecondaryText]}>
          {getSubtitleText()}
        </Text>

        {isExpanded && !selectionMode && (
          <>
            <View style={styles.expandedContent}>
              <TouchableOpacity 
                style={styles.viewLinkRow} 
                onPress={() => handleViewPDF(item)}
              >
                <Ionicons name="document-text" size={14} color={isDark ? "#999" : "#6b7280"} />
                <Text style={[styles.viewLinkText, isDark && styles.viewLinkTextDark]}>View PDF</Text>
              </TouchableOpacity>

              <View style={styles.metaRow}>
                <Ionicons name="list" size={14} color={isDark ? "#999" : "#6b7280"} />
                <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                  Logs: {item.countLogs}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="time" size={14} color={isDark ? "#999" : "#6b7280"} />
                <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                  Total Overtime: {formatMinutes(item.totalMinutes)}
                </Text>
              </View>

              {item.submittedAt && (
                <View style={styles.metaRow}>
                  <Ionicons name="checkmark-circle" size={14} color={isDark ? "#999" : "#6b7280"} />
                  <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                    Submitted via {item.submittedVia || 'email'} on {new Date(item.submittedAt).toLocaleDateString('en-AU')}
                  </Text>
                </View>
              )}

              {!item.submittedAt && (
                <View style={styles.metaRow}>
                  <Ionicons name="mail-outline" size={14} color={isDark ? "#999" : "#6b7280"} />
                  <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                    Ready to submit via email
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.actions, isDark && styles.darkActions]}>
              <TouchableOpacity
                style={[styles.actionButton, styles.headerSubmitActionButtonSmall]}
                onPress={() => handleSubmitEmail(item)}
              >
                <Ionicons name="send" size={14} color="#fff" />
                <Text style={styles.submitActionButtonText}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, isDark && styles.darkActionButton]}
                onPress={() => handleEditName(item)}
              >
                <Text style={[styles.actionButtonText, isDark && styles.darkActionButtonText]}>Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteActionButton, isDark && styles.darkDeleteButton]}
                onPress={() => handleDeleteBatch(item)}
              >
                <Text style={[styles.actionButtonText, styles.deleteActionButtonText, isDark && styles.darkDeleteButtonText]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <View style={[styles.previewCard, isDark && styles.darkPreviewCard]}>
          <Text style={[styles.previewTitle, isDark && styles.darkText]}>
            Ready to export overview
          </Text>
          <Text style={[styles.previewDescription, isDark && styles.darkPreviewDescription]}>
            Once you mark logs as ready, they collect here so you can generate an AVAC PDF in one tap.
          </Text>
          <View style={[styles.previewHighlight, isDark && styles.darkPreviewHighlight]}>
            <Ionicons name="document-text" size={18} color="#2e7d32" />
            <View>
              <Text style={styles.previewHighlightTitle}>3 logs ready</Text>
              <Text style={styles.previewHighlightSubtitle}>Tap to export a PDF bundle</Text>
            </View>
          </View>
        </View>

        <View style={[styles.previewCard, isDark && styles.darkPreviewCard]}>
          <Text style={[styles.previewDescription, isDark && styles.darkPreviewDescription]}>
            Each export keeps the PDF, log count, total hours and submission status together.
          </Text>

          <View style={[styles.exportCard, isDark && styles.darkCard, styles.previewExportCard]}>
            <View style={styles.exportHeader}>
              <View style={styles.titleContainer}>
                <Text style={[styles.exportTitle, isDark && styles.darkText]}>
                  Oct AVAC batch
                </Text>
              </View>
              <View style={styles.headerRight}>
                <View style={[styles.statusBadge, styles.notSubmittedBadge]}>
                  <Ionicons name="ellipse" size={12} color="#a15c07" />
                  <Text style={styles.notSubmittedText}>Not submitted</Text>
                </View>
                <TouchableOpacity style={styles.expandButton} disabled>
                  <Ionicons 
                    name="chevron-down" 
                    size={18} 
                    color={isDark ? "#999" : "#6b7280"} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.exportSubtitle, isDark && styles.darkSecondaryText]}>
              Created 15 Oct • 09:12 · 5 logs · 18h 30m
            </Text>

            <View style={styles.expandedContent}>
              <View style={styles.metaRow}>
                <Ionicons name="list" size={14} color={isDark ? "#999" : "#6b7280"} />
                <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                  Logs included: 5
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="time" size={14} color={isDark ? "#999" : "#6b7280"} />
                <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                  Total overtime: 18h 30m
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="mail-outline" size={14} color={isDark ? "#999" : "#6b7280"} />
                <Text style={[styles.metaText, isDark && styles.darkSecondaryText]}>
                  Submit via email when you're ready.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.previewHelperText, isDark && styles.darkPreviewDescription]}>
          Export your ready logs to create your first AVAC form.
        </Text>
      </View>
  );

  // Only show full loading screen on initial load, not on subsequent navigations
  if (isLoading && exportBatches.length === 0 && !hasLoadedExportBatchesOnce) {
    return (
      <View style={[styles.container, styles.centerContent, isDark && styles.darkContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>
          Loading exports...
        </Text>
      </View>
    );
  }

  const filteredBatches = getFilteredBatches();

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={[styles.title, isDark && styles.darkText]}>
          Exports
        </Text>
        {selectionMode ? (
          <View style={styles.selectionModeButtons}>
            {selectedBatchIds.size > 0 && (
              <TouchableOpacity
                onPress={handleBatchDelete}
                style={[styles.filterButton, isDark && styles.darkFilterButton]}
              >
                <Ionicons name="trash-outline" size={18} color={isDark ? '#ff6b6b' : '#d32f2f'} />
              </TouchableOpacity>
            )}
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
          </View>
        ) : (
          <View style={styles.normalModeButtons}>
            <TouchableOpacity
              onPress={() => setSelectionMode(true)}
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
                color={(submissionStatusFilter !== 'all' || dateFilter !== 'all') ? '#007AFF' : (isDark ? '#999' : '#666')} 
              />
              {(submissionStatusFilter !== 'all' || dateFilter !== 'all') && (
                <View style={styles.filterButtonBadge}>
                  <View style={styles.filterButtonDot} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={filteredBatches}
        renderItem={renderExportItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={renderListHeader}
      />
      {exportBatches.length === 0 && (
        <>
          <TouchableOpacity
            style={styles.previewCTAButton}
            onPress={() => router.push('/log/new')}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.previewCTAText}>Add first log</Text>
        </>
      )}
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
  darkSecondaryText: {
    color: '#999',
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
  selectionModeButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  normalModeButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  actionButton: {
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
  selectActionButton: {
    // Uses base actionButton styles
  },
  darkSelectActionButton: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
    borderRadius: 12,
  },
  filterActionButton: {
    // Uses base actionButton styles
  },
  darkFilterActionButton: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
    borderRadius: 12,
  },
  deleteActionButton: {
    backgroundColor: '#FF3B30',
  },
  shareActionButton: {
    backgroundColor: '#007AFF',
  },
  cancelActionButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 16,
  },
  darkCancelActionButton: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
  },
  cancelActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  darkCancelActionButtonText: {
    color: '#fff',
  },
  exitActionButton: {
    // Uses base actionButton styles
  },
  darkExitActionButton: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
    borderRadius: 12,
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
  darkCard: {
    backgroundColor: '#2c2c2e',
    borderColor: '#3a3a3c',
  },
  exportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  exportInfo: {
    flex: 1,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  exportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  exportSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  submittedBadge: {
    backgroundColor: '#dbeafe',
  },
  notSubmittedBadge: {
    backgroundColor: '#fef3c7',
  },
  submittedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
  notSubmittedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a15c07',
  },
  expandButton: {
    padding: 4,
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
  viewLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  darkActions: {
    borderTopColor: '#3a3a3c',
  },
  headerActionButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 50,
  },
  headerSubmitActionButtonSmall: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  headerShareActionButtonSmall: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  headerDeleteActionButtonSmall: {
    backgroundColor: '#ffebee',
    borderColor: '#ffcdd2',
  },
  headerActionButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerShareActionButton: {
    backgroundColor: '#34C759',
  },
  headerSubmitActionButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  submitActionButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  shareActionButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  deleteActionButtonText: {
    color: '#d32f2f',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptyStateContainer: {
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
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
  firstRunScroll: {
    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 48,
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
    alignSelf: 'stretch',
  },
  darkPreviewCard: {
    backgroundColor: '#1c1c1e',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: '#111827',
  },
  previewDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  darkPreviewDescription: {
    color: '#a0a0a0',
  },
  previewHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#e8f5e8',
  },
  darkPreviewHighlight: {
    backgroundColor: '#1a2e1a',
  },
  previewHighlightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1b5e20',
  },
  previewHighlightSubtitle: {
    fontSize: 13,
    color: '#2e7d32',
  },
  previewExportCard: {
    marginTop: 12,
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
  placeholderHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  disabledFilterButton: {
    borderColor: '#e0e0e0',
    backgroundColor: '#f4f4f4',
  },
  // Filter Styles (matching logs screen)
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
  statusFilterScrollContent: {
    paddingRight: 16,
  },
  secondaryFilterScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  secondaryFilterScrollContent: {
    paddingRight: 16,
  },
  filterButtonRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionButtonPadding: {
    padding: 4,
  },
  headerCancelText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '400',
  },
  headerCancelTextDark: {
    color: '#0A84FF',
  },
  selectionCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCard: {
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
  darkSelectedCard: {
    backgroundColor: '#1a1a2e',
    borderColor: '#007AFF',
  },
  unselectedCard: {
    opacity: 0.4,
    backgroundColor: '#f5f5f5',
  },
  darkUnselectedCard: {
    opacity: 0.3,
    backgroundColor: '#1c1c1e',
  },
  selectionCheckboxButton: {
    marginRight: 12,
    padding: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  exportInfoWithCheckbox: {
    flex: 1,
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkSelectionBar: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
  },
  selectionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  selectionButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  selectionButtonTextDark: {
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
  submitActionButtons: {
    backgroundColor: '#e8f5e8',
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  darkSubmitActionButtons: {
    backgroundColor: '#1a2e1a',
    borderColor: '#4CAF50',
  },
  submitActionInstructions: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '500',
    marginBottom: 12,
  },
  darkSubmitActionInstructions: {
    color: '#4CAF50',
  },
  submitActionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  submitActionButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  emailActionButton: {
    backgroundColor: '#4CAF50',
  },
  shareActionButtonLarge: {
    backgroundColor: '#4CAF50',
  },
  submitActionButtonTextLarge: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  submitContainer: {
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
  darkSubmitContainer: {
    backgroundColor: '#1a2e1a',
    borderColor: '#4CAF50',
  },
  submitInfo: {
    flex: 1,
  },
  submitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 4,
  },
  submitSubtitle: {
    fontSize: 14,
    color: '#4CAF50',
  },
  darkSubmitSubtitle: {
    color: '#4CAF50',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  darkSubmitButton: {
    backgroundColor: '#4CAF50',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resendContainer: {
    backgroundColor: '#fff3cd',
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  darkResendContainer: {
    backgroundColor: '#2d2415',
    borderColor: '#ffc107',
  },
  resendText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  darkResendText: {
    color: '#ffc107',
  },
});
