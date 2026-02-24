import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { useLogsStore } from '../../lib/state/logsStore';
import { useProfileStore } from '../../lib/state/profileStore';
import { formatMinutes } from '../../lib/time';
import { sendAVACEmail } from '../../lib/email/emailService';
import { downloadPDFFromStorage, isCloudURL, isLocalPath } from '../../lib/storage/pdfStorage';
import { setClipboardWithAutoClear } from '../../lib/utils/clipboard';
import { getExportFileName, getExportDisplayName } from '../../lib/utils/exportFilename';
import InAppPDFViewer from '../../components/InAppPDFViewer';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('PDFViewer');

export default function PDFViewerScreen() {
  const router = useRouter();
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { exportBatches, markBatchAsSubmitted } = useLogsStore();
  const { profile } = useProfileStore();
  const [exportBatch, setExportBatch] = useState<any>(null);
  const [fileInfo, setFileInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'details'>('preview');
  const [localPdfUri, setLocalPdfUri] = useState<string | null>(null);
  const [emailDetails, setEmailDetails] = useState<{ recipientEmail: string; subject: string; body: string } | null>(null);

  useEffect(() => {
    if (batchId) {
      const batch = exportBatches.find(b => b.id === batchId);
      if (batch) {
        setExportBatch(batch);
        handlePDFUri(batch.pdfUri);
      }
    }
  }, [batchId, exportBatches]);

  const handlePDFUri = async (pdfUri: string) => {
    if (!pdfUri) return;
    
    let finalUri = pdfUri;
    
    // If it's a cloud URL, download to local cache first
    if (isCloudURL(pdfUri)) {
      try {
        setIsLoading(true);
        debug.debug('Downloading PDF from cloud storage...');
        // Get the preferred filename from export batch
        const preferredFileName = exportBatch ? getExportFileName(exportBatch, profile) : undefined;
        finalUri = await downloadPDFFromStorage(pdfUri, batchId || '', preferredFileName);
        setLocalPdfUri(finalUri);
        debug.debug('PDF downloaded to local cache:', finalUri);
      } catch (error) {
        debug.error('Failed to download PDF from cloud:', error);
        // Fallback to cloud URL if download fails
        finalUri = pdfUri;
      } finally {
        setIsLoading(false);
      }
    } else {
      // Local path - use directly
      setLocalPdfUri(finalUri);
    }
    
    // Load file info (only for local files)
    // Check if it's a local file path (starts with file://) and not a cloud URL
    if (finalUri && !isCloudURL(finalUri) && (finalUri.startsWith('file://') || finalUri.startsWith('/'))) {
      try {
        const { getInfoAsync } = await import('expo-file-system/legacy');
        const info = await getInfoAsync(finalUri);
        setFileInfo(info);
      } catch (error) {
        // Non-fatal error - just log it
        debug.error('Failed to get file info:', error);
      }
    } else {
      // Not a local file - skip file info
      debug.debug('Skipping file info for non-local file:', finalUri?.substring(0, 50));
    }
  };

  const handleViewPDF = async () => {
    let pdfUri = localPdfUri || exportBatch?.pdfUri;
    if (!pdfUri) {
      Alert.alert('Error', 'PDF file not found');
      return;
    }

    setIsLoading(true);
    try {
      // Ensure PDF is a local file path before sharing
      if (isCloudURL(pdfUri)) {
        try {
          const batchId = exportBatch?.id || pdfUri.split('/').pop()?.replace('.pdf', '') || 'unknown';
          debug.debug('Downloading PDF from cloud storage...');
          // Get the preferred filename from export batch
          const preferredFileName = exportBatch ? getExportFileName(exportBatch, profile) : undefined;
          pdfUri = await downloadPDFFromStorage(pdfUri, batchId, preferredFileName);
          debug.debug('PDF downloaded to local path:', pdfUri);
        } catch (downloadError) {
          debug.error('Failed to download PDF:', downloadError);
          Alert.alert('Error', 'Failed to download PDF file. Please check your connection and try again.');
          setIsLoading(false);
          return;
        }
      }
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'View AVAC Form',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      debug.error('Failed to open PDF:', error);
      Alert.alert('Error', 'Failed to open PDF. The file may have been deleted.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSharePDF = async () => {
    let pdfUri = localPdfUri || exportBatch?.pdfUri;
    if (!pdfUri) {
      Alert.alert('Error', 'PDF file not found');
      return;
    }

    setIsLoading(true);
    try {
      // Ensure PDF is a local file path before sharing
      if (isCloudURL(pdfUri)) {
        try {
          const batchId = exportBatch?.id || pdfUri.split('/').pop()?.replace('.pdf', '') || 'unknown';
          debug.debug('Downloading PDF from cloud storage...');
          // Get the preferred filename from export batch
          const preferredFileName = exportBatch ? getExportFileName(exportBatch, profile) : undefined;
          pdfUri = await downloadPDFFromStorage(pdfUri, batchId, preferredFileName);
          debug.debug('PDF downloaded to local path:', pdfUri);
        } catch (downloadError) {
          debug.error('Failed to download PDF:', downloadError);
          Alert.alert('Error', 'Failed to download PDF file. Please check your connection and try again.');
          setIsLoading(false);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitEmail = async () => {
    if (!profile) {
      Alert.alert('Profile Required', 'Please complete your profile before submitting AVAC forms.');
      return;
    }

    const pdfUri = localPdfUri || exportBatch?.pdfUri;
    if (!pdfUri) {
      Alert.alert('Error', 'PDF file not found');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendAVACEmail(profile, pdfUri, exportBatch);
      
      if (result.success && result.useAppleMail) {
        // Apple Mail method - everything is pre-filled with attachment
        await markBatchAsSubmitted(exportBatch.id, 'email');
        Alert.alert('Success', 'Email opened in Apple Mail with attachment and all details pre-filled. Please review and send.');
        setIsSubmitting(false);
      } else if (result.success && result.useShareSheet) {
        // Share sheet method - store email details for manual copy (recipient is optional)
        if (result.subject && result.body) {
          setEmailDetails({
            recipientEmail: result.recipientEmail || '',
            subject: result.subject,
            body: result.body,
          });
        }
        
        // Prepare alert message (recipient is optional)
        const emailDetailsText = result.recipientEmail 
          ? `To: ${result.recipientEmail}\n\nSubject: ${result.subject}\n\nUse the "Copy Email Details" button below to copy the email details to your clipboard, then select your email app (e.g., Outlook) and paste (Cmd+V) the details.`
          : `Subject: ${result.subject}\n\nUse the "Copy Email Details" button below to copy the email details to your clipboard, then select your email app (e.g., Outlook), choose your recipient, and paste (Cmd+V) the details.`;
        
        // Show alert with option to copy to clipboard
        Alert.alert(
          'Ready to Email',
          emailDetailsText,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => {
              setIsSubmitting(false);
              setEmailDetails(null);
            }},
            {
              text: 'Continue',
              onPress: async () => {
                try {
                  // Ensure PDF is a local file path before sharing
                  let localPdfPath = pdfUri;
                  if (isCloudURL(pdfUri)) {
                    try {
                      const batchId = exportBatch?.id || pdfUri.split('/').pop()?.replace('.pdf', '') || 'unknown';
                      debug.debug('Downloading PDF from cloud storage...');
                      // Get the preferred filename from export batch
                      const preferredFileName = exportBatch ? getExportFileName(exportBatch, profile) : undefined;
                      localPdfPath = await downloadPDFFromStorage(pdfUri, batchId, preferredFileName);
                      debug.debug('PDF downloaded to local path:', localPdfPath);
                    } catch (downloadError) {
                      debug.error('Failed to download PDF:', downloadError);
                      Alert.alert('Error', 'Failed to download PDF file. Please check your connection and try again.');
                      setIsSubmitting(false);
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
                    await markBatchAsSubmitted(exportBatch.id, 'email');
                  } else {
                    Alert.alert('Sharing not available', 'Sharing is not available on this device.');
                  }
                } catch (shareError) {
                  debug.error('Sharing failed:', shareError);
                  Alert.alert('Sharing Failed', 'Failed to share PDF. Please try again.');
                } finally {
                  setIsSubmitting(false);
                }
              }
            }
          ]
        );
      } else if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to get recipient information. Please try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      debug.error('Error submitting AVAC:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleCopyEmailDetails = async () => {
    if (!emailDetails) return;

    const clipboardText = `To: ${emailDetails.recipientEmail}\nSubject: ${emailDetails.subject}\n\n${emailDetails.body}`;
    
    try {
      await setClipboardWithAutoClear(clipboardText, 60000); // Auto-clear after 60 seconds
      Alert.alert('Copied', 'Email details copied to clipboard. They will be automatically cleared in 60 seconds.');
    } catch (error) {
      debug.error('Failed to copy to clipboard:', error);
      Alert.alert('Error', 'Failed to copy email details to clipboard. Please try again.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!exportBatch) {
    return (
      <View style={[styles.container, styles.centerContent, isDark && styles.darkContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>
          Loading PDF...
        </Text>
      </View>
    );
  }

  if (!exportBatch.pdfUri) {
    return (
      <View style={[styles.container, styles.centerContent, isDark && styles.darkContainer]}>
        <Ionicons name="document-text-outline" size={64} color="#ccc" />
        <Text style={[styles.errorTitle, isDark && styles.darkText]}>
          PDF Not Available
        </Text>
        <Text style={[styles.errorMessage, isDark && styles.darkText]}>
          The PDF file is no longer available.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalHours = Math.floor(exportBatch.totalMinutes / 60);
  const remainingMinutes = exportBatch.totalMinutes % 60;
  const createdDate = new Date(exportBatch.createdAt);
  
  // Get the shortened display name (without person's name)
  const displayName = getExportDisplayName(exportBatch, profile);

  // If in preview mode, show the PDF viewer
  if (viewMode === 'preview') {
    const pdfUri = localPdfUri || exportBatch.pdfUri;
    if (!pdfUri) {
      return (
        <View style={[styles.container, styles.centerContent, isDark && styles.darkContainer]}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.loadingText, isDark && styles.darkText]}>
            Loading PDF...
          </Text>
        </View>
      );
    }
    
    return (
      <InAppPDFViewer
        pdfUri={pdfUri}
        title={displayName}
        onClose={() => router.replace('/(tabs)/exports')}
      />
    );
  }

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Header */}
        <View style={[styles.header, isDark && styles.darkCard]}>
          <Text style={[styles.headerTitle, isDark && styles.darkText]}>
            {displayName}
          </Text>
          <Text style={[styles.headerSubtitle, isDark && styles.darkText]}>
            Generated on {createdDate.toLocaleDateString('en-AU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* PDF Preview Card */}
        <View style={[styles.previewCard, isDark && styles.darkCard]}>
          <Ionicons name="document-text" size={64} color="#007AFF" />
          <Text style={[styles.previewTitle, isDark && styles.darkText]}>
            AVAC Form PDF
          </Text>
          <Text style={[styles.previewSubtitle, isDark && styles.darkText]}>
            Tap to view or share your overtime form
          </Text>
          
          {fileInfo && (
            <View style={styles.fileInfo}>
              <Text style={[styles.fileInfoText, isDark && styles.darkText]}>
                Size: {formatFileSize(fileInfo.size)}
              </Text>
              <Text style={[styles.fileInfoText, isDark && styles.darkText]}>
                Modified: {new Date(fileInfo.modificationTime).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Export Details */}
        <View style={[styles.detailsCard, isDark && styles.darkCard]}>
          <Text style={[styles.detailsTitle, isDark && styles.darkText]}>
            Export Details
          </Text>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isDark && styles.darkText]}>
              Logs Included:
            </Text>
            <Text style={[styles.detailValue, isDark && styles.darkText]}>
              {exportBatch.countLogs}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isDark && styles.darkText]}>
              Total Overtime:
            </Text>
            <Text style={[styles.detailValue, isDark && styles.darkText]}>
              {formatMinutes(exportBatch.totalMinutes)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isDark && styles.darkText]}>
              Status:
            </Text>
            <Text style={[styles.detailValue, isDark && styles.darkText]}>
              {exportBatch.submittedAt 
                ? `Submitted via ${exportBatch.submittedVia || 'email'} on ${new Date(exportBatch.submittedAt).toLocaleDateString('en-AU')}`
                : 'Not submitted'
              }
            </Text>
          </View>
        </View>

        {/* Email Details Copy Button (shown when email details are available) */}
        {emailDetails && (
          <View style={[styles.emailDetailsCard, isDark && styles.darkCard]}>
            <Text style={[styles.emailDetailsTitle, isDark && styles.darkText]}>
              Email Details Ready
            </Text>
            <Text style={[styles.emailDetailsText, isDark && styles.darkText]}>
              To: {emailDetails.recipientEmail}
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, styles.copyButton]}
              onPress={handleCopyEmailDetails}
            >
              <Ionicons name="copy-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Copy Email Details</Text>
            </TouchableOpacity>
            <Text style={[styles.emailDetailsHint, isDark && styles.darkText]}>
              Clipboard will be cleared automatically after 60 seconds
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => setViewMode('preview')}
          >
            <Ionicons name="eye" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Preview PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.submitButton]}
            onPress={handleSubmitEmail}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="mail" size={20} color="#fff" />
            )}
            <Text style={styles.actionButtonText}>Submit via Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={handleSharePDF}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="share" size={20} color="#fff" />
            )}
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, isDark && styles.darkBackButton]}
          onPress={() => router.replace('/(tabs)/exports')}
        >
          <Text style={[styles.backButtonText, isDark && styles.darkText]}>
            ← Back to Exports
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
  darkCard: {
    backgroundColor: '#1c1c1e',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  darkText: {
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  previewSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  fileInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    width: '100%',
  },
  fileInfoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  detailsCard: {
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
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actions: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  viewButton: {
    backgroundColor: '#007AFF',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  shareButton: {
    backgroundColor: '#34C759',
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
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emailDetailsCard: {
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
  emailDetailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emailDetailsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  emailDetailsHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  copyButton: {
    backgroundColor: '#007AFF',
  },
});
