import { create } from 'zustand';
import type { CustomerInfo, PurchasesOfferings } from 'react-native-purchases';
import { SubscriptionSnapshot, RemoteFeatureFlag } from '../../types';
import { revenuecatClient } from '../subscription/revenuecat';
import { fetchRemoteFeatureFlags, subscriptionApi, supabaseEnabled } from '../supabase';
import { createScopedLogger } from '../utils/logger';
import {
  DEFAULT_SUBSCRIPTION_PRODUCTS,
  evaluateSubscriptionAccess,
  getDaysRemaining,
  computeTrialEligibility,
} from '../utils/subscription';

type RemoteFlagMap = Record<string, RemoteFeatureFlag>;

type SubscriptionAccessState = ReturnType<typeof evaluateSubscriptionAccess>;

interface SubscriptionState {
  initialized: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  userId: string | null;
  snapshot: SubscriptionSnapshot | null;
  remoteFlags: RemoteFlagMap;
  offerings: PurchasesOfferings | null;
  customerInfo: CustomerInfo | null;
  trialEligibility: Record<string, boolean>;
  access: SubscriptionAccessState;
  paywallEnabled: boolean;

  init: (userId?: string | null) => Promise<void>;
  refresh: (userId?: string | null) => Promise<void>;
  refreshFromSupabase: (userId?: string | null) => Promise<void>;
  refreshRevenueCat: (userId?: string | null) => Promise<void>;
  refreshTrialEligibility: (productIds?: string[]) => Promise<void>;
  purchasePackage: (identifier: string) => Promise<CustomerInfo | null>;
  restorePurchases: () => Promise<CustomerInfo | null>;
  markPaywallAcknowledged: () => Promise<void>;
  reset: () => void;

  hasActiveAccess: () => boolean;
  shouldShowPaywall: () => boolean;
  isTrialEligible: () => boolean;
  trialDaysRemaining: () => number | null;
  graceDaysRemaining: () => number | null;
}

const logger = createScopedLogger('subscriptionStore');

const initialState: Omit<
  SubscriptionState,
  | 'init'
  | 'refresh'
  | 'refreshFromSupabase'
  | 'refreshRevenueCat'
  | 'refreshTrialEligibility'
  | 'purchasePackage'
  | 'restorePurchases'
  | 'markPaywallAcknowledged'
  | 'reset'
  | 'hasActiveAccess'
  | 'shouldShowPaywall'
  | 'isTrialEligible'
  | 'trialDaysRemaining'
  | 'graceDaysRemaining'
> = {
  initialized: false,
  loading: false,
  refreshing: false,
  error: null,
  userId: null,
  snapshot: null,
  remoteFlags: {},
  offerings: null,
  customerInfo: null,
  trialEligibility: {},
  paywallEnabled: false,
  access: {
    hasAccess: true,
    shouldShowPaywall: false,
    reason: 'paywall-disabled',
  },
};

