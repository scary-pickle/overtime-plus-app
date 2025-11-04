import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';

export default function SignIn() {
  const router = useRouter();
  const { signIn, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async () => {
    clearError();
    const result = await signIn(email.trim(), password);
    if (result === 'success') {
      router.replace('/(tabs)/home');
    } else if (result === 'verify') {
      router.replace('/auth/verify-email');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B2239' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>Welcome back</Text>
          <Text style={{ color: '#cfe0f7', marginTop: 4 }}>Sign in to continue</Text>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12 }}>
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
          {error ? <Text style={{ color: '#b91c1c' }}>{error}</Text> : null}
          <TouchableOpacity onPress={onSubmit} disabled={isLoading} style={{ backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, opacity: isLoading ? 0.7 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>{isLoading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>
        </View>
        <Link href="/auth/forgot-password">
          <Text style={{ color: '#cfe0f7', textAlign: 'center', marginTop: 12 }}>Forgot password?</Text>
        </Link>
        <Link href="/auth/sign-up">
          <Text style={{ color: '#cfe0f7', textAlign: 'center', marginTop: 8 }}>Don't have an account? Sign up</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
