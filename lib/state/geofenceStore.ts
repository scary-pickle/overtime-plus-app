import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { GeofenceSettings } from '../../types';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('geofenceStore');

const SETTINGS_KEY = 'geofence_settings';
const ACTIVE_LOG_KEY = 'geofence_active_log_id';

const DEFAULT_SETTINGS: GeofenceSettings = {
  enabled: false,
  radiusMeters: 500,
  hospitalName: '',
  notifyOnEntry: true,
  notifyOnExit: true,
};

interface GeofenceState {
  settings: GeofenceSettings;
  isLoading: boolean;
  // ID of the currently open geofence-proposed draft log (if a shift is in progress)
  activeGeofenceLogId: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  saveSettings: (settings: GeofenceSettings) => Promise<void>;
  setActiveGeofenceLogId: (id: string | null) => Promise<void>;
}

export const useGeofenceStore = create<GeofenceState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  activeGeofenceLogId: null,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const [settingsStr, activeLogId] = await Promise.all([
        SecureStore.getItemAsync(SETTINGS_KEY),
        SecureStore.getItemAsync(ACTIVE_LOG_KEY),
      ]);

      const settings = settingsStr
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(settingsStr) }
        : DEFAULT_SETTINGS;

      set({
        settings,
        activeGeofenceLogId: activeLogId ?? null,
        isLoading: false,
      });
      debug.debug('Geofence settings loaded', { enabled: settings.enabled, radius: settings.radiusMeters });
    } catch (error) {
      debug.error('Failed to load geofence settings:', error);
      set({ isLoading: false });
    }
  },

  saveSettings: async (settings: GeofenceSettings) => {
    try {
      await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings));
      set({ settings });
      debug.debug('Geofence settings saved', { enabled: settings.enabled, radius: settings.radiusMeters });
    } catch (error) {
      debug.error('Failed to save geofence settings:', error);
    }
  },

  setActiveGeofenceLogId: async (id: string | null) => {
    try {
      if (id) {
        await SecureStore.setItemAsync(ACTIVE_LOG_KEY, id);
      } else {
        await SecureStore.deleteItemAsync(ACTIVE_LOG_KEY);
      }
      set({ activeGeofenceLogId: id });
    } catch (error) {
      debug.error('Failed to persist active geofence log ID:', error);
    }
  },
}));
