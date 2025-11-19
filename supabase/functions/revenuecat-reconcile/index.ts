import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Nightly reconciliation job to sync subscription status from RevenueCat
// This ensures subscription_status, trial_consumed, grace_period_until, etc. stay accurate
// even if webhooks are missed or client tampering occurs
// Configure via environment variables:
//  - REVENUECAT_SECRET_KEY=<secret-key> (required for RevenueCat API calls)
//  - SUPABASE_URL=<project-url> (auto-injected by Supabase)
//  - SUPABASE_SERVICE_ROLE_KEY=<service-role-key> (auto-injected by Supabase)
//  - RECONCILE_BATCH_SIZE=100 (optional, default 100)

const JSON_HEADERS = { 'content-type': 'application/json' } as const;
const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';

interface RevenueCatCustomerInfo {
  request_date: string;
  request_date_ms: number;
  subscriber: {
    first_seen: string;
    last_seen: string;
    management_url?: string;
    original_app_user_id: string;
    original_application_version?: string;
    other_purchases: Record<string, any>;
    subscriptions: Record<string, {
      billing_issues_detected_at?: string;
      expires_date?: string;
      grace_period_expires_date?: string;
      is_sandbox: boolean;
      original_purchase_date: string;
      period_type: string;
      purchase_date: string;
      store: string;
      unsubscribe_detected_at?: string;
    }>;
    entitlements: Record<string, {
      expires_date?: string;
      grace_period_expires_date?: string;
      product_identifier: string;
      purchase_date: string;
    }>;
  };
}

// Calculate grace period (7 days after subscription expires)
function calculateGracePeriod(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  const graceEnd = new Date(expiry);
  graceEnd.setDate(graceEnd.getDate() + 7);
  return graceEnd.toISOString();
}

// Calculate data retention (90 days after cancellation)
function calculateDataRetention(cancelledAt: string | null): string | null {
  if (!cancelledAt) return null;
  const cancelled = new Date(cancelledAt);
  const retentionEnd = new Date(cancelled);
  retentionEnd.setDate(retentionEnd.getDate() + 90);
  return retentionEnd.toISOString();
}

