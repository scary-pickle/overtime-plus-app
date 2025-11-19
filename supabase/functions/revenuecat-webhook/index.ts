import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// RevenueCat webhook handler for Events API v2
// Handles subscription lifecycle events and updates Supabase profiles table
// Configure via environment variables:
//  - REVENUECAT_SECRET_KEY=<secret-key> (required for webhook signature verification)
//  - SUPABASE_URL=<project-url> (auto-injected by Supabase)
//  - SUPABASE_SERVICE_ROLE_KEY=<service-role-key> (auto-injected by Supabase)

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

interface RevenueCatEvent {
  id: string;
  event: {
    id: string;
    type: string;
    app_user_id: string;
    product_id?: string;
    period_type?: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    environment: string;
    entitlement_ids?: string[];
    presented_offering_id?: string;
    transaction_id?: string;
    original_transaction_id?: string;
    is_family_share?: boolean;
    country_code?: string;
    currency?: string;
    price?: number;
    price_in_purchased_currency?: number;
    subscriber_attributes?: Record<string, any>;
    store?: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
  };
  api_version: string;
}

// Verify webhook signature (RevenueCat sends Authorization header with secret)
function verifyWebhookSignature(req: Request, secret: string): boolean {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return false;
  }
  // RevenueCat sends: Authorization: Bearer <secret>
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token === secret;
}

// Map RevenueCat event type to subscription status
// Note: Trials are detected from INITIAL_PURCHASE events with period_type='trial' or price=0
function mapEventToStatus(eventType: string, periodType?: string, price?: number): 'trial' | 'active' | 'expired' | 'cancelled' | null {
  switch (eventType) {
    case 'INITIAL_PURCHASE':
      // Check if this is a trial (period_type='trial' or price is 0/free)
      if (periodType === 'trial' || price === 0 || price === null) {
        return 'trial';
      }
      return 'active';
    case 'RENEWAL':
    case 'BILLING_ISSUE':
      return 'active';
    case 'CANCELLATION':
      return 'cancelled';
    case 'EXPIRATION':
      return 'expired';
    default:
      return null;
  }
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

serve(async (req) => {
  try {
    const secret = Deno.env.get('REVENUECAT_SECRET_KEY');
    if (!secret) {
      console.error('[revenuecat-webhook] REVENUECAT_SECRET_KEY not set');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(req, secret)) {
      console.warn('[revenuecat-webhook] Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: JSON_HEADERS,
      });
    }

    const event: RevenueCatEvent = await req.json();
    const { event: eventData } = event;

    if (!eventData?.app_user_id) {
      return new Response(JSON.stringify({ error: 'Missing app_user_id' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find user by RevenueCat app_user_id (should match Supabase user.id)
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', eventData.app_user_id)
      .single();

    if (fetchError || !profile) {
      console.warn(`[revenuecat-webhook] Profile not found for app_user_id: ${eventData.app_user_id}`);
      // Still return 200 to prevent RevenueCat retries for invalid users
      return new Response(JSON.stringify({ received: true, user_not_found: true }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    const userId = profile.user_id;
    const eventType = eventData.type;
    const periodType = eventData.period_type;
    const price = eventData.price;
    const status = mapEventToStatus(eventType, periodType, price);

    // Build update payload
    const updates: Record<string, any> = {};

    // Handle subscription status
    if (status) {
      updates.subscription_status = status;
    }

    // Handle INITIAL_PURCHASE (may be trial or paid)
    if (eventType === 'INITIAL_PURCHASE') {
      const isTrial = periodType === 'trial' || price === 0 || price === null;
      
      if (isTrial) {
        // This is a trial purchase
        updates.trial_consumed = true;
        if (eventData.purchased_at_ms) {
          updates.trial_started_at = new Date(eventData.purchased_at_ms).toISOString();
        }
        if (eventData.expiration_at_ms) {
          updates.trial_expires_at = new Date(eventData.expiration_at_ms).toISOString();
        }
      } else {
        // This is a paid purchase (no trial)
        if (eventData.product_id) {
          updates.subscription_product_id = eventData.product_id;
        }
        if (eventData.expiration_at_ms) {
          updates.subscription_expires_at = new Date(eventData.expiration_at_ms).toISOString();
        }
      }
      // Clear cancellation if resubscribing
      updates.subscription_cancelled_at = null;
      updates.grace_period_until = null;
    }

    // Handle renewal (trial has ended, now paid)
    if (eventType === 'RENEWAL') {
      // Trial has ended, subscription is now active/paid
      updates.trial_consumed = true; // Ensure trial is marked as consumed
      if (eventData.product_id) {
        updates.subscription_product_id = eventData.product_id;
      }
      if (eventData.expiration_at_ms) {
        updates.subscription_expires_at = new Date(eventData.expiration_at_ms).toISOString();
      }
      // Clear trial dates since we're now in paid period
      updates.trial_started_at = null;
      updates.trial_expires_at = null;
      // Clear cancellation if resubscribing
      updates.subscription_cancelled_at = null;
      updates.grace_period_until = null;
    }

    // Handle cancellation
    if (eventType === 'CANCELLATION') {
      updates.subscription_cancelled_at = new Date().toISOString();
      // Grace period starts after subscription expires (not immediately)
      // We'll set this when expiration happens
    }

    // Handle expiration
    if (eventType === 'EXPIRATION') {
      const expiresAt = eventData.expiration_at_ms
        ? new Date(eventData.expiration_at_ms).toISOString()
        : new Date().toISOString();
      updates.subscription_expires_at = expiresAt;
      // Set grace period (7 days after expiration)
      updates.grace_period_until = calculateGracePeriod(expiresAt);
      // Set data retention (90 days after cancellation, or from now if not cancelled)
      const cancelledAt = updates.subscription_cancelled_at || new Date().toISOString();
      updates.data_retention_until = calculateDataRetention(cancelledAt);
    }

    // Handle billing issues (keep subscription active but flag for monitoring)
    if (eventType === 'BILLING_ISSUE') {
      // Keep status as 'active' but could add a billing_issue flag if needed
      console.warn(`[revenuecat-webhook] Billing issue for user ${userId}`);
    }

    // Update profile
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (updateError) {
        console.error(`[revenuecat-webhook] Failed to update profile for ${userId}:`, updateError);
        return new Response(JSON.stringify({ error: 'Update failed', details: updateError.message }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }

      console.log(`[revenuecat-webhook] Updated profile for ${userId}:`, updates);
    }

    // Store raw webhook payload for auditing (optional - create webhook_logs table if needed)
    // This helps with debugging and replaying events

    return new Response(JSON.stringify({ received: true, updated: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (e) {
    console.error('[revenuecat-webhook] Error processing webhook:', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'server_error' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});

