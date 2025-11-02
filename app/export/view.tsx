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
import InAppPDFViewer from '../../components/InAppPDFViewer';

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

  useEffect(() => {
    if (batchId) {
      const batch = exportBatches.find(b => b.id === batchId);
      if (batch) {
        setExportBatch(batch);
        loadFileInfo(batch.pdfUri);
      }
    }
  }, [batchId, exportBatches]);

  const loadFileInfo = async (pdfUri: string) => {
    if (!pdfUri) return;
    
    try {
      // Use the legacy API for now to avoid deprecation issues
      const { getInfoAsync } = await import('expo-file-system/legacy');
      const info = await getInfoAsync(pdfUri);
      setFileInfo(info);
    } catch (error) {
      console.error('Failed to get file info:', error);
    }
  };

  const handleViewPDF = async () => {
    if (!exportBatch?.pdfUri) {
      Alert.alert('Error', 'PDF file not found');
      return;
    }

    setIsLoading(true);
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(exportBatch.pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'View AVAC Form',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Failed to open PDF:', error);
      Alert.alert('Error', 'Failed to open PDF. The file may have been deleted.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSharePDF = async () => {
    if (!exportBatch?.pdfUri) {
      Alert.alert('Error', 'PDF file not found');
      return;
    }

    setIsLoading(true);
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(exportBatch.pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share AVAC Form',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Sharing failed:', error);
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

    if (!profile.email) {
      Alert.alert('Email Required', 'Please add your email address in Settings before submitting AVAC forms.');
      return;
    }

    if (!exportBatch?.pdfUri) {
      Alert.alert('Error', 'PDF file not found');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendAVACEmail(profile, exportBatch.pdfUri, exportBatch);
      
      if (result.success && result.useAppleMail) {
        // Apple Mail method - everything is pre-filled with attachment
        await markBatchAsSubmitted(exportBatch.id, 'email');
        Alert.alert('Success', 'Email opened in Apple Mail with attachment and all details pre-filled. Please review and send.');
        setIsSubmitting(false);
      } else if (result.success && result.useShareSheet) {
        // Share sheet method - copy info to clipboard and open share sheet
        const clipboardText = `To: ${result.recipientEmail}\nSubject: ${result.subject}\n\n${result.body}`;
        await Clipboard.setStringAsync(clipboardText);
        
        // Show brief notification then open share sheet
        Alert.alert(
          'Ready to Email',
          `✓ Email details copied to clipboard\n\nTo: ${result.recipientEmail}\n\nNext: Select your email app (e.g., Outlook), then paste (Cmd+V) the email details.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setIsSubmitting(false) },
            {
              text: 'Continue',
              onPress: async () => {
                try {
                  // Open share sheet with PDF attachment
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(exportBatch.pdfUri, {
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
                  console.error('Sharing failed:', shareError);
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
      console.error('Error submitting AVAC:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
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

  // If in preview mode, show the PDF viewer
  if (viewMode === 'preview') {
    return (
      <InAppPDFViewer
        pdfUri={exportBatch.pdfUri}
        title={`Export #${exportBatch.id.split('_')[1]}`}
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
            Export #{exportBatch.id.split('_')[1]}
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
});
