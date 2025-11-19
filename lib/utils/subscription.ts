import dayjs from 'dayjs';
import { SubscriptionSnapshot } from '../../types';

export type SubscriptionAccessReason =
  | 'paywall-disabled'
  | 'legacy-free'
  | 'active'
  | 'trial'
  | 'grace'
  | 'customer-entitled'
  | 'none';

export type SubscriptionAccessResult = {
  hasAccess: boolean;
  shouldShowPaywall: boolean;
  reason: SubscriptionAccessReason;
  daysRemaining?: number | null;
};

export const DEFAULT_SUBSCRIPTION_PRODUCTS = [
  'overtime_plus_monthly',
  'overtime_plus_yearly',
];

const asDay = (input?: string | null, now = dayjs()): dayjs.Dayjs | null => {
  if (!input) {
    return null;
  }
  const parsed = dayjs(input);
  if (!parsed.isValid()) {
    return null;
  }
  return parsed.isBefore(now) ? null : parsed;
};

export const getDaysRemaining = (input?: string | null, now = new Date()): number | null => {
  const dayValue = asDay(input, dayjs(now));
  if (!dayValue) {
    return null;
  }
  const diff = dayValue.diff(now, 'day');
  return diff >= 0 ? diff : 0;
};

export const isTrialActive = (snapshot?: SubscriptionSnapshot | null, now = new Date()): boolean => {
  if (!snapshot?.trialExpiresAt) {
    return false;
  }
  const target = asDay(snapshot.trialExpiresAt, dayjs(now));
  return !!target;
};

export const isGracePeriodActive = (snapshot?: SubscriptionSnapshot | null, now = new Date()): boolean => {
  if (!snapshot?.gracePeriodUntil) {
    return false;
  }
  return !!asDay(snapshot.gracePeriodUntil, dayjs(now));
};

export const hasActiveSubscription = (
  snapshot?: SubscriptionSnapshot | null,
  now = new Date()
): boolean => {
  if (!snapshot) {
    return false;
  }

  const expiresAt = snapshot.subscriptionExpiresAt || snapshot.trialExpiresAt;
  if (!expiresAt) {
    return snapshot.status === 'active';
  }

  const expiry = asDay(expiresAt, dayjs(now));
  if (!expiry) {
    return snapshot.status === 'active' && !snapshot.subscriptionExpiresAt;
  }

  if (snapshot.status === 'active' || snapshot.status === 'trial') {
    return true;
  }

  if (snapshot.status === 'cancelled') {
    return true;
  }

  return false;
};

export const computeTrialEligibility = (
  snapshot?: SubscriptionSnapshot | null,
  revenueCatEligible?: boolean | null
): boolean => {
  if (!snapshot) {
    return Boolean(revenueCatEligible ?? true);
  }
  if (snapshot.trialConsumed) {
    return false;
  }
  if (typeof revenueCatEligible === 'boolean') {
    return revenueCatEligible;
  }
  return true;
};

export const evaluateSubscriptionAccess = (
  snapshot: SubscriptionSnapshot | null,
  options: {
    paywallEnabled: boolean;
    hasRevenueCatEntitlement?: boolean;
    legacyOverride?: boolean;
    now?: Date;
  }
): SubscriptionAccessResult => {
  const now = options.now ?? new Date();
  if (!options.paywallEnabled) {
    return {
      hasAccess: true,
      shouldShowPaywall: false,
      reason: 'paywall-disabled',
    };
  }

  if (snapshot?.legacyFreeAccess && !options.legacyOverride) {
    return {
      hasAccess: true,
      shouldShowPaywall: false,
      reason: 'legacy-free',
    };
  }

  if (options.hasRevenueCatEntitlement) {
    return {
      hasAccess: true,
      shouldShowPaywall: false,
      reason: 'customer-entitled',
    };
  }

  if (hasActiveSubscription(snapshot, now)) {
    return {
      hasAccess: true,
      shouldShowPaywall: false,
      reason: 'active',
      daysRemaining: getDaysRemaining(snapshot?.subscriptionExpiresAt || undefined, now),
    };
  }

  if (isTrialActive(snapshot, now)) {
    return {
      hasAccess: true,
      shouldShowPaywall: false,
      reason: 'trial',
      daysRemaining: getDaysRemaining(snapshot?.trialExpiresAt || undefined, now),
    };
  }

  if (isGracePeriodActive(snapshot, now)) {
    return {
      hasAccess: true,
      shouldShowPaywall: false,
      reason: 'grace',
      daysRemaining: getDaysRemaining(snapshot?.gracePeriodUntil || undefined, now),
    };
  }

  return {
    hasAccess: false,
    shouldShowPaywall: true,
    reason: 'none',
  };
};

export const MANAGE_SUBSCRIPTION_URLS = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
};

export const getManageSubscriptionUrl = (platform: 'ios' | 'android'): string => {
  if (platform === 'ios') {
    return MANAGE_SUBSCRIPTION_URLS.ios;
  }
  return MANAGE_SUBSCRIPTION_URLS.android;
};
