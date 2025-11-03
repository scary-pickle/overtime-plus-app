import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';
import { exchangeSessionFromUrl } from '../../lib/auth/deeplinks';
import { supabase } from '../../lib/supabase';

export default function VerifyEmail() {
  const router = useRouter();
  const { user, emailVerified, resendVerification, isLoading, clearError, error } = useAuthStore();
  const [codeUrl, setCodeUrl] = useState('');
  const [emailInput, setEmailInput] = useState<string>(user?.email ?? '');
  const [cooldown, setCooldown] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const onPasteCode = async () => {
    clearError();
    setStatusMsg(null);
    if (!codeUrl) return setStatusMsg('Paste the full URL from your email.');
    const pasted = codeUrl.trim();
    // First try PKCE exchange (code + code_verifier)
    setStatusMsg('Checking link…');
    const ok = await exchangeSessionFromUrl(pasted);
    if (ok) {
      setStatusMsg('Verified. Redirecting…');
      return router.replace('/(tabs)/home');
    }

    // Fallback: handle token links (verifyOtp)
    try {
      const u = new URL(pasted);
      const token = u.searchParams.get('token') || u.searchParams.get('token_hash');
      if (!token) return setStatusMsg('The link did not contain a token.');
      if (!emailInput) return setStatusMsg('Enter the email you used to sign up.');
      // @ts-ignore
      setStatusMsg('Verifying code…');
      const { data, error } = await (supabase as any).auth.verifyOtp({
        type: 'signup',
        token_hash: token,
        email: emailInput,
      });
      if (error) throw error;
      if (data?.session) {
        setStatusMsg('Verified. Redirecting…');
        return router.replace('/(tabs)/home');
      }
      // As a last resort, refresh session
      // @ts-ignore
      const { data: s } = await (supabase as any).auth.getSession();
      if (s?.session) {
        setStatusMsg('Verified. Redirecting…');
        router.replace('/(tabs)/home');
      } else {
        setStatusMsg('Verification failed. Please try again or resend the email.');
      }
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Verification failed');
    }
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
          {statusMsg ? <Text style={{ color: '#111827' }}>{statusMsg}</Text> : null}
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
          <Text style={{ color: '#4b5563', marginTop: 8 }}>Email (needed for manual verification)</Text>
          <TextInput
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="you@health.qld.gov.au"
            autoCapitalize="none"
            keyboardType="email-address"
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


