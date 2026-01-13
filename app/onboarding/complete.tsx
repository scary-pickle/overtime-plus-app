import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/state/authStore';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('OnboardingComplete');

export default function OnboardingComplete() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { completeOnboarding } = useAuthStore();

  const handleStartUsingApp = async () => {
    try {
      await completeOnboarding();
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
        
        <Text style={[styles.title, isDark && styles.darkTitle]}>All Set!</Text>
        
        <Text style={[styles.description, isDark && styles.darkDescription]}>
          Your profile is complete and you're ready to start tracking overtime.
        </Text>

        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={[styles.featureText, isDark && styles.darkFeatureText]}>Profile set up successfully</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={[styles.featureText, isDark && styles.darkFeatureText]}>Ready to create logs</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={[styles.featureText, isDark && styles.darkFeatureText]}>Ready to generate AVAC forms</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleStartUsingApp}
        >
          <Text style={styles.buttonText}>Start Using App</Text>
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
    marginBottom: 32,
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
    marginBottom: 40,
    lineHeight: 24,
  },
  darkDescription: {
    color: '#aaa',
  },
  featuresList: {
    width: '100%',
    marginBottom: 48,
    gap: 16,
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







