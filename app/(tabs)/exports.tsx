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
import { sendAVACEmail } from '../../lib/email/emailService';

type SubmissionStatusFilter = 'all' | 'submitted' | 'notSubmitted';
type DateFilter = 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear';

export default function ExportsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { user } = useAuthStore();
  const { exportBatches, loadExportBatches, deleteExportBatch, updateExportBatch, markBatchAsSubmitted, isLoading } = useLogsStore();
  const { profile } = useProfileStore();
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [expandedActionIds, setExpandedActionIds] = useState<Set<string>>(new Set());
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

  const handleToggleFilter = () => {
    setIsFilterExpanded(!isFilterExpanded);
  };


  const handleSubmissionStatusFilterChange = (status: SubmissionStatusFilter) => {
    if (submissionStatusFilter === status) {
      setSubmissionStatusFilter('all');
    } else {
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

  const renderFilterButton = (status: SubmissionStatusFilter, label: string) => {
    const isActive = submissionStatusFilter === status && submissionStatusFilter !== 'all';
    const count = status === 'all' ? exportBatches.length :
                  status === 'submitted' ? exportBatches.filter(b => b.submittedAt).length :
                  exportBatches.filter(b => !b.submittedAt).length;
    
    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          isActive && styles.activeFilterButton,
          isDark && styles.darkFilterButton,
          isActive && isDark && styles.darkActiveFilterButton,
        ]}
        onPress={() => handleSubmissionStatusFilterChange(status)}
      >
        <Text
          style={[
            styles.filterButtonText,
            isActive && styles.activeFilterButtonText,
            isDark && styles.darkFilterButtonText,
            isActive && isDark && styles.darkActiveFilterButtonText,
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
      // Handle cloud URLs - download to cache if needed
      let pdfUri = batch.pdfUri;
      const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
      
      if (isCloudURL(batch.pdfUri)) {
        try {
          pdfUri = await downloadPDFFromStorage(batch.pdfUri, batch.id);
        } catch (error) {
          console.error('Failed to download PDF from cloud:', error);
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
      const result = await sendAVACEmail(profile, batch.pdfUri, batch);
      
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
                  // Ensure PDF is a local file path before sharing
                  let localPdfPath = batch.pdfUri;
                  const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
                  
                  if (isCloudURL(batch.pdfUri)) {
                    try {
                      console.log('[Email Share] Downloading PDF from cloud storage...');
                      localPdfPath = await downloadPDFFromStorage(batch.pdfUri, batch.id);
                      console.log('[Email Share] PDF downloaded to local path:', localPdfPath);
                    } catch (downloadError) {
                      console.error('[Email Share] Failed to download PDF:', downloadError);
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
    
    // Only get info for local files, not cloud URLs
    const { isCloudURL } = await import('../../lib/storage/pdfStorage');
    if (isCloudURL(batch.pdfUri)) {
      console.log('[Exports] Skipping file info for cloud URL');
      return null;
    }
    
    // Check if it's a local file path
    if (!batch.pdfUri.startsWith('file://') && !batch.pdfUri.startsWith('/')) {
      console.log('[Exports] Skipping file info for non-local file');
      return null;
    }
    
    try {
      const info = await getInfoAsync(batch.pdfUri);
      return info;
    } catch (error) {
      console.error('Failed to get PDF info:', error);
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
      .map(batch => batch.customName || `Export #${batch.id.split('_')[1]}`)
      .join('\n');
    const moreText = batchCount > 3 ? `\n...and ${batchCount - 3} more` : '';

    Alert.alert(
      'Delete Exports',
      `Are you sure you want to delete ${batchCount} export${batchCount > 1 ? 's' : ''}? This action cannot be undone.\n\n${batchNames}${moreText}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('[EXPORTS] Batch delete cancelled')
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('[EXPORTS] Batch delete confirmed, deleting', batchCount, 'exports');
            
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
      for (const batch of selectedBatches) {
        try {
          // Handle cloud URLs - download to cache if needed
          let pdfUri = batch.pdfUri;
          const { isCloudURL, downloadPDFFromStorage } = await import('../../lib/storage/pdfStorage');
          
          if (isCloudURL(batch.pdfUri)) {
            try {
              pdfUri = await downloadPDFFromStorage(batch.pdfUri, batch.id);
            } catch (error) {
              console.error(`Failed to download PDF ${batch.id} from cloud:`, error);
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
          console.error(`Failed to read or merge PDF ${batch.id}:`, error);
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
          console.error('Failed to clean up merged PDF file:', error);
        }
      }, 10000); // Clean up after 10 seconds

      setSelectionMode(false);
      setSelectedBatchIds(new Set());
    } catch (error) {
      console.error('Batch sharing failed:', error);
      Alert.alert('Sharing Failed', 'Failed to merge or share PDF files. Please try again.');
    } finally {
      setIsBatchSharing(false);
    }
  }, [selectedBatchIds, exportBatches, submissionStatusFilter, dateFilter, handleSharePDF]);

  const renderListHeader = () => (
    <>
      {/* Filter Dropdown - Expands Below Header */}
      {isFilterExpanded && (
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
                  {renderFilterButton('all', 'All')}
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
      )}

      {/* Selection Bar */}
      {selectionMode && selectedBatchIds.size > 0 && (
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
      )}
    </>
  );

  const renderExportItem = ({ item }: { item: ExportBatch }) => {
    const totalHours = Math.floor(item.totalMinutes / 60);
    const remainingMinutes = item.totalMinutes % 60;
    const createdDate = new Date(item.createdAt);
    const isSelected = selectedBatchIds.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.exportCard,
          isDark && styles.darkCard,
          selectionMode && isSelected && styles.selectedCard,
          selectionMode && isSelected && isDark && styles.darkSelectedCard,
          selectionMode && styles.selectionCard,
        ]}
        onPress={selectionMode ? () => handleToggleBatchSelection(item.id) : undefined}
        activeOpacity={selectionMode ? 0.7 : 1}
      >
        <View style={styles.exportHeader}>
          {selectionMode && (
            <TouchableOpacity 
              style={styles.selectionButton}
              onPress={() => handleToggleBatchSelection(item.id)}
            >
              <Ionicons 
                name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                size={24} 
                color={isSelected ? "#007AFF" : "#ccc"} 
              />
            </TouchableOpacity>
          )}
          <View style={[styles.exportInfo, selectionMode && styles.exportInfoWithCheckbox]}>
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
          {!selectionMode && (
            <View style={styles.exportActions}>
              <TouchableOpacity
                style={[styles.cardActionButton, styles.submitButton]}
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
                style={[styles.cardActionButton, styles.shareButton]}
                onPress={() => handleSharePDF(item)}
              >
                <Ionicons name="share" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cardActionButton, styles.moreButton]}
                onPress={() => toggleExpandedActions(item.id)}
              >
                <Ionicons name={expandedActionIds.has(item.id) ? 'close' : 'ellipsis-vertical'} size={16} color="#fff" />
              </TouchableOpacity>
              {expandedActionIds.has(item.id) && (
                <View style={styles.inlineOverlay} pointerEvents="auto">
                  <View style={styles.inlineButtons} pointerEvents="auto">
                    <TouchableOpacity
                      style={[styles.cardActionButton, styles.editButton]}
                      onPress={() => {
                        console.log('[EXPORTS] Edit button pressed for batch:', item.id);
                        handleEditName(item);
                      }}
                    >
                      <Ionicons name="create" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cardActionButton, styles.deleteButton]}
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
          )}
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
      </TouchableOpacity>
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
              <>
                <TouchableOpacity
                  onPress={handleBatchDelete}
                style={[styles.cardActionButton, styles.deleteActionButton]}
              >
                <Ionicons name="trash" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBatchShare}
                style={[styles.cardActionButton, styles.shareActionButton]}
                  disabled={isBatchSharing}
                >
                  {isBatchSharing ? (
                    <ActivityIndicator size={14} color="#fff" />
                  ) : (
                    <Ionicons name="share" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              </>
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
        onScrollBeginDrag={handleScroll}
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
  cardActionButton: {
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
  headerActionButton: {
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
  selectionButton: {
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  darkSelectionBar: {
    backgroundColor: '#1c1c1e',
    borderBottomColor: '#333',
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
});
