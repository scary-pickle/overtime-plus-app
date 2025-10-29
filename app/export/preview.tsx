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
import { useRouter } from 'expo-router';
import { getInfoAsync } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../lib/state/profileStore';
import { useLogsStore } from '../../lib/state/logsStore';
import { buildAVAC, validateLogsForPDF } from '../../lib/pdf/buildAVAC';
import { formatMinutes } from '../../lib/time';
import InAppPDFViewer from '../../components/InAppPDFViewer';

export default function ExportPreviewScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile } = useProfileStore();
  const { logs, getReadyLogs, batchExport, updateExportBatch } = useLogsStore();
  
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportBatch, setExportBatch] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'preview'>('summary');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    generatePDF();
  }, []);

  const generatePDF = async (regenerate = false) => {
    if (!profile) {
      setError('Profile not found');
      return;
    }

    const readyLogs = getReadyLogs();
    if (readyLogs.length === 0) {
      setError('No ready logs to export');
      return;
    }

    // Validate logs
    const validation = validateLogsForPDF(readyLogs);
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate custom filename if provided
      const customFileName = customName.trim() ? `${customName.trim()}.pdf` : undefined;
      const pdfUri = await buildAVAC(profile, readyLogs, customFileName);
      setPdfUri(pdfUri);
      
      if (!regenerate) {
        // Create export batch with custom name
        const batch = await batchExport(readyLogs.map(log => log.id));
        const batchWithCustomName = { ...batch, customName: customName.trim() || undefined };
        setExportBatch(batchWithCustomName);
        
        // Update the batch with the PDF URI and custom name
        const updatedBatch = { ...batchWithCustomName, pdfUri };
        await updateExportBatch(updatedBatch);
        setExportBatch(updatedBatch);
      } else if (exportBatch) {
        // Update existing batch with new custom name and PDF URI
        const updatedBatch = { ...exportBatch, customName: customName.trim() || undefined, pdfUri };
        await updateExportBatch(updatedBatch);
        setExportBatch(updatedBatch);
      }
      
      console.log('PDF generated successfully:', pdfUri);
    } catch (error) {
      console.error('PDF generation failed:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomNameChange = (text: string) => {
    setCustomName(text);
    // Regenerate PDF if it already exists
    if (pdfUri && exportBatch) {
      generatePDF(true);
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
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Sharing failed:', error);
      Alert.alert('Sharing Failed', 'Failed to share PDF. Please try again.');
    }
  };



  const getPDFInfo = async () => {
    if (!pdfUri) return null;

    try {
      const info = await getInfoAsync(pdfUri);
      return info;
    } catch (error) {
      console.error('Failed to get PDF info:', error);
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
          onPress={generatePDF}
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
    <ScrollView style={[styles.container, isDark && styles.darkContainer]}>
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
