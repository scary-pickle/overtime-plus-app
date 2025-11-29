import { create } from 'zustand';
import { supabase, supabaseEnabled } from '../supabase';
import { isAllowedDomain, isValidEmail, validatePasswordStrength } from '../auth/validation';
import { toFriendlyAuthMessage } from '../auth/errors';
import { useOnboardingStore } from './onboardingStore';
import { useSubscriptionStore } from './subscriptionStore';
import { revenuecatClient } from '../subscription/revenuecat';
import { database } from '../db/sqlite';
import { profileStorage } from '../storage/profile';
import * as SecureStore from 'expo-secure-store';
import { createScopedLogger, maskEmail, maskUserId } from '../utils/logger';
import { clearCachedPdfsForBatches, deleteStoredPdfs } from '../storage/pdfStorage';

const CURRENT_USER_ID_KEY = 'overtime_plus_current_user_id';
const debug = createScopedLogger('authStore');

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  error: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  pendingPassword: string | null;
  hasCompletedOnboarding: boolean;
  isDeletingAccount: boolean;

  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<'success' | 'verify' | 'error'>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  requestEmailOtp: (email: string, shouldCreateUser?: boolean) => Promise<boolean>;
  verifyEmailOtp: (email: string, token: string) => Promise<'success' | 'error'>;
  completeOnboarding: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true, // Start as true - we haven't checked session yet
  error: null,
  emailVerified: false,
  pendingEmail: null,
  pendingPassword: null,
  hasCompletedOnboarding: false,
  isDeletingAccount: false,

  clearError: () => set({ error: null }),

  checkSession: async () => {
    set({ isLoading: true, error: null });
    try {
      debug.debug('Getting session from Supabase...');
      
      // Supabase automatically restores session from storage when client is initialized
      // However, this happens asynchronously, so we may need to wait a bit
      // Try getSession() with a small delay to allow restoration to complete
      let session = null;
      let user = null;
      let error: any = null;
      
      // Try up to 3 times with increasing delays to allow session restoration
      for (let attempt = 1; attempt <= 3; attempt++) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        error = result?.error;
        session = result?.data?.session ?? null;
        user = session?.user ?? null;
        
        debug.debug('getSession attempt ' + attempt + ':', {
          hasData: !!result?.data,
          hasSession: !!session,
          hasUser: !!user,
          hasError: !!error,
          errorMessage: error?.message,
        });
        
        if (session && user) {
          debug.debug('Session found on attempt ' + attempt);
          break;
        }
        
        // If no session found and not the last attempt, wait a bit before retrying
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
      
      if (error) throw error;

      // If we have a session, verify the user still exists in Supabase
      if (session && user) {
        debug.debug('Verifying user still exists...', { userId: maskUserId(user.id) });
        try {
          // Verify the user still exists by calling getUser() - this will fail if user was deleted
          // @ts-ignore
          const { data: userData, error: userError } = await (supabase as any).auth.getUser();
          if (userError) {
            debug.error('User validation failed - user may have been deleted:', userError);
            // User was likely deleted or session is invalid - clear it
            await (supabase as any).auth.signOut();
            set({
              session: null,
              user: null,
              emailVerified: false,
              hasCompletedOnboarding: false,
              isLoading: false,
            });
            debug.debug('Session cleared due to invalid user');
            return;
          }
          debug.debug('User verified successfully');
        } catch (verifyError) {
          debug.error('Error verifying user:', verifyError);
          // If verification fails, clear the session to be safe
          await (supabase as any).auth.signOut();
          set({
            session: null,
            user: null,
            emailVerified: false,
            hasCompletedOnboarding: false,
            isLoading: false,
          });
          debug.debug('Session cleared due to verification error');
          return;
        }
      }

      // Check onboarding status and get the result directly
      const onboardingStore = useOnboardingStore.getState();
      const hasCompletedOnboarding = await onboardingStore.checkOnboardingStatus(user?.id);

      // Store current user ID in SecureStore for widget access
      if (user?.id) {
        await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, user.id);
      } else {
        await SecureStore.deleteItemAsync(CURRENT_USER_ID_KEY);
      }

      debug.debug('Setting state:', {
        hasSession: !!session,
        hasUser: !!user,
        userId: maskUserId(user?.id),
        emailVerified: !!user?.email_confirmed_at,
        hasCompletedOnboarding,
      });
      
      set({
        session,
        user,
        emailVerified: !!user?.email_confirmed_at,
        hasCompletedOnboarding,
        isLoading: false,
      });
      
      debug.debug('State set complete');
    } catch (e) {
      debug.error('Error getting session:', e);
      // Clear session on error
      await (supabase as any).auth.signOut();
      set({
        session: null,
        user: null,
        emailVerified: false,
        hasCompletedOnboarding: false,
        isLoading: false,
        error: toFriendlyAuthMessage(e instanceof Error ? e.message : 'Failed to get session'),
      });
    }
  },

  signIn: async (email: string, password: string) => {
    const emailMasked = email.replace(/(^.).+(@.*$)/, '$1***$2');
    debug.debug('===== SIGN IN START =====');
    debug.debug('signing in', { emailMasked, passwordLength: password.length });
    set({ isLoading: true, error: null });
    debug.debug('set isLoading to true');
    try {
      debug.debug('calling supabase.auth.signInWithPassword');
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signInWithPassword({ email, password });
      debug.debug('signInWithPassword response', {
        hasData: !!data,
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        hasError: !!error,
        errorCode: (error as any)?.code,
        errorMessage: error?.message,
        errorStatus: (error as any)?.status,
      });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        debug.error('error received', { message: msg, fullMessage: error.message });
        if (msg.includes('email not confirmed') || msg.includes('confirm your email') || msg.includes('email not verified')) {
          debug.debug('email not confirmed - redirecting to verify');
          set({
            isLoading: false,
            error: toFriendlyAuthMessage(error.message),
            pendingEmail: email,
            emailVerified: false,
          });
          debug.debug('===== SIGN IN - NEEDS VERIFICATION =====');
          return 'verify';
        }
        debug.error('throwing error', { message: error.message });
        throw error;
      }
      let session = data?.session ?? null;
      let user = session?.user ?? null;
      debug.debug('success - extracting session/user', {
        hasSession: !!session,
        hasUser: !!user,
        userId: maskUserId(user?.id),
        userEmail: maskEmail(user?.email),
        emailConfirmedAt: user?.email_confirmed_at,
        emailVerified: !!user?.email_confirmed_at,
      });
      
      // Explicitly set session on Supabase client to ensure it's available for subsequent requests
      // This is important for session persistence across app restarts
      if (session) {
        try {
          debug.debug('Setting session on Supabase client after sign-in');
          // @ts-ignore
          const { data: setData, error: setError } = await (supabase as any).auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          if (setError) {
            debug.warn('Error setting session after sign-in (non-fatal):', setError);
          } else if (setData?.session) {
            debug.debug('Session set on client successfully');
            // Use the session returned from setSession as it may have updated tokens
            session = setData.session;
            user = session?.user ?? null;
          }
        } catch (setSessionError) {
          debug.warn('Exception setting session after sign-in (non-fatal):', setSessionError);
          // Continue anyway - the session should still be stored by the storage adapter
        }
      }
      
      // Check onboarding status
      const onboardingStore = useOnboardingStore.getState();
      await onboardingStore.checkOnboardingStatus(user?.id);

      // Store current user ID in SecureStore for widget access
      if (user?.id) {
        await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, user.id);
      }

      set({
        session,
        user,
        emailVerified: !!user?.email_confirmed_at,
        pendingEmail: null,
        pendingPassword: null,
        hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
        isLoading: false,
      });
      debug.debug('===== SIGN IN COMPLETE - SUCCESS =====');
      return 'success';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed';
      debug.error('===== SIGN IN FAILED =====', {
        message: msg,
        error: e,
        errorString: String(e),
        errorName: e instanceof Error ? e.name : 'Unknown',
        errorCode: (e as any)?.code,
      });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return 'error';
    }
  },

  signUp: async (email: string, password: string) => {
    debug.debug('invoked', { emailMasked: email.replace(/(^.).+(@.*$)/, '$1***$2') });
    set({ isLoading: true, error: null });
    try {
      if (!isValidEmail(email)) {
        debug.error('invalid email format');
        throw new Error('Invalid email format');
      }
      if (!isAllowedDomain(email)) {
        debug.error('domain not allowed');
        throw new Error('Email domain not allowed');
      }
      const pw = validatePasswordStrength(password);
      if (!pw.valid) {
        debug.error('password weak', { issues: pw.errors });
        throw new Error(`Password requirements: ${pw.errors.join(', ')}`);
      }
      // Use normal signUp flow - it will send "Confirm sign up" email template (configured to show OTP code)
      debug.debug('calling supabase.auth.signUp');
      
      // Validate Supabase URL format before making request
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
        debug.error('Invalid Supabase URL:', supabaseUrl);
        throw new Error('Supabase URL is not configured correctly. Please check your environment variables.');
      }
      
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Don't send redirect links, just OTP code in email
        },
      });
      if (error) {
        debug.error('supabase error', { 
          code: (error as any)?.code, 
          message: error.message,
          status: (error as any)?.status,
          name: error.name,
          stack: error.stack,
        });
        
        // Provide more helpful error messages
        if (error.message?.includes('Network request failed') || error.message?.includes('fetch')) {
          throw new Error('Unable to connect to Supabase. Please check:\n1. Your internet connection\n2. Your Supabase URL is correct\n3. Your Supabase project is active');
        }
        
        throw error;
      }
      debug.debug('signup response', { hasUser: !!data?.user, hasSession: !!data?.session });
      // User created, confirmation email sent (configured to show OTP code in template)
      set({
        pendingEmail: email,
        pendingPassword: password,
        emailVerified: false,
        isLoading: false,
        user: data?.user ?? null,
        session: null,
      });
      debug.debug('completed OK');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed';
      debug.error('failed', { message: msg });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return false;
    }
  },

  requestEmailOtp: async (email: string, shouldCreateUser = false) => {
    const emailMasked = email.replace(/(^.).+(@.*$)/, '$1***$2');
    debug.debug('sending OTP', { emailMasked, shouldCreateUser });
    set({ isLoading: true, error: null });
    try {
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signInWithOtp({
        email,
        options: { 
          shouldCreateUser,
          emailRedirectTo: undefined, // Don't send redirect links, only OTP codes
        },
      });
      debug.debug('response', { 
        hasData: !!data, 
        hasError: !!error,
        errorCode: (error as any)?.code,
        errorMessage: error?.message,
        dataKeys: data ? Object.keys(data) : [],
      });
      if (error) {
        debug.error('error details', { 
          code: (error as any)?.code,
          message: error.message,
          status: (error as any)?.status,
        });
        throw error;
      }
      debug.debug('OTP sent successfully');
      set({ pendingEmail: email, isLoading: false });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send code';
      debug.error('failed', { 
        message: msg,
        error: e,
        errorString: String(e),
      });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return false;
    }
  },

  verifyEmailOtp: async (email: string, token: string) => {
    const emailMasked = email.replace(/(^.).+(@.*$)/, '$1***$2');
    debug.debug('===== VERIFY OTP START =====');
    debug.debug('verifying', { 
      emailMasked, 
      email: maskEmail(email), 
      tokenLength: token.length,
      token: token.length > 0 ? '***' : 'empty',
    });
    debug.debug('current state before verification', {
      pendingEmail: get().pendingEmail,
      pendingPassword: !!get().pendingPassword,
      hasUser: !!get().user,
      hasSession: !!get().session,
      emailVerified: get().emailVerified,
    });
    set({ isLoading: true, error: null });
    debug.debug('set isLoading to true');
    try {
      const attemptTypes: Array<'email' | 'signup'> = ['email', 'signup'];
      let session: any = null;
      let lastError: Error | null = null;
      debug.debug('starting verification attempts', { attemptTypes });
      for (const type of attemptTypes) {
        debug.debug('===== Attempting verification with type:', type, '=====');
        debug.debug('calling supabase.auth.verifyOtp', { 
          email: maskEmail(email), 
          tokenLength: token.length,
          type,
        });
        // @ts-ignore
        const { data, error } = await (supabase as any).auth.verifyOtp({ email, token, type });
        debug.debug('verifyOtp response received', {
          type,
          hasData: !!data,
          hasSession: !!data?.session,
          hasUser: !!data?.user,
          hasError: !!error,
          errorCode: (error as any)?.code,
          errorMessage: error?.message,
          errorStatus: (error as any)?.status,
          errorName: error?.name,
          dataKeys: data ? Object.keys(data) : [],
          sessionKeys: data?.session ? Object.keys(data.session) : [],
          userKeys: data?.user ? Object.keys(data.user) : [],
        });
        if (!error && (data?.session || data?.user)) {
          debug.debug('SUCCESS with type', type);
          session = data?.session ?? null;
          lastError = null;
          debug.debug('session extracted', {
            hasSession: !!session,
            sessionKeys: session ? Object.keys(session) : [],
            userId: maskUserId(session?.user?.id),
            userEmail: maskEmail(session?.user?.email),
          });
          // Set session immediately after verification to ensure it's available for subsequent requests
          if (session) {
            debug.debug('Setting session on Supabase client immediately after verification');
            // @ts-ignore
            const { data: setData, error: setError } = await (supabase as any).auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
            if (setError) {
              debug.error('Error setting session:', setError);
            } else if (setData?.session) {
              session = setData.session;
              debug.debug('Session set on client successfully');
              // Wait for session to propagate (SecureStore operations are async)
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Try to verify session, but don't fail if it's not immediately available
              let sessionVerified = false;
              for (let attempt = 1; attempt <= 3; attempt++) {
                // @ts-ignore
                const verifyResult = await (supabase as any).auth.getSession();
                if (verifyResult?.error) {
                  debug.error('Session verification error (attempt ' + attempt + '):', verifyResult.error);
                } else if (verifyResult?.data?.session) {
                  sessionVerified = true;
                  debug.debug('Session verified (attempt ' + attempt + ')');
                  break;
                } else {
                  debug.debug('Session not yet available in getSession (attempt ' + attempt + ')');
                }
                
                if (attempt < 3) {
                  await new Promise(resolve => setTimeout(resolve, 200 * attempt));
                }
              }
              
              if (!sessionVerified) {
                debug.warn('WARNING: Session not verified via getSession, but setSession succeeded - proceeding anyway');
              }
            } else {
              debug.debug('setSession did not return a session; continuing with verifyOtp session');
            }
          }
          break;
        }
        if (error) {
          lastError = error;
          debug.error('FAILED with type', type, { 
            message: error.message,
            code: (error as any)?.code,
            status: (error as any)?.status,
            name: error.name,
            errorString: String(error),
            errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          });
        }
      }
      debug.debug('after loop', {
        hasSession: !!session,
        hasLastError: !!lastError,
        lastErrorMessage: lastError?.message,
      });
      if (!session) {
        debug.debug('no session from verifyOtp, trying getSession fallback');
        // Ensure we have an active session in case verifyOtp returned only a user object
        // @ts-ignore
        const { data: fallbackSession, error: fallbackError } = await (supabase as any).auth.getSession();
        debug.debug('getSession fallback result', {
          hasSession: !!fallbackSession?.session,
          hasError: !!fallbackError,
          errorMessage: fallbackError?.message,
        });
        if (fallbackSession?.session) {
          session = fallbackSession.session;
          debug.debug('using fallback session', {
            hasSession: !!session,
            userId: session?.user?.id,
          });
        } else if (fallbackError) {
          lastError = fallbackError;
          debug.error('fallback getSession error', {
            message: fallbackError.message,
            code: (fallbackError as any)?.code,
          });
        }
      }
      if (!session) {
        debug.error('NO SESSION FOUND - throwing error');
        if (lastError) {
          debug.error('throwing lastError', {
            message: lastError.message,
            code: (lastError as any)?.code,
            name: lastError.name,
          });
          throw lastError;
        }
        debug.error('throwing generic error');
        throw new Error('Verification failed. Try again.');
      }
      debug.debug('session found, checking pending password', {
        hasPendingPassword: !!get().pendingPassword,
        hasSessionUser: !!session.user,
      });
      // Only set password if user was created without one (OTP-only signup)
      // If user was created via signUp with password, it's already set, so skip
      const pendingPassword = get().pendingPassword;
      if (pendingPassword && session.user) {
        debug.debug('attempting to apply pending password');
        // Check if user already has a password set (if they do, skip update)
        // We can't easily check this, so we'll try to update and ignore "same password" errors
        try {
          debug.debug('calling updateUser with password');
          // @ts-ignore
          const { error } = await (supabase as any).auth.updateUser({ password: pendingPassword });
          if (error && !error.message.includes('same password')) {
            debug.warn('password update error (non-fatal)', { 
              message: error.message,
              code: (error as any)?.code,
            });
            // Don't throw - password might already be set, verification succeeded
          } else {
            debug.debug('password update successful or same password');
          }
        } catch (e) {
          // Ignore password update errors - verification already succeeded
          debug.warn('password update failed (non-fatal)', {
            error: e,
            errorString: String(e),
          });
        }
      }
      debug.debug('fetching fresh session to ensure flags are updated');
      // Fetch fresh session/user to ensure flags are updated
      // The session should already be set from the verification step above
      // @ts-ignore
      let latestData = await (supabase as any).auth.getSession();
      let latest = latestData?.data;
      if (latestData?.error || !latest?.session) {
        debug.error('Error getting session after verification, retrying setSession:', latestData?.error);
        // If getSession fails or returns no session, try setting the session again
        if (session) {
          debug.debug('Retrying setSession due to getSession error');
          // @ts-ignore
          const { data: retrySet } = await (supabase as any).auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          const retrySession = retrySet?.session ?? session;
          session = retrySession;
          // Try getSession again
          // @ts-ignore
          const retryData = await (supabase as any).auth.getSession();
          latest = retryData?.data ?? { session: retrySession };
        }
     }
      const finalSession = latest?.session ?? session;
      const finalUser = finalSession?.user ?? null;
      debug.debug('final session/user state', {
        hasFinalSession: !!finalSession,
        hasFinalUser: !!finalUser,
        userId: maskUserId(finalUser?.id),
        userEmail: maskEmail(finalUser?.email),
        emailConfirmedAt: finalUser?.email_confirmed_at,
        emailVerified: !!finalUser?.email_confirmed_at,
      });
      // Check onboarding status (new users will have onboarding incomplete)
      const onboardingStore = useOnboardingStore.getState();
      await onboardingStore.checkOnboardingStatus(finalUser?.id);

      // Store current user ID in SecureStore for widget access
      if (finalUser?.id) {
        await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, finalUser.id);
      }

      debug.debug('updating store state');
      set({
        session: finalSession,
        user: finalUser,
        emailVerified: true,
        pendingEmail: null,
        pendingPassword: null,
        hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
        isLoading: false,
      });
      debug.debug('===== VERIFICATION COMPLETE - SUCCESS =====', { 
        hasUser: !!finalUser,
        emailVerified: true,
        hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
      });
      return 'success';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to verify code';
      debug.error('===== VERIFICATION FAILED =====', { 
        message: msg,
        error: e,
        errorString: String(e),
        errorName: e instanceof Error ? e.name : 'Unknown',
        errorCode: (e as any)?.code,
        errorStack: e instanceof Error ? e.stack : undefined,
      });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      debug.debug('set isLoading to false and error to:', toFriendlyAuthMessage(msg));
      return 'error';
    }
  },

  completeOnboarding: async () => {
    const { user } = get();
    const onboardingStore = useOnboardingStore.getState();
    await onboardingStore.completeOnboarding(user?.id);
    set({ hasCompletedOnboarding: true });
  },

  deleteAccount: async () => {
    const { user } = get();
    const userId = user?.id || null;
    const now = new Date().toISOString();
    set({ isDeletingAccount: true, error: null });

    try {
      // Flag cloud data for deletion (best-effort, non-blocking)
      if (supabaseEnabled && userId) {
        try {
          await (supabase as any).from('profiles').update({ account_deleted_at: now }).eq('user_id', userId);
        } catch (error) {
          debug.error('[deleteAccount] Failed to mark profile deleted in Supabase', error);
        }

        const tables = ['overtime_logs', 'usual_shifts', 'export_batches'] as const;
        for (const table of tables) {
          try {
            await (supabase as any).from(table).update({ deleted_at: now }).eq('user_id', userId);
          } catch (error) {
            debug.error(`[deleteAccount] Failed to flag ${table} rows for deletion`, error);
          }
        }

        try {
          const functionsClient = (supabase as any).functions;
          if (!functionsClient?.invoke) {
            throw new Error('Supabase functions client unavailable');
          }

          const { error: hardDeleteError } = await functionsClient.invoke('delete-account', {
            body: { reason: 'user_initiated' },
          });

          if (hardDeleteError) {
            throw hardDeleteError;
          }
        } catch (error) {
          debug.error('[deleteAccount] Hard delete function failed', error);
          throw new Error('Failed to remove your cloud backups. Please try again.');
        }
      }

      // Sign out from RevenueCat to clear entitlement state
      try {
        await revenuecatClient.logOut();
      } catch (error) {
        debug.error('[deleteAccount] RevenueCat logout failed (non-fatal)', error);
      }

      // Gather export batches before clearing DB for later cleanup
      let exportBatches: any[] = [];
      try {
        await database.init();
        exportBatches = await database.getExportBatches(userId);
      } catch (error) {
        debug.error('[deleteAccount] Failed to load export batches for cleanup (non-fatal)', error);
      }

      // Wipe local profile and cached data
      try {
        await profileStorage.deleteProfile(userId);
      } catch (error) {
        debug.error('[deleteAccount] Failed to delete local profile', error);
      }

      try {
        await database.clearAllData();
        await database.clearAuthSessions();
        await database.clearLegacyData();
      } catch (error) {
        debug.error('[deleteAccount] Failed to clear local database', error);
      }

      // Reset onboarding flag locally (and remotely if possible)
      try {
        const onboardingStore = useOnboardingStore.getState();
        await onboardingStore.resetOnboarding(userId);
      } catch (error) {
        debug.error('[deleteAccount] Failed to reset onboarding flags', error);
      }

      // Clean up cached PDFs locally and in storage (best-effort)
      if (exportBatches.length > 0) {
        try {
          await clearCachedPdfsForBatches(exportBatches);
          await deleteStoredPdfs(exportBatches);
        } catch (error) {
          debug.error('[deleteAccount] Failed to clean up PDFs (non-fatal)', error);
        }
      }

      // Sign out of Supabase and clear stored IDs
      try {
        // @ts-ignore
        await (supabase as any).auth.signOut();
      } catch (error) {
        debug.error('[deleteAccount] Supabase signOut failed (non-fatal)', error);
      }
      await SecureStore.deleteItemAsync(CURRENT_USER_ID_KEY);

      // Reset subscription state
      const subscriptionStore = useSubscriptionStore.getState();
      subscriptionStore.reset();

      set({
        user: null,
        session: null,
        emailVerified: false,
        hasCompletedOnboarding: false,
        pendingEmail: null,
        pendingPassword: null,
        isLoading: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete account';
      debug.error('[deleteAccount] Failed', e);
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      throw e;
    } finally {
      set({ isDeletingAccount: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      // @ts-ignore
      const { error } = await (supabase as any).auth.signOut();
      if (error) throw error;
      
      // Clear current user ID from SecureStore
      await SecureStore.deleteItemAsync(CURRENT_USER_ID_KEY);
      
      // Reset subscription cache and RevenueCat identity
      // Safely log out from RevenueCat (may fail if native module not available)
      try {
        await revenuecatClient.logOut();
      } catch (error) {
        // Ignore errors - native module may not be available
      }
      const subscriptionStore = useSubscriptionStore.getState();
      subscriptionStore.reset();
      
      set({
        user: null,
        session: null,
        emailVerified: false,
        hasCompletedOnboarding: false,
        pendingEmail: null,
        pendingPassword: null,
        isLoading: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign out failed';
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
    }
  },
}));
