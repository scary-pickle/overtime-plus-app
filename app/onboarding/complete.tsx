import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocalUserStore } from '../../lib/state/localUserStore';
import { useOnboardingStore } from '../../lib/state/onboardingStore';
import { createScopedLogger } from '../../lib/utils/logger';
import { OnboardingHeader } from '../../components/OnboardingHeader';

const debug = createScopedLogger('OnboardingComplete');

export default function OnboardingComplete() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { localUserId } = useLocalUserStore();
  const { completeOnboarding } = useOnboardingStore();

  const handleStartUsingApp = async () => {
    try {
      await completeOnboarding(localUserId);
      router.replace('/(tabs)/home');
    } catch (error) {
      debug.error('Error completing onboarding:', error);
      // Still redirect even if there's an error
      router.replace('/(tabs)/home');
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={[styles.checkmarkCircle, isDark && styles.darkCheckmarkCircle]}>
            <Ionicons name="checkmark" size={60} color="#4CAF50" />
          </View>
        </View>

        <OnboardingHeader
          step={6}
          title="All Set!"
          subtitle="Your setup is complete. Here is where the main features live before you open Home."
          align="center"
          containerStyle={styles.headerBlock}
        />

        <View style={styles.featuresList}>
          <View style={[styles.tabMapCard, isDark && styles.darkTabMapCard]}>
            {[
              { icon: 'home', title: 'Home', body: 'Start/end shift and create logs quickly.' },
              { icon: 'list', title: 'Logs', body: 'Review entries and mark logs ready for export.' },
              { icon: 'calendar', title: 'Shifts', body: 'Save roster patterns for faster logging.' },
              { icon: 'document-text', title: 'Exports', body: 'Generate AVAC PDF bundles from ready logs.' },
              { icon: 'person', title: 'Profile', body: 'Add delegate/email details later if needed.' },
            ].map((item) => (
              <View key={item.title} style={styles.tabRow}>
                <View style={[styles.tabIconWrap, isDark && styles.darkTabIconWrap]}>
                  <Ionicons name={item.icon as any} size={15} color={isDark ? '#93c5fd' : '#1d4ed8'} />
                </View>
                <View style={styles.tabTextGroup}>
                  <Text style={[styles.tabLabel, isDark && styles.darkFeatureText]}>{item.title}</Text>
                  <Text style={[styles.tabBody, isDark && styles.darkDescription]}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleStartUsingApp}
        >
          <Text style={styles.buttonText}>Open Home</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  headerBlock: {
    width: '100%',
    marginBottom: 8,
  },
  stepPill: {
    backgroundColor: '#eaf2ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  darkStepPill: {
    backgroundColor: '#10233f',
  },
  stepPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  darkStepPillText: {
    color: '#93c5fd',
  },
  checkmarkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkCheckmarkCircle: {
    backgroundColor: '#1B5E20',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  darkTitle: {
    color: '#fff',
  },
  description: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  darkDescription: {
    color: '#aaa',
  },
  featuresList: {
    width: '100%',
    marginBottom: 28,
  },
  tabMapCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  darkTabMapCard: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tabIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  darkTabIconWrap: {
    backgroundColor: '#111827',
  },
  tabTextGroup: {
    flex: 1,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  tabBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#555',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#111',
  },
  darkFeatureText: {
    color: '#fff',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});





