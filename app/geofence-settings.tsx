import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  useColorScheme,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useGeofenceStore } from '../lib/state/geofenceStore';
import { useProfileStore } from '../lib/state/profileStore';
import { geofenceManager } from '../lib/location/geofenceManager';
import { getCoordinatesForHospital } from '../lib/data/hospitalCoordinates';
import { GeofenceSettings } from '../types';

const RADIUS_OPTIONS = [
  { label: '200 m', value: 200, description: 'Precise — best for compact sites' },
  { label: '500 m', value: 500, description: 'Recommended for most hospitals' },
  { label: '1 km', value: 1000, description: 'Wide — useful for large campuses' },
];

export default function GeofenceSettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const { settings, loadSettings, saveSettings } = useGeofenceStore();
  const { profile } = useProfileStore();

  const [localSettings, setLocalSettings] = useState<GeofenceSettings>(settings);
  const [permissionStatus, setPermissionStatus] = useState<{
    foreground: Location.PermissionStatus;
    background: Location.PermissionStatus;
  } | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const hospitalName = profile?.location || '';
  const isKnownHospital = !!getCoordinatesForHospital(hospitalName);
  const hasCoordinates = isKnownHospital || !!localSettings.customCoordinates;
  const hasAlwaysPermission = permissionStatus?.background === 'granted';

  useEffect(() => {
    loadSettings();
    checkPermissions();
    checkMonitoringStatus();
  }, []);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const checkPermissions = async () => {
    const status = await geofenceManager.getPermissionStatus();
    setPermissionStatus(status);
  };

  const checkMonitoringStatus = async () => {
    const monitoring = await geofenceManager.isMonitoring();
    setIsMonitoring(monitoring);
  };

  const handleRequestPermission = async () => {
    const { granted } = await geofenceManager.requestPermissions();
    await checkPermissions();
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Overtime+ needs "Always" location access to detect when you arrive at and leave work.\n\nPlease go to Settings → Privacy & Security → Location Services → Overtime+ and select "Always".',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newSettings: GeofenceSettings = {
        ...localSettings,
        hospitalName,
      };

      await saveSettings(newSettings);

      if (newSettings.enabled && hasAlwaysPermission && hasCoordinates) {
        const started = await geofenceManager.startMonitoring(
          hospitalName,
          newSettings.radiusMeters,
          newSettings.customCoordinates,
        );
        setIsMonitoring(started);
        if (!started) {
          Alert.alert('Could Not Start', 'Geofencing could not be activated. Make sure location permission is set to "Always" in Settings.');
        }
      } else if (!newSettings.enabled) {
        await geofenceManager.stopMonitoring();
        setIsMonitoring(false);
      }

      Alert.alert('Saved', 'Geofence settings have been saved.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetCurrentLocation = async () => {
    setIsFetchingLocation(true);
    try {
      // Ensure at least foreground permission before getting position
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed to capture your hospital\'s position.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = {
        latitude: Math.round(pos.coords.latitude * 10000) / 10000,
        longitude: Math.round(pos.coords.longitude * 10000) / 10000,
      };
      setLocalSettings(prev => ({ ...prev, customCoordinates: coords }));
    } catch (error) {
      Alert.alert('Could Not Get Location', 'Make sure location services are enabled and try again.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleToggleEnabled = (value: boolean) => {
    setLocalSettings(prev => ({ ...prev, enabled: value }));
  };

  return (
    <View style={[styles.container, isDark && styles.darkContainer, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.darkText]}>Auto Shift Detection</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Info card */}
        <View style={[styles.infoCard, isDark && styles.darkInfoCard]}>
          <Ionicons name="location-outline" size={20} color={isDark ? '#60a5fa' : '#2563eb'} />
          <Text style={[styles.infoText, isDark && styles.darkInfoText]}>
            When enabled, Overtime+ monitors a zone around your hospital. On arrival and departure it automatically creates a draft shift log for you to review.
          </Text>
        </View>

        {/* Hospital row */}
        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Hospital</Text>
          {hospitalName ? (
            <View style={styles.row}>
              <Ionicons
                name={hasCoordinates ? 'checkmark-circle' : 'alert-circle-outline'}
                size={18}
                color={hasCoordinates ? '#4CAF50' : '#f59e0b'}
              />
              <Text style={[styles.rowText, isDark && styles.darkSubText]}>{hospitalName}</Text>
            </View>
          ) : (
            <Text style={[styles.warningText, isDark && styles.darkWarningText]}>
              No hospital set. Go to Profile → Organisation to select your hospital.
            </Text>
          )}
          {hospitalName && !isKnownHospital && !localSettings.customCoordinates && (
            <Text style={[styles.warningText, isDark && styles.darkWarningText]}>
              This hospital is not in our database — set its location below to enable auto detection.
            </Text>
          )}
        </View>

        {/* Custom hospital location — shown when hospital is not in our known list */}
        {hospitalName && !isKnownHospital && (
          <View style={[styles.section, isDark && styles.darkSection]}>
            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Set Hospital Location</Text>
            <Text style={[styles.mutedText, isDark && styles.darkMutedText, { marginBottom: 12 }]}>
              Go to your hospital and tap the button below to capture its location. This is stored only on your device.
            </Text>
            {localSettings.customCoordinates ? (
              <View style={styles.row}>
                <Ionicons name="location" size={18} color="#4CAF50" />
                <Text style={[styles.rowText, isDark && styles.darkSubText]}>
                  Location set ({localSettings.customCoordinates.latitude.toFixed(4)}, {localSettings.customCoordinates.longitude.toFixed(4)})
                </Text>
              </View>
            ) : (
              <View style={styles.row}>
                <Ionicons name="location-outline" size={18} color="#f59e0b" />
                <Text style={[styles.rowText, isDark && styles.darkSubText]}>No location set yet</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.permissionButton, { marginTop: 12, backgroundColor: '#4CAF50' }, isFetchingLocation && { opacity: 0.6 }]}
              onPress={handleSetCurrentLocation}
              disabled={isFetchingLocation}
            >
              <Text style={styles.permissionButtonText}>
                {isFetchingLocation ? 'Getting location…' : localSettings.customCoordinates ? 'Update Location' : 'Use My Current Location'}
              </Text>
            </TouchableOpacity>
            {localSettings.customCoordinates && (
              <TouchableOpacity
                style={{ marginTop: 8 }}
                onPress={() => setLocalSettings(prev => ({ ...prev, customCoordinates: undefined }))}
              >
                <Text style={[styles.mutedText, { color: '#ef4444' }]}>Clear saved location</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Location permission */}
        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Location Permission</Text>

          {!permissionStatus ? (
            <Text style={[styles.mutedText, isDark && styles.darkMutedText]}>Checking…</Text>
          ) : hasAlwaysPermission ? (
            <View style={styles.row}>
              <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
              <Text style={[styles.rowText, isDark && styles.darkSubText]}>Always — ready for background detection</Text>
            </View>
          ) : (
            <>
              <View style={styles.row}>
                <Ionicons name="alert-circle-outline" size={18} color="#f59e0b" />
                <Text style={[styles.rowText, isDark && styles.darkSubText]}>
                  {permissionStatus.foreground === 'granted'
                    ? '"While Using" only — upgrade to "Always" for background detection'
                    : 'Location access not granted'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.permissionButton, isDark && styles.darkPermissionButton]}
                onPress={handleRequestPermission}
              >
                <Text style={styles.permissionButtonText}>
                  {permissionStatus.foreground === 'granted' ? 'Allow Background Access' : 'Grant Location Access'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Enable toggle */}
        <View style={[styles.section, isDark && styles.darkSection]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Enable Auto Detection</Text>
              <Text style={[styles.mutedText, isDark && styles.darkMutedText]}>
                {isMonitoring ? 'Currently monitoring' : 'Not currently monitoring'}
              </Text>
            </View>
            <Switch
              value={localSettings.enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: '#ddd', true: '#4CAF50' }}
              thumbColor="#fff"
              disabled={!hasCoordinates || !hasAlwaysPermission || !hospitalName}
            />
          </View>
          {localSettings.enabled && (!hasCoordinates || !hasAlwaysPermission) && (
            <Text style={[styles.warningText, isDark && styles.darkWarningText]}>
              {!hasAlwaysPermission
                ? 'Enable "Always" location access above to activate.'
                : 'No coordinates available for this hospital.'}
            </Text>
          )}
        </View>

        {/* Radius picker */}
        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Detection Radius</Text>
          <Text style={[styles.mutedText, isDark && styles.darkMutedText, { marginBottom: 12 }]}>
            How far from the hospital entrance triggers entry/exit detection.
          </Text>
          {RADIUS_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.radiusOption,
                isDark && styles.darkRadiusOption,
                localSettings.radiusMeters === option.value && styles.radiusOptionSelected,
                localSettings.radiusMeters === option.value && isDark && styles.darkRadiusOptionSelected,
              ]}
              onPress={() => setLocalSettings(prev => ({ ...prev, radiusMeters: option.value }))}
            >
              <View style={styles.radiusLeft}>
                <Text style={[
                  styles.radiusLabel,
                  isDark && styles.darkText,
                  localSettings.radiusMeters === option.value && styles.radiusLabelSelected,
                ]}>
                  {option.label}
                </Text>
                <Text style={[styles.mutedText, isDark && styles.darkMutedText]}>{option.description}</Text>
              </View>
              {localSettings.radiusMeters === option.value && (
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Notifications */}
        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Notifications</Text>

          <View style={styles.notifRow}>
            <Text style={[styles.notifLabel, isDark && styles.darkText]}>When you arrive at work</Text>
            <Switch
              value={localSettings.notifyOnEntry}
              onValueChange={v => setLocalSettings(prev => ({ ...prev, notifyOnEntry: v }))}
              trackColor={{ false: '#ddd', true: '#4CAF50' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.notifRow, styles.notifRowLast]}>
            <Text style={[styles.notifLabel, isDark && styles.darkText]}>When you leave work</Text>
            <Switch
              value={localSettings.notifyOnExit}
              onValueChange={v => setLocalSettings(prev => ({ ...prev, notifyOnExit: v }))}
              trackColor={{ false: '#ddd', true: '#4CAF50' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Info note */}
        <Text style={[styles.footerNote, isDark && styles.darkMutedText]}>
          GPS accuracy near large buildings can vary. If detection is unreliable, try a larger radius. Brief exits (under 15 min) will not end your shift.
        </Text>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save Settings'}</Text>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  darkContainer: { backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  darkText: { color: '#fff' },
  darkSubText: { color: '#ccc' },
  darkMutedText: { color: '#888' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  darkInfoCard: { backgroundColor: '#1e3a5f' },
  infoText: { flex: 1, fontSize: 14, color: '#2563eb', lineHeight: 20 },
  darkInfoText: { color: '#93c5fd' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  darkSection: { backgroundColor: '#1c1c1e' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { fontSize: 15, color: '#555', flex: 1 },
  mutedText: { fontSize: 13, color: '#888' },
  warningText: { fontSize: 13, color: '#b45309', marginTop: 6 },
  darkWarningText: { color: '#f59e0b' },
  permissionButton: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  darkPermissionButton: { backgroundColor: '#1d4ed8' },
  permissionButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLeft: { flex: 1, marginRight: 16 },
  radiusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  darkRadiusOption: { borderColor: '#374151' },
  radiusOptionSelected: { borderColor: '#4CAF50', backgroundColor: '#f0fdf4' },
  darkRadiusOptionSelected: { borderColor: '#4CAF50', backgroundColor: '#052e16' },
  radiusLeft: { flex: 1 },
  radiusLabel: { fontSize: 15, fontWeight: '500', color: '#333' },
  radiusLabelSelected: { color: '#166534' },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notifRowLast: { borderBottomWidth: 0 },
  notifLabel: { fontSize: 15, color: '#333', flex: 1 },
  footerNote: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
