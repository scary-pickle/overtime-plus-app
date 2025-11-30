import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, StyleSheet, useColorScheme, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';
import { isAllowedDomain, isValidEmail, validatePasswordStrength } from '../../lib/auth/validation';

import { createScopedLogger } from '../../lib/utils/logger';

const { debug } = createScopedLogger('SignUp');

export default function SignUp() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { signUp, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const onSubmit = async () => {
    debug('[sign-up] submit tapped');
    clearError();
    setLocalError(null);
    const e = email.trim();
    if (!isValidEmail(e)) {
      debug('[sign-up] invalid email');
      return setLocalError('Enter a valid email');
    }
    if (!isAllowedDomain(e)) {
      debug('[sign-up] domain not allowed');
      return setLocalError('Only @health.qld.gov.au emails are allowed');
    }
    if (password !== confirm) {
      debug('[sign-up] password mismatch');
      return setLocalError('Passwords do not match');
    }
    const pw = validatePasswordStrength(password);
    if (!pw.valid) {
      debug('[sign-up] weak password', { issues: pw.errors });
      return setLocalError(`Password: ${pw.errors.join(', ')}`);
    }
    debug('[sign-up] calling store.signUp');
    const ok = await signUp(e, password);
    debug('[sign-up] store.signUp returned', { ok });
    if (ok) router.replace('/auth/verify-email');
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={[styles.title, isDark && styles.darkTitle]}>Create your account</Text>
              <Text style={[styles.subtitle, isDark && styles.darkSubtitle]}>Use your @health.qld.gov.au email</Text>
            </View>
            <View style={[styles.card, isDark && styles.darkCard]}>
              {localError ? <Text style={styles.error}>{localError}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.field}>
                <Text style={[styles.label, isDark && styles.darkLabel]}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@health.qld.gov.au"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, isDark && styles.darkInput]}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, isDark && styles.darkLabel]}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  secureTextEntry
                  style={[styles.input, isDark && styles.darkInput]}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, isDark && styles.darkLabel]}>Confirm password</Text>
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="••••••••"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  secureTextEntry
                  style={[styles.input, isDark && styles.darkInput]}
                />
              </View>
              <TouchableOpacity 
                onPress={onSubmit} 
                disabled={isLoading} 
                style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>{isLoading ? 'Creating...' : 'Create Account'}</Text>
              </TouchableOpacity>
              <Text style={[styles.helperText, isDark && styles.darkHelperText]}>
                We'll email you a 6-digit code to confirm your account inside the app.
              </Text>
            </View>
            <Link href="/auth/sign-in">
              <Text style={[styles.link, isDark && styles.darkLink]}>Already have an account? Sign in</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
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
    marginBottom: 16,
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
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
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
    marginBottom: 12,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  helperText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  darkHelperText: {
    color: '#999',
  },
  link: {
    color: '#666',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 12,
  },
  darkLink: {
    color: '#aaa',
  },
});
