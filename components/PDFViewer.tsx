import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { getInfoAsync } from 'expo-file-system';

interface PDFViewerProps {
  pdfUri: string;
  title?: string;
  onClose?: () => void;
}

export default function PDFViewer({ pdfUri, title = 'PDF Viewer', onClose }: PDFViewerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isLoading, setIsLoading] = useState(false);
  const [fileInfo, setFileInfo] = useState<any>(null);

  const handleViewPDF = async () => {
    if (!pdfUri) {
      Alert.alert('Error', 'PDF file not found');
      return;
    }

    setIsLoading(true);
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: title,
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
    if (!pdfUri) {
      Alert.alert('Error', 'PDF file not found');
      return;
    }

    setIsLoading(true);
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share PDF',
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

  const loadFileInfo = async () => {
    if (!pdfUri || fileInfo) return;
    
    try {
      const info = await getInfoAsync(pdfUri);
      setFileInfo(info);
    } catch (error) {
      console.error('Failed to get file info:', error);
    }
  };

  React.useEffect(() => {
    loadFileInfo();
  }, [pdfUri]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <View style={[styles.header, isDark && styles.darkHeader]}>
        <Text style={[styles.title, isDark && styles.darkText]}>{title}</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.content, isDark && styles.darkContent]}>
        <View style={[styles.previewCard, isDark && styles.darkCard]}>
          <Ionicons name="document-text" size={64} color="#007AFF" />
          <Text style={[styles.previewTitle, isDark && styles.darkText]}>
            PDF Document
          </Text>
          <Text style={[styles.previewSubtitle, isDark && styles.darkText]}>
            Tap to view or share
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

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={handleViewPDF}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="eye" size={20} color="#fff" />
            )}
            <Text style={styles.actionButtonText}>View PDF</Text>
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
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  darkHeader: {
    backgroundColor: '#1c1c1e',
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  darkContent: {
    backgroundColor: '#000',
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
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
  actions: {
    gap: 12,
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
  shareButton: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
