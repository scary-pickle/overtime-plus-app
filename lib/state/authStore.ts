import { create } from 'zustand';
import { supabase } from '../supabase';
import { isAllowedDomain, isValidEmail, validatePasswordStrength } from '../auth/validation';
import { toFriendlyAuthMessage } from '../auth/errors';

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  error: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  pendingPassword: string | null;

  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<'success' | 'verify' | 'error'>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  requestEmailOtp: (email: string, shouldCreateUser?: boolean) => Promise<boolean>;
  verifyEmailOtp: (email: string, token: string) => Promise<'success' | 'error'>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: false,
  error: null,
  emailVerified: false,
  pendingEmail: null,
  pendingPassword: null,

  clearError: () => set({ error: null }),

  checkSession: async () => {
    set({ isLoading: true, error: null });
    try {
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.getSession();
      if (error) throw error;
      const session = data?.session ?? null;
      const user = session?.user ?? null;
      set({
        session,
        user,
        emailVerified: !!user?.email_confirmed_at,
        isLoading: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to get session';
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signInWithPassword({ email, password });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('email not confirmed') || msg.includes('confirm your email') || msg.includes('email not verified')) {
          set({
            isLoading: false,
            error: toFriendlyAuthMessage(error.message),
            pendingEmail: email,
            emailVerified: false,
          });
          return 'verify';
        }
        throw error;
      }
      const session = data?.session ?? null;
      const user = session?.user ?? null;
      set({
        session,
        user,
        emailVerified: !!user?.email_confirmed_at,
        pendingEmail: null,
        pendingPassword: null,
        isLoading: false,
      });
      return 'success';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed';
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
    console.log('[authStore.verifyEmailOtp] verifying', { emailMasked, tokenLength: token.length });
    set({ isLoading: true, error: null });
    try {
      const attemptTypes: Array<'email' | 'signup'> = ['email', 'signup'];
      let session: any = null;
      let lastError: Error | null = null;
      for (const type of attemptTypes) {
        console.log('[authStore.verifyEmailOtp] attempting', { type });
        // @ts-ignore
        const { data, error } = await (supabase as any).auth.verifyOtp({ email, token, type });
        console.log('[authStore.verifyEmailOtp] attempt result', { 
          type,
          hasData: !!data,
          hasSession: !!data?.session,
          hasUser: !!data?.user,
          hasError: !!error,
          errorCode: (error as any)?.code,
          errorMessage: error?.message,
        });
        if (!error && (data?.session || data?.user)) {
          session = data?.session ?? null;
          lastError = null;
          console.log('[authStore.verifyEmailOtp] success with type', type);
          break;
        }
        if (error) {
          lastError = error;
          console.log('[authStore.verifyEmailOtp] failed with type', type, { message: error.message });
        }
      }
      if (!session) {
        // Ensure we have an active session in case verifyOtp returned only a user object
        // @ts-ignore
        const { data: fallbackSession, error: fallbackError } = await (supabase as any).auth.getSession();
        if (fallbackSession?.session) {
          session = fallbackSession.session;
        } else if (fallbackError) {
          lastError = fallbackError;
        }
      }
      if (!session) {
        if (lastError) throw lastError;
        throw new Error('Verification failed. Try again.');
      }
      // Only set password if user was created without one (OTP-only signup)
      // If user was created via signUp with password, it's already set, so skip
      const pendingPassword = get().pendingPassword;
      if (pendingPassword && session.user) {
        // Check if user already has a password set (if they do, skip update)
        // We can't easily check this, so we'll try to update and ignore "same password" errors
        try {
          console.log('[authStore.verifyEmailOtp] applying pending password');
          // @ts-ignore
          const { error } = await (supabase as any).auth.updateUser({ password: pendingPassword });
          if (error && !error.message.includes('same password')) {
            console.log('[authStore.verifyEmailOtp] password update error (non-fatal)', { message: error.message });
            // Don't throw - password might already be set, verification succeeded
          }
        } catch (e) {
          // Ignore password update errors - verification already succeeded
          console.log('[authStore.verifyEmailOtp] password update failed (non-fatal)', e);
        }
      }
      // Fetch fresh session/user to ensure flags are updated
      // @ts-ignore
      const { data: latest } = await (supabase as any).auth.getSession();
      const finalSession = latest?.session ?? session;
      const finalUser = finalSession?.user ?? null;
      set({
        session: finalSession,
        user: finalUser,
        emailVerified: true,
        pendingEmail: null,
        pendingPassword: null,
        isLoading: false,
      });
      console.log('[authStore.verifyEmailOtp] verification complete', { hasUser: !!finalUser });
      return 'success';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to verify code';
      console.log('[authStore.verifyEmailOtp] failed', { message: msg });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return 'error';
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      // @ts-ignore
      const { error } = await (supabase as any).auth.signOut();
      if (error) throw error;
      set({
        user: null,
        session: null,
        emailVerified: false,
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
