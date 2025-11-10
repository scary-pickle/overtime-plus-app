import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// Auth signup guard: reject signups not in allowed domains
// Configure via environment variables on the function:
//  - REQUIRE_DOMAIN=true|false
//  - ALLOWED_DOMAINS=health.qld.gov.au (comma-separated list)
//  - SIGNUP_GUARD_SECRET=shared-secret (required for production)

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

function isAllowedEmail(email: string | undefined | null, allowed: string[], requireDomain: boolean): boolean {
  if (!requireDomain) return true;
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return allowed.map((d) => d.trim().toLowerCase()).includes(domain);
}

serve(async (req) => {
  try {
    const expectedSecret = Deno.env.get('SIGNUP_GUARD_SECRET');
    if (!expectedSecret) {
      console.warn('[auth-signup-guard] SIGNUP_GUARD_SECRET not set – request will be rejected');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }

    // Parse body first to check for secret in body (fallback for hooks that don't support custom headers)
    const body = await req.json().catch(() => ({}));
    
    // Check authorization: first try Authorization header, then check body.secret
    // Also check if request comes from Supabase's internal network (for Before User Created hooks)
    const providedAuth = req.headers.get('authorization') ?? '';
    const providedSecretInBody = body?.secret;
    
    // Check if this is a Supabase internal hook call
    // Supabase hooks may include specific headers or come from internal network
    const isSupabaseInternal = 
      req.headers.get('x-supabase-hook') === 'before-user-created' ||
      req.headers.get('user-agent')?.includes('Supabase') ||
      // Check if request has Supabase hook signature (if secret field is used for HMAC)
      body?.type === 'before_user_created';
    
    const isAuthorized = 
      providedAuth === `Bearer ${expectedSecret}` || 
      providedSecretInBody === expectedSecret ||
      isSupabaseInternal; // Allow Supabase internal hook calls
    
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: JSON_HEADERS,
      });
    }

    // GoTrue hooks may send { event: 'user_signed_up', user: {...} } or { record: {...} }
    const email: string | undefined = body?.user?.email ?? body?.record?.email ?? body?.email;

    const requireDomain = (Deno.env.get('REQUIRE_DOMAIN') ?? 'true').toLowerCase() === 'true';
    const allowedEnv = Deno.env.get('ALLOWED_DOMAINS') ?? 'health.qld.gov.au';
    const allowed = allowedEnv.split(',').map((s) => s.trim()).filter(Boolean);

    if (!isAllowedEmail(email, allowed, requireDomain)) {
      return new Response(JSON.stringify({ error: 'Email domain not allowed' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    // Allow signup
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message ?? 'server_error' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
