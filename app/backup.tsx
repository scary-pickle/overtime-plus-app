import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { database } from '../lib/db/sqlite';
import { useLocalUserStore } from '../lib/state/localUserStore';
import { useLogsStore } from '../lib/state/logsStore';
import { useShiftsStore } from '../lib/state/shiftsStore';
import { useTemplatesStore } from '../lib/state/templatesStore';
import { useShiftTemplatesStore } from '../lib/state/shiftTemplatesStore';
import { createScopedLogger } from '../lib/utils/logger';

const debug = createScopedLogger('backup');

const BACKUP_VERSION = 1;

interface BackupData {
  version: number;
  exportedAt: string;
  data: {
    usualShifts: any[];
    overtimeLogs: any[];
    exportBatches: any[];
    logTemplates: any[];
    shiftTemplates: any[];
  };
}

export default function BackupScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { localUserId } = useLocalUserStore();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await database.exportAllData(localUserId || null);
      const backup: BackupData = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        data,
      };

      const json = JSON.stringify(backup, null, 2);
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `overtime-plus-backup-${dateStr}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, json, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Save Backup File',
      });

      debug.debug('Backup exported successfully');
    } catch (error) {
      debug.error('Export failed:', error);
      Alert.alert('Export Failed', 'Could not create backup file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const jsonText = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });

      let backup: BackupData;
      try {
        backup = JSON.parse(jsonText);
      } catch {
        Alert.alert('Invalid File', 'The selected file is not a valid backup file.');
        return;
      }

      if (backup.version !== BACKUP_VERSION) {
        Alert.alert('Incompatible Backup', `This backup was created with a different version (v${backup.version}) and cannot be imported.`);
        return;
      }

      const { data } = backup;
      if (!data || typeof data !== 'object') {
        Alert.alert('Invalid File', 'The backup file is missing required data.');
        return;
      }

      const counts = {
        logs: (data.overtimeLogs || []).length,
        shifts: (data.usualShifts || []).length,
        templates: (data.logTemplates || []).length,
        shiftTemplates: (data.shiftTemplates || []).length,
        batches: (data.exportBatches || []).length,
      };

      Alert.alert(
        'Import Backup?',
        `This will replace all current data with:\n\n• ${counts.logs} overtime logs\n• ${counts.shifts} shift patterns\n• ${counts.templates} log templates\n• ${counts.shiftTemplates} shift templates\n• ${counts.batches} export batches\n\nExported: ${new Date(backup.exportedAt).toLocaleDateString()}\n\nThis cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: () => performImport(backup.data),
          },
        ]
      );
    } catch (error) {
      debug.error('Import failed:', error);
      Alert.alert('Import Failed', 'Could not read the selected file. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const performImport = async (data: BackupData['data']) => {
    setIsImporting(true);
    try {
      await database.importAllData(data);

      // Reload all stores from SQLite
      await Promise.all([
        useLogsStore.getState().loadLogs(localUserId || null),
        useLogsStore.getState().loadExportBatches(localUserId || null),
        useShiftsStore.getState().loadShifts(localUserId || null),
        useTemplatesStore.getState().loadTemplates(localUserId || null),
        useShiftTemplatesStore.getState().loadTemplates(localUserId || null),
      ]);

      Alert.alert('Import Successful', 'Your data has been restored from the backup.', [
        { text: 'OK', onPress: () => router.back() },
      ]);

      debug.debug('Import completed successfully');
    } catch (error) {
      debug.error('Import failed:', error);
      Alert.alert('Import Failed', 'Could not restore data. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={[styles.backText, isDark && styles.textDark]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, isDark && styles.textDark]}>Backup & Restore</Text>
      <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
        Export your data as a JSON file to keep a local backup, or restore from a previous backup.
      </Text>

      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.cardTitle, isDark && styles.textDark]}>Export Backup</Text>
        <Text style={[styles.cardDescription, isDark && styles.subtitleDark]}>
          Save all your logs, shifts, and templates to a JSON file you can store anywhere.
        </Text>
        <TouchableOpacity
          style={[styles.button, styles.exportButton]}
          onPress={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Export Backup</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.cardTitle, isDark && styles.textDark]}>Restore from Backup</Text>
        <Text style={[styles.cardDescription, isDark && styles.subtitleDark]}>
          Replace all current data with data from a previously exported backup file.
        </Text>
        <View style={[styles.warningRow]}>
          <Text style={styles.warningText}>⚠️ This will overwrite all existing data.</Text>
        </View>
        <TouchableOpacity
          style={[styles.button, styles.importButton]}
          onPress={handleImport}
          disabled={isImporting}
        >
          {isImporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Choose Backup File</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#000',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: '#333',
  },
  textDark: {
    color: '#fff',
  },
  subtitleDark: {
    color: '#AAA',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 32,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  cardDark: {
    backgroundColor: '#1A1A1A',
    borderColor: '#333',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  warningRow: {
    marginBottom: 12,
  },
  warningText: {
    fontSize: 13,
    color: '#CC6600',
    fontWeight: '600',
  },
  button: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  exportButton: {
    backgroundColor: '#0066CC',
  },
  importButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
