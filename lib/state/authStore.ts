import { create } from 'zustand';
import { supabase } from '../supabase';
import { isAllowedDomain, isValidEmail, validatePasswordStrength } from '../auth/validation';
import { toFriendlyAuthMessage } from '../auth/errors';
import { useOnboardingStore } from './onboardingStore';
import * as SecureStore from 'expo-secure-store';

const CURRENT_USER_ID_KEY = 'overtime_plus_current_user_id';

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
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.getSession();
      if (error) throw error;
      const session = data?.session ?? null;
      const user = session?.user ?? null;

      // If we have a session, verify the user still exists in Supabase
      if (session && user) {
        console.log('[authStore.checkSession] Verifying user still exists...', { userId: user.id });
        try {
          // Verify the user still exists by calling getUser() - this will fail if user was deleted
          // @ts-ignore
          const { data: userData, error: userError } = await (supabase as any).auth.getUser();
          if (userError) {
            console.log('[authStore.checkSession] User validation failed - user may have been deleted:', userError);
            // User was likely deleted or session is invalid - clear it
            await (supabase as any).auth.signOut();
            set({
              session: null,
              user: null,
              emailVerified: false,
              hasCompletedOnboarding: false,
              isLoading: false,
            });
            console.log('[authStore.checkSession] Session cleared due to invalid user');
            return;
          }
          console.log('[authStore.checkSession] User verified successfully');
        } catch (verifyError) {
          console.log('[authStore.checkSession] Error verifying user:', verifyError);
          // If verification fails, clear the session to be safe
          await (supabase as any).auth.signOut();
          set({
            session: null,
            user: null,
            emailVerified: false,
            hasCompletedOnboarding: false,
            isLoading: false,
          });
          console.log('[authStore.checkSession] Session cleared due to verification error');
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

      console.log('[authStore.checkSession] Setting state:', {
        hasSession: !!session,
        hasUser: !!user,
        userId: user?.id?.substring(0, 8),
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
      
      console.log('[authStore.checkSession] State set complete');
    } catch (e) {
      console.log('[authStore.checkSession] Error getting session:', e);
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
    console.log('[authStore.signIn] ===== SIGN IN START =====');
    console.log('[authStore.signIn] signing in', { emailMasked, passwordLength: password.length });
    set({ isLoading: true, error: null });
    console.log('[authStore.signIn] set isLoading to true');
    try {
      console.log('[authStore.signIn] calling supabase.auth.signInWithPassword');
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signInWithPassword({ email, password });
      console.log('[authStore.signIn] signInWithPassword response', {
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
        console.log('[authStore.signIn] error received', { message: msg, fullMessage: error.message });
        if (msg.includes('email not confirmed') || msg.includes('confirm your email') || msg.includes('email not verified')) {
          console.log('[authStore.signIn] email not confirmed - redirecting to verify');
          set({
            isLoading: false,
            error: toFriendlyAuthMessage(error.message),
            pendingEmail: email,
            emailVerified: false,
          });
          console.log('[authStore.signIn] ===== SIGN IN - NEEDS VERIFICATION =====');
          return 'verify';
        }
        console.log('[authStore.signIn] throwing error', { message: error.message });
        throw error;
      }
      const session = data?.session ?? null;
      const user = session?.user ?? null;
      console.log('[authStore.signIn] success - extracting session/user', {
        hasSession: !!session,
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
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
      console.log('[authStore.signIn] ===== SIGN IN COMPLETE - SUCCESS =====');
      return 'success';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed';
      console.log('[authStore.signIn] ===== SIGN IN FAILED =====', {
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
    console.log('[authStore.signUp] invoked', { emailMasked: email.replace(/(^.).+(@.*$)/, '$1***$2') });
    set({ isLoading: true, error: null });
    try {
      if (!isValidEmail(email)) {
        console.log('[authStore.signUp] invalid email format');
        throw new Error('Invalid email format');
      }
      if (!isAllowedDomain(email)) {
        console.log('[authStore.signUp] domain not allowed');
        throw new Error('Email domain not allowed');
      }
      const pw = validatePasswordStrength(password);
      if (!pw.valid) {
        console.log('[authStore.signUp] password weak', { issues: pw.errors });
        throw new Error(`Password requirements: ${pw.errors.join(', ')}`);
      }
      // Use normal signUp flow - it will send "Confirm sign up" email template (configured to show OTP code)
      console.log('[authStore.signUp] calling supabase.auth.signUp');
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Don't send redirect links, just OTP code in email
        },
      });
      if (error) {
        console.log('[authStore.signUp] supabase error', { code: (error as any)?.code, message: error.message });
        throw error;
      }
      console.log('[authStore.signUp] signup response', { hasUser: !!data?.user, hasSession: !!data?.session });
      // User created, confirmation email sent (configured to show OTP code in template)
      set({
        pendingEmail: email,
        pendingPassword: password,
        emailVerified: false,
        isLoading: false,
        user: data?.user ?? null,
        session: null,
      });
      console.log('[authStore.signUp] completed OK');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed';
      console.log('[authStore.signUp] failed', { message: msg });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return false;
    }
  },

  requestEmailOtp: async (email: string, shouldCreateUser = false) => {
    const emailMasked = email.replace(/(^.).+(@.*$)/, '$1***$2');
    console.log('[authStore.requestEmailOtp] sending OTP', { emailMasked, shouldCreateUser });
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
      console.log('[authStore.requestEmailOtp] response', { 
        hasData: !!data, 
        hasError: !!error,
        errorCode: (error as any)?.code,
        errorMessage: error?.message,
        dataKeys: data ? Object.keys(data) : [],
      });
      if (error) {
        console.log('[authStore.requestEmailOtp] error details', { 
          code: (error as any)?.code,
          message: error.message,
          status: (error as any)?.status,
        });
        throw error;
      }
      console.log('[authStore.requestEmailOtp] OTP sent successfully');
      set({ pendingEmail: email, isLoading: false });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send code';
      console.log('[authStore.requestEmailOtp] failed', { 
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
    console.log('[authStore.verifyEmailOtp] ===== VERIFY OTP START =====');
    console.log('[authStore.verifyEmailOtp] verifying', { 
      emailMasked, 
      email: email, 
      tokenLength: token.length,
      token: token.length > 0 ? '***' : 'empty',
    });
    console.log('[authStore.verifyEmailOtp] current state before verification', {
      pendingEmail: get().pendingEmail,
      pendingPassword: !!get().pendingPassword,
      hasUser: !!get().user,
      hasSession: !!get().session,
      emailVerified: get().emailVerified,
    });
    set({ isLoading: true, error: null });
    console.log('[authStore.verifyEmailOtp] set isLoading to true');
    try {
      const attemptTypes: Array<'email' | 'signup'> = ['email', 'signup'];
      let session: any = null;
      let lastError: Error | null = null;
      console.log('[authStore.verifyEmailOtp] starting verification attempts', { attemptTypes });
      for (const type of attemptTypes) {
        console.log('[authStore.verifyEmailOtp] ===== Attempting verification with type:', type, '=====');
        console.log('[authStore.verifyEmailOtp] calling supabase.auth.verifyOtp', { 
          email, 
          tokenLength: token.length,
          type,
        });
        // @ts-ignore
        const { data, error } = await (supabase as any).auth.verifyOtp({ email, token, type });
        console.log('[authStore.verifyEmailOtp] verifyOtp response received', {
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
          console.log('[authStore.verifyEmailOtp] SUCCESS with type', type);
          session = data?.session ?? null;
          lastError = null;
          console.log('[authStore.verifyEmailOtp] session extracted', {
            hasSession: !!session,
            sessionKeys: session ? Object.keys(session) : [],
            userId: session?.user?.id,
            userEmail: session?.user?.email,
          });
          break;
        }
        if (error) {
          lastError = error;
          console.log('[authStore.verifyEmailOtp] FAILED with type', type, { 
            message: error.message,
            code: (error as any)?.code,
            status: (error as any)?.status,
            name: error.name,
            errorString: String(error),
            errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          });
        }
      }
      console.log('[authStore.verifyEmailOtp] after loop', {
        hasSession: !!session,
        hasLastError: !!lastError,
        lastErrorMessage: lastError?.message,
      });
      if (!session) {
        console.log('[authStore.verifyEmailOtp] no session from verifyOtp, trying getSession fallback');
        // Ensure we have an active session in case verifyOtp returned only a user object
        // @ts-ignore
        const { data: fallbackSession, error: fallbackError } = await (supabase as any).auth.getSession();
        console.log('[authStore.verifyEmailOtp] getSession fallback result', {
          hasSession: !!fallbackSession?.session,
          hasError: !!fallbackError,
          errorMessage: fallbackError?.message,
        });
        if (fallbackSession?.session) {
          session = fallbackSession.session;
          console.log('[authStore.verifyEmailOtp] using fallback session', {
            hasSession: !!session,
            userId: session?.user?.id,
          });
        } else if (fallbackError) {
          lastError = fallbackError;
          console.log('[authStore.verifyEmailOtp] fallback getSession error', {
            message: fallbackError.message,
            code: (fallbackError as any)?.code,
          });
        }
      }
      if (!session) {
        console.log('[authStore.verifyEmailOtp] NO SESSION FOUND - throwing error');
        if (lastError) {
          console.log('[authStore.verifyEmailOtp] throwing lastError', {
            message: lastError.message,
            code: (lastError as any)?.code,
            name: lastError.name,
          });
          throw lastError;
        }
        console.log('[authStore.verifyEmailOtp] throwing generic error');
        throw new Error('Verification failed. Try again.');
      }
      console.log('[authStore.verifyEmailOtp] session found, checking pending password', {
        hasPendingPassword: !!get().pendingPassword,
        hasSessionUser: !!session.user,
      });
      // Only set password if user was created without one (OTP-only signup)
      // If user was created via signUp with password, it's already set, so skip
      const pendingPassword = get().pendingPassword;
      if (pendingPassword && session.user) {
        console.log('[authStore.verifyEmailOtp] attempting to apply pending password');
        // Check if user already has a password set (if they do, skip update)
        // We can't easily check this, so we'll try to update and ignore "same password" errors
        try {
          console.log('[authStore.verifyEmailOtp] calling updateUser with password');
          // @ts-ignore
          const { error } = await (supabase as any).auth.updateUser({ password: pendingPassword });
          if (error && !error.message.includes('same password')) {
            console.log('[authStore.verifyEmailOtp] password update error (non-fatal)', { 
              message: error.message,
              code: (error as any)?.code,
            });
            // Don't throw - password might already be set, verification succeeded
          } else {
            console.log('[authStore.verifyEmailOtp] password update successful or same password');
          }
        } catch (e) {
          // Ignore password update errors - verification already succeeded
          console.log('[authStore.verifyEmailOtp] password update failed (non-fatal)', {
            error: e,
            errorString: String(e),
          });
        }
      }
      console.log('[authStore.verifyEmailOtp] fetching fresh session to ensure flags are updated');
      // Fetch fresh session/user to ensure flags are updated
      // @ts-ignore
      const { data: latest } = await (supabase as any).auth.getSession();
      const finalSession = latest?.session ?? session;
      const finalUser = finalSession?.user ?? null;
      console.log('[authStore.verifyEmailOtp] final session/user state', {
        hasFinalSession: !!finalSession,
        hasFinalUser: !!finalUser,
        userId: finalUser?.id,
        userEmail: finalUser?.email,
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

      console.log('[authStore.verifyEmailOtp] updating store state');
      set({
        session: finalSession,
        user: finalUser,
        emailVerified: true,
        pendingEmail: null,
        pendingPassword: null,
        hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
        isLoading: false,
      });
      console.log('[authStore.verifyEmailOtp] ===== VERIFICATION COMPLETE - SUCCESS =====', { 
        hasUser: !!finalUser,
        emailVerified: true,
        hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
      });
      return 'success';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to verify code';
      console.log('[authStore.verifyEmailOtp] ===== VERIFICATION FAILED =====', { 
        message: msg,
        error: e,
        errorString: String(e),
        errorName: e instanceof Error ? e.name : 'Unknown',
        errorCode: (e as any)?.code,
        errorStack: e instanceof Error ? e.stack : undefined,
      });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      console.log('[authStore.verifyEmailOtp] set isLoading to false and error to:', toFriendlyAuthMessage(msg));
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
