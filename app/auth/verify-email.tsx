import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';
import { exchangeSessionFromUrl } from '../../lib/auth/deeplinks';

export default function VerifyEmail() {
  const router = useRouter();
  const { user, emailVerified, resendVerification, isLoading, clearError, error } = useAuthStore();
  const [codeUrl, setCodeUrl] = useState('');
  const [cooldown, setCooldown] = useState(0);

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
    setCooldown(30);
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (emailVerified) {
    router.replace('/(tabs)/home');
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B2239' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>Verify your email</Text>
          <Text style={{ color: '#cfe0f7', marginTop: 4 }}>We sent a link to: {user?.email ?? 'your email'}</Text>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12 }}>
          {error ? <Text style={{ color: '#b91c1c' }}>{error}</Text> : null}
          <TouchableOpacity onPress={onResend} disabled={isLoading || cooldown > 0} style={{ backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', opacity: isLoading || cooldown > 0 ? 0.7 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>{isLoading ? 'Resending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}</Text>
          </TouchableOpacity>
          <View style={{ height: 12 }} />
          <Text style={{ color: '#4b5563' }}>Can't open the link on this device? Paste the full URL here:</Text>
          <TextInput
            value={codeUrl}
            onChangeText={setCodeUrl}
            placeholder="Paste verification URL"
            autoCapitalize="none"
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 }}
          />
          <TouchableOpacity onPress={onPasteCode} style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}


