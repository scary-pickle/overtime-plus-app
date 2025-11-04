import { create } from 'zustand';
import { Profile } from '../../types';
import { profileStorage } from '../storage/profile';

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
      const profile = await profileStorage.loadProfile(userId);
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
      await profileStorage.saveProfile(profile, userId);
      console.log('Profile saved to storage, updating store state');
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
