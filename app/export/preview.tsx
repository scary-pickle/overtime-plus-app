import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getInfoAsync } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../lib/state/profileStore';
import { useLogsStore } from '../../lib/state/logsStore';
import { useAuthStore } from '../../lib/state/authStore';
import { exportSync } from '../../lib/supabase';
import { buildAVAC, validateLogsForPDF } from '../../lib/pdf/buildAVAC';
import { buildSMOAVAC } from '../../lib/pdf/buildSMOAVAC';
import { formatMinutes } from '../../lib/time';
import { isCloudURL } from '../../lib/storage/pdfStorage';
import InAppPDFViewer from '../../components/InAppPDFViewer';
import { createScopedLogger } from '../../lib/utils/logger';
import { OvertimeLog } from '../../types';

const debug = createScopedLogger('ExportPreview');

export default function ExportPreviewScreen() {
  const router = useRouter();
  const { logIds } = useLocalSearchParams<{ logIds?: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile } = useProfileStore();
  const { user } = useAuthStore();
  const { logs, getReadyLogs, batchExport, updateExportBatch, markBatchAsSubmitted } = useLogsStore();
  
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportBatch, setExportBatch] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'preview'>('summary');
  const [customName, setCustomName] = useState('');
  const [batchLogIds, setBatchLogIds] = useState<string[]>(() => {
    // Initialize from route params if available
    if (logIds && logIds.trim()) {
      return logIds.split(',').map(id => id.trim()).filter(id => id);
    }
    return [];
  });

  useEffect(() => {
    generatePDF();
  }, []);

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
            router.replace('/(tabs)/profile');
          }
        }
      ]
    );

    return false;
  };

  const generatePDF = async (regenerate = false) => {
    if (!profile) {
      setError('Profile not found');
      return;
    }

    if (!ensureProfileReadyForExport()) {
      setError('Profile details are required to generate PDFs');
      return;
    }

    // Get logs to export - either from params, existing batch, or all ready logs
    let readyLogs;
    if (regenerate && exportBatch) {
      // When regenerating, use stored log IDs or find by exportBatchId
      if (batchLogIds.length > 0) {
        readyLogs = logs.filter(log => batchLogIds.includes(log.id));
      } else {
        // Fallback: try to find logs by exportBatchId
        readyLogs = logs.filter(log => log.exportBatchId === exportBatch.id);
        // If still no logs, try logIds param
        if (readyLogs.length === 0 && logIds && logIds.trim()) {
          const logIdArray = logIds.split(',').map(id => id.trim()).filter(id => id);
          readyLogs = logs.filter(log => logIdArray.includes(log.id));
        }
      }
    } else if (logIds && logIds.trim()) {
      const logIdArray = logIds.split(',').map(id => id.trim()).filter(id => id);
      readyLogs = logs.filter(log => logIdArray.includes(log.id) && (log.status === 'ready' || log.status === 'exported'));
    } else {
      readyLogs = getReadyLogs();
    }

    if (readyLogs.length === 0) {
      // Only show error if not regenerating (to avoid showing error while typing custom name)
      if (!regenerate) {
        setError('No ready logs to export');
      } else {
        // When regenerating, if we can't find logs, just return silently
        // Don't set error or regenerate PDF
        debug.debug('No logs found for regeneration, skipping');
        return;
      }
      return;
    }

    // Expand shift swaps - include linked logs for shift swaps
    // Use a Set to track processed log IDs to prevent duplicates
    const processedLogIds = new Set<string>();
    const expandedLogs: OvertimeLog[] = [];
    
    for (const log of readyLogs) {
      // Skip if already processed
      if (processedLogIds.has(log.id)) {
        continue;
      }
      
      // If this is a leave group, handle all related logs together
      if (log.isLeave && log.leaveGroupId) {
        // Find all logs with the same leaveGroupId (excluding the current log to prevent duplicates)
        const relatedLeaveLogs = logs.filter(l => 
          l.leaveGroupId === log.leaveGroupId && 
          l.id !== log.id && // Exclude current log to prevent duplicate
          (l.status === 'ready' || l.status === 'exported') &&
          !processedLogIds.has(l.id)
        );
        
        // Combine current log with related logs and sort by date (earliest first)
        // Use a Set to ensure no duplicates by ID
        const allLeaveLogsMap = new Map<string, OvertimeLog>();
        allLeaveLogsMap.set(log.id, log);
        relatedLeaveLogs.forEach(l => allLeaveLogsMap.set(l.id, l));
        
        const allLeaveLogs = Array.from(allLeaveLogsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        
        // Add all leave logs to expanded logs
        expandedLogs.push(...allLeaveLogs);
        
        // Mark all as processed
        allLeaveLogs.forEach(l => processedLogIds.add(l.id));
        
        continue;
      }
      
      // If this is a shift swap, handle all related logs together
      if (log.isShiftSwap && log.shiftSwapId) {
        // Find all logs with the same shiftSwapId
        const swapLogs = logs.filter(l => 
          l.shiftSwapId === log.shiftSwapId && 
          (l.status === 'ready' || l.status === 'exported') &&
          !processedLogIds.has(l.id)
        );
        
        if (swapLogs.length > 0) {
          // Determine which logs are Person A (matches profile initials) and which are Person B
          const personALogs: OvertimeLog[] = [];
          const personBLogs: OvertimeLog[] = [];
          
          for (const swapLog of swapLogs) {
            const matchesProfile = swapLog.initials && profile.employeeInitial && 
                                  swapLog.initials.toUpperCase() === profile.employeeInitial.toUpperCase();
            if (matchesProfile) {
              personALogs.push(swapLog);
            } else {
              personBLogs.push(swapLog);
            }
          }
          
          // Sort Person A logs: Date 1 (rostered) first, then Date 2 (actual)
          personALogs.sort((a, b) => {
            // First sort by date
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            // If same date, rostered (actual='N/A') comes before actual (rostered='N/A')
            const aIsRostered = a.actualStart === 'N/A' && a.actualFinish === 'N/A';
            const bIsRostered = b.actualStart === 'N/A' && b.actualFinish === 'N/A';
            if (aIsRostered && !bIsRostered) return -1;
            if (!aIsRostered && bIsRostered) return 1;
            // If still same, sort by createdAt
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
          
          // Sort Person B logs: Date 2 (rostered) first, then Date 1 (actual)
          personBLogs.sort((a, b) => {
            // First sort by date (descending - Date 2 before Date 1)
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            // If same date, rostered (actual='N/A') comes before actual (rostered='N/A')
            const aIsRostered = a.actualStart === 'N/A' && a.actualFinish === 'N/A';
            const bIsRostered = b.actualStart === 'N/A' && b.actualFinish === 'N/A';
            if (aIsRostered && !bIsRostered) return -1;
            if (!aIsRostered && bIsRostered) return 1;
            // If still same, sort by createdAt
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
          
          // Add in order: Person A logs first, then Person B logs
          for (const personALog of personALogs) {
            expandedLogs.push(personALog);
            processedLogIds.add(personALog.id);
          }
          for (const personBLog of personBLogs) {
            expandedLogs.push(personBLog);
            processedLogIds.add(personBLog.id);
          }
        } else {
          // No related logs found, just add current log
          expandedLogs.push(log);
          processedLogIds.add(log.id);
        }
      } else if (log.isShiftSwap && log.linkedLogId) {
        // Fallback for 2-log swaps (same date)
        const linkedLog = logs.find(l => l.id === log.linkedLogId);
        if (linkedLog && (linkedLog.status === 'ready' || linkedLog.status === 'exported')) {
          // Determine which is Person A (matches profile initials) and which is Person B
          const logAMatchesProfile = log.initials && profile.employeeInitial && 
                                     log.initials.toUpperCase() === profile.employeeInitial.toUpperCase();
          const linkedLogMatchesProfile = linkedLog.initials && profile.employeeInitial && 
                                         linkedLog.initials.toUpperCase() === profile.employeeInitial.toUpperCase();
          
          // Person A should come first (row 1), Person B second (row 2)
          if (logAMatchesProfile) {
            // Current log is Person A, linked log is Person B
            expandedLogs.push(log);
            expandedLogs.push(linkedLog);
          } else if (linkedLogMatchesProfile) {
            // Linked log is Person A, current log is Person B
            expandedLogs.push(linkedLog);
            expandedLogs.push(log);
          } else {
            // Fallback: if we can't determine, add in original order
            expandedLogs.push(log);
            expandedLogs.push(linkedLog);
          }
          
          processedLogIds.add(log.id);
          processedLogIds.add(linkedLog.id);
        } else {
          // Linked log not found or not ready, just add current log
          expandedLogs.push(log);
          processedLogIds.add(log.id);
        }
      } else {
        // Not a shift swap, just add the log
        expandedLogs.push(log);
        processedLogIds.add(log.id);
      }
    }

    // Final deduplication by ID to ensure no duplicates
    const uniqueLogsMap = new Map<string, OvertimeLog>();
    for (const log of expandedLogs) {
      if (!uniqueLogsMap.has(log.id)) {
        uniqueLogsMap.set(log.id, log);
      }
    }
    const finalExpandedLogs = Array.from(uniqueLogsMap.values());

    // Validate logs (skip validation when regenerating to avoid errors while typing)
    if (!regenerate) {
      const validation = validateLogsForPDF(finalExpandedLogs);
      if (!validation.valid) {
        setError(validation.errors.join(', '));
        return;
      }
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate custom filename if provided
      const customFileName = customName.trim() ? `${customName.trim()}.pdf` : undefined;
      
      // Check if any logs are shift swaps - shift swaps must always use normal template
      const hasShiftSwaps = finalExpandedLogs.some(log => log.isShiftSwap);
      
      // Use SMO template if user is SMO and no shift swaps, otherwise use regular template
      // Shift swaps always require the normal template (SMO template doesn't support shift swaps)
      const pdfUri = hasShiftSwaps
        ? await buildAVAC(profile, finalExpandedLogs, customFileName)  // Force normal template for shift swaps
        : (profile.isSMO 
            ? await buildSMOAVAC(profile, finalExpandedLogs, customFileName)
            : await buildAVAC(profile, finalExpandedLogs, customFileName));
      setPdfUri(pdfUri);
      
      // Get userId for cloud upload
      const userId = user?.id;
      
      if (!regenerate) {
        // Store the log IDs used for this batch (include both logs in shift swaps)
        const logIdsForBatch = finalExpandedLogs.map(log => log.id);
        setBatchLogIds(logIdsForBatch);
        
        // Create export batch with custom name
        const batch = await batchExport(logIdsForBatch, pdfUri, userId);
        const batchWithCustomName = { ...batch, customName: customName.trim() || undefined };
        setExportBatch(batchWithCustomName);
        
        // Update the batch with the PDF URI and custom name
        const updatedBatch = { ...batchWithCustomName, pdfUri };
        await updateExportBatch(updatedBatch, userId);
        setExportBatch(updatedBatch);
        
        // Upload PDF to cloud storage in background (non-blocking)
        // The exportSync.uploadExportBatch will handle this, but we can also trigger it here
        // for immediate feedback
        if (userId) {
          exportSync.uploadExportBatch(updatedBatch, userId)
            .then(() => {
              debug.debug('PDF uploaded to cloud storage successfully');
            })
            .catch(err => {
              debug.error('PDF upload to cloud storage failed (non-fatal):', err);
            });
        }
      } else if (exportBatch) {
        // Update existing batch with new custom name and PDF URI
        const updatedBatch = { ...exportBatch, customName: customName.trim() || undefined, pdfUri };
        await updateExportBatch(updatedBatch, userId);
        setExportBatch(updatedBatch);
        
        // Upload PDF to cloud storage in background (non-blocking)
        if (userId) {
          exportSync.uploadExportBatch(updatedBatch, userId)
            .then(() => {
              debug.debug('PDF re-uploaded to cloud storage successfully');
            })
            .catch(err => {
              debug.error('PDF re-upload to cloud storage failed (non-fatal):', err);
            });
        }
      }
      
      debug.debug('PDF generated successfully:', pdfUri);
    } catch (error) {
      debug.error('PDF generation failed:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomNameChange = (text: string) => {
    setCustomName(text);
    // Just update the batch name without regenerating PDF immediately
    // This avoids errors and is more performant
    if (exportBatch) {
      const userId = user?.id;
      const updatedBatch = { ...exportBatch, customName: text.trim() || undefined };
      // Update optimistically in state
      setExportBatch(updatedBatch);
      // Update in database (fire and forget)
      updateExportBatch(updatedBatch, userId).catch(err => {
        debug.error('Failed to update batch name:', err);
        // Revert on error
        setExportBatch(exportBatch);
      });
    }
  };

  const handleShare = async () => {
    if (!pdfUri) return;

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share AVAC Form',
        });
        
        // Mark batch as submitted after sharing
        if (exportBatch) {
          await markBatchAsSubmitted(exportBatch.id, 'manual');
        }
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      debug.error('Sharing failed:', error);
      Alert.alert('Sharing Failed', 'Failed to share PDF. Please try again.');
    }
  };



  const getPDFInfo = async () => {
    if (!pdfUri) return null;

    // Only get info for local files, not cloud URLs
    if (isCloudURL(pdfUri)) {
      debug.debug('Skipping file info for cloud URL');
      return null;
    }

    // Check if it's a local file path
    if (!pdfUri.startsWith('file://') && !pdfUri.startsWith('/')) {
      debug.debug('Skipping file info for non-local file');
      return null;
    }

    try {
      const info = await getInfoAsync(pdfUri);
      return info;
    } catch (error) {
      debug.error('Failed to get PDF info:', error);
      return null;
    }
  };


  const renderPDFInfo = () => {
    if (!exportBatch) return null;

    const totalMinutes = exportBatch.totalMinutes;
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    return (
      <View style={[styles.infoCard, isDark && styles.darkCard]}>
        <Text style={[styles.infoTitle, isDark && styles.darkText]}>
          Export Summary
        </Text>
        
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, isDark && styles.darkText]}>
            Logs Included:
          </Text>
          <Text style={[styles.infoValue, isDark && styles.darkText]}>
            {exportBatch.countLogs}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, isDark && styles.darkText]}>
            Total Overtime:
          </Text>
          <Text style={[styles.infoValue, isDark && styles.darkText]}>
            {formatMinutes(totalMinutes)}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, isDark && styles.darkText]}>
            Generated:
          </Text>
          <Text style={[styles.infoValue, isDark && styles.darkText]}>
            {new Date(exportBatch.createdAt).toLocaleString('en-AU')}
          </Text>
        </View>
      </View>
    );
  };

  const renderActions = () => (
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.actionButton, styles.previewButton]}
        onPress={() => setViewMode('preview')}
      >
        <Ionicons name="eye" size={20} color="#fff" />
        <Text style={styles.actionButtonText}>Preview PDF</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.actionButton, styles.shareButton]}
        onPress={handleShare}
      >
        <Ionicons name="share" size={20} color="#fff" />
        <Text style={styles.actionButtonText}>Share PDF</Text>
      </TouchableOpacity>
    </View>
  );

  if (isGenerating) {
    return (
      <View style={[styles.container, styles.centerContent, isDark && styles.darkContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>
          Generating PDF...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent, isDark && styles.darkContainer]}>
        <Text style={[styles.errorTitle, isDark && styles.darkText]}>
          Export Failed
        </Text>
        <Text style={[styles.errorMessage, isDark && styles.darkText]}>
          {error}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => generatePDF()}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // If in preview mode, show the PDF viewer
  if (viewMode === 'preview' && pdfUri) {
    return (
      <InAppPDFViewer
        pdfUri={pdfUri}
        title="AVAC Form Preview"
        onClose={() => setViewMode('summary')}
      />
    );
  }

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Success Header */}
        <View style={[styles.header, isDark && styles.darkCard]}>
          <Text style={[styles.headerTitle, isDark && styles.darkText]}>
            PDF Generated Successfully
          </Text>
          <Text style={[styles.headerSubtitle, isDark && styles.darkText]}>
            Your AVAC form is ready to share or email.
          </Text>
        </View>

        {/* Custom Name Input */}
        <View style={[styles.nameInputCard, isDark && styles.darkCard]}>
          <Text style={[styles.nameInputLabel, isDark && styles.darkText]}>
            Export Name (Optional)
          </Text>
          <TextInput
            style={[styles.nameInput, isDark && styles.darkTextInput]}
            value={customName}
            onChangeText={handleCustomNameChange}
            placeholder="Enter a custom name for this export"
            placeholderTextColor={isDark ? '#666' : '#999'}
          />
          <Text style={[styles.nameInputHint, isDark && styles.darkText]}>
            This will be the filename when you share the PDF
          </Text>
        </View>

        {/* PDF Info */}
        {renderPDFInfo()}


        {/* Actions */}
        {renderActions()}

        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, isDark && styles.darkBackButton]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, isDark && styles.darkText]}>
            ← Back to Logs
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  content: {
    padding: 16,
  },
  header: {
    backgroundColor: '#e8f5e8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  darkCard: {
    backgroundColor: '#1a2e1a',
    borderColor: '#4CAF50',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  darkText: {
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#4CAF50',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actions: {
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    minWidth: 200,
  },
  previewButton: {
    backgroundColor: '#34C759',
  },
  shareButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  darkBackButton: {
    backgroundColor: '#007AFF',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff4444',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Custom name input styles
  nameInputCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  nameInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  darkTextInput: {
    borderColor: '#444',
    backgroundColor: '#2c2c2e',
    color: '#fff',
  },
  nameInputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
