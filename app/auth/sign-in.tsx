import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, StyleSheet, useColorScheme } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';

import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('SignIn');

export default function SignIn() {
  debug('[sign-in] component render');
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { signIn, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  debug('[sign-in] state snapshot', {
    email: email.length > 0 ? '***' : 'empty',
    passwordLength: password.length,
    isLoading,
    error,
  });

  const onSubmit = async () => {
    debug('[sign-in] onSubmit called', { emailLength: email.length, passwordLength: password.length });
    clearError();
    debug('[sign-in] calling signIn');
    const result = await signIn(email.trim(), password);
    debug('[sign-in] signIn returned', { result });
    if (result === 'success') {
      debug('[sign-in] success - navigating to home');
      router.replace('/(tabs)/home');
    } else if (result === 'verify') {
      debug('[sign-in] needs verification - navigating to verify-email');
      router.replace('/auth/verify-email');
    } else {
      debug('[sign-in] error result', { result });
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, isDark && styles.darkTitle]}>Welcome back</Text>
          <Text style={[styles.subtitle, isDark && styles.darkSubtitle]}>Sign in to continue</Text>
        </View>
        <View style={[styles.card, isDark && styles.darkCard]}>
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
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity 
            onPress={() => {
              debug('[sign-in] Sign In button pressed', { isLoading, emailLength: email.length, passwordLength: password.length });
              onSubmit();
            }}
            disabled={isLoading} 
            style={[styles.button, isLoading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>{isLoading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>
        </View>
        <Link href="/auth/forgot-password">
          <Text style={[styles.link, isDark && styles.darkLink]}>Forgot password?</Text>
        </Link>
        <Link href="/auth/sign-up">
          <Text style={[styles.link, isDark && styles.darkLink, styles.linkMargin]}>Don't have an account? Sign up</Text>
        </Link>
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
    backgroundColor: '#2563EB',
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
  link: {
    color: '#666',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
  },
  darkLink: {
    color: '#aaa',
  },
  linkMargin: {
    marginTop: 12,
  },
});