const derivePaywallEnabled = (flags: RemoteFlagMap): boolean => {
  const paywallFlag = flags['enable_paywall'];
  if (!paywallFlag?.value) {
    return false;
  }
  if (typeof paywallFlag.value.enabled === 'boolean') {
    return paywallFlag.value.enabled;
  }
  return false;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => {
  const applyState = (partial: Partial<SubscriptionState>) => {
    set((current) => {
      const next = { ...current, ...partial };
      const paywallEnabled = derivePaywallEnabled(next.remoteFlags);

      const revenueCatEntitlements = next.customerInfo?.entitlements?.active || {};
      const hasEntitlement = Object.keys(revenueCatEntitlements).length > 0;
      const access = evaluateSubscriptionAccess(next.snapshot, {
        paywallEnabled,
        hasRevenueCatEntitlement: hasEntitlement,
      });

      return {
        ...next,
        paywallEnabled,
        access,
      };
    });
  };

  return {
    ...initialState,

    init: async (userId?: string | null) => {
      const id = userId ?? get().userId;
      applyState({ userId: id ?? null, loading: true, error: null });
      try {
        await revenuecatClient.configure(id ?? null);
        await get().refresh(id ?? null);
        applyState({ initialized: true, loading: false });
      } catch (error) {
        logger.error('Failed to initialize subscription store', error);
        applyState({
          error: error instanceof Error ? error.message : 'Failed to initialize subscription',
          loading: false,
        });
      }
    },

    refresh: async (userId?: string | null) => {
      const id = userId ?? get().userId;
      if (!id && !supabaseEnabled) {
        // Unauthenticated/offline scenario - keep defaults
        applyState({ refreshing: false });
        return;
      }

      // Prevent concurrent refreshes - if already refreshing, skip
      const current = get();
      if (current.refreshing) {
        logger.debug('Already refreshing subscription, skipping duplicate call');
        return;
      }

      applyState({ refreshing: true });
      try {
        await Promise.allSettled([
          get().refreshFromSupabase(id),
          get().refreshRevenueCat(id),
        ]);
      } finally {
        applyState({ refreshing: false, initialized: true });
      }
    },

    refreshFromSupabase: async (userId?: string | null) => {
      if (!supabaseEnabled || !userId) {
        if (!supabaseEnabled) {
          logger.debug('Supabase disabled; skipping subscription snapshot fetch');
        }
        return;
      }

      try {
        const [snapshot, flags] = await Promise.all([
          subscriptionApi.fetchSnapshot(userId),
          fetchRemoteFeatureFlags(),
        ]);
        applyState({
          snapshot: snapshot ?? null,
          remoteFlags: flags,
          userId,
          error: null,
        });
      } catch (error) {
        logger.error('Failed to refresh subscription snapshot', error);
        applyState({
          error: error instanceof Error ? error.message : 'Failed to refresh subscription status',
        });
      }
    },

    refreshRevenueCat: async (userId?: string | null) => {
      try {
        const [customerInfo, offerings] = await Promise.all([
          revenuecatClient.getCustomerInfo(userId ?? get().userId),
          revenuecatClient.getOfferings(userId ?? get().userId),
        ]);
        applyState({
          customerInfo: customerInfo ?? null,
          offerings: offerings ?? null,
        });
      } catch (error) {
        logger.error('Failed to refresh RevenueCat info', error);
      }
    },

    refreshTrialEligibility: async (productIds?: string[]) => {
      const ids = productIds && productIds.length > 0 ? productIds : DEFAULT_SUBSCRIPTION_PRODUCTS;
      if (!ids.length) {
        return;
      }
      try {
        const eligibility = await revenuecatClient.checkTrialEligibility(ids, get().userId);
        applyState({
          trialEligibility: {
            ...get().trialEligibility,
            ...eligibility,
          },
        });
      } catch (error) {
        logger.error('Failed to refresh trial eligibility', error);
      }
    },

    purchasePackage: async (identifier: string) => {
      const userId = get().userId;
      try {
        const customerInfo = await revenuecatClient.purchasePackage(identifier, userId);
        await get().refreshRevenueCat(userId);
        return customerInfo;
      } catch (error) {
        logger.error('Purchase failed', error);
        throw error;
      }
    },

    restorePurchases: async () => {
      const userId = get().userId;
      try {
        const customerInfo = await revenuecatClient.restorePurchases(userId);
        await get().refreshRevenueCat(userId);
        return customerInfo;
      } catch (error) {
        logger.error('Restore purchases failed', error);
        throw error;
      }
    },

    markPaywallAcknowledged: async () => {
      const userId = get().userId;
      if (!userId) return;
      const success = await subscriptionApi.markPaywallAcknowledged(userId);
      if (success) {
        applyState({
          snapshot: {
            ...(get().snapshot || {
              status: 'none',
              subscriptionExpiresAt: null,
              trialStartedAt: null,
              trialExpiresAt: null,
              trialConsumed: true,
              subscriptionProductId: null,
              subscriptionCancelledAt: null,
              gracePeriodUntil: null,
              dataRetentionUntil: null,
              accountDeletedAt: null,
              legacyFreeAccess: false,
              paywallAcknowledgedAt: null,
            }),
            paywallAcknowledgedAt: new Date().toISOString(),
          },
        });
      }
    },

    reset: () => {
      set({
        ...initialState,
      });
    },

    hasActiveAccess: () => !get().access.shouldShowPaywall,

    shouldShowPaywall: () => get().access.shouldShowPaywall,

    isTrialEligible: () => {
      const snapshot = get().snapshot;
      const rcEligibility = Object.values(get().trialEligibility).some(Boolean);
      return computeTrialEligibility(snapshot, rcEligibility);
    },

    trialDaysRemaining: () => getDaysRemaining(get().snapshot?.trialExpiresAt || undefined),
    graceDaysRemaining: () => getDaysRemaining(get().snapshot?.gracePeriodUntil || undefined),
  };
});
