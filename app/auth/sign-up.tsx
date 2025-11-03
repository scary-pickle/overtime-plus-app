import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';
import { isAllowedDomain, isValidEmail, validatePasswordStrength } from '../../lib/auth/validation';

export default function SignUp() {
  const { signUp, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const onSubmit = async () => {
    clearError();
    setLocalError(null);
    const e = email.trim();
    if (!isValidEmail(e)) return setLocalError('Enter a valid email');
    if (!isAllowedDomain(e)) return setLocalError('Only @health.qld.gov.au emails are allowed');
    if (password !== confirm) return setLocalError('Passwords do not match');
    const pw = validatePasswordStrength(password);
    if (!pw.valid) return setLocalError(`Password: ${pw.errors.join(', ')}`);
    await signUp(e, password);
  };

  return (
    <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Create Account</Text>
      {localError ? <Text style={{ color: 'red' }}>{localError}</Text> : null}
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email (@health.qld.gov.au)"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
      />
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Confirm Password"
        secureTextEntry
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
      />
      <Button title={isLoading ? 'Creating...' : 'Create Account'} onPress={onSubmit} disabled={isLoading} />
      <Text style={{ textAlign: 'center', marginTop: 12 }}>
        You'll receive a verification email. Open it on this device.
      </Text>
      <Link href="/auth/sign-in">
        <Text style={{ color: '#007AFF', textAlign: 'center', marginTop: 8 }}>Already have an account? Sign in</Text>
      </Link>
    </View>
  );
}


