import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Paths, deleteAsync } from 'expo-file-system';
import { database } from '../lib/db/sqlite';
import { useOnboardingStore } from '../lib/state/onboardingStore';
import { useLocalUserStore } from '../lib/state/localUserStore';
import { createScopedLogger } from '../lib/utils/logger';

const debug = createScopedLogger('reset-app');

const CONFIRM_PHRASE = 'RESET';

export default function ResetAppScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const { localUserId } = useLocalUserStore();
  const { resetOnboarding } = useOnboardingStore();

  const isConfirmed = confirmText === CONFIRM_PHRASE;

  const handleReset = async () => {
    if (!isConfirmed) return;

    Alert.alert(
      'Are you sure?',
      'This will permanently delete all your data from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: performReset,
        },
      ]
    );
  };

  const performReset = async () => {
    setIsResetting(true);
    try {
      // 1. Clear all SQLite data
      await database.clearAllUserData();
      debug.debug('Cleared all SQLite data');

      // 2. Delete PDF cache directory
      try {
        const cacheDir = Paths?.cache?.uri;
        if (cacheDir) {
          await deleteAsync(cacheDir, { idempotent: true });
          debug.debug('Cleared PDF cache');
        }
      } catch (cacheError) {
        debug.warn('Failed to clear cache (non-fatal):', cacheError);
      }

      // 3. Delete all SecureStore keys
      const secureKeys = [
        'overtime_plus_local_user_id',
        'overtime_plus_onboarding_complete',
        localUserId ? `overtime_plus_onboarding_complete_${localUserId}` : null,
        'overtime_plus_profile',
        localUserId ? `overtime_plus_profile_${localUserId}` : null,
      ].filter(Boolean) as string[];

      for (const key of secureKeys) {
        await SecureStore.deleteItemAsync(key).catch(() => {});
      }
      debug.debug('Cleared SecureStore');

      // 4. Reset onboarding state
      await resetOnboarding(localUserId);

      // 5. Navigate back to onboarding
      router.replace('/onboarding/welcome');
    } catch (error) {
      debug.error('Reset failed:', error);
      Alert.alert('Error', 'Reset failed. Please try again.');
    } finally {
      setIsResetting(false);
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

      <Text style={[styles.title, isDark && styles.textDark]}>Reset App</Text>

      <View style={[styles.warningBox, isDark && styles.warningBoxDark]}>
        <Text style={styles.warningTitle}>⚠️ Warning</Text>
        <Text style={styles.warningText}>
          This will permanently delete all your data from this device, including:
        </Text>
        <Text style={styles.warningBullet}>• All overtime logs</Text>
        <Text style={styles.warningBullet}>• All shift patterns</Text>
        <Text style={styles.warningBullet}>• All templates</Text>
        <Text style={styles.warningBullet}>• All export history</Text>
        <Text style={styles.warningBullet}>• Your profile</Text>
        <Text style={[styles.warningText, styles.warningBold]}>
          This cannot be undone.
        </Text>
      </View>

      <Text style={[styles.label, isDark && styles.textDark]}>
        Type <Text style={styles.confirmPhrase}>RESET</Text> to confirm
      </Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        value={confirmText}
        onChangeText={setConfirmText}
        placeholder="Type RESET here"
        placeholderTextColor={isDark ? '#666' : '#999'}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.resetButton, !isConfirmed && styles.resetButtonDisabled]}
        onPress={handleReset}
        disabled={!isConfirmed || isResetting}
      >
        {isResetting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.resetButtonText}>Delete All Data</Text>
        )}
      </TouchableOpacity>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 24,
  },
  warningBox: {
    backgroundColor: '#FFF3F3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  warningBoxDark: {
    backgroundColor: '#2A0000',
    borderColor: '#660000',
  },
  warningTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#CC0000',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#CC0000',
    marginBottom: 6,
  },
  warningBullet: {
    fontSize: 14,
    color: '#CC0000',
    marginLeft: 8,
    marginBottom: 2,
  },
  warningBold: {
    fontWeight: '700',
    marginTop: 8,
  },
  label: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  confirmPhrase: {
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#F8F8F8',
    marginBottom: 24,
    letterSpacing: 2,
  },
  inputDark: {
    borderColor: '#444',
    color: '#fff',
    backgroundColor: '#1A1A1A',
  },
  resetButton: {
    backgroundColor: '#CC0000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  resetButtonDisabled: {
    backgroundColor: '#E88',
    opacity: 0.5,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
