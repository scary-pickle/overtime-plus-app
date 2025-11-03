import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';

export default function SignIn() {
  const router = useRouter();
  const { signIn, isLoading, error, clearError, emailVerified } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async () => {
    clearError();
    await signIn(email.trim(), password);
    if (emailVerified) {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Sign In</Text>
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
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
      <Button title={isLoading ? 'Signing in...' : 'Sign In'} onPress={onSubmit} disabled={isLoading} />
      <Link href="/auth/forgot-password">
        <Text style={{ color: '#007AFF', textAlign: 'center', marginTop: 8 }}>Forgot password?</Text>
      </Link>
      <Link href="/auth/sign-up">
        <Text style={{ color: '#007AFF', textAlign: 'center', marginTop: 8 }}>Don't have an account? Sign up</Text>
      </Link>
    </View>
  );
}


