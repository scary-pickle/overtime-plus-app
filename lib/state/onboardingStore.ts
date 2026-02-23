import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('onboardingStore');

const ONBOARDING_STATUS_KEY = 'overtime_plus_onboarding_complete';

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  checkOnboardingStatus: (userId?: string | null) => Promise<boolean>;
  completeOnboarding: (userId?: string | null) => Promise<void>;
  resetOnboarding: (userId?: string | null) => Promise<void>;
  clearError: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasCompletedOnboarding: false,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  checkOnboardingStatus: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const storageKey = userId
        ? `${ONBOARDING_STATUS_KEY}_${userId}`
        : ONBOARDING_STATUS_KEY;

      debug.debug('Checking status', {
        userId: userId?.substring(0, 8),
        storageKey,
      });

      const localStatus = await SecureStore.getItemAsync(storageKey);
      debug.debug('Local storage status:', localStatus);

      if (localStatus === 'true') {
        debug.debug('Found completed in local storage');
        set({ hasCompletedOnboarding: true, isLoading: false });
        return true;
      }

      debug.debug('Onboarding not completed');
      set({ hasCompletedOnboarding: false, isLoading: false });
      return false;
    } catch (error) {
      debug.error('Error checking onboarding status:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check onboarding status'
      });
      return false;
    }
  },

  completeOnboarding: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const storageKey = userId
        ? `${ONBOARDING_STATUS_KEY}_${userId}`
        : ONBOARDING_STATUS_KEY;

      debug.debug('Completing onboarding', {
        userId: userId?.substring(0, 8),
        storageKey,
      });

      await SecureStore.setItemAsync(storageKey, 'true');
      debug.debug('Saved to local storage');

      debug.debug('Setting hasCompletedOnboarding to true');
      set({ hasCompletedOnboarding: true, isLoading: false });
    } catch (error) {
      debug.error('Error completing onboarding:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to complete onboarding'
      });
      throw error;
    }
  },

  resetOnboarding: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const storageKey = userId
        ? `${ONBOARDING_STATUS_KEY}_${userId}`
        : ONBOARDING_STATUS_KEY;

      await SecureStore.deleteItemAsync(storageKey);
      set({ hasCompletedOnboarding: false, isLoading: false });
    } catch (error) {
      debug.error('Error resetting onboarding:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to reset onboarding'
      });
    }
  },
}));
