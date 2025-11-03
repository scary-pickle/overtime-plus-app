import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
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
    <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Reset password</Text>
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      {status ? <Text>{status}</Text> : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Your email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
      />
      <Button title={loading ? 'Sending…' : 'Send reset link'} onPress={onSubmit} disabled={loading} />
    </View>
  );
}


