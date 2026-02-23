import { create } from 'zustand';
import { Profile } from '../../types';
import { profileStorage } from '../storage/profile';
import { createScopedLogger } from '../utils/logger';

const devLog = createScopedLogger('profileStore');

interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadProfile: (userId?: string | null) => Promise<void>;
  saveProfile: (profile: Profile, userId?: string | null) => Promise<void>;
  deleteProfile: (userId?: string | null) => Promise<void>;
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
    const current = get();
    if (current.isLoading) {
      devLog.debug('Profile load already in progress, skipping duplicate call');
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const profile = await profileStorage.loadProfile(userId);

      devLog.debug('Profile loaded from storage:', {
        userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous',
        hasProfile: profile !== null,
      });
      if (profile) {
        devLog.debug('Profile completeness check:', profileStorage.isProfileComplete(profile));
      }
      set({ profile, isLoading: false, error: null });
    } catch (error) {
      devLog.error('Error loading profile:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load profile',
      });
    }
  },

  saveProfile: async (profile: Profile, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await profileStorage.saveProfile(profile, userId);
      devLog.debug('Profile saved to storage');
      set({ profile, isLoading: false, error: null });
    } catch (error) {
      devLog.error('Error saving profile:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to save profile',
      });
    }
  },

  deleteProfile: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await profileStorage.deleteProfile(userId);
      set({ profile: null, isLoading: false, error: null });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete profile',
      });
    }
  },

  clearError: () => set({ error: null }),

  // Computed getters
  get initials() {
    const { profile } = get();
    return profile?.employeeInitial || '';
  },

  get isComplete() {
    const { profile } = get();
    return profile ? profileStorage.isProfileComplete(profile) : false;
  },

  get hasProfile() {
    const { profile } = get();
    return profile !== null;
  },
}));
