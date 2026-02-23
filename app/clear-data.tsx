import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearTestData, checkDataExists } from '../lib/clearTestData';
import { useLogsStore } from '../lib/state/logsStore';
import { useShiftsStore } from '../lib/state/shiftsStore';
import { useLocalUserStore } from '../lib/state/localUserStore';

export default function ClearDataScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const { localUserId } = useLocalUserStore();
  const { loadLogs } = useLogsStore();
  const { loadShifts } = useShiftsStore();
  
  const [isClearing, setIsClearing] = useState(false);
  const [dataStatus, setDataStatus] = useState<{
    logs: number;
    shifts: number;
    batches: number;
  } | null>(null);

  const handleCheckData = async () => {
    const status = await checkDataExists();
    setDataStatus(status);
  };

  const handleClearData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all logs, shifts, and export batches. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              const success = await clearTestData();
              if (success) {
                // Reload data in stores
                await Promise.all([
                  loadLogs(localUserId),
                  loadShifts(localUserId),
                ]);
                
                // Check data status again
                await handleCheckData();
                
                Alert.alert(
                  'Success',
                  'All test data has been cleared. Your app now has clean data.',
                  [{ text: 'OK', onPress: () => router.back() }]
                );
              } else {
                Alert.alert('Error', 'Failed to clear data. Please try again.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            } finally {
              setIsClearing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Header */}
        <View style={[styles.header, isDark && styles.darkCard, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text style={[styles.title, isDark && styles.darkText]}>Clear Test Data</Text>
        </View>

        {/* Info Section */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color="#007AFF" />
            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
              About This Tool
            </Text>
          </View>
          <Text style={[styles.infoText, isDark && styles.darkText]}>
            This tool will remove all test data from your app, including:
          </Text>
          <View style={styles.list}>
            <Text style={[styles.listItem, isDark && styles.darkText]}>• All overtime logs</Text>
            <Text style={[styles.listItem, isDark && styles.darkText]}>• All shift patterns</Text>
            <Text style={[styles.listItem, isDark && styles.darkText]}>• All export batches</Text>
          </View>
          <Text style={[styles.warningText, isDark && styles.darkText]}>
            ⚠️ This action cannot be undone. Make sure you don't have any important data you want to keep.
          </Text>
        </View>

        {/* Data Status */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Current Data Status
          </Text>
          <TouchableOpacity
            style={[styles.checkButton, isDark && styles.darkButton]}
            onPress={handleCheckData}
          >
            <Ionicons name="refresh" size={20} color={isDark ? '#fff' : '#007AFF'} />
            <Text style={[styles.checkButtonText, isDark && styles.darkButtonText]}>
              Check Data Status
            </Text>
          </TouchableOpacity>
          
          {dataStatus && (
            <View style={styles.statusContainer}>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, isDark && styles.darkText]}>Logs:</Text>
                <Text style={[styles.statusValue, isDark && styles.darkText]}>{dataStatus.logs}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, isDark && styles.darkText]}>Shifts:</Text>
                <Text style={[styles.statusValue, isDark && styles.darkText]}>{dataStatus.shifts}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, isDark && styles.darkText]}>Export Batches:</Text>
                <Text style={[styles.statusValue, isDark && styles.darkText]}>{dataStatus.batches}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Clear Button */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <TouchableOpacity
            style={[
              styles.clearButton,
              isClearing && styles.clearButtonDisabled,
              isDark && styles.darkClearButton
            ]}
            onPress={handleClearData}
            disabled={isClearing}
          >
            <Ionicons 
              name={isClearing ? "hourglass" : "trash"} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.clearButtonText}>
              {isClearing ? 'Clearing Data...' : 'Clear All Test Data'}
            </Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#1c1c1e',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 12,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
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
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  list: {
    marginBottom: 12,
  },
  listItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#ff6b35',
    fontWeight: '500',
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginBottom: 16,
  },
  darkButton: {
    backgroundColor: '#1a1a2e',
    borderColor: '#007AFF',
  },
  checkButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  darkButtonText: {
    color: '#007AFF',
  },
  statusContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3b30',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  clearButtonDisabled: {
    backgroundColor: '#ff9999',
  },
  darkClearButton: {
    backgroundColor: '#ff3b30',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  darkText: {
    color: '#fff',
  },
});
