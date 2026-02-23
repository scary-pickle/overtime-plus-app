import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('localUserStore');

const LOCAL_USER_ID_KEY = 'overtime_plus_local_user_id';

interface LocalUserState {
  localUserId: string;
  isLoading: boolean;

  /**
   * Loads the stable local user ID from SecureStore.
   * Generates a new UUID on first launch and persists it.
   * Call once during app initialisation (in _layout.tsx).
   */
  init: () => Promise<void>;

  /**
   * Removes the local user ID from SecureStore.
   * Used by the Reset App flow — a new UUID will be generated on next init().
   */
  clearLocalUser: () => Promise<void>;
}

export const useLocalUserStore = create<LocalUserState>((set) => ({
  localUserId: '',
  isLoading: true,

  init: async () => {
    set({ isLoading: true });
    try {
      let userId = await SecureStore.getItemAsync(LOCAL_USER_ID_KEY);

      if (!userId) {
        userId = randomUUID();
        await SecureStore.setItemAsync(LOCAL_USER_ID_KEY, userId);
        debug.debug('Generated new local user ID');
      } else {
        debug.debug('Loaded existing local user ID');
      }

      set({ localUserId: userId, isLoading: false });
    } catch (error) {
      debug.error('Failed to initialise local user ID', error);
      // Fall back to an in-memory UUID so the app can still function
      set({ localUserId: randomUUID(), isLoading: false });
    }
  },

  clearLocalUser: async () => {
    try {
      await SecureStore.deleteItemAsync(LOCAL_USER_ID_KEY);
      set({ localUserId: '' });
      debug.debug('Cleared local user ID');
    } catch (error) {
      debug.error('Failed to clear local user ID', error);
    }
  },
}));
