import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';

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

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  hasCompletedOnboarding: false,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  checkOnboardingStatus: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Check local storage first
      const storageKey = userId 
        ? `${ONBOARDING_STATUS_KEY}_${userId}`
        : ONBOARDING_STATUS_KEY;
      
      console.log('[onboardingStore.checkOnboardingStatus] Checking status', {
        userId: userId?.substring(0, 8),
        storageKey,
      });
      
      const localStatus = await SecureStore.getItemAsync(storageKey);
      console.log('[onboardingStore.checkOnboardingStatus] Local storage status:', localStatus);
      
      if (localStatus === 'true') {
        console.log('[onboardingStore.checkOnboardingStatus] Found completed in local storage');
        set({ hasCompletedOnboarding: true, isLoading: false });
        return true;
      }

      // If we have a userId, also check Supabase user metadata
      if (userId) {
        try {
          console.log('[onboardingStore.checkOnboardingStatus] Checking Supabase metadata');
          // @ts-ignore
          const { data, error } = await (supabase as any).auth.getUser();
          if (!error && data?.user) {
            const metadata = data.user.user_metadata || {};
            const hasCompleted = metadata.hasCompletedOnboarding === true;
            
            console.log('[onboardingStore.checkOnboardingStatus] Supabase metadata:', {
              hasCompleted,
              metadata: Object.keys(metadata),
              userMetadata: metadata,
            });
            
            if (hasCompleted) {
              // Sync to local storage
              console.log('[onboardingStore.checkOnboardingStatus] Found completed in Supabase, syncing to local');
              await SecureStore.setItemAsync(storageKey, 'true');
              set({ hasCompletedOnboarding: true, isLoading: false });
              return true;
            }
          } else if (error) {
            console.log('[onboardingStore.checkOnboardingStatus] Error getting user:', error);
          }
        } catch (e) {
          console.log('[onboardingStore.checkOnboardingStatus] Error checking Supabase onboarding status:', e);
          // Continue with local storage check
        }
      }

      console.log('[onboardingStore.checkOnboardingStatus] Onboarding not completed');
      set({ hasCompletedOnboarding: false, isLoading: false });
      return false;
    } catch (error) {
      console.error('[onboardingStore.checkOnboardingStatus] Error checking onboarding status:', error);
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

      console.log('[onboardingStore.completeOnboarding] Completing onboarding', {
        userId: userId?.substring(0, 8),
        storageKey,
      });

      // Save to local storage
      await SecureStore.setItemAsync(storageKey, 'true');
      console.log('[onboardingStore.completeOnboarding] Saved to local storage');

      // If we have a userId, also save to Supabase user metadata
      if (userId) {
        try {
          console.log('[onboardingStore.completeOnboarding] Updating Supabase metadata');
          // @ts-ignore
          const { error } = await (supabase as any).auth.updateUser({
            data: { hasCompletedOnboarding: true }
          });
          if (error) {
            console.log('[onboardingStore.completeOnboarding] Error updating Supabase onboarding status:', error);
            // Don't throw - local storage is sufficient
          } else {
            console.log('[onboardingStore.completeOnboarding] Successfully updated Supabase metadata');
          }
        } catch (e) {
          console.log('[onboardingStore.completeOnboarding] Error updating Supabase onboarding status:', e);
          // Don't throw - local storage is sufficient
        }
      }

      console.log('[onboardingStore.completeOnboarding] Setting hasCompletedOnboarding to true');
      set({ hasCompletedOnboarding: true, isLoading: false });
    } catch (error) {
      console.error('[onboardingStore.completeOnboarding] Error completing onboarding:', error);
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

      // Clear local storage
      await SecureStore.deleteItemAsync(storageKey);

      // If we have a userId, also clear from Supabase user metadata
      if (userId) {
        try {
          // @ts-ignore
          const { error } = await (supabase as any).auth.updateUser({
            data: { hasCompletedOnboarding: false }
          });
          if (error) {
            console.log('Error resetting Supabase onboarding status:', error);
            // Don't throw - local storage is sufficient
          }
        } catch (e) {
          console.log('Error resetting Supabase onboarding status:', e);
          // Don't throw - local storage is sufficient
        }
      }

      set({ hasCompletedOnboarding: false, isLoading: false });
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to reset onboarding' 
      });
    }
  },
}));
