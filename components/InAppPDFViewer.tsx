import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { EncodingType } from 'expo-file-system/legacy';

interface InAppPDFViewerProps {
  pdfUri: string;
  title?: string;
  onClose?: () => void;
}

export default function InAppPDFViewer({ pdfUri, title = 'PDF Viewer', onClose }: InAppPDFViewerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<any>(null);

  React.useEffect(() => {
    loadFileInfo();
  }, [pdfUri]);

  const loadFileInfo = async () => {
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setError('Failed to load PDF. The file may be corrupted or in an unsupported format.');
    setIsLoading(false);
  };

  const handleWebViewLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  // Create a data URL for the PDF
  const getPDFDataUrl = async () => {
    try {
      const base64 = await FileSystem.readAsStringAsync(pdfUri, {
        encoding: EncodingType.Base64,
      });
      return `data:application/pdf;base64,${base64}`;
    } catch (error) {
      console.error('Failed to read PDF as base64:', error);
      // Fallback: try using the file URI directly
      return pdfUri;
    }
  };

  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);

  React.useEffect(() => {
    const loadPDF = async () => {
      try {
        // First try to use the file URI directly
        setPdfDataUrl(pdfUri);
        setIsLoading(false);
      } catch (error) {
        setError('Failed to load PDF file');
        setIsLoading(false);
      }
    };
    loadPDF();
  }, [pdfUri]);

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent, isDark && styles.darkContainer]}>
        <Ionicons name="document-text-outline" size={64} color="#ff4444" />
        <Text style={[styles.errorTitle, isDark && styles.darkText]}>
          Failed to Load PDF
        </Text>
        <Text style={[styles.errorMessage, isDark && styles.darkText]}>
          {error}
        </Text>
        {onClose && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.darkHeader]}>
        <Text style={[styles.title, isDark && styles.darkText]}>{title}</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        )}
      </View>

      {/* File Info */}
      {fileInfo && (
        <View style={[styles.fileInfoBar, isDark && styles.darkFileInfoBar]}>
          <Text style={[styles.fileInfoText, isDark && styles.darkText]}>
            Size: {formatFileSize(fileInfo.size)}
          </Text>
          <Text style={[styles.fileInfoText, isDark && styles.darkText]}>
            Modified: {new Date(fileInfo.modificationTime).toLocaleDateString()}
          </Text>
        </View>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.loadingText, isDark && styles.darkText]}>
            Loading PDF...
          </Text>
        </View>
      )}

      {/* PDF WebView */}
      {pdfDataUrl && (
        <WebView
          source={{ uri: pdfDataUrl }}
          style={styles.webview}
          onError={handleWebViewError}
          onLoad={handleWebViewLoad}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={[styles.loadingText, isDark && styles.darkText]}>
                Loading PDF...
              </Text>
            </View>
          )}
          // Enable PDF viewing features
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          // Add user agent to help with PDF rendering
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
          // Enable file access for local PDFs
          originWhitelist={['*']}
          allowsBackForwardNavigationGestures={true}
        />
      )}
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
    flex: 1,
  },
  darkText: {
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  fileInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  darkFileInfoBar: {
    backgroundColor: '#1c1c1e',
    borderBottomColor: '#333',
  },
  fileInfoText: {
    fontSize: 12,
    color: '#666',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1,
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
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
