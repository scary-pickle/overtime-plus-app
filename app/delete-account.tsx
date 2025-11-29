import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../lib/state/authStore';

const CONFIRMATION_TEXT = 'DELETE';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, deleteAccount, isDeletingAccount, error } = useAuthStore();
  const [confirmation, setConfirmation] = useState('');

  const canSubmit = confirmation.trim().toUpperCase() === CONFIRMATION_TEXT && !isDeletingAccount;

  const handleDelete = () => {
    Alert.alert(
      'Delete account?',
      'This will permanently delete your account, all Supabase-stored data (logs, shifts, exports, attachments), local data on this device, and disconnect any subscriptions. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              Alert.alert(
                'Account deleted',
                'Your account and saved data have been deleted.',
                [{ text: 'OK', onPress: () => router.replace('/auth/welcome') }],
              );
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete account. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.title, isDark && styles.darkText]}>Delete Account</Text>
      </View>

      <View style={[styles.card, isDark && styles.darkCard]}>
        <View style={styles.iconRow}>
          <View style={[styles.iconCircle, isDark && styles.darkIconCircle]}>
            <Ionicons name="warning-outline" size={24} color="#ef4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, isDark && styles.darkText]}>This cannot be undone</Text>
            <Text style={[styles.cardCopy, isDark && styles.darkSubtitle]}>
              Deleting your account will remove:
            </Text>
            <View style={styles.list}>
              <Text style={[styles.listItem, isDark && styles.darkText]}>
                • Profile, roster, logs, shifts, and export batches stored in Supabase
              </Text>
              <Text style={[styles.listItem, isDark && styles.darkText]}>
                • Files stored in Supabase Storage (attachments, exported PDFs)
              </Text>
              <Text style={[styles.listItem, isDark && styles.darkText]}>
                • RevenueCat subscription linkage and entitlements
              </Text>
              <Text style={[styles.listItem, isDark && styles.darkText]}>
                • Local data and cached sessions on this device
              </Text>
            </View>
          </View>
        </View>
        {user?.email && (
          <Text style={[styles.meta, isDark && styles.darkSubtitle]}>
            Signed in as {user.email}
          </Text>
        )}
      </View>

      <View style={[styles.card, isDark && styles.darkCard]}>
        <Text style={[styles.label, isDark && styles.darkText]}>
          Type "{CONFIRMATION_TEXT}" to confirm
        </Text>
        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={CONFIRMATION_TEXT}
          placeholderTextColor={isDark ? '#666' : '#999'}
          autoCapitalize="characters"
          style={[styles.input, isDark && styles.darkInput]}
        />
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
        <TouchableOpacity
          style={[
            styles.deleteButton,
            (!canSubmit) && styles.deleteButtonDisabled,
          ]}
          disabled={!canSubmit}
          onPress={handleDelete}
          activeOpacity={0.85}
        >
          {isDeletingAccount ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.deleteButtonText}>Delete my account</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
  },
  darkText: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 2,
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
  },
  iconRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkIconCircle: {
    backgroundColor: '#2a1212',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardCopy: {
    color: '#555',
    marginBottom: 8,
  },
  darkSubtitle: {
    color: '#aaa',
  },
  list: {
    marginTop: 4,
    gap: 4,
  },
  listItem: {
    color: '#333',
    fontSize: 14,
  },
  meta: {
    marginTop: 12,
    color: '#666',
    fontSize: 13,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#111',
  },
  darkInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#444',
    color: '#fff',
  },
  deleteButton: {
    marginTop: 16,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  errorText: {
    color: '#dc2626',
    marginTop: 10,
  },
});
