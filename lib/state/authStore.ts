import { create } from 'zustand';
import { supabase } from '../supabase';
import { getRedirectUri } from '../auth/deeplinks';
import { isAllowedDomain, isValidEmail, validatePasswordStrength } from '../auth/validation';

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  error: string | null;
  emailVerified: boolean;

  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
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
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to get session' });
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
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Sign in failed' });
    }
  },

  signUp: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!isValidEmail(email)) throw new Error('Invalid email format');
      if (!isAllowedDomain(email)) throw new Error('Email domain not allowed');
      const pw = validatePasswordStrength(password);
      if (!pw.valid) throw new Error(`Password requirements: ${pw.errors.join(', ')}`);

      const redirectTo = getRedirectUri();
      // @ts-ignore
      const { error } = await (supabase as any).auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      set({ isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Sign up failed' });
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
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to resend verification' });
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
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Sign out failed' });
    }
  },
}));


