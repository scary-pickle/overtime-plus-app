import { create } from 'zustand';
import { Profile } from '../../types';
import { profileStorage } from '../storage/profile';

interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadProfile: () => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  deleteProfile: () => Promise<void>;
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

  loadProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const profile = await profileStorage.loadProfile();
      console.log('Profile loaded from storage:', profile ? 'Profile exists' : 'No profile');
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

  saveProfile: async (profile: Profile) => {
    set({ isLoading: true, error: null });
    try {
      await profileStorage.saveProfile(profile);
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

  deleteProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      await profileStorage.deleteProfile();
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
