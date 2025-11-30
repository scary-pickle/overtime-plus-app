import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useHideSplashOnFocus } from '../../lib/utils/hideSplashOnFocus';

export default function Welcome() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  
  // Hide splash screen when this screen is focused and ready
  useHideSplashOnFocus();

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, isDark && styles.darkTitle]}>Overtime+</Text>
          <Text style={[styles.subtitle, isDark && styles.darkSubtitle]}>
            Track shifts and overtime securely across devices.
          </Text>
        </View>
        <View style={styles.buttons}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]}
            activeOpacity={0.8}
            onPress={() => router.push('/auth/sign-in')}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            activeOpacity={0.8}
            onPress={() => router.push('/auth/sign-up')}
          >
            <Text style={styles.buttonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  darkTitle: {
    color: '#fff',
  },
  subtitle: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    lineHeight: 26,
  },
  darkSubtitle: {
    color: '#aaa',
  },
  buttons: {
    gap: 12,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonLight: {
    backgroundColor: '#000',
  },
  secondaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButtonLight: {
    backgroundColor: '#000',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
});


