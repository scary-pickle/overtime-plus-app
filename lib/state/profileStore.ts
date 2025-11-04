import { create } from 'zustand';
import { Profile } from '../../types';
import { profileStorage } from '../storage/profile';
import { profileSync } from '../supabase';

interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadProfile: (userId?: string | null) => Promise<void>;
  saveProfile: (profile: Profile, userId?: string | null) => Promise<void>;
  deleteProfile: (userId?: string | null) => Promise<void>;
  clearLegacyProfile: () => Promise<void>;
  clearError: () => void;
  
  // Computed getters
  initials: string;
  isComplete: boolean;
  hasProfile: boolean;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  loadProfile: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Clear legacy profile if we have a userId (new authenticated user)
      if (userId) {
        await profileStorage.clearLegacyProfile();
      }
      
      // Try loading from Supabase first (if authenticated)
      let profile: Profile | null = null;
      if (userId) {
        try {
          const supabaseProfile = await profileSync.downloadProfile(userId);
          if (supabaseProfile) {
            console.log('Profile loaded from Supabase, saving to local storage');
            // Save to local storage for offline access
            await profileStorage.saveProfile(supabaseProfile, userId);
            profile = supabaseProfile;
          }
        } catch (syncError) {
          console.error('Failed to load profile from Supabase (non-fatal):', syncError);
          // Continue to local storage
        }
      }
      
      // If not found in Supabase, load from local storage
      if (!profile) {
        profile = await profileStorage.loadProfile(userId);
        
        // If we have a local profile and userId, sync it to Supabase (background sync)
        if (profile && userId) {
          profileSync.uploadProfile(profile, userId).catch(syncError => {
            console.error('Failed to sync local profile to Supabase (non-fatal):', syncError);
          });
        }
      }
      
      console.log('Profile loaded from storage:', { 
        userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous',
        hasProfile: profile !== null 
      });
      if (profile) {
        console.log('Profile completeness check:', profileStorage.isProfileComplete(profile));
        console.log('Profile fields:', Object.keys(profile));
      }
      set({ 
        profile, 
        isLoading: false,
        error: null 
      });
      console.log('Profile store state after load:', { 
        hasProfile: profile !== null, 
        isComplete: profile ? profileStorage.isProfileComplete(profile) : false 
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load profile' 
      });
    }
  },

  saveProfile: async (profile: Profile, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Save to local storage first
      await profileStorage.saveProfile(profile, userId);
      console.log('Profile saved to storage, updating store state');
      
      // Sync to Supabase (don't fail if this fails - local save is primary)
      if (userId) {
        try {
          await profileSync.uploadProfile(profile, userId);
          console.log('Profile synced to Supabase successfully');
        } catch (syncError) {
          console.error('Failed to sync profile to Supabase (non-fatal):', syncError);
          // Continue - local save succeeded
        }
      }
      
      set({ 
        profile, 
        isLoading: false,
        error: null 
      });
      console.log('Profile store state updated:', { 
        hasProfile: profile !== null, 
        isComplete: profile ? profileStorage.isProfileComplete(profile) : false 
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to save profile' 
      });
    }
  },

  deleteProfile: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await profileStorage.deleteProfile(userId);
      set({ 
        profile: null, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to delete profile' 
      });
    }
  },

  clearLegacyProfile: async () => {
    try {
      await profileStorage.clearLegacyProfile();
    } catch (error) {
      console.error('Error clearing legacy profile:', error);
    }
  },

  clearError: () => set({ error: null }),

  // Computed getters
  get initials() {
    const { profile } = get();
    const initials = profile?.employeeInitial || '';
    console.log('ProfileStore initials getter:', { 
      hasProfile: !!profile, 
      employeeInitial: profile?.employeeInitial,
      initials 
    });
    return initials;
  },

  get isComplete() {
    const { profile } = get();
    const result = profile ? profileStorage.isProfileComplete(profile) : false;
    console.log('isComplete getter called:', { profile: !!profile, result });
    return result;
  },

  get hasProfile() {
    const { profile } = get();
    const result = profile !== null;
    console.log('hasProfile getter called:', { profile: !!profile, result });
    return result;
  }
}));
