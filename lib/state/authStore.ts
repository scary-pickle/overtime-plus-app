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
      // OTP-first flow: send 6-digit code to email; set pending password
      console.log('[authStore.signUp] sending OTP via signInWithOtp');
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        console.log('[authStore.signUp] signInWithOtp error', { message: error.message });
        throw error;
      }
      console.log('[authStore.signUp] OTP sent', { hasUser: !!data?.user });
      set({
        pendingEmail: email,
        pendingPassword: password,
        emailVerified: false,
        isLoading: false,
        user: null,
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
      const { error } = await (supabase as any).auth.signInWithOtp({
        email,
        options: { shouldCreateUser },
      });
      if (error) throw error;
      set({ pendingEmail: email, isLoading: false });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send code';
      console.log('[authStore.requestEmailOtp] failed', { message: msg });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return false;
    }
  },

  verifyEmailOtp: async (email: string, token: string) => {
    const emailMasked = email.replace(/(^.).+(@.*$)/, '$1***$2');
    console.log('[authStore.verifyEmailOtp] verifying', { emailMasked });
    set({ isLoading: true, error: null });
    try {
      const attemptTypes: Array<'email' | 'signup'> = ['email', 'signup'];
      let session: any = null;
      let lastError: Error | null = null;
      for (const type of attemptTypes) {
        // @ts-ignore
        const { data, error } = await (supabase as any).auth.verifyOtp({ email, token, type });
        if (!error && (data?.session || data?.user)) {
          session = data?.session ?? null;
          lastError = null;
          break;
        }
        if (error) {
          lastError = error;
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
      const pendingPassword = get().pendingPassword;
      if (pendingPassword) {
        console.log('[authStore.verifyEmailOtp] applying pending password');
        // @ts-ignore
        const { error } = await (supabase as any).auth.updateUser({ password: pendingPassword });
        if (error) throw error;
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
