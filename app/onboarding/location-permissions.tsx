import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useProfileStore } from '../../lib/state/profileStore';
import { useGeofenceStore } from '../../lib/state/geofenceStore';
import { geofenceManager } from '../../lib/location/geofenceManager';
import { getCoordinatesForHospital } from '../../lib/data/hospitalCoordinates';
import { GeofenceSettings } from '../../types';

export default function LocationPermissionsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { profile } = useProfileStore();
  const { saveSettings } = useGeofenceStore();

  const hospitalName = profile?.location || '';
  const isKnownHospital = !!getCoordinatesForHospital(hospitalName);

  const [permissionStatus, setPermissionStatus] = useState<{
    foreground: Location.PermissionStatus;
    background: Location.PermissionStatus;
  } | null>(null);
  const [customCoordinates, setCustomCoordinates] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  const hasAlwaysPermission = permissionStatus?.background === 'granted';
  const canEnable = hasAlwaysPermission && (isKnownHospital || !!customCoordinates);

  useEffect(() => {
    geofenceManager.getPermissionStatus().then(setPermissionStatus);
  }, []);

  const handleSetCurrentLocation = async () => {
    setIsFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      await geofenceManager.getPermissionStatus().then(setPermissionStatus);
      if (status !== 'granted') return;

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCustomCoordinates({
        latitude: Math.round(pos.coords.latitude * 10000) / 10000,
        longitude: Math.round(pos.coords.longitude * 10000) / 10000,
      });
    } catch {
      // silently ignore — user can try again or skip
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleEnableAndContinue = async () => {
    setIsEnabling(true);
    try {
      const { granted } = await geofenceManager.requestPermissions();
      const status = await geofenceManager.getPermissionStatus();
      setPermissionStatus(status);

      if (granted) {
        const settings: GeofenceSettings = {
          enabled: true,
          radiusMeters: 500,
          hospitalName,
          notifyOnEntry: true,
          notifyOnExit: true,
          customCoordinates,
        };
        await saveSettings(settings);
        await geofenceManager.startMonitoring(hospitalName, 500, customCoordinates);
      }
    } finally {
      setIsEnabling(false);
      router.push('/onboarding/create-first-log');
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/create-first-log');
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, isDark && styles.darkIconCircle]}>
            <Ionicons name="location" size={44} color="#4CAF50" />
          </View>
        </View>

        {/* Headline */}
        <Text style={[styles.title, isDark && styles.darkText]}>Automatic Shift Tracking</Text>
        <Text style={[styles.subtitle, isDark && styles.darkSubtitle]}>
          Overtime+ can automatically start and stop your shift log when you arrive at and leave your hospital.
        </Text>

        {/* Feature bullets */}
        <View style={[styles.card, isDark && styles.darkCard]}>
          {[
            { icon: 'enter-outline', text: 'Detects when you arrive at your hospital and records your start time' },
            { icon: 'exit-outline', text: 'Detects when you leave and records your finish time' },
            { icon: 'document-text-outline', text: 'Creates a draft log for you to review — nothing is submitted without your approval' },
            { icon: 'phone-portrait-outline', text: 'Works in the background, even when the app is closed' },
          ].map(({ icon, text }) => (
            <View key={text} style={styles.bullet}>
              <Ionicons name={icon as any} size={20} color="#4CAF50" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, isDark && styles.darkSubtitle]}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Privacy callout */}
        <View style={[styles.privacyCard, isDark && styles.darkPrivacyCard]}>
          <Ionicons name="lock-closed" size={18} color={isDark ? '#86efac' : '#166534'} />
          <View style={styles.privacyText}>
            <Text style={[styles.privacyTitle, isDark && styles.darkPrivacyTitle]}>Your data stays on your phone</Text>
            <Text style={[styles.privacyBody, isDark && styles.darkPrivacyBody]}>
              Overtime+ works entirely offline. Your location is never sent to any server — it is processed locally on your device and immediately discarded. No accounts, no cloud, no data sharing.
            </Text>
          </View>
        </View>

        {/* Hospital info */}
        {hospitalName ? (
          <View style={[styles.card, isDark && styles.darkCard]}>
            <Text style={[styles.cardLabel, isDark && styles.darkSubtitle]}>Your hospital</Text>
            <View style={styles.hospitalRow}>
              <Ionicons
                name={isKnownHospital || customCoordinates ? 'checkmark-circle' : 'alert-circle-outline'}
                size={20}
                color={isKnownHospital || customCoordinates ? '#4CAF50' : '#f59e0b'}
              />
              <Text style={[styles.hospitalName, isDark && styles.darkText]}>{hospitalName}</Text>
            </View>

            {/* Custom hospital location step */}
            {!isKnownHospital && (
              <View style={styles.customLocationSection}>
                <View style={[styles.divider, isDark && styles.darkDivider]} />
                <Text style={[styles.cardLabel, isDark && styles.darkSubtitle, { marginTop: 12 }]}>
                  Set hospital location
                </Text>
                <Text style={[styles.customLocationBody, isDark && styles.darkSubtitle]}>
                  Your hospital isn't in our database. Go to your hospital and tap below to capture its location — stored only on your phone.
                </Text>

                {customCoordinates ? (
                  <View style={styles.coordRow}>
                    <Ionicons name="location" size={16} color="#4CAF50" />
                    <Text style={[styles.coordText, isDark && styles.darkSubtitle]}>
                      Location saved ({customCoordinates.latitude.toFixed(4)}, {customCoordinates.longitude.toFixed(4)})
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.secondaryButton, isDark && styles.darkSecondaryButton, isFetchingLocation && styles.disabledButton]}
                  onPress={handleSetCurrentLocation}
                  disabled={isFetchingLocation}
                >
                  {isFetchingLocation ? (
                    <ActivityIndicator size="small" color="#4CAF50" />
                  ) : (
                    <Ionicons name="locate" size={16} color="#4CAF50" />
                  )}
                  <Text style={styles.secondaryButtonText}>
                    {isFetchingLocation ? 'Getting location…' : customCoordinates ? 'Update Location' : 'Use My Current Location'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {/* Permission status (shown once we know) */}
        {permissionStatus && hasAlwaysPermission && (
          <View style={[styles.card, isDark && styles.darkCard, styles.permissionGrantedCard]}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={[styles.permissionGrantedText, isDark && styles.darkText]}>
              Location access enabled
            </Text>
          </View>
        )}

        {/* "Open Settings" nudge if foreground granted but not background */}
        {permissionStatus?.foreground === 'granted' && !hasAlwaysPermission && (
          <View style={[styles.settingsNudge, isDark && styles.darkSettingsNudge]}>
            <Ionicons name="information-circle-outline" size={16} color={isDark ? '#93c5fd' : '#2563eb'} />
            <Text style={[styles.settingsNudgeText, isDark && styles.darkSettingsNudgeText]}>
              To detect shifts in the background, tap "Enable Location Access" and choose{' '}
              <Text style={{ fontWeight: '700' }}>Always</Text> when iOS asks.
            </Text>
          </View>
        )}

        {/* Primary CTA */}
        <View style={styles.actions}>
          {!hasAlwaysPermission ? (
            <TouchableOpacity
              style={[styles.primaryButton, (isEnabling || (!isKnownHospital && !customCoordinates && hospitalName !== '')) && styles.primaryButtonMuted]}
              onPress={handleEnableAndContinue}
              disabled={isEnabling}
            >
              {isEnabling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="location" size={20} color="#fff" />
              )}
              <Text style={styles.primaryButtonText}>
                {isEnabling ? 'Enabling…' : 'Enable Location Access'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/onboarding/create-first-log')}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={[styles.skipText, isDark && styles.darkSkipText]}>Set up later in Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkIconCircle: {
    backgroundColor: '#052e16',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  darkText: {
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  darkSubtitle: {
    color: '#9ca3af',
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  bulletIcon: {
    marginTop: 1,
    marginRight: 12,
    width: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  darkPrivacyCard: {
    backgroundColor: '#052e16',
    borderColor: '#166534',
  },
  privacyText: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  darkPrivacyTitle: {
    color: '#86efac',
  },
  privacyBody: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 19,
  },
  darkPrivacyBody: {
    color: '#4ade80',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  hospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  customLocationSection: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  darkDivider: {
    backgroundColor: '#374151',
  },
  customLocationBody: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  coordText: {
    fontSize: 13,
    color: '#4b5563',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  darkSecondaryButton: {
    borderColor: '#4CAF50',
  },
  disabledButton: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  permissionGrantedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  permissionGrantedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  settingsNudge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  darkSettingsNudge: {
    backgroundColor: '#1e3a5f',
  },
  settingsNudgeText: {
    flex: 1,
    fontSize: 13,
    color: '#1d4ed8',
    lineHeight: 19,
  },
  darkSettingsNudgeText: {
    color: '#93c5fd',
  },
  actions: {
    marginTop: 8,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 14,
    paddingVertical: 17,
    paddingHorizontal: 24,
  },
  primaryButtonMuted: {
    backgroundColor: '#86c988',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
    color: '#6b7280',
  },
  darkSkipText: {
    color: '#9ca3af',
  },
});
