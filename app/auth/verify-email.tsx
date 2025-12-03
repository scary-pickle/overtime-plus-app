import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, Keyboard, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../lib/state/authStore';
import { useHideSplashOnFocus } from '../../lib/utils/hideSplashOnFocus';

import { createScopedLogger } from '../../lib/utils/logger';

const { debug } = createScopedLogger('VerifyEmail');

const maskEmail = (email?: string | null) => {
  if (!email) return email ?? undefined;
  const [local, domain] = email.split('@');
  if (!domain || !local) return '***';
  return `${local[0]}***@${domain}`;
};

export default function VerifyEmail() {
  debug('[verify-email] component render');
  const router = useRouter();
  
  // Hide splash screen when this screen is focused and ready
  useHideSplashOnFocus();
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

  const maskedState = {
    userEmail: maskEmail(userEmail),
    pendingEmail: maskEmail(pendingEmail),
    emailInput: maskEmail(emailInput),
  };

  debug('[verify-email] state snapshot', {
    userEmail: maskedState.userEmail,
    pendingEmail: maskedState.pendingEmail,
    pendingPassword: !!pendingPassword,
    emailInput: maskedState.emailInput,
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
    debug('[verify-email] emailVerified effect', { emailVerified });
    if (emailVerified) {
      debug('[verify-email] email verified, redirecting to onboarding');
      router.replace('/onboarding/welcome');
    }
  }, [emailVerified, router]);

  useEffect(() => {
    debug('[verify-email] email input sync effect', { 
      pendingEmail: maskEmail(pendingEmail), 
      userEmail: maskEmail(userEmail), 
      emailInput: maskEmail(emailInput),
    });
    if (pendingEmail && pendingEmail !== emailInput) {
      debug('[verify-email] updating emailInput from pendingEmail', { pendingEmail });
      setEmailInput(pendingEmail);
    } else if (!pendingEmail && userEmail && userEmail !== emailInput) {
      debug('[verify-email] updating emailInput from userEmail', { userEmail });
      setEmailInput(userEmail);
    }
  }, [pendingEmail, userEmail, emailInput]);

  const sendOtp = useCallback(
    async (rawEmail: string, shouldCreateUser: boolean, silent = false) => {
      debug('[verify-email] sendOtp called', { rawEmail: maskEmail(rawEmail), shouldCreateUser, silent });
      const targetEmail = rawEmail.trim();
      debug('[verify-email] sendOtp trimmed email', { targetEmail: maskEmail(targetEmail) });
      if (!targetEmail) {
        debug('[verify-email] sendOtp - no email provided');
        if (!silent) setStatusMsg('Enter your email first.');
        return false;
      }
      if (!silent) {
        debug('[verify-email] sendOtp - clearing error and setting status');
        clearError();
        setStatusMsg('Sending code...');
      }
      debug('[verify-email] sendOtp - setting isSending to true');
      setIsSending(true);
      debug('[verify-email] sendOtp - calling requestEmailOtp');
      const sent = await requestEmailOtp(targetEmail, shouldCreateUser);
      debug('[verify-email] sendOtp - requestEmailOtp returned', { sent });
      setIsSending(false);
      debug('[verify-email] sendOtp - setting isSending to false');
      if (sent) {
        debug('[verify-email] sendOtp - success, setting status and cooldown');
        if (!silent) setStatusMsg('Code sent. Check your email.');
        setCooldown(30);
        setEmailInput(targetEmail);
      } else if (!silent) {
        debug('[verify-email] sendOtp - failed, clearing status');
        setStatusMsg(null);
      }
      return sent;
    },
    [requestEmailOtp, clearError]
  );

  // Auto-send OTP when arriving from signup (pendingEmail + pendingPassword means we just signed up)
  useEffect(() => {
    debug('[verify-email] auto-send effect', { 
      pendingEmail: maskEmail(pendingEmail), 
      pendingPassword, 
      autoSentRef: autoSentRef.current ? maskEmail(autoSentRef.current) : null,
    });
    if (!pendingEmail) {
      debug('[verify-email] auto-send effect - no pendingEmail, returning');
      return;
    }
    if (autoSentRef.current === pendingEmail) {
      debug('[verify-email] auto-send effect - already sent for this email, returning');
      return;
    }
    // Only auto-send if we have pendingPassword (came from signup flow)
    // This means signUp already sent the Magic Link email, so we don't need to resend
    // But if user is here without pendingPassword, they might need to request code manually
    if (pendingPassword) {
      debug('[verify-email] auto-send skipped - code already sent during signup');
      setStatusMsg('Check your email for the 6-digit code.');
      autoSentRef.current = pendingEmail; // Mark as sent so we don't try again
      debug('[verify-email] auto-send effect - marked as sent', { email: maskEmail(autoSentRef.current) });
    } else {
      debug('[verify-email] auto-send effect - no pendingPassword, user may need to request code manually');
    }
  }, [pendingEmail, pendingPassword]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Compute busy state before it's used in effects
  const effectiveEmail = emailInput || pendingEmail || userEmail;
  const busy = isLoading || isSending || isVerifying;

  // Auto-submit when 6 digits are entered (only once per code)
  useEffect(() => {
    debug('[verify-email] auto-submit effect', {
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
      debug('[verify-email] auto-submit effect - code length < 6, resetting verificationAttemptedRef');
      verificationAttemptedRef.current = null;
    }
    // Only auto-submit if:
    // 1. Code is 6 digits
    // 2. Not busy
    // 3. Not currently verifying
    // 4. No error (prevent infinite loop after failed verification)
    // 5. Code hasn't been attempted yet
    if (otpCode.length === 6 && !busy && !isVerifying && !error && verificationAttemptedRef.current !== otpCode) {
      debug('[verify-email] auto-submit effect - triggering auto-submit', {
        otpCode: '***',
        busy,
        isVerifying,
        hasError: !!error,
        verificationAttemptedRef: verificationAttemptedRef.current,
      });
      // Don't set verificationAttemptedRef here - let onVerifyOtp do it to avoid race conditions
      debug('[verify-email] auto-submit effect - dismissing keyboard');
      Keyboard.dismiss();
      // Small delay to ensure keyboard is dismissed before submitting
      setTimeout(() => {
        debug('[verify-email] auto-submit effect - timeout callback, calling onVerifyOtp');
        onVerifyOtp();
      }, 100);
    } else if (otpCode.length === 6) {
      debug('[verify-email] auto-submit effect - code is 6 digits but not attempting', {
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
  const sendLabel = isSending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send 6-digit code';
  const verifyLabel = isVerifying ? 'Verifying...' : 'Verify code';

  debug('[verify-email] computed values', {
    effectiveEmail: maskEmail(effectiveEmail),
    busy,
    sendLabel,
    verifyLabel,
  });

  const onSendOtp = async () => {
    debug('[verify-email] onSendOtp button pressed', { effectiveEmail: maskEmail(effectiveEmail), pendingPassword: !!pendingPassword });
    await sendOtp(effectiveEmail, Boolean(pendingPassword), false);
  };

  const onVerifyOtp = async () => {
    const token = otpCode.trim();
    debug('[verify-email] onVerifyOtp called', {
      isVerifying,
      verificationAttemptedRef: verificationAttemptedRef.current,
      otpCode: otpCode.length > 0 ? `${otpCode.length} chars` : 'empty',
      otpCodeLength: otpCode.length,
      tokenLength: token.length,
      effectiveEmail: maskEmail(effectiveEmail),
    });
    
    // Validate inputs first
    const targetEmail = (effectiveEmail || '').trim();
    debug('[verify-email] onVerifyOtp - targetEmail', { targetEmail: maskEmail(targetEmail) });
    if (!targetEmail) {
      debug('[verify-email] onVerifyOtp - no email, setting error message');
      setStatusMsg('Enter your email first.');
      return;
    }
    if (token.length < 6) {
      debug('[verify-email] onVerifyOtp - token too short, setting error message');
      setStatusMsg('Enter the 6-digit code.');
      return;
    }
    
    // Prevent multiple verification attempts with the same code
    // Check this AFTER validation so we can return early on invalid input
    if (isVerifying || verificationAttemptedRef.current === token) {
      debug('[verify-email] onVerifyOtp - blocked (already verifying or already attempted)', {
        isVerifying,
        verificationAttemptedRef: verificationAttemptedRef.current,
        token: token.length > 0 ? '***' : 'empty',
        tokenLength: token.length,
      });
      return;
    }
    
    // Mark this code as attempted immediately to prevent duplicate calls
    debug('[verify-email] onVerifyOtp - setting verificationAttemptedRef and starting verification', {
      tokenLength: token.length,
    });
    verificationAttemptedRef.current = token;
    clearError();
    setStatusMsg('Verifying code...');
    debug('[verify-email] onVerifyOtp - setting isVerifying to true');
    setIsVerifying(true);
    debug('[verify-email] onVerifyOtp - calling verifyEmailOtp', { targetEmail: maskEmail(targetEmail), tokenLength: token.length });
    const outcome = await verifyEmailOtp(targetEmail, token);
    debug('[verify-email] onVerifyOtp - verifyEmailOtp returned', { outcome });
    setIsVerifying(false);
    debug('[verify-email] onVerifyOtp - setting isVerifying to false');
    if (outcome === 'success') {
      debug('[verify-email] onVerifyOtp - SUCCESS! Setting status and redirecting');
      setStatusMsg('Verified. Redirecting...');
      setOtpCode('');
      verificationAttemptedRef.current = null; // Reset for next attempt
      debug('[verify-email] onVerifyOtp - navigating to onboarding');
      router.replace('/onboarding/welcome');
    } else {
      debug('[verify-email] onVerifyOtp - FAILED', { outcome });
      setStatusMsg(null);
      // Don't reset verificationAttemptedRef on failure - keep it set to prevent infinite loop
      // User needs to clear the code or type a new digit to trigger a new attempt
      debug('[verify-email] onVerifyOtp - keeping verificationAttemptedRef set to prevent infinite loop');
      // The ref will be reset when user types a new digit (in the auto-submit effect when length < 6)
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Verify your email</Text>
        
        <Text style={styles.description}>
          Enter the 6-digit code we emailed to {pendingEmail || userEmail || 'your email'}.
        </Text>

        <View style={styles.formContainer}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {statusMsg ? (
            <Text style={styles.statusText}>{statusMsg}</Text>
          ) : (
            <Text style={styles.instructionText}>
              Check your email for the 6-digit code.
            </Text>
          )}
          <TextInput
            value={otpCode}
            onChangeText={(text) => {
              debug('[verify-email] OTP input changed', { 
                oldLength: otpCode.length, 
                newLength: text.length,
                text: text.length > 0 ? '***' : 'empty',
              });
              setOtpCode(text);
            }}
            placeholder="Enter 6-digit code"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={() => {
              debug('[verify-email] OTP input onSubmitEditing', { 
                otpCodeLength: otpCode.length, 
                busy,
                shouldSubmit: otpCode.length === 6 && !busy,
              });
              if (otpCode.length === 6 && !busy) {
                debug('[verify-email] OTP input onSubmitEditing - submitting');
                Keyboard.dismiss();
                onVerifyOtp();
              } else {
                debug('[verify-email] OTP input onSubmitEditing - not submitting', {
                  otpCodeLength: otpCode.length,
                  busy,
                });
              }
            }}
            onBlur={() => {
              debug('[verify-email] OTP input onBlur');
              Keyboard.dismiss();
            }}
            onFocus={() => {
              debug('[verify-email] OTP input onFocus', { otpCodeLength: otpCode.length });
            }}
            style={styles.input}
          />
          <TouchableOpacity
            onPress={() => {
              debug('[verify-email] Verify button pressed', { 
                busy, 
                isVerifying, 
                isLoading, 
                isSending,
                otpCodeLength: otpCode.length,
              });
              onVerifyOtp();
            }}
            disabled={busy}
            style={[styles.button, busy && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>{verifyLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSendOtp}
            disabled={busy || cooldown > 0}
            style={styles.resendButton}
          >
            <Text style={[styles.resendText, (busy || cooldown > 0) && styles.resendTextDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend 6-digit code'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  formContainer: {
    width: '100%',
    gap: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    textAlign: 'center',
  },
  statusText: {
    color: '#111827',
    fontSize: 14,
    textAlign: 'center',
  },
  instructionText: {
    color: '#4b5563',
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  resendText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: '#9CA3AF',
  },
});
