import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';
import { exchangeSessionFromUrl } from '../../lib/auth/deeplinks';

export default function VerifyEmail() {
  const router = useRouter();
  const { user, emailVerified, resendVerification, isLoading, clearError, error } = useAuthStore();
  const [codeUrl, setCodeUrl] = useState('');

  const onPasteCode = async () => {
    clearError();
    if (!codeUrl) return;
    const ok = await exchangeSessionFromUrl(codeUrl.trim());
    if (ok) router.replace('/(tabs)/home');
  };

  const onResend = async () => {
    if (!user?.email) return;
    clearError();
    await resendVerification(user.email);
  };

  if (emailVerified) {
    router.replace('/(tabs)/home');
    return null;
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Verify your email</Text>
      <Text>We sent a link to: {user?.email ?? 'your email'}</Text>
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      <Button title={isLoading ? 'Resending…' : 'Resend verification email'} onPress={onResend} disabled={isLoading} />
      <View style={{ height: 16 }} />
      <Text>Can't open the link on this device? Paste the full URL here:</Text>
      <TextInput
        value={codeUrl}
        onChangeText={setCodeUrl}
        placeholder="Paste verification URL"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
      />
      <Button title="Confirm" onPress={onPasteCode} />
    </View>
  );
}


