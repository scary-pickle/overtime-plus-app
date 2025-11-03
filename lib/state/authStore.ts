import { create } from 'zustand';
import { supabase } from '../supabase';
import { getRedirectUri } from '../auth/deeplinks';
import { isAllowedDomain, isValidEmail, validatePasswordStrength } from '../auth/validation';
import { toFriendlyAuthMessage } from '../auth/errors';

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  error: string | null;
  emailVerified: boolean;

  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  error: null,
  emailVerified: false,

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
      if (error) throw error;
      const session = data?.session ?? null;
      const user = session?.user ?? null;
      set({ session, user, emailVerified: !!user?.email_confirmed_at, isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed';
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
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

      const redirectTo = getRedirectUri();
      console.log('[authStore.signUp] calling supabase.auth.signUp', { redirectTo });
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        console.log('[authStore.signUp] supabase error', { code: (error as any)?.code, message: error.message });
        throw error;
      }
      console.log('[authStore.signUp] supabase response', { hasUser: !!data?.user, hasSession: !!data?.session });
      set({ isLoading: false });
      console.log('[authStore.signUp] completed OK');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed';
      console.log('[authStore.signUp] failed', { message: msg });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return false;
    }
  },

  resendVerification: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      const redirectTo = getRedirectUri();
      // @ts-ignore
      const { error } = await (supabase as any).auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      set({ isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to resend verification';
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      // @ts-ignore
      const { error } = await (supabase as any).auth.signOut();
      if (error) throw error;
      set({ user: null, session: null, emailVerified: false, isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign out failed';
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
    }
  },
}));


