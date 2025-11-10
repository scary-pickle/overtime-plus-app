import { create } from 'zustand';
import { supabase } from '../supabase';
import { isAllowedDomain, isValidEmail, validatePasswordStrength } from '../auth/validation';
import { toFriendlyAuthMessage } from '../auth/errors';
import { useOnboardingStore } from './onboardingStore';
import * as SecureStore from 'expo-secure-store';

const CURRENT_USER_ID_KEY = 'overtime_plus_current_user_id';
const isDev = process.env.NODE_ENV !== 'production';
const debug = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};

const maskEmail = (email?: string | null) => {
  if (!email) return undefined;
  const [local, domain] = email.split('@');
  if (!domain || !local) return '***';
  return `${local[0]}***@${domain}`;
};

const maskUserId = (id?: string | null) => (id ? `${id.substring(0, 8)}...` : undefined);

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  error: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  pendingPassword: string | null;
  hasCompletedOnboarding: boolean;

  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<'success' | 'verify' | 'error'>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
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

  clearError: () => set({ error: null }),

  checkSession: async () => {
    set({ isLoading: true, error: null });
    try {
      debug('[authStore.checkSession] Getting session from Supabase...');
      
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
        
        debug('[authStore.checkSession] getSession attempt ' + attempt + ':', {
          hasData: !!result?.data,
          hasSession: !!session,
          hasUser: !!user,
          hasError: !!error,
          errorMessage: error?.message,
        });
        
        if (session && user) {
          debug('[authStore.checkSession] Session found on attempt ' + attempt);
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
        debug('[authStore.checkSession] Verifying user still exists...', { userId: maskUserId(user.id) });
        try {
          // Verify the user still exists by calling getUser() - this will fail if user was deleted
          // @ts-ignore
          const { data: userData, error: userError } = await (supabase as any).auth.getUser();
          if (userError) {
            debug('[authStore.checkSession] User validation failed - user may have been deleted:', userError);
            // User was likely deleted or session is invalid - clear it
            await (supabase as any).auth.signOut();
            set({
              session: null,
              user: null,
              emailVerified: false,
              hasCompletedOnboarding: false,
              isLoading: false,
            });
            debug('[authStore.checkSession] Session cleared due to invalid user');
            return;
          }
          debug('[authStore.checkSession] User verified successfully');
        } catch (verifyError) {
          debug('[authStore.checkSession] Error verifying user:', verifyError);
          // If verification fails, clear the session to be safe
          await (supabase as any).auth.signOut();
          set({
            session: null,
            user: null,
            emailVerified: false,
            hasCompletedOnboarding: false,
            isLoading: false,
          });
          debug('[authStore.checkSession] Session cleared due to verification error');
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

      debug('[authStore.checkSession] Setting state:', {
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
      
      debug('[authStore.checkSession] State set complete');
    } catch (e) {
      debug('[authStore.checkSession] Error getting session:', e);
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
    debug('[authStore.signIn] ===== SIGN IN START =====');
    debug('[authStore.signIn] signing in', { emailMasked, passwordLength: password.length });
    set({ isLoading: true, error: null });
    debug('[authStore.signIn] set isLoading to true');
    try {
      debug('[authStore.signIn] calling supabase.auth.signInWithPassword');
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signInWithPassword({ email, password });
      debug('[authStore.signIn] signInWithPassword response', {
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
        debug('[authStore.signIn] error received', { message: msg, fullMessage: error.message });
        if (msg.includes('email not confirmed') || msg.includes('confirm your email') || msg.includes('email not verified')) {
          debug('[authStore.signIn] email not confirmed - redirecting to verify');
          set({
            isLoading: false,
            error: toFriendlyAuthMessage(error.message),
            pendingEmail: email,
            emailVerified: false,
          });
          debug('[authStore.signIn] ===== SIGN IN - NEEDS VERIFICATION =====');
          return 'verify';
        }
        debug('[authStore.signIn] throwing error', { message: error.message });
        throw error;
      }
      const session = data?.session ?? null;
      const user = session?.user ?? null;
      debug('[authStore.signIn] success - extracting session/user', {
        hasSession: !!session,
        hasUser: !!user,
        userId: maskUserId(user?.id),
        userEmail: maskEmail(user?.email),
        emailConfirmedAt: user?.email_confirmed_at,
        emailVerified: !!user?.email_confirmed_at,
      });
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
      debug('[authStore.signIn] ===== SIGN IN COMPLETE - SUCCESS =====');
      return 'success';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed';
      debug('[authStore.signIn] ===== SIGN IN FAILED =====', {
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
    debug('[authStore.signUp] invoked', { emailMasked: email.replace(/(^.).+(@.*$)/, '$1***$2') });
    set({ isLoading: true, error: null });
    try {
      if (!isValidEmail(email)) {
        debug('[authStore.signUp] invalid email format');
        throw new Error('Invalid email format');
      }
      if (!isAllowedDomain(email)) {
        debug('[authStore.signUp] domain not allowed');
        throw new Error('Email domain not allowed');
      }
      const pw = validatePasswordStrength(password);
      if (!pw.valid) {
        debug('[authStore.signUp] password weak', { issues: pw.errors });
        throw new Error(`Password requirements: ${pw.errors.join(', ')}`);
      }
      // Use normal signUp flow - it will send "Confirm sign up" email template (configured to show OTP code)
      debug('[authStore.signUp] calling supabase.auth.signUp');
      
      // Validate Supabase URL format before making request
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
        debug('[authStore.signUp] Invalid Supabase URL:', supabaseUrl);
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
        debug('[authStore.signUp] supabase error', { 
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
      debug('[authStore.signUp] signup response', { hasUser: !!data?.user, hasSession: !!data?.session });
      // User created, confirmation email sent (configured to show OTP code in template)
      set({
        pendingEmail: email,
        pendingPassword: password,
        emailVerified: false,
        isLoading: false,
        user: data?.user ?? null,
        session: null,
      });
      debug('[authStore.signUp] completed OK');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed';
      debug('[authStore.signUp] failed', { message: msg });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return false;
    }
  },

  requestEmailOtp: async (email: string, shouldCreateUser = false) => {
    const emailMasked = email.replace(/(^.).+(@.*$)/, '$1***$2');
    debug('[authStore.requestEmailOtp] sending OTP', { emailMasked, shouldCreateUser });
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
      debug('[authStore.requestEmailOtp] response', { 
        hasData: !!data, 
        hasError: !!error,
        errorCode: (error as any)?.code,
        errorMessage: error?.message,
        dataKeys: data ? Object.keys(data) : [],
      });
      if (error) {
        debug('[authStore.requestEmailOtp] error details', { 
          code: (error as any)?.code,
          message: error.message,
          status: (error as any)?.status,
        });
        throw error;
      }
      debug('[authStore.requestEmailOtp] OTP sent successfully');
      set({ pendingEmail: email, isLoading: false });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send code';
      debug('[authStore.requestEmailOtp] failed', { 
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
    debug('[authStore.verifyEmailOtp] ===== VERIFY OTP START =====');
    debug('[authStore.verifyEmailOtp] verifying', { 
      emailMasked, 
      email: maskEmail(email), 
      tokenLength: token.length,
      token: token.length > 0 ? '***' : 'empty',
    });
    debug('[authStore.verifyEmailOtp] current state before verification', {
      pendingEmail: get().pendingEmail,
      pendingPassword: !!get().pendingPassword,
      hasUser: !!get().user,
      hasSession: !!get().session,
      emailVerified: get().emailVerified,
    });
    set({ isLoading: true, error: null });
    debug('[authStore.verifyEmailOtp] set isLoading to true');
    try {
      const attemptTypes: Array<'email' | 'signup'> = ['email', 'signup'];
      let session: any = null;
      let lastError: Error | null = null;
      debug('[authStore.verifyEmailOtp] starting verification attempts', { attemptTypes });
      for (const type of attemptTypes) {
        debug('[authStore.verifyEmailOtp] ===== Attempting verification with type:', type, '=====');
        debug('[authStore.verifyEmailOtp] calling supabase.auth.verifyOtp', { 
          email: maskEmail(email), 
          tokenLength: token.length,
          type,
        });
        // @ts-ignore
        const { data, error } = await (supabase as any).auth.verifyOtp({ email, token, type });
        debug('[authStore.verifyEmailOtp] verifyOtp response received', {
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
          debug('[authStore.verifyEmailOtp] SUCCESS with type', type);
          session = data?.session ?? null;
          lastError = null;
          debug('[authStore.verifyEmailOtp] session extracted', {
            hasSession: !!session,
            sessionKeys: session ? Object.keys(session) : [],
            userId: maskUserId(session?.user?.id),
            userEmail: maskEmail(session?.user?.email),
          });
          // Set session immediately after verification to ensure it's available for subsequent requests
          if (session) {
            debug('[authStore.verifyEmailOtp] Setting session on Supabase client immediately after verification');
            // @ts-ignore
            const { data: setData, error: setError } = await (supabase as any).auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
            if (setError) {
              debug('[authStore.verifyEmailOtp] Error setting session:', setError);
            } else if (setData?.session) {
              session = setData.session;
              debug('[authStore.verifyEmailOtp] Session set on client successfully');
              // Wait for session to propagate (SecureStore operations are async)
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Try to verify session, but don't fail if it's not immediately available
              let sessionVerified = false;
              for (let attempt = 1; attempt <= 3; attempt++) {
                // @ts-ignore
                const verifyResult = await (supabase as any).auth.getSession();
                if (verifyResult?.error) {
                  debug('[authStore.verifyEmailOtp] Session verification error (attempt ' + attempt + '):', verifyResult.error);
                } else if (verifyResult?.data?.session) {
                  sessionVerified = true;
                  debug('[authStore.verifyEmailOtp] Session verified (attempt ' + attempt + ')');
                  break;
                } else {
                  debug('[authStore.verifyEmailOtp] Session not yet available in getSession (attempt ' + attempt + ')');
                }
                
                if (attempt < 3) {
                  await new Promise(resolve => setTimeout(resolve, 200 * attempt));
                }
              }
              
              if (!sessionVerified) {
                debug('[authStore.verifyEmailOtp] WARNING: Session not verified via getSession, but setSession succeeded - proceeding anyway');
              }
            } else {
              debug('[authStore.verifyEmailOtp] setSession did not return a session; continuing with verifyOtp session');
            }
          }
          break;
        }
        if (error) {
          lastError = error;
          debug('[authStore.verifyEmailOtp] FAILED with type', type, { 
            message: error.message,
            code: (error as any)?.code,
            status: (error as any)?.status,
            name: error.name,
            errorString: String(error),
            errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          });
        }
      }
      debug('[authStore.verifyEmailOtp] after loop', {
        hasSession: !!session,
        hasLastError: !!lastError,
        lastErrorMessage: lastError?.message,
      });
      if (!session) {
        debug('[authStore.verifyEmailOtp] no session from verifyOtp, trying getSession fallback');
        // Ensure we have an active session in case verifyOtp returned only a user object
        // @ts-ignore
        const { data: fallbackSession, error: fallbackError } = await (supabase as any).auth.getSession();
        debug('[authStore.verifyEmailOtp] getSession fallback result', {
          hasSession: !!fallbackSession?.session,
          hasError: !!fallbackError,
          errorMessage: fallbackError?.message,
        });
        if (fallbackSession?.session) {
          session = fallbackSession.session;
          debug('[authStore.verifyEmailOtp] using fallback session', {
            hasSession: !!session,
            userId: session?.user?.id,
          });
        } else if (fallbackError) {
          lastError = fallbackError;
          debug('[authStore.verifyEmailOtp] fallback getSession error', {
            message: fallbackError.message,
            code: (fallbackError as any)?.code,
          });
        }
      }
      if (!session) {
        debug('[authStore.verifyEmailOtp] NO SESSION FOUND - throwing error');
        if (lastError) {
          debug('[authStore.verifyEmailOtp] throwing lastError', {
            message: lastError.message,
            code: (lastError as any)?.code,
            name: lastError.name,
          });
          throw lastError;
        }
        debug('[authStore.verifyEmailOtp] throwing generic error');
        throw new Error('Verification failed. Try again.');
      }
      debug('[authStore.verifyEmailOtp] session found, checking pending password', {
        hasPendingPassword: !!get().pendingPassword,
        hasSessionUser: !!session.user,
      });
      // Only set password if user was created without one (OTP-only signup)
      // If user was created via signUp with password, it's already set, so skip
      const pendingPassword = get().pendingPassword;
      if (pendingPassword && session.user) {
        debug('[authStore.verifyEmailOtp] attempting to apply pending password');
        // Check if user already has a password set (if they do, skip update)
        // We can't easily check this, so we'll try to update and ignore "same password" errors
        try {
          debug('[authStore.verifyEmailOtp] calling updateUser with password');
          // @ts-ignore
          const { error } = await (supabase as any).auth.updateUser({ password: pendingPassword });
          if (error && !error.message.includes('same password')) {
            debug('[authStore.verifyEmailOtp] password update error (non-fatal)', { 
              message: error.message,
              code: (error as any)?.code,
            });
            // Don't throw - password might already be set, verification succeeded
          } else {
            debug('[authStore.verifyEmailOtp] password update successful or same password');
          }
        } catch (e) {
          // Ignore password update errors - verification already succeeded
          debug('[authStore.verifyEmailOtp] password update failed (non-fatal)', {
            error: e,
            errorString: String(e),
          });
        }
      }
      debug('[authStore.verifyEmailOtp] fetching fresh session to ensure flags are updated');
      // Fetch fresh session/user to ensure flags are updated
      // The session should already be set from the verification step above
      // @ts-ignore
      let latestData = await (supabase as any).auth.getSession();
      let latest = latestData?.data;
      if (latestData?.error || !latest?.session) {
        debug('[authStore.verifyEmailOtp] Error getting session after verification, retrying setSession:', latestData?.error);
        // If getSession fails or returns no session, try setting the session again
        if (session) {
          debug('[authStore.verifyEmailOtp] Retrying setSession due to getSession error');
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
      debug('[authStore.verifyEmailOtp] final session/user state', {
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

      debug('[authStore.verifyEmailOtp] updating store state');
      set({
        session: finalSession,
        user: finalUser,
        emailVerified: true,
        pendingEmail: null,
        pendingPassword: null,
        hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
        isLoading: false,
      });
      debug('[authStore.verifyEmailOtp] ===== VERIFICATION COMPLETE - SUCCESS =====', { 
        hasUser: !!finalUser,
        emailVerified: true,
        hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
      });
      return 'success';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to verify code';
      debug('[authStore.verifyEmailOtp] ===== VERIFICATION FAILED =====', { 
        message: msg,
        error: e,
        errorString: String(e),
        errorName: e instanceof Error ? e.name : 'Unknown',
        errorCode: (e as any)?.code,
        errorStack: e instanceof Error ? e.stack : undefined,
      });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      debug('[authStore.verifyEmailOtp] set isLoading to false and error to:', toFriendlyAuthMessage(msg));
      return 'error';
    }
  },

  completeOnboarding: async () => {
    const { user } = get();
    const onboardingStore = useOnboardingStore.getState();
    await onboardingStore.completeOnboarding(user?.id);
    set({ hasCompletedOnboarding: true });
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      // @ts-ignore
      const { error } = await (supabase as any).auth.signOut();
      if (error) throw error;
      
      // Clear current user ID from SecureStore
      await SecureStore.deleteItemAsync(CURRENT_USER_ID_KEY);
      
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