// Fetch customer info from RevenueCat
async function fetchRevenueCatCustomer(appUserId: string, secretKey: string): Promise<RevenueCatCustomerInfo | null> {
  try {
    const url = `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // User doesn't exist in RevenueCat yet (not an error)
        return null;
      }
      const text = await response.text();
      throw new Error(`RevenueCat API error: ${response.status} ${text}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[revenuecat-reconcile] Failed to fetch customer ${appUserId}:`, error);
    return null;
  }
}

// Determine subscription status from RevenueCat customer info
function determineStatus(customerInfo: RevenueCatCustomerInfo | null): {
  status: 'none' | 'trial' | 'active' | 'expired' | 'cancelled';
  expiresAt: string | null;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  trialConsumed: boolean;
  productId: string | null;
  cancelledAt: string | null;
} {
  if (!customerInfo?.subscriber) {
    return {
      status: 'none',
      expiresAt: null,
      trialStartedAt: null,
      trialExpiresAt: null,
      trialConsumed: false,
      productId: null,
      cancelledAt: null,
    };
  }

  const { subscriptions, entitlements } = customerInfo.subscriber;
  const now = new Date();

  // Check entitlements first (most reliable)
  const activeEntitlements = Object.entries(entitlements || {}).filter(([_, ent]) => {
    if (!ent.expires_date) return true; // Lifetime entitlement
    return new Date(ent.expires_date) > now;
  });

  if (activeEntitlements.length > 0) {
    const [entitlementId, entitlement] = activeEntitlements[0];
    const expiresAt = entitlement.expires_date ? new Date(entitlement.expires_date).toISOString() : null;
    const productId = entitlement.product_identifier;

    // Check if there's a subscription for this entitlement
    const subscription = subscriptions?.[entitlementId];
    const cancelledAt = subscription?.unsubscribe_detected_at
      ? new Date(subscription.unsubscribe_detected_at).toISOString()
      : null;

    // Determine if in trial (check if purchase_date is recent and period_type is trial)
    const purchaseDate = new Date(entitlement.purchase_date);
    const daysSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
    const isTrial = daysSincePurchase < 32 && subscription?.period_type === 'trial'; // ~1 month trial

    return {
      status: cancelledAt ? 'cancelled' : isTrial ? 'trial' : 'active',
      expiresAt,
      trialStartedAt: isTrial ? purchaseDate.toISOString() : null,
      trialExpiresAt: isTrial && expiresAt ? expiresAt : null,
      trialConsumed: isTrial || purchaseDate < now, // If they've ever purchased, trial is consumed
      productId,
      cancelledAt,
    };
  }

  // No active entitlements - check if expired recently
  const expiredEntitlements = Object.entries(entitlements || {}).filter(([_, ent]) => {
    if (!ent.expires_date) return false;
    const expired = new Date(ent.expires_date);
    return expired <= now && expired > new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // Within last 90 days
  });

  if (expiredEntitlements.length > 0) {
    const [_, entitlement] = expiredEntitlements[0];
    const subscription = subscriptions?.[expiredEntitlements[0][0]];
    const cancelledAt = subscription?.unsubscribe_detected_at
      ? new Date(subscription.unsubscribe_detected_at).toISOString()
      : null;

    return {
      status: cancelledAt ? 'cancelled' : 'expired',
      expiresAt: entitlement.expires_date ? new Date(entitlement.expires_date).toISOString() : null,
      trialStartedAt: null,
      trialExpiresAt: null,
      trialConsumed: true, // If they had a subscription, trial is consumed
      productId: entitlement.product_identifier,
      cancelledAt,
    };
  }

  // No entitlements found
  return {
    status: 'none',
    expiresAt: null,
    trialStartedAt: null,
    trialExpiresAt: null,
    trialConsumed: false,
    productId: null,
    cancelledAt: null,
  };
}

serve(async (req) => {
  try {
    const secret = Deno.env.get('REVENUECAT_SECRET_KEY');
    if (!secret) {
      console.error('[revenuecat-reconcile] REVENUECAT_SECRET_KEY not set');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }

    // Optional: Require authorization header for manual triggers
    const authHeader = req.headers.get('authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow unauthenticated requests from Supabase cron (they don't send auth)
      // But require auth for manual triggers
      const url = new URL(req.url);
      if (url.searchParams.get('manual') === 'true' && !authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: JSON_HEADERS,
        });
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const batchSize = parseInt(Deno.env.get('RECONCILE_BATCH_SIZE') || '100', 10);

    // Fetch users with active subscriptions or trials (not legacy-only users)
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('user_id, subscription_status, legacy_free_access')
      .or('subscription_status.neq.none,legacy_free_access.eq.false')
      .limit(batchSize);

    if (fetchError) {
      console.error('[revenuecat-reconcile] Failed to fetch profiles:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch profiles', details: fetchError.message }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ reconciled: 0, message: 'No profiles to reconcile' }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    let reconciled = 0;
    let errors = 0;

    // Reconcile each user
    for (const profile of profiles) {
      try {
        const customerInfo = await fetchRevenueCatCustomer(profile.user_id, secret);
        const rcStatus = determineStatus(customerInfo);

        // Build update payload
        const updates: Record<string, any> = {
          subscription_status: rcStatus.status,
          subscription_expires_at: rcStatus.expiresAt,
          trial_started_at: rcStatus.trialStartedAt,
          trial_expires_at: rcStatus.trialExpiresAt,
          trial_consumed: rcStatus.trialConsumed,
          subscription_product_id: rcStatus.productId,
          subscription_cancelled_at: rcStatus.cancelledAt,
        };

        // Set grace period if expired/cancelled
        if ((rcStatus.status === 'expired' || rcStatus.status === 'cancelled') && rcStatus.expiresAt) {
          updates.grace_period_until = calculateGracePeriod(rcStatus.expiresAt);
        } else {
          updates.grace_period_until = null;
        }

        // Set data retention if cancelled
        if (rcStatus.status === 'cancelled' && rcStatus.cancelledAt) {
          updates.data_retention_until = calculateDataRetention(rcStatus.cancelledAt);
        } else if (rcStatus.status === 'expired' && !updates.data_retention_until) {
          // If expired but not cancelled, set retention from now
          updates.data_retention_until = calculateDataRetention(new Date().toISOString());
        }

        // Update profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('user_id', profile.user_id);

        if (updateError) {
          console.error(`[revenuecat-reconcile] Failed to update ${profile.user_id}:`, updateError);
          errors++;
        } else {
          reconciled++;
        }
      } catch (error) {
        console.error(`[revenuecat-reconcile] Error reconciling ${profile.user_id}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        reconciled,
        errors,
        total: profiles.length,
        message: `Reconciled ${reconciled} of ${profiles.length} profiles`,
      }),
      {
        status: 200,
        headers: JSON_HEADERS,
      }
    );
  } catch (e) {
    console.error('[revenuecat-reconcile] Error:', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'server_error' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});

