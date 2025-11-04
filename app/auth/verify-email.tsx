import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';

export default function VerifyEmail() {
  const router = useRouter();
  const {
    user,
    emailVerified,
    isLoading,
    clearError,
    error,
    pendingEmail,
    pendingPassword,
    requestEmailOtp,
    verifyEmailOtp,
  } = useAuthStore();

  const userEmail = user?.email ?? '';
  const [emailInput, setEmailInput] = useState<string>(pendingEmail || userEmail);
  const [otpCode, setOtpCode] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const autoSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (emailVerified) {
      router.replace('/(tabs)/home');
    }
  }, [emailVerified, router]);

  useEffect(() => {
    if (pendingEmail && pendingEmail !== emailInput) {
      setEmailInput(pendingEmail);
    } else if (!pendingEmail && userEmail && userEmail !== emailInput) {
      setEmailInput(userEmail);
    }
  }, [pendingEmail, userEmail]);

  const sendOtp = useCallback(
    async (rawEmail: string, shouldCreateUser: boolean, silent = false) => {
      const targetEmail = rawEmail.trim();
      if (!targetEmail) {
        if (!silent) setStatusMsg('Enter your email first.');
        return false;
      }
      if (!silent) {
        clearError();
        setStatusMsg('Sending code...');
      }
      setIsSending(true);
      const sent = await requestEmailOtp(targetEmail, shouldCreateUser);
      setIsSending(false);
      if (sent) {
        if (!silent) setStatusMsg('Code sent. Check your email.');
        setCooldown(30);
        setEmailInput(targetEmail);
      } else if (!silent) {
        setStatusMsg(null);
      }
      return sent;
    },
    [requestEmailOtp, clearError]
  );

  useEffect(() => {
    if (!pendingEmail) return;
    if (autoSentRef.current === pendingEmail) return;
    autoSentRef.current = pendingEmail;
    sendOtp(pendingEmail, Boolean(pendingPassword), false);
  }, [pendingEmail, pendingPassword, sendOtp]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const effectiveEmail = emailInput || pendingEmail || userEmail;
  const busy = isLoading || isSending || isVerifying;
  const sendLabel = isSending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send 6-digit code';
  const verifyLabel = isVerifying ? 'Verifying...' : 'Verify code';

  const onSendOtp = async () => {
    await sendOtp(effectiveEmail, Boolean(pendingPassword), false);
  };

  const onVerifyOtp = async () => {
    const targetEmail = (effectiveEmail || '').trim();
    if (!targetEmail) {
      setStatusMsg('Enter your email first.');
      return;
    }
    const token = otpCode.trim();
    if (token.length < 6) {
      setStatusMsg('Enter the 6-digit code.');
      return;
    }
    clearError();
    setStatusMsg('Verifying code...');
    setIsVerifying(true);
    const outcome = await verifyEmailOtp(targetEmail, token);
    setIsVerifying(false);
    if (outcome === 'success') {
      setStatusMsg('Verified. Redirecting...');
      setOtpCode('');
      router.replace('/(tabs)/home');
    } else {
      setStatusMsg(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B2239' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>Verify your email</Text>
          <Text style={{ color: '#cfe0f7', marginTop: 4 }}>
            Enter the 6-digit code we emailed to {pendingEmail || userEmail || 'your email'}.
          </Text>
        </View>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            gap: 12,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 12,
          }}
        >
          {error ? <Text style={{ color: '#b91c1c' }}>{error}</Text> : null}
          {statusMsg ? <Text style={{ color: '#111827' }}>{statusMsg}</Text> : null}
          <Text style={{ color: '#4b5563', marginTop: 8 }}>Email</Text>
          <TextInput
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="you@health.qld.gov.au"
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 }}
          />
          <TouchableOpacity
            onPress={onSendOtp}
            disabled={busy || cooldown > 0}
            style={{
              backgroundColor: '#111827',
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              opacity: busy || cooldown > 0 ? 0.7 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{sendLabel}</Text>
          </TouchableOpacity>

          <Text style={{ color: '#4b5563', marginTop: 16 }}>Enter the 6-digit code</Text>
          <TextInput
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="Enter 6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 }}
          />
          <TouchableOpacity
            onPress={onVerifyOtp}
            disabled={busy}
            style={{
              backgroundColor: '#2563EB',
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              opacity: busy ? 0.7 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{verifyLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
