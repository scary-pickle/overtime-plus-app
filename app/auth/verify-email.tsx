import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';
import { exchangeSessionFromUrl } from '../../lib/auth/deeplinks';
import { supabase } from '../../lib/supabase';

export default function VerifyEmail() {
  const router = useRouter();
  const { user, emailVerified, resendVerification, isLoading, clearError, error, pendingEmail, pendingPassword } = useAuthStore();
  const [codeUrl, setCodeUrl] = useState('');
  const [emailInput, setEmailInput] = useState<string>(pendingEmail || user?.email || '');
  const [cooldown, setCooldown] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');

  const onPasteCode = async () => {
    clearError();
    setStatusMsg(null);
    if (!codeUrl) return setStatusMsg('Paste the full URL from your email.');
    const pasted = codeUrl.trim();
    // First try PKCE exchange (code + code_verifier)
    console.log('[verify-email] pasted URL', pasted);
    setStatusMsg('Checking link…');
    const ok = await exchangeSessionFromUrl(pasted);
    if (ok) {
      setStatusMsg('Verified. Redirecting…');
      return router.replace('/(tabs)/home');
    }

    // Fallback: handle token links (verifyOtp)
    try {
      const u = new URL(pasted);
      const tokenHash = u.searchParams.get('token_hash');
      const token = u.searchParams.get('token');
      const type = (u.searchParams.get('type') || 'signup') as any;
      console.log('[verify-email] parsed', { hasToken: !!token, hasTokenHash: !!tokenHash, type });
      if (!token && !tokenHash) return setStatusMsg('The link did not contain a token.');
      setStatusMsg(`Verifying (${type})…`);
      let data: any = null;
      let error: any = null;
      // Prefer token_hash flow
      if (tokenHash) {
        // @ts-ignore
        const r = await (supabase as any).auth.verifyOtp({ type, token_hash: tokenHash });
        data = r.data; error = r.error;
        if (error) console.log('[verify-email] verifyOtp error token_hash', { message: error.message });
      }
      // Fallback: token (some email links supply token instead of token_hash)
      if (error || (!data?.session && token)) {
        // First try with email
        // @ts-ignore
        const r1 = await (supabase as any).auth.verifyOtp({ type, token, email: emailInput || undefined });
        data = r1.data; error = r1.error;
        if (error) console.log('[verify-email] verifyOtp error token+email', { message: error.message });
        if (error) {
          // Try without email
          // @ts-ignore
          const r2 = await (supabase as any).auth.verifyOtp({ type, token });
          data = r2.data; error = r2.error;
          if (error) console.log('[verify-email] verifyOtp error token only', { message: error.message });
          if (error) {
            // Some backends expect token passed as token_hash
            // @ts-ignore
            const r3 = await (supabase as any).auth.verifyOtp({ type, token_hash: token });
            data = r3.data; error = r3.error;
            if (error) console.log('[verify-email] verifyOtp error token as token_hash', { message: error.message });
          }
        }
      }
      if (error) {
        console.log('[verify-email] verifyOtp error with provided type', { message: error.message });
        // Try fallback types commonly used by email links
        const fallbackTypes = type === 'signup' ? ['email', 'magiclink'] : ['signup', 'email', 'magiclink'];
        for (const ft of fallbackTypes) {
          setStatusMsg(`Verifying (${ft})…`);
          // @ts-ignore
          let r: any;
          if (tokenHash) {
            // @ts-ignore
            r = await (supabase as any).auth.verifyOtp({ type: ft as any, token_hash: tokenHash });
          } else if (token) {
            // @ts-ignore
            r = await (supabase as any).auth.verifyOtp({ type: ft as any, token, email: emailInput || undefined });
            if (r.error) {
              // Try without email
              // @ts-ignore
              r = await (supabase as any).auth.verifyOtp({ type: ft as any, token });
            }
          }
          if (!r.error) {
            data = r.data;
            error = null as any;
            console.log('[verify-email] verifyOtp succeeded with fallback type', ft);
            break;
          } else {
            console.log('[verify-email] verifyOtp still failing', { type: ft, message: r.error.message });
          }
        }
      }
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

  const onSendOtp = async () => {
    try {
      const targetEmail = emailInput || user?.email;
      if (!targetEmail) {
        setStatusMsg('Enter your email first.');
        return;
      }
      setStatusMsg('Sending code…');
      // Use passwordless email OTP; shouldCreateUser ensures unconfirmed users can get a code
      // @ts-ignore
      const { error } = await (supabase as any).auth.signInWithOtp({
        email: targetEmail,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStatusMsg('Code sent. Check your email.');
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Failed to send code');
    }
  };

  const onVerifyOtp = async () => {
    try {
      const targetEmail = emailInput || user?.email;
      if (!targetEmail) {
        setStatusMsg('Enter your email first.');
        return;
      }
      if (!otpCode || otpCode.length < 6) {
        setStatusMsg('Enter the 6-digit code.');
        return;
      }
      setStatusMsg('Verifying code…');
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.verifyOtp({
        email: targetEmail,
        token: otpCode,
        type: 'email',
      });
      if (error) throw error;
      if (data?.session) {
        setStatusMsg('Verified. Redirecting…');
        router.replace('/(tabs)/home');
      } else {
        setStatusMsg('Verification failed. Try again.');
      }
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Failed to verify code');
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-send OTP when arriving from signup (pendingEmail present)
  useEffect(() => {
    if (pendingEmail) {
      console.log('[verify-email] auto-send OTP for', pendingEmail);
      onSendOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {/* Link-based verification removed in favor of OTP */}
          <Text style={{ color: '#4b5563', marginTop: 8 }}>Email</Text>
          <TextInput
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="you@health.qld.gov.au"
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 }}
          />

          <View style={{ height: 16 }} />
          <Text style={{ color: '#4b5563' }}>Enter the 6‑digit code:</Text>
          <TouchableOpacity onPress={onSendOtp} style={{ backgroundColor: '#111827', borderRadius: 12, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Send 6‑digit code to email</Text>
          </TouchableOpacity>
          <TextInput
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="Enter 6‑digit code"
            keyboardType="number-pad"
            maxLength={6}
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginTop: 8 }}
          />
          <TouchableOpacity onPress={onVerifyOtp} style={{ backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Verify code</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}


