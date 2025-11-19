import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Platform,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSubscriptionStore } from '../../lib/state/subscriptionStore';
import {
  getManageSubscriptionUrl,
  SubscriptionAccessReason,
} from '../../lib/utils/subscription';
import { LegacyPaywallAcknowledgmentModal } from '../../components/LegacyPaywallAcknowledgmentModal';

const STATUS_COPY: Record<SubscriptionAccessReason, { label: string; detail: string }> = {
  'paywall-disabled': {
    label: 'Paywall Disabled',
    detail: 'Subscriptions are not enforced for this build.',
  },
  'legacy-free': {
    label: 'Legacy Access',
    detail: 'You have temporary access while we roll out subscriptions.',
  },
  active: {
    label: 'Subscription Active',
    detail: 'Your subscription is active and billing normally.',
  },
  'customer-entitled': {
    label: 'Entitlement Active',
    detail: 'RevenueCat reports an active entitlement for this account.',
  },
  trial: {
    label: 'Trial Active',
    detail: 'You are in the 1-month free trial period.',
  },
  grace: {
    label: 'Grace Period',
    detail: 'Your subscription expired but export-only access remains for 7 days.',
  },
  none: {
    label: 'Subscription Required',
    detail: 'Start a free trial or resume your subscription to keep using Overtime+.',
  },
};

const formatDate = (value?: string | null) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
};

const PaywallScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const offerings = useSubscriptionStore((state) => state.offerings);
  const access = useSubscriptionStore((state) => state.access);
  const snapshot = useSubscriptionStore((state) => state.snapshot);
  const refreshing = useSubscriptionStore((state) => state.refreshing);
  const remoteFlags = useSubscriptionStore((state) => state.remoteFlags);
  const trialEligible = useSubscriptionStore((state) => state.isTrialEligible());
  const trialDaysRemaining = useSubscriptionStore((state) => state.trialDaysRemaining());
  const graceDaysRemaining = useSubscriptionStore((state) => state.graceDaysRemaining());
  const purchasePackage = useSubscriptionStore((state) => state.purchasePackage);
  const restorePurchases = useSubscriptionStore((state) => state.restorePurchases);
  const refresh = useSubscriptionStore((state) => state.refresh);
  const [pendingPackage, setPendingPackage] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [showLegacyModal, setShowLegacyModal] = useState(false);

  // Show legacy acknowledgement modal if needed
  useEffect(() => {
    if (snapshot?.legacyFreeAccess && !snapshot?.paywallAcknowledgedAt) {
      setShowLegacyModal(true);
    }
  }, [snapshot?.legacyFreeAccess, snapshot?.paywallAcknowledgedAt]);

  const packages = useMemo(() => {
    if (!offerings) {
      return [] as PurchasesPackage[];
    }
    if (offerings.current?.availablePackages?.length) {
      return offerings.current.availablePackages;
    }
    const fallback: PurchasesPackage[] = [];
    Object.values(offerings.all || {}).forEach((offering: any) => {
      offering.availablePackages.forEach((pkg: PurchasesPackage) => fallback.push(pkg));
    });
    return fallback;
  }, [offerings]);

  const handlePurchase = async (identifier: string) => {
    try {
      setPendingPackage(identifier);
      await purchasePackage(identifier);
      Alert.alert('Subscription Updated', 'Thanks! Your access has been refreshed.');
    } catch (error: any) {
      if (error?.userCancelled) {
        return;
      }
      Alert.alert('Purchase Failed', error?.message || 'Unable to complete purchase. Please try again.');
    } finally {
      setPendingPackage(null);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      await restorePurchases();
      Alert.alert('Restored', 'Previous purchases restored successfully.');
    } catch (error: any) {
      Alert.alert('Restore Failed', error?.message || 'Unable to restore purchases.');
    } finally {
      setRestoring(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const openManageSubscriptions = () => {
    const url = getManageSubscriptionUrl(Platform.OS === 'ios' ? 'ios' : 'android');
    Linking.openURL(url).catch(() => {
      Alert.alert('Manage Subscription', 'Unable to open the subscription settings page.');
    });
  };

  const statusCopy = STATUS_COPY[access.reason] || STATUS_COPY.none;

  const paywallFlag = remoteFlags['enable_paywall'];
  const cohort = paywallFlag?.value?.cohort_percentage;
  const rolloutTarget = paywallFlag?.value?.target_group;

  const manageLabel = Platform.OS === 'ios' ? 'Manage in App Store' : 'Manage in Play Store';

  const handleLegacyAcknowledge = () => {
    setShowLegacyModal(false);
    // Refresh subscription state after acknowledgement
    refresh();
  };

  return (
    <>
      <LegacyPaywallAcknowledgmentModal
        visible={showLegacyModal}
        onAcknowledge={handleLegacyAcknowledge}
        onDismiss={() => setShowLegacyModal(false)}
      />
      <ScrollView
        style={[styles.container, isDark && styles.darkContainer]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={isDark ? '#fff' : '#000'} />
        }
      >
      <View style={styles.content}>
        <View style={[styles.statusCard, isDark && styles.darkCard]}>
          <View style={styles.statusHeader}>
            <Ionicons name="card-outline" size={22} color={isDark ? '#fff' : '#111'} />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.statusTitle, isDark && styles.darkText]}>
                {statusCopy.label}
              </Text>
              <Text style={[styles.statusSubtitle, isDark && styles.darkSubtitle]}>
                {statusCopy.detail}
              </Text>
            </View>
          </View>
          {access.reason === 'trial' && typeof trialDaysRemaining === 'number' && (
            <Text style={[styles.statusMeta, isDark && styles.darkSubtitle]}>
              Trial ends in {trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'}.
            </Text>
          )}
          {access.reason === 'grace' && typeof graceDaysRemaining === 'number' && (
            <Text style={[styles.statusMeta, isDark && styles.darkSubtitle]}>
              Grace period ends in {graceDaysRemaining} day{graceDaysRemaining === 1 ? '' : 's'}.
            </Text>
          )}
          {snapshot?.subscriptionExpiresAt && (
            <Text style={[styles.statusMeta, isDark && styles.darkSubtitle]}>
              Renews / expires {formatDate(snapshot.subscriptionExpiresAt)}
            </Text>
          )}
          {snapshot?.legacyFreeAccess && (
            <Text style={[styles.statusMeta, styles.legacyCopy]}>
              Legacy beta access is active until you acknowledge the paywall.
            </Text>
          )}
        </View>

        <View style={[styles.calloutRow, isDark && styles.darkCard]}>
          <Ionicons name="time-outline" size={20} color="#ffb74d" />
          <Text style={[styles.calloutText, isDark && styles.darkText]}>
            Cancellation during trial removes access immediately. Cancelling during a paid period keeps access until the cycle ends, followed by 7 days of export-only grace.
          </Text>
        </View>

        {trialEligible ? (
          <View style={[styles.calloutRow, isDark && styles.darkCard]}>
            <Ionicons name="sparkles-outline" size={20} color="#00c853" />
            <Text style={[styles.calloutText, isDark && styles.darkText]}>
              You are eligible for a 1-month free trial. Billing begins only after the trial ends.
            </Text>
          </View>
        ) : (
          <View style={[styles.calloutRow, isDark && styles.darkCard]}>
            <Ionicons name="information-circle-outline" size={20} color="#ff7043" />
            <Text style={[styles.calloutText, isDark && styles.darkText]}>
              Free trials are unavailable for this account. You can subscribe to regain access instantly.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Choose a plan
          </Text>
          {cohort !== undefined && (
            <Text style={[styles.sectionSubtitle, isDark && styles.darkSubtitle]}>
              Rollout cohort: {cohort}% {rolloutTarget ? `(${rolloutTarget})` : ''}
            </Text>
          )}
        </View>

        {packages.length === 0 && (
          <View style={[styles.emptyState, isDark && styles.darkCard]}>
            <Text style={[styles.emptyStateText, isDark && styles.darkSubtitle]}>
              No offerings loaded from RevenueCat yet. Configure offerings in the dashboard or refresh once products are synced.
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}

        {packages.map((pkg) => {
          const product = (pkg as any).product || (pkg as any).storeProduct || {};
          const price = product.priceString || product.formattedPrice || '';
          const title = product.title || pkg.identifier;
          const description = product.description || '';

          return (
            <View key={pkg.identifier} style={[styles.packageCard, isDark && styles.darkCard]}>
              <View style={styles.packageHeader}>
                <View>
                  <Text style={[styles.packageTitle, isDark && styles.darkText]}>{title}</Text>
                  <Text style={[styles.packagePrice, isDark && styles.darkSubtitle]}>{price}</Text>
                </View>
                <View style={styles.packageBadge}>
                  <Text style={styles.packageBadgeText}>
                    {pkg.packageType.toLowerCase()}
                  </Text>
                </View>
              </View>
              {description ? (
                <Text style={[styles.packageDescription, isDark && styles.darkSubtitle]}>
                  {description}
                </Text>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (pendingPackage === pkg.identifier) && styles.buttonLoading,
                ]}
                onPress={() => handlePurchase(pkg.identifier)}
                disabled={pendingPackage === pkg.identifier}
                activeOpacity={0.8}
              >
                {pendingPackage === pkg.identifier ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {trialEligible ? 'Start Free Trial' : 'Subscribe'}
                  </Text>
                )}
              </TouchableOpacity>
              <Text style={[styles.packageFooter, isDark && styles.darkSubtitle]}>
                Trial converts to paid automatically. Cancel anytime from your store account.
              </Text>
            </View>
          );
        })}

        <View style={[styles.actionsRow, isDark && styles.darkCard]}>
          <TouchableOpacity
            style={[styles.secondaryButton, restoring && styles.buttonLoading]}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator color={isDark ? '#fff' : '#111'} />
            ) : (
              <Text style={[styles.secondaryButtonText, isDark && styles.darkText]}>
                Restore Purchases
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={openManageSubscriptions}>
            <Text style={styles.linkButtonText}>{manageLabel}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.footerCard, isDark && styles.darkCard]}>
          <Text style={[styles.footerTitle, isDark && styles.darkText]}>Need to export data?</Text>
          <Text style={[styles.footerCopy, isDark && styles.darkSubtitle]}>
            During the 7-day grace period exports remain available so you can download your logs before the account locks. 
            Contact support if you need help recovering access.
          </Text>
          <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/(tabs)/profile')}>
            <Text style={styles.linkButtonText}>Back to app</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  darkCard: {
    backgroundColor: '#1e1e1e',
    borderColor: '#2c2c2c',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  darkText: {
    color: '#fff',
  },
  darkSubtitle: {
    color: '#ccc',
  },
  statusMeta: {
    marginTop: 8,
    fontSize: 14,
    color: '#444',
  },
  legacyCopy: {
    color: '#FFB300',
    fontWeight: '600',
  },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 12,
  },
  calloutText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  packageCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  packagePrice: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  packageBadge: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  packageBadgeText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  packageDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonLoading: {
    opacity: 0.6,
  },
  packageFooter: {
    fontSize: 12,
    color: '#777',
    marginTop: 10,
  },
  actionsRow: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: '#f1f1f1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  linkButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  footerCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  footerCopy: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default PaywallScreen;
