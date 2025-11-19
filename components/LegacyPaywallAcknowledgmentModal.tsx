import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscriptionStore } from '../lib/state/subscriptionStore';

interface LegacyPaywallAcknowledgmentModalProps {
  visible: boolean;
  onAcknowledge: () => void;
  onDismiss?: () => void;
}

export function LegacyPaywallAcknowledgmentModal({
  visible,
  onAcknowledge,
  onDismiss,
}: LegacyPaywallAcknowledgmentModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const markPaywallAcknowledged = useSubscriptionStore((state) => state.markPaywallAcknowledged);

  const handleAcknowledge = async () => {
    try {
      await markPaywallAcknowledged();
      onAcknowledge();
    } catch (error) {
      Alert.alert('Error', 'Failed to acknowledge. Please try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, isDark && styles.darkContainer]}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Ionicons
                name="information-circle"
                size={48}
                color={isDark ? '#FFB300' : '#FF9800'}
              />
              <Text style={[styles.title, isDark && styles.darkTitle]}>
                Subscription Update
              </Text>
            </View>

            <View style={styles.content}>
              <Text style={[styles.paragraph, isDark && styles.darkText]}>
                Thank you for being an early user of Overtime+! We're introducing subscriptions to help us continue improving the app.
              </Text>

              <Text style={[styles.paragraph, isDark && styles.darkText]}>
                <Text style={styles.bold}>What's changing:</Text>
              </Text>
              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <Text style={[styles.bullet, isDark && styles.darkText]}>•</Text>
                  <Text style={[styles.bulletText, isDark && styles.darkText]}>
                    New users get a <Text style={styles.bold}>1-month free trial</Text>
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <Text style={[styles.bullet, isDark && styles.darkText]}>•</Text>
                  <Text style={[styles.bulletText, isDark && styles.darkText]}>
                    After the trial, subscriptions start automatically (monthly or yearly)
                  </Text>
                </View>
                <View style={styles.bulletItem}>
                  <Text style={[styles.bullet, isDark && styles.darkText]}>•</Text>
                  <Text style={[styles.bulletText, isDark && styles.darkText]}>
                    You can cancel anytime from your App Store or Play Store account
                  </Text>
                </View>
              </View>

              <Text style={[styles.paragraph, isDark && styles.darkText]}>
                <Text style={styles.bold}>Your current access:</Text>
              </Text>
              <View style={[styles.infoBox, isDark && styles.darkInfoBox]}>
                <Text style={[styles.infoText, isDark && styles.darkInfoText]}>
                  You currently have legacy beta access. Once you acknowledge this message, you'll need to start a subscription or trial to continue using the app.
                </Text>
              </View>

              <Text style={[styles.paragraph, isDark && styles.darkText]}>
                <Text style={styles.bold}>Important:</Text> If you're eligible, you can start a 1-month free trial. Cancelling during the trial removes access immediately. Cancelling during a paid period keeps access until the end of that period, followed by a 7-day grace period for data export.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryButton, isDark && styles.darkPrimaryButton]}
              onPress={handleAcknowledge}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>I Understand</Text>
            </TouchableOpacity>
            {onDismiss && (
              <TouchableOpacity
                style={[styles.secondaryButton, isDark && styles.darkSecondaryButton]}
                onPress={onDismiss}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryButtonText, isDark && styles.darkSecondaryText]}>
                  Not Now
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  darkContainer: {
    backgroundColor: '#1e1e1e',
  },
  scrollView: {
    maxHeight: '70%',
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginTop: 12,
    textAlign: 'center',
  },
  darkTitle: {
    color: '#fff',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    marginBottom: 16,
  },
  darkText: {
    color: '#e0e0e0',
  },
  bold: {
    fontWeight: '600',
  },
  bulletList: {
    marginBottom: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 16,
    marginRight: 8,
    color: '#333',
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  infoBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  darkInfoBox: {
    backgroundColor: '#2a2415',
    borderColor: '#FF9800',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#856404',
  },
  darkInfoText: {
    color: '#FFAB40',
  },
  actions: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  darkPrimaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkSecondaryButton: {
    borderColor: '#444',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  darkSecondaryText: {
    color: '#999',
  },
});

