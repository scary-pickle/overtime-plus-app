import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';
import { isAllowedDomain, isValidEmail, validatePasswordStrength } from '../../lib/auth/validation';

export default function SignUp() {
  const router = useRouter();
  const { signUp, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const onSubmit = async () => {
    console.log('[sign-up] submit tapped');
    clearError();
    setLocalError(null);
    const e = email.trim();
    if (!isValidEmail(e)) {
      console.log('[sign-up] invalid email');
      return setLocalError('Enter a valid email');
    }
    if (!isAllowedDomain(e)) {
      console.log('[sign-up] domain not allowed');
      return setLocalError('Only @health.qld.gov.au emails are allowed');
    }
    if (password !== confirm) {
      console.log('[sign-up] password mismatch');
      return setLocalError('Passwords do not match');
    }
    const pw = validatePasswordStrength(password);
    if (!pw.valid) {
      console.log('[sign-up] weak password', { issues: pw.errors });
      return setLocalError(`Password: ${pw.errors.join(', ')}`);
    }
    console.log('[sign-up] calling store.signUp');
    const ok = await signUp(e, password);
    console.log('[sign-up] store.signUp returned', { ok });
    if (ok) router.replace('/auth/verify-email');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B2239' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>Create your account</Text>
          <Text style={{ color: '#cfe0f7', marginTop: 4 }}>Use your @health.qld.gov.au email</Text>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12 }}>
          {localError ? <Text style={{ color: '#b91c1c' }}>{localError}</Text> : null}
          {error ? <Text style={{ color: '#b91c1c' }}>{error}</Text> : null}
          <Text style={{ fontSize: 14, color: '#4b5563' }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@health.qld.gov.au"
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 }}
          />
          <Text style={{ fontSize: 14, color: '#4b5563', marginTop: 8 }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 }}
          />
          <Text style={{ fontSize: 14, color: '#4b5563', marginTop: 8 }}>Confirm password</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            secureTextEntry
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 }}
          />
          <TouchableOpacity onPress={onSubmit} disabled={isLoading} style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, opacity: isLoading ? 0.7 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>{isLoading ? 'Creating...' : 'Create Account'}</Text>
          </TouchableOpacity>
          <Text style={{ textAlign: 'center', marginTop: 8, color: '#6b7280' }}>
            We'll email you a 6-digit code to confirm your account inside the app.
          </Text>
        </View>
        <Link href="/auth/sign-in">
          <Text style={{ color: '#cfe0f7', textAlign: 'center', marginTop: 12 }}>Already have an account? Sign in</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
