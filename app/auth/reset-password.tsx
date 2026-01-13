import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, StyleSheet, useColorScheme, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('ResetPassword');

export default function ResetPassword() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string; type?: string }>();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sessionSet, setSessionSet] = useState(false);

  // Set session from URL parameters OR check existing session when component mounts
  useEffect(() => {
    const initializeSession = async () => {
      const { access_token, refresh_token, type } = params;
      
      // First, check if we already have a session (from code exchange in auth-callback)
      // @ts-ignore - supabase client has full auth API
      const { data: sessionData } = await (supabase as any).auth.getSession();
      
      if (sessionData?.session) {
        debug.debug('Session already exists from code exchange, using it');
        setSessionSet(true);
        return;
      }
      
      // Otherwise, try to set session from URL parameters (direct token flow)
      if (type === 'recovery' && access_token && refresh_token) {
        try {
          debug.debug('Setting session from password reset tokens in URL');
          // @ts-ignore - supabase client has full auth API
          const { error: sessionError } = await (supabase as any).auth.setSession({
            access_token,
            refresh_token,
          });

          if (sessionError) {
            debug.error('Error setting session:', sessionError);
            setError('Invalid or expired reset link. Please request a new password reset.');
            return;
          }

          debug.debug('Session set successfully from URL tokens');
          setSessionSet(true);
        } catch (e) {
          debug.error('Failed to set session:', e);
          setError('Failed to authenticate reset link. Please try again.');
        }
      } else {
        // No session and no URL params - wait a bit and check again
        // This handles the case where code exchange is still in progress
        debug.debug('No session found yet, waiting for code exchange to complete...');
        
        // Wait a moment for code exchange to complete (if coming from auth-callback)
        // Try multiple times with increasing delays
        let retryCount = 0;
        const maxRetries = 5;
        const checkSession = async () => {
          // @ts-ignore - supabase client has full auth API
          const { data: retrySessionData } = await (supabase as any).auth.getSession();
          
          if (retrySessionData?.session) {
            debug.debug('Session found after retry', { retryCount });
            setSessionSet(true);
          } else if (retryCount < maxRetries) {
            retryCount++;
            debug.debug('No session yet, retrying...', { retryCount });
            setTimeout(checkSession, 300); // Wait 300ms between retries
          } else {
            debug.warn('No session found after all retries and no valid reset password parameters', { 
              hasType: !!type, 
              type, 
              hasAccessToken: !!access_token,
              hasRefreshToken: !!refresh_token,
              hasExistingSession: !!retrySessionData?.session,
            });
            setError('Invalid reset link. Please request a new password reset.');
          }
        };
        
        // Start checking after initial delay
        setTimeout(checkSession, 300);
      }
    };

    initializeSession();
  }, [params]);

  const onSubmit = async () => {
    if (!sessionSet) {
      setError('Please wait while we verify your reset link...');
      return;
    }

    // Validate passwords
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError(null);
    setStatus(null);
    setLoading(true);

    try {
      debug.debug('Updating password');
      // @ts-ignore - supabase client has full auth API
      const { error: updateError } = await (supabase as any).auth.updateUser({
        password: password,
      });

      if (updateError) {
        debug.error('Error updating password:', updateError);
        throw updateError;
      }

      debug.debug('Password updated successfully');
      setStatus('Password updated successfully! Redirecting...');
      
      // Wait a moment then redirect to sign in
      setTimeout(() => {
        router.replace('/auth/sign-in');
      }, 1500);
    } catch (e) {
      debug.error('Failed to update password:', e);
      setError(e instanceof Error ? e.message : 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, isDark && styles.darkTitle]}>Reset password</Text>
            <Text style={[styles.subtitle, isDark && styles.darkSubtitle]}>
              {sessionSet ? 'Enter your new password' : 'Verifying reset link...'}
            </Text>
          </View>
          <View style={[styles.card, isDark && styles.darkCard]}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {status ? <Text style={[styles.status, isDark && styles.darkStatus]}>{status}</Text> : null}
            
            {sessionSet ? (
              <>
                <View style={styles.field}>
                  <Text style={[styles.label, isDark && styles.darkLabel]}>New password</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={isDark ? '#666' : '#999'}
                    secureTextEntry
                    autoCapitalize="none"
                    style={[styles.input, isDark && styles.darkInput]}
                    editable={!loading}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={[styles.label, isDark && styles.darkLabel]}>Confirm password</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={isDark ? '#666' : '#999'}
                    secureTextEntry
                    autoCapitalize="none"
                    style={[styles.input, isDark && styles.darkInput]}
                    editable={!loading}
                    onSubmitEditing={onSubmit}
                  />
                </View>
                <TouchableOpacity
                  onPress={onSubmit}
                  disabled={loading || !password || !confirmPassword}
                  style={[styles.button, (loading || !password || !confirmPassword) && styles.buttonDisabled]}
                >
                  <Text style={styles.buttonText}>
                    {loading ? 'Updating...' : 'Update password'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, isDark && styles.darkLoadingText]}>
                  Verifying your reset link...
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  darkTitle: {
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  darkSubtitle: {
    color: '#aaa',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
    shadowOpacity: 0.3,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  darkLabel: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  darkInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#444',
    color: '#fff',
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
  },
  status: {
    color: '#0f172a',
    fontSize: 14,
  },
  darkStatus: {
    color: '#d1d5db',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  darkLoadingText: {
    color: '#aaa',
  },
});
