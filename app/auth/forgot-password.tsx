import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuthStore } from '../../lib/state/authStore';
import { getRedirectUri } from '../../lib/auth/deeplinks';

export default function ForgotPassword() {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B2239' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>Reset password</Text>
          <Text style={{ color: '#cfe0f7', marginTop: 4 }}>We'll email you a reset link</Text>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12 }}>
          {error ? <Text style={{ color: '#b91c1c' }}>{error}</Text> : null}
          {status ? <Text style={{ color: '#111827' }}>{status}</Text> : null}
          <Text style={{ fontSize: 14, color: '#4b5563' }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@health.qld.gov.au"
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 }}
          />
          <TouchableOpacity onPress={onSubmit} disabled={loading} style={{ backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, opacity: loading ? 0.7 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>{loading ? 'Sending…' : 'Send reset link'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}


