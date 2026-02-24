import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingHeader } from '../../components/OnboardingHeader';

const FEATURE_CARDS = [
  {
    title: 'Home',
    icon: 'home',
    body: 'Start or end a shift, create a log quickly, and see recent overtime activity.',
  },
  {
    title: 'Logs',
    icon: 'list',
    body: 'Review entries and move logs through Draft, Ready, and Exported status.',
  },
  {
    title: 'Shifts',
    icon: 'calendar',
    body: 'Save roster patterns and quick shifts so overtime logs auto-fill faster.',
  },
  {
    title: 'Exports',
    icon: 'document-text',
    body: 'Generate AVAC PDF bundles from ready logs and track submission status.',
  },
  {
    title: 'Profile',
    icon: 'person',
    body: 'Update delegate, email, and other details used for exporting and submitting.',
  },
] as const;

export default function OnboardingHowItWorks() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <OnboardingHeader
          step={2}
          title="How Overtime+ Works"
          subtitle="Before setup, here is the main workflow so the app makes sense when you reach Home."
          onBack={() => router.back()}
          align="left"
          containerStyle={styles.headerBlock}
        />

        <View style={styles.cards}>
          {FEATURE_CARDS.map((card) => (
            <View key={card.title} style={[styles.card, isDark && styles.darkCard]}>
              <View style={[styles.iconWrap, isDark && styles.darkIconWrap]}>
                <Ionicons name={card.icon as any} size={20} color={isDark ? '#93c5fd' : '#2563eb'} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, isDark && styles.darkTitle]}>{card.title}</Text>
                <Text style={[styles.cardBody, isDark && styles.darkSubtitle]}>{card.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.workflowCard, isDark && styles.darkWorkflowCard]}>
          <Text style={[styles.workflowTitle, isDark && styles.darkTitle]}>Typical workflow</Text>
          <Text style={[styles.workflowBody, isDark && styles.darkSubtitle]}>
            Create or auto-track a log, review it in Logs, mark it ready, export an AVAC PDF, then track submission in Exports.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/onboarding/profile-setup')}>
          <Text style={styles.primaryButtonText}>Continue to Profile Setup</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

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
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  headerBlock: {
    marginBottom: 8,
  },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#eaf2ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
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
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  darkTitle: {
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4b5563',
    marginBottom: 20,
  },
  darkSubtitle: {
    color: '#9ca3af',
  },
  cards: {
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  darkIconWrap: {
    backgroundColor: '#111827',
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  workflowCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  darkWorkflowCard: {
    backgroundColor: '#052e16',
    borderColor: '#166534',
  },
  workflowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  workflowBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#4b5563',
    fontSize: 15,
    fontWeight: '600',
  },
  darkSecondaryButtonText: {
    color: '#9ca3af',
  },
});
