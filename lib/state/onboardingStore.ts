import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';
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

      // If we have a userId, also check Supabase user metadata AND profile
      if (userId) {
        try {
          debug.debug('Checking Supabase metadata');
          
          // First ensure we have a session
          // @ts-ignore
          let sessionResult = await (supabase as any).auth.getSession();
          if (sessionResult?.error || !sessionResult?.data?.session) {
            debug.debug('No session available, skipping Supabase check');
            // Continue with local storage check only
          } else {
            // @ts-ignore
            const { data, error } = await (supabase as any).auth.getUser();
            if (!error && data?.user) {
              const metadata = data.user.user_metadata || {};
              const hasCompleted = metadata.hasCompletedOnboarding === true;
              
              debug.debug('Supabase metadata:', {
                hasCompleted,
                metadata: Object.keys(metadata),
                userMetadata: metadata,
              });
              
              if (hasCompleted) {
                // Sync to local storage
                debug.debug('Found completed in Supabase, syncing to local');
                await SecureStore.setItemAsync(storageKey, 'true');
                set({ hasCompletedOnboarding: true, isLoading: false });
                return true;
              }
              
              // MIGRATION HELPER: Check if user has a profile in Supabase
              // This helps users who lost onboarding status due to migration/storage clear
              // The profiles table stores profile data in metadata JSONB, so just check if a row exists
              try {
                debug.debug('Checking for existing profile in Supabase');
                const { data: profileData, error: profileError } = await (supabase as any)
                  .from('profiles')
                  .select('user_id, display_name, email')
                  .eq('user_id', userId)
                  .single();
                
                debug.debug('Profile query result:', {
                  hasData: !!profileData,
                  hasError: !!profileError,
                  errorMessage: profileError?.message,
                  errorDetails: profileError?.details,
                  errorHint: profileError?.hint,
                });
                
                if (!profileError && profileData) {
                  // If a profile row exists, the user has completed onboarding
                  const hasCompleteProfile = true;
                  debug.debug('Profile check:', {
                    hasProfile: true,
                    hasCompleteProfile: true,
                    displayName: profileData.display_name,
                    email: profileData.email,
                  });
                  
                  if (hasCompleteProfile) {
                    debug.debug('✅ Complete profile found - marking onboarding as complete');
                    // Mark onboarding as complete both locally and in Supabase
                    await SecureStore.setItemAsync(storageKey, 'true');
                    
                    // Update Supabase metadata
                    try {
                      // @ts-ignore
                      await (supabase as any).auth.updateUser({
                        data: { hasCompletedOnboarding: true }
                      });
                      debug.debug('Updated Supabase metadata with onboarding flag');
                    } catch (updateError) {
                      debug.debug('Failed to update Supabase metadata:', updateError);
                      // Non-fatal - local storage is sufficient
                    }
                    
                    set({ hasCompletedOnboarding: true, isLoading: false });
                    return true;
                  } else {
                    debug.debug('Profile exists but is incomplete');
                  }
                } else {
                  debug.debug('No profile found or query error');
                }
              } catch (profileCheckError) {
                debug.debug('Error checking profile:', profileCheckError);
                // Continue with regular flow
              }
            } else if (error) {
              debug.debug('Error getting user:', error);
            }
          }
        } catch (e) {
          debug.debug('Error checking Supabase onboarding status:', e);
          // Continue with local storage check
        }
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

      // Save to local storage
      await SecureStore.setItemAsync(storageKey, 'true');
      debug.debug('Saved to local storage');

      // If we have a userId, also save to Supabase user metadata
      if (userId) {
        try {
          debug.debug('Updating Supabase metadata');
          
          // First ensure we have a session
          // @ts-ignore
          let sessionResult = await (supabase as any).auth.getSession();
          if (sessionResult?.error || !sessionResult?.data?.session) {
            debug.debug('No session available, skipping Supabase update');
            // Don't throw - local storage is sufficient
          } else {
            // @ts-ignore
            const { error } = await (supabase as any).auth.updateUser({
              data: { hasCompletedOnboarding: true }
            });
            if (error) {
              debug.debug('Error updating Supabase onboarding status:', error);
              // Don't throw - local storage is sufficient
            } else {
              debug.debug('Successfully updated Supabase metadata');
            }
          }
        } catch (e) {
          debug.debug('Error updating Supabase onboarding status:', e);
          // Don't throw - local storage is sufficient
        }
      }

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
            debug.debug('Error resetting Supabase onboarding status:', error);
            // Don't throw - local storage is sufficient
          }
        } catch (e) {
          debug.debug('Error resetting Supabase onboarding status:', e);
          // Don't throw - local storage is sufficient
        }
      }

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
