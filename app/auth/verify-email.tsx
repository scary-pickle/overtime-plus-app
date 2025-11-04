import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, Keyboard, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';

export default function VerifyEmail() {
  console.log('[verify-email] component render');
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
  const verificationAttemptedRef = useRef<string | null>(null);

  console.log('[verify-email] state snapshot', {
    userEmail,
    pendingEmail,
    pendingPassword: !!pendingPassword,
    emailInput,
    otpCode: otpCode.length > 0 ? `${otpCode.length} chars` : 'empty',
    otpCodeLength: otpCode.length,
    statusMsg,
    cooldown,
    isSending,
    isVerifying,
    isLoading,
    emailVerified,
    error,
    verificationAttemptedRef: verificationAttemptedRef.current,
  });

  useEffect(() => {
    console.log('[verify-email] emailVerified effect', { emailVerified });
    if (emailVerified) {
      console.log('[verify-email] email verified, redirecting to onboarding');
      router.replace('/onboarding/welcome');
    }
  }, [emailVerified, router]);

  useEffect(() => {
    console.log('[verify-email] email input sync effect', { pendingEmail, userEmail, emailInput });
    if (pendingEmail && pendingEmail !== emailInput) {
      console.log('[verify-email] updating emailInput from pendingEmail', { pendingEmail });
      setEmailInput(pendingEmail);
    } else if (!pendingEmail && userEmail && userEmail !== emailInput) {
      console.log('[verify-email] updating emailInput from userEmail', { userEmail });
      setEmailInput(userEmail);
    }
  }, [pendingEmail, userEmail, emailInput]);

  const sendOtp = useCallback(
    async (rawEmail: string, shouldCreateUser: boolean, silent = false) => {
      console.log('[verify-email] sendOtp called', { rawEmail, shouldCreateUser, silent });
      const targetEmail = rawEmail.trim();
      console.log('[verify-email] sendOtp trimmed email', { targetEmail });
      if (!targetEmail) {
        console.log('[verify-email] sendOtp - no email provided');
        if (!silent) setStatusMsg('Enter your email first.');
        return false;
      }
      if (!silent) {
        console.log('[verify-email] sendOtp - clearing error and setting status');
        clearError();
        setStatusMsg('Sending code...');
      }
      console.log('[verify-email] sendOtp - setting isSending to true');
      setIsSending(true);
      console.log('[verify-email] sendOtp - calling requestEmailOtp');
      const sent = await requestEmailOtp(targetEmail, shouldCreateUser);
      console.log('[verify-email] sendOtp - requestEmailOtp returned', { sent });
      setIsSending(false);
      console.log('[verify-email] sendOtp - setting isSending to false');
      if (sent) {
        console.log('[verify-email] sendOtp - success, setting status and cooldown');
        if (!silent) setStatusMsg('Code sent. Check your email.');
        setCooldown(30);
        setEmailInput(targetEmail);
      } else if (!silent) {
        console.log('[verify-email] sendOtp - failed, clearing status');
        setStatusMsg(null);
      }
      return sent;
    },
    [requestEmailOtp, clearError]
  );

  // Auto-send OTP when arriving from signup (pendingEmail + pendingPassword means we just signed up)
  useEffect(() => {
    console.log('[verify-email] auto-send effect', { pendingEmail, pendingPassword, autoSentRef: autoSentRef.current });
    if (!pendingEmail) {
      console.log('[verify-email] auto-send effect - no pendingEmail, returning');
      return;
    }
    if (autoSentRef.current === pendingEmail) {
      console.log('[verify-email] auto-send effect - already sent for this email, returning');
      return;
    }
    // Only auto-send if we have pendingPassword (came from signup flow)
    // This means signUp already sent the Magic Link email, so we don't need to resend
    // But if user is here without pendingPassword, they might need to request code manually
    if (pendingPassword) {
      console.log('[verify-email] auto-send skipped - code already sent during signup');
      setStatusMsg('Check your email for the 6-digit code.');
      autoSentRef.current = pendingEmail; // Mark as sent so we don't try again
      console.log('[verify-email] auto-send effect - marked as sent', { email: autoSentRef.current });
    } else {
      console.log('[verify-email] auto-send effect - no pendingPassword, user may need to request code manually');
    }
  }, [pendingEmail, pendingPassword]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-submit when 6 digits are entered (only once per code)
  useEffect(() => {
    console.log('[verify-email] auto-submit effect', {
      otpCodeLength: otpCode.length,
      otpCode: otpCode.length > 0 ? '***' : 'empty',
      busy,
      isVerifying,
      isLoading,
      isSending,
      hasError: !!error,
      verificationAttemptedRef: verificationAttemptedRef.current,
      shouldAttempt: otpCode.length === 6 && !busy && !isVerifying && !error && verificationAttemptedRef.current !== otpCode,
    });
    // Reset ref if code length changes (user is typing a new code)
    if (otpCode.length < 6) {
      console.log('[verify-email] auto-submit effect - code length < 6, resetting verificationAttemptedRef');
      verificationAttemptedRef.current = null;
    }
    // Only auto-submit if:
    // 1. Code is 6 digits
    // 2. Not busy
    // 3. Not currently verifying
    // 4. No error (prevent infinite loop after failed verification)
    // 5. Code hasn't been attempted yet
    if (otpCode.length === 6 && !busy && !isVerifying && !error && verificationAttemptedRef.current !== otpCode) {
      console.log('[verify-email] auto-submit effect - triggering auto-submit', {
        otpCode: '***',
        busy,
        isVerifying,
        hasError: !!error,
        verificationAttemptedRef: verificationAttemptedRef.current,
      });
      // Don't set verificationAttemptedRef here - let onVerifyOtp do it to avoid race conditions
      console.log('[verify-email] auto-submit effect - dismissing keyboard');
      Keyboard.dismiss();
      // Small delay to ensure keyboard is dismissed before submitting
      setTimeout(() => {
        console.log('[verify-email] auto-submit effect - timeout callback, calling onVerifyOtp');
        onVerifyOtp();
      }, 100);
    } else if (otpCode.length === 6) {
      console.log('[verify-email] auto-submit effect - code is 6 digits but not attempting', {
        busy,
        isVerifying,
        hasError: !!error,
        verificationAttemptedRef: verificationAttemptedRef.current,
        alreadyAttempted: verificationAttemptedRef.current === otpCode,
        reason: busy ? 'busy' : isVerifying ? 'verifying' : error ? 'has error' : verificationAttemptedRef.current === otpCode ? 'already attempted' : 'unknown',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode, busy, isVerifying, error]);

  const effectiveEmail = emailInput || pendingEmail || userEmail;
  const busy = isLoading || isSending || isVerifying;
  const sendLabel = isSending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send 6-digit code';
  const verifyLabel = isVerifying ? 'Verifying...' : 'Verify code';

  console.log('[verify-email] computed values', {
    effectiveEmail,
    busy,
    sendLabel,
    verifyLabel,
  });

  const onSendOtp = async () => {
    console.log('[verify-email] onSendOtp button pressed', { effectiveEmail, pendingPassword: !!pendingPassword });
    await sendOtp(effectiveEmail, Boolean(pendingPassword), false);
  };

  const onVerifyOtp = async () => {
    const token = otpCode.trim();
    console.log('[verify-email] onVerifyOtp called', {
      isVerifying,
      verificationAttemptedRef: verificationAttemptedRef.current,
      otpCode: otpCode.length > 0 ? `${otpCode.length} chars` : 'empty',
      otpCodeLength: otpCode.length,
      tokenLength: token.length,
      effectiveEmail,
    });
    
    // Validate inputs first
    const targetEmail = (effectiveEmail || '').trim();
    console.log('[verify-email] onVerifyOtp - targetEmail', { targetEmail });
    if (!targetEmail) {
      console.log('[verify-email] onVerifyOtp - no email, setting error message');
      setStatusMsg('Enter your email first.');
      return;
    }
    if (token.length < 6) {
      console.log('[verify-email] onVerifyOtp - token too short, setting error message');
      setStatusMsg('Enter the 6-digit code.');
      return;
    }
    
    // Prevent multiple verification attempts with the same code
    // Check this AFTER validation so we can return early on invalid input
    if (isVerifying || verificationAttemptedRef.current === token) {
      console.log('[verify-email] onVerifyOtp - blocked (already verifying or already attempted)', {
        isVerifying,
        verificationAttemptedRef: verificationAttemptedRef.current,
        token: token.length > 0 ? '***' : 'empty',
        tokenLength: token.length,
      });
      return;
    }
    
    // Mark this code as attempted immediately to prevent duplicate calls
    console.log('[verify-email] onVerifyOtp - setting verificationAttemptedRef and starting verification', {
      tokenLength: token.length,
    });
    verificationAttemptedRef.current = token;
    clearError();
    setStatusMsg('Verifying code...');
    console.log('[verify-email] onVerifyOtp - setting isVerifying to true');
    setIsVerifying(true);
    console.log('[verify-email] onVerifyOtp - calling verifyEmailOtp', { targetEmail, tokenLength: token.length });
    const outcome = await verifyEmailOtp(targetEmail, token);
    console.log('[verify-email] onVerifyOtp - verifyEmailOtp returned', { outcome });
    setIsVerifying(false);
    console.log('[verify-email] onVerifyOtp - setting isVerifying to false');
    if (outcome === 'success') {
      console.log('[verify-email] onVerifyOtp - SUCCESS! Setting status and redirecting');
      setStatusMsg('Verified. Redirecting...');
      setOtpCode('');
      verificationAttemptedRef.current = null; // Reset for next attempt
      console.log('[verify-email] onVerifyOtp - navigating to onboarding');
      router.replace('/onboarding/welcome');
    } else {
      console.log('[verify-email] onVerifyOtp - FAILED', { outcome });
      setStatusMsg(null);
      // Don't reset verificationAttemptedRef on failure - keep it set to prevent infinite loop
      // User needs to clear the code or type a new digit to trigger a new attempt
      console.log('[verify-email] onVerifyOtp - keeping verificationAttemptedRef set to prevent infinite loop');
      // The ref will be reset when user types a new digit (in the auto-submit effect when length < 6)
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B2239' }}>
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
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
            onChangeText={(text) => {
              console.log('[verify-email] OTP input changed', { 
                oldLength: otpCode.length, 
                newLength: text.length,
                text: text.length > 0 ? '***' : 'empty',
              });
              setOtpCode(text);
            }}
            placeholder="Enter 6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={() => {
              console.log('[verify-email] OTP input onSubmitEditing', { 
                otpCodeLength: otpCode.length, 
                busy,
                shouldSubmit: otpCode.length === 6 && !busy,
              });
              if (otpCode.length === 6 && !busy) {
                console.log('[verify-email] OTP input onSubmitEditing - submitting');
                Keyboard.dismiss();
                onVerifyOtp();
              } else {
                console.log('[verify-email] OTP input onSubmitEditing - not submitting', {
                  otpCodeLength: otpCode.length,
                  busy,
                });
              }
            }}
            onBlur={() => {
              console.log('[verify-email] OTP input onBlur');
              Keyboard.dismiss();
            }}
            onFocus={() => {
              console.log('[verify-email] OTP input onFocus', { otpCodeLength: otpCode.length });
            }}
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12 }}
          />
          <TouchableOpacity
            onPress={() => {
              console.log('[verify-email] Verify button pressed', { 
                busy, 
                isVerifying, 
                isLoading, 
                isSending,
                otpCodeLength: otpCode.length,
              });
              onVerifyOtp();
            }}
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
      </ScrollView>
    </SafeAreaView>
  );
}
