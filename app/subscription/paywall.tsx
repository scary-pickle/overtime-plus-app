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
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { useSubscriptionStore } from '../../lib/state/subscriptionStore';
import {
  getManageSubscriptionUrl,
  SubscriptionAccessReason,
} from '../../lib/utils/subscription';
import { LegacyPaywallAcknowledgmentModal } from '../../components/LegacyPaywallAcknowledgmentModal';

const privacyPolicyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL;

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

  const openExternal = (url: string | undefined | null, label: string) => {
    if (!url) {
      Alert.alert(`${label} unavailable`, `${label} URL is not configured yet.`);
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert(`${label}`, `Unable to open the ${label.toLowerCase()}.`);
    });
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
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={isDark ? '#fff' : '#000'} />
        }
      >
        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={[styles.heroIconContainer, isDark && styles.darkHeroIconContainer]}>
              <Ionicons name="sparkles" size={32} color="#007AFF" />
            </View>
            <Text style={[styles.heroTitle, isDark && styles.darkText]}>
              {statusCopy.label}
            </Text>
            <Text style={[styles.heroSubtitle, isDark && styles.darkSubtitle]}>
              {statusCopy.detail}
            </Text>
            {access.reason === 'trial' && typeof trialDaysRemaining === 'number' && (
              <View style={[styles.badge, styles.trialBadge]}>
                <Ionicons name="time-outline" size={14} color="#10B981" />
                <Text style={styles.badgeText}>
                  {trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'} remaining
                </Text>
              </View>
            )}
            {access.reason === 'grace' && typeof graceDaysRemaining === 'number' && (
              <View style={[styles.badge, styles.graceBadge]}>
                <Ionicons name="warning-outline" size={14} color="#FFA500" />
                <Text style={styles.graceBadgeText}>
                  {graceDaysRemaining} day{graceDaysRemaining === 1 ? '' : 's'} of grace period remaining
                </Text>
              </View>
            )}
            {snapshot?.subscriptionExpiresAt && (
              <Text style={[styles.heroMeta, isDark && styles.darkSubtitle]}>
                Renews {formatDate(snapshot.subscriptionExpiresAt)}
              </Text>
            )}
          </View>

          {/* Info Cards */}
          {trialEligible && (
            <View style={[styles.infoCard, isDark && styles.darkCard, styles.successCard]}>
              <View style={styles.infoCardHeader}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={[styles.infoCardTitle, isDark && styles.darkText]}>
                  Free Trial Available
                </Text>
              </View>
              <Text style={[styles.infoCardText, isDark && styles.darkSubtitle]}>
                Start your 1-month free trial today. Billing begins only after the trial ends.
              </Text>
            </View>
          )}

          {!trialEligible && access.reason === 'none' && (
            <View style={[styles.infoCard, isDark && styles.darkCard]}>
              <View style={styles.infoCardHeader}>
                <Ionicons name="information-circle" size={20} color="#007AFF" />
                <Text style={[styles.infoCardTitle, isDark && styles.darkText]}>
                  Subscription Required
                </Text>
              </View>
              <Text style={[styles.infoCardText, isDark && styles.darkSubtitle]}>
                Subscribe to regain full access to Overtime+ features.
              </Text>
            </View>
          )}

          <View style={[styles.infoCard, isDark && styles.darkCard]}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="time-outline" size={20} color="#FFA500" />
              <Text style={[styles.infoCardTitle, isDark && styles.darkText]}>
                Cancellation Policy
              </Text>
            </View>
            <Text style={[styles.infoCardText, isDark && styles.darkSubtitle]}>
              Cancelling during trial removes access immediately. Cancelling during a paid period keeps access until the cycle ends, followed by 7 days of export-only grace.
            </Text>
          </View>

          {/* Plans Section */}
          {packages.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
                  Choose Your Plan
                </Text>
                {cohort !== undefined && (
                  <Text style={[styles.sectionSubtitle, isDark && styles.darkSubtitle]}>
                    Rollout cohort: {cohort}% {rolloutTarget ? `(${rolloutTarget})` : ''}
                  </Text>
                )}
              </View>

              {packages.map((pkg, index) => {
                const product = (pkg as any).product || (pkg as any).storeProduct || {};
                const price = product.priceString || product.formattedPrice || '';
                const title = product.title || pkg.identifier;
                const description = product.description || '';
                const isYearly = pkg.packageType === PACKAGE_TYPE.ANNUAL;
                const isPopular = isYearly; // Mark yearly as popular

                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[
                      styles.packageCard,
                      isDark && styles.darkCard,
                      isPopular && styles.popularCard,
                      isPopular && isDark && styles.darkPopularCard,
                    ]}
                    onPress={() => handlePurchase(pkg.identifier)}
                    disabled={pendingPackage === pkg.identifier}
                    activeOpacity={0.9}
                  >
                    {isPopular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>Best Value</Text>
                      </View>
                    )}
                    <View style={styles.packageHeader}>
                      <View style={styles.packageTitleContainer}>
                        <Text style={[styles.packageTitle, isDark && styles.darkText]}>
                          {isYearly ? 'Annual' : 'Monthly'}
                        </Text>
                        <Text style={[styles.packagePrice, isDark && styles.darkText]}>
                          {price}
                        </Text>
                        {isYearly && (
                          <Text style={[styles.packageSavings, isDark && styles.darkSubtitle]}>
                            Save compared to monthly
                          </Text>
                        )}
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
                        isPopular && styles.primaryButtonPopular,
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
                      {trialEligible ? 'Free trial, then ' : ''}{price} per {isYearly ? 'year' : 'month'}. Cancel anytime.
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {packages.length === 0 && (
            <View style={[styles.emptyState, isDark && styles.darkCard]}>
              <Ionicons name="refresh-outline" size={48} color={isDark ? '#666' : '#999'} />
              <Text style={[styles.emptyStateTitle, isDark && styles.darkText]}>
                Loading Plans
              </Text>
              <Text style={[styles.emptyStateText, isDark && styles.darkSubtitle]}>
                No offerings loaded from RevenueCat yet. Configure offerings in the dashboard or refresh once products are synced.
              </Text>
              <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
                <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[styles.secondaryButton, isDark && styles.darkSecondaryButton, restoring && styles.buttonLoading]}
              onPress={handleRestore}
              disabled={restoring}
              activeOpacity={0.7}
            >
              {restoring ? (
                <ActivityIndicator color={isDark ? '#fff' : '#111'} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color={isDark ? '#fff' : '#111'} style={{ marginRight: 8 }} />
                  <Text style={[styles.secondaryButtonText, isDark && styles.darkText]}>
                    Restore Purchases
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton} onPress={openManageSubscriptions} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={16} color="#007AFF" style={{ marginRight: 6 }} />
              <Text style={styles.linkButtonText}>{manageLabel}</Text>
            </TouchableOpacity>
          </View>

          {/* Legal & Billing */}
          <View style={[styles.legalCard, isDark && styles.darkCard]}>
            <View style={styles.legalHeader}>
              <Ionicons name="shield-checkmark-outline" size={20} color={isDark ? '#fff' : '#111'} />
              <Text style={[styles.legalTitle, isDark && styles.darkText]}>Billing & Legal</Text>
            </View>
            <Text style={[styles.legalCopy, isDark && styles.darkSubtitle]}>
              Payment is charged to your Apple ID/Google Play account at confirmation. Subscriptions auto-renew unless you cancel at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store/Play Store settings. Free trials convert to paid if not canceled 24 hours before trial ends; unused trial time is forfeited when purchasing.
            </Text>
            <View style={styles.legalLinks}>
              <TouchableOpacity
                style={styles.linkPill}
                onPress={() => openExternal(privacyPolicyUrl, 'Privacy Policy')}
                activeOpacity={0.8}
              >
                <Text style={styles.linkPillText}>Privacy Policy</Text>
                <Ionicons name="open-outline" size={16} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkPill}
                onPress={() => openExternal(termsUrl, 'Terms of Service')}
                activeOpacity={0.8}
              >
                <Text style={styles.linkPillText}>Terms of Service</Text>
                <Ionicons name="open-outline" size={16} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={[styles.footerCard, isDark && styles.darkCard]}>
            <Ionicons name="document-text-outline" size={24} color={isDark ? '#007AFF' : '#007AFF'} />
            <Text style={[styles.footerTitle, isDark && styles.darkText]}>Need to export data?</Text>
            <Text style={[styles.footerCopy, isDark && styles.darkSubtitle]}>
              During the 7-day grace period, exports remain available so you can download your logs before the account locks.
            </Text>
            <TouchableOpacity 
              style={styles.footerLink} 
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.7}
            >
              <Text style={styles.footerLinkText}>Back to app</Text>
              <Ionicons name="arrow-forward" size={16} color="#007AFF" />
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
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    padding: 20,
  },
  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  heroIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  darkHeroIconContainer: {
    backgroundColor: '#1C1C1E',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  heroMeta: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    gap: 6,
  },
  trialBadge: {
    backgroundColor: '#F0FDF4',
  },
  graceBadge: {
    backgroundColor: '#FFF7ED',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  graceBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFA500',
  },
  // Info Cards
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
    shadowOpacity: 0.2,
  },
  successCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  infoCardText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Section Header
  sectionHeader: {
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  // Package Cards
  packageCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  popularCard: {
    borderColor: '#007AFF',
    borderWidth: 2,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  darkPopularCard: {
    borderColor: '#007AFF',
    backgroundColor: '#1c1c1e',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  packageHeader: {
    marginBottom: 12,
  },
  packageTitleContainer: {
    marginBottom: 4,
  },
  packageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  packagePrice: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  packageSavings: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
  packageDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonPopular: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  buttonLoading: {
    opacity: 0.6,
  },
  packageFooter: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Actions
  actionsSection: {
    marginTop: 8,
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: '#f1f1f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  darkSecondaryButton: {
    backgroundColor: '#2c2c2e',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  linkButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Footer
  footerCard: {
    marginTop: 32,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  footerCopy: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerLinkText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Legal
  legalCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  legalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  legalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  legalCopy: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  legalLinks: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  linkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#E8F0FE',
  },
  linkPillText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  // Empty State
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
    fontSize: 14,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  // Text Colors
  darkText: {
    color: '#fff',
  },
  darkSubtitle: {
    color: '#aaa',
  },
});

export default PaywallScreen;
