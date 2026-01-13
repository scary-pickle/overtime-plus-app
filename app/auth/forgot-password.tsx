import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, StyleSheet, useColorScheme } from 'react-native';
import { useAuthStore } from '../../lib/state/authStore';
import { getRedirectUri } from '../../lib/auth/deeplinks';

export default function ForgotPassword() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { clearError, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    clearError();
    setStatus(null);
    setLoading(true);
    try {
      const redirectTo = getRedirectUri();
      // @ts-ignore
      const { error: err } = await (require('../../lib/supabase').supabase as any).auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (err) throw err;
      setStatus('Check your email for a reset link.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to request reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, isDark && styles.darkTitle]}>Reset password</Text>
          <Text style={[styles.subtitle, isDark && styles.darkSubtitle]}>We'll email you a reset link</Text>
        </View>
        <View style={[styles.card, isDark && styles.darkCard]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {status ? <Text style={[styles.status, isDark && styles.darkStatus]}>{status}</Text> : null}
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@health.qld.gov.au"
              placeholderTextColor={isDark ? '#666' : '#999'}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus={true}
              style={[styles.input, isDark && styles.darkInput]}
            />
          </View>
          <TouchableOpacity
            onPress={onSubmit}
            disabled={loading}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send reset link'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
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
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  darkTitle: {
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  darkSubtitle: {
    color: '#aaa',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
    shadowOpacity: 0.3,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  darkLabel: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  darkInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#444',
    color: '#fff',
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
  },
  status: {
    color: '#0f172a',
    fontSize: 14,
  },
  darkStatus: {
    color: '#d1d5db',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});


