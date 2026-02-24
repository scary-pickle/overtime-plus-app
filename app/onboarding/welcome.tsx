import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingHeader } from '../../components/OnboardingHeader';

export default function OnboardingWelcome() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="time-outline" size={80} color="#007AFF" />
        </View>
        
        <OnboardingHeader
          step={1}
          title="Welcome to Overtime+"
          subtitle="Set up the essentials, learn where each feature lives, and create your first overtime log before you land on Home."
          align="center"
          containerStyle={styles.headerBlock}
        />

        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={[styles.featureText, isDark && styles.darkFeatureText]}>Add your profile basics</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={[styles.featureText, isDark && styles.darkFeatureText]}>Learn the app tabs and workflow</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={[styles.featureText, isDark && styles.darkFeatureText]}>Create your first log with guidance</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/onboarding/how-it-works')}
        >
          <Text style={styles.buttonText}>Start Setup</Text>
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
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  headerBlock: {
    width: '100%',
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  darkTitle: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  darkDescription: {
    color: '#AAAAAA',
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
    color: '#333',
  },
  darkFeatureText: {
    color: '#AAAAAA',
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





