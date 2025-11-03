import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// Auth signup guard: reject signups not in allowed domains
// Configure via environment variables on the function:
//  - REQUIRE_DOMAIN=true|false
//  - ALLOWED_DOMAINS=health.qld.gov.au (comma-separated list)

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
    const body = await req.json().catch(() => ({}));
    // GoTrue hooks may send { event: 'user_signed_up', user: {...} } or { record: {...} }
    const email: string | undefined = body?.user?.email ?? body?.record?.email ?? body?.email;

    const requireDomain = (Deno.env.get('REQUIRE_DOMAIN') ?? 'true').toLowerCase() === 'true';
    const allowedEnv = Deno.env.get('ALLOWED_DOMAINS') ?? 'health.qld.gov.au';
    const allowed = allowedEnv.split(',').map((s) => s.trim()).filter(Boolean);

    if (!isAllowedEmail(email, allowed, requireDomain)) {
      return new Response(JSON.stringify({ error: 'Email domain not allowed' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Allow signup
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message ?? 'server_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
