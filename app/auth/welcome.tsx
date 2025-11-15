import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StyleSheet, useColorScheme } from 'react-native';
import { Link } from 'expo-router';

export default function Welcome() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const signInButtonStyle = {
    ...styles.button,
    backgroundColor: '#2563EB',
    width: '100%',
  };

  const signUpButtonStyle = {
    ...styles.button,
    backgroundColor: '#10B981',
    width: '100%',
  };

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
          <Link href="/auth/sign-in" asChild>
            <TouchableOpacity style={signInButtonStyle}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/auth/sign-up" asChild>
            <TouchableOpacity style={signUpButtonStyle}>
              <Text style={styles.buttonText}>Create Account</Text>
            </TouchableOpacity>
          </Link>
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
    backgroundColor: '#2563EB',
  },
  primaryButtonLight: {
    backgroundColor: '#000',
  },
  secondaryButton: {
    backgroundColor: '#10B981',
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


