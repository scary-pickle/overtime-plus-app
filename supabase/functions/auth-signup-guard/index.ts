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
    const allowDevMode = Deno.env.get('ALLOW_DEV_MODE') === 'true';
    
    // Minimal request metadata logging (avoid logging secrets/PII)
    console.log('[auth-signup-guard] Request received', {
      method: req.method,
      url: req.url,
      headerKeys: Array.from(req.headers.keys()),
      hasWebhookSignature: !!req.headers.get('webhook-signature'),
    });
    
    // Get raw body string first (needed for signature verification)
    const rawBody = await req.text();
    let body: any = {};
    
    // Parse request body - handle both JSON and form data
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = JSON.parse(rawBody);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries());
      } else {
        // Try JSON first, fallback to empty object
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = {};
        }
      }
      console.log('[auth-signup-guard] Request body parsed', {
        bodyKeys: Object.keys(body),
        hasUser: !!body?.user,
        hasRecord: !!body?.record,
        hasEmail: !!(body?.user?.email || body?.record?.email || body?.email),
      });
    } catch (e) {
      console.warn('[auth-signup-guard] Failed to parse request body:', e);
      body = {};
    }

    // Supabase Auth Hooks use Standard Webhooks format with webhook-signature header
    // The secret is stored in v1,whsec_<base64> format, but Supabase sends a signature
    // We need to verify the signature using the secret
    
    // Get the webhook signature from headers
    const webhookSignature = req.headers.get('webhook-signature') ?? '';
    const webhookTimestamp = req.headers.get('webhook-timestamp') ?? '';
    const webhookId = req.headers.get('webhook-id') ?? '';
    
    // Also check for secret in Authorization header (fallback)
    const authHeader = req.headers.get('authorization') ?? '';
    let headerSecret = authHeader.replace(/^Bearer\s+/i, '').trim();
    
    // Handle Standard Webhooks format in Authorization header: "v1,whsec_<base64_encoded_secret>"
    if (headerSecret.startsWith('v1,whsec_')) {
      try {
        const base64Part = headerSecret.replace(/^v1,whsec_/, '');
        headerSecret = atob(base64Part);
      } catch (e) {
        console.warn('[auth-signup-guard] Failed to decode Standard Webhooks format secret:', e);
      }
    }
    
    // Check body for secret (fallback)
    const bodySecret = typeof body?.secret === 'string' ? String(body.secret) : '';
    let secretFromBody = bodySecret || 
                         body?.SIGNUP_GUARD_SECRET || 
                         body?.auth_secret ||
                         body?.webhook_secret ||
                         '';
    
    if (secretFromBody.startsWith('v1,whsec_')) {
      try {
        const base64Part = secretFromBody.replace(/^v1,whsec_/, '');
        secretFromBody = atob(base64Part);
      } catch (e) {
        // Keep original if decoding fails
      }
    }
    
    // Verify Standard Webhooks signature if present
    let hasValidSignature = false;
    if (webhookSignature && expectedSecret) {
      try {
        // Standard Webhooks signature format: "v1,<base64_signature>"
        // Signature is computed as: HMAC-SHA256(timestamp + "." + rawBody, secret)
        // Some implementations use: HMAC-SHA256(webhookId + "." + timestamp + "." + rawBody, secret)
        // The secret in env var is the raw secret (not v1,whsec_ format)
        if (webhookSignature.startsWith('v1,')) {
          const signature = webhookSignature.replace(/^v1,/, '');
          
          // Try both payload formats:
          // 1. Standard format: timestamp.body
          // 2. Alternative format: webhookId.timestamp.body
          const signedPayload1 = `${webhookTimestamp}.${rawBody}`;
          const signedPayload2 = `${webhookId}.${webhookTimestamp}.${rawBody}`;
          
          // Get the secret - Standard Webhooks uses the base64-decoded bytes from v1,whsec_ format
          // The hook secret is: v1,whsec_<base64_encoded_secret>
          // According to Standard Webhooks spec, the base64 part decodes to raw bytes that are used directly as the HMAC key
          // The env var should contain the same secret that's base64-encoded in the hook config
          let secretToUse: Uint8Array;
          
          if (expectedSecret.startsWith('v1,whsec_')) {
            // Secret is in v1,whsec_ format - decode the base64 part to get raw bytes
            // Standard Webhooks: the base64 part is the base64-encoding of the secret bytes
            // When decoded, we get the raw bytes directly (not a hex string)
            try {
              const base64Part = expectedSecret.replace(/^v1,whsec_/, '');
              // Decode base64 to get raw bytes
              // atob() returns a string, but we need to convert it to Uint8Array
              const decodedString = atob(base64Part);
              // Convert the decoded string to bytes
              // The decoded string contains the raw bytes, so we need to get the byte values
              secretToUse = new Uint8Array(decodedString.length);
              for (let i = 0; i < decodedString.length; i++) {
                secretToUse[i] = decodedString.charCodeAt(i);
              }
            } catch (e) {
              console.error('[auth-signup-guard] Failed to decode secret from v1,whsec_ format:', e);
              throw e;
            }
          } else {
            // Secret is raw - could be hex string or plain string
            // Try to parse as hex first
            if (/^[0-9a-fA-F]+$/.test(expectedSecret) && expectedSecret.length % 2 === 0) {
              // It's a hex string - convert to bytes
              secretToUse = new Uint8Array(expectedSecret.length / 2);
              for (let i = 0; i < expectedSecret.length; i += 2) {
                secretToUse[i / 2] = parseInt(expectedSecret.substring(i, i + 2), 16);
              }
            } else {
              // Not hex - use UTF-8 encoding
              secretToUse = new TextEncoder().encode(expectedSecret);
            }
          }
          
          // Try multiple secret formats and payload formats
          // Some implementations use the full secret string (including v1,whsec_ prefix) as the HMAC key
          const secretVariants: { name: string; bytes: Uint8Array }[] = [
            { name: 'decoded_base64_bytes', bytes: secretToUse }
          ];
          
          // If secret is in v1,whsec_ format, also try using the full string as UTF-8
          if (expectedSecret.startsWith('v1,whsec_')) {
            secretVariants.push({
              name: 'full_string_utf8',
              bytes: new TextEncoder().encode(expectedSecret)
            });
            // Also try just the base64 part as UTF-8 (without decoding)
            const base64Part = expectedSecret.replace(/^v1,whsec_/, '');
            secretVariants.push({
              name: 'base64_part_utf8',
              bytes: new TextEncoder().encode(base64Part)
            });
          }
          
          // Try format 1: timestamp.body
          // Try format 2: webhookId.timestamp.body
          const payloadFormats = [
            { name: 'timestamp.body', payload: signedPayload1 },
            { name: 'webhookId.timestamp.body', payload: signedPayload2 }
          ];
          
          let computedSignatures: { secretVariant: string; payloadFormat: string; signature: string }[] = [];
          
          for (const secretVariant of secretVariants) {
            const key = await crypto.subtle.importKey(
              'raw',
              secretVariant.bytes,
              { name: 'HMAC', hash: 'SHA-256' },
              false,
              ['sign']
            );
            
            for (const payloadFormat of payloadFormats) {
              const computedSignature = await crypto.subtle.sign(
                'HMAC',
                key,
                new TextEncoder().encode(payloadFormat.payload)
              );
              const computedSignatureBase64 = btoa(String.fromCharCode(...new Uint8Array(computedSignature)));
              
              computedSignatures.push({
                secretVariant: secretVariant.name,
                payloadFormat: payloadFormat.name,
                signature: computedSignatureBase64
              });
            }
          }
          
          // Compare signatures using timing-safe comparison
          const toBytes = (value: string) => new TextEncoder().encode(value);
          const timingSafeEqual = (a: string, b: string) => {
            const aBytes = toBytes(a);
            const bBytes = toBytes(b);
            if (aBytes.length !== bBytes.length || aBytes.length === 0) {
              return false;
            }
            let diff = 0;
            for (let i = 0; i < aBytes.length; i++) {
              diff |= aBytes[i] ^ bBytes[i];
            }
            return diff === 0;
          };
          
          // Try all combinations
          let matchedCombo: { secretVariant: string; payloadFormat: string } | null = null;
          for (const computed of computedSignatures) {
            if (timingSafeEqual(signature, computed.signature)) {
              hasValidSignature = true;
              matchedCombo = { secretVariant: computed.secretVariant, payloadFormat: computed.payloadFormat };
              break;
            }
          }
          
          const computedSignatureBase64 = computedSignatures[0]?.signature || '';
          const computedSignatureBase64_2 = computedSignatures[1]?.signature || '';
          
          if (hasValidSignature) {
            console.log('[auth-signup-guard] Webhook signature verified successfully', {
              matchedSecretVariant: matchedCombo?.secretVariant,
              matchedPayloadFormat: matchedCombo?.payloadFormat
            });
          } else {
            console.warn('[auth-signup-guard] Webhook signature verification failed', {
              timestampPresent: !!webhookTimestamp,
              webhookIdPresent: !!webhookId,
              payloadBytes: rawBody.length,
              combinationsTried: computedSignatures.length,
            });
            
            // The signatures don't match - this could mean:
            // 1. The secret in env var doesn't match the hook secret
            //    SOLUTION: Ensure both the Auth Hook secret and SIGNUP_GUARD_SECRET env var
            //    are set to the exact same value (check your Supabase dashboard for the hook secret)
            // 2. The signature algorithm is different
            // 3. The payload format is different
            // For now, we'll reject the request for security
          }
        }
      } catch (e) {
        console.error('[auth-signup-guard] Error verifying webhook signature:', e);
      }
    }

    // In development mode, allow requests without secret if explicitly enabled
    if (allowDevMode && !expectedSecret) {
      console.warn('[auth-signup-guard] DEV MODE: Allowing request without secret check');
      // Continue to domain validation below
    } else if (!expectedSecret) {
      console.warn('[auth-signup-guard] SIGNUP_GUARD_SECRET not set – request will be rejected');
      return new Response(JSON.stringify({ 
        error: 'Server misconfigured',
        message: 'SIGNUP_GUARD_SECRET environment variable is not set. Please configure it in Supabase Dashboard → Edge Functions → Settings.'
      }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }

    // Helper function for timing-safe comparison
    const toBytes = (value: string) => new TextEncoder().encode(value);
    const timingSafeEqual = (a: string, b: string) => {
      const aBytes = toBytes(a);
      const bBytes = toBytes(b);
      if (aBytes.length !== bBytes.length || aBytes.length === 0) {
        return false;
      }
      let diff = 0;
      for (let i = 0; i < aBytes.length; i++) {
        diff |= aBytes[i] ^ bBytes[i];
      }
      return diff === 0;
    };

    // Validate authentication: either signature verification OR secret match
    let hasValidAuth = false;
    
    if (expectedSecret) {
      // If we have a webhook signature, try to verify it first
      if (webhookSignature) {
        hasValidAuth = hasValidSignature;
        
        // If signature verification failed, try fallback methods (for development/debugging)
        if (!hasValidAuth && allowDevMode) {
          console.warn('[auth-signup-guard] Signature verification failed, trying fallback methods (dev mode)');
          
          // Get the actual secret value (decode if in v1,whsec_ format)
          let secretToCompare = expectedSecret;
          if (expectedSecret.startsWith('v1,whsec_')) {
            try {
              const base64Part = expectedSecret.replace(/^v1,whsec_/, '');
              secretToCompare = atob(base64Part);
            } catch (e) {
              // Keep original if decoding fails
            }
          }
          
          // Try header or body secret as fallback
          hasValidAuth =
            (headerSecret && timingSafeEqual(headerSecret, secretToCompare)) ||
            (secretFromBody && timingSafeEqual(secretFromBody, secretToCompare));
        }
      } else {
        // No webhook signature - check for secret in header or body
        // Get the actual secret value (decode if in v1,whsec_ format)
        let secretToCompare = expectedSecret;
        if (expectedSecret.startsWith('v1,whsec_')) {
          try {
            const base64Part = expectedSecret.replace(/^v1,whsec_/, '');
            secretToCompare = atob(base64Part);
          } catch (e) {
            // Keep original if decoding fails
          }
        }
        
        hasValidAuth =
          (headerSecret && timingSafeEqual(headerSecret, secretToCompare)) ||
          (secretFromBody && timingSafeEqual(secretFromBody, secretToCompare));
      }
      
      // Log for debugging (without exposing the secret)
      if (!hasValidAuth) {
        const debugInfo = {
          hasWebhookSignature: !!webhookSignature,
          hasValidSignature: hasValidSignature,
          hasHeaderSecret: !!headerSecret,
          hasBodySecret: !!secretFromBody,
          bodyKeys: Object.keys(body || {}),
          contentType: req.headers.get('content-type'),
          webhookId: webhookId || 'none',
          webhookTimestamp: webhookTimestamp || 'none',
          allowDevMode: allowDevMode,
        };
        console.error('[auth-signup-guard] Authentication validation failed', debugInfo);
        return new Response(JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Hook requires valid authentication. Verify the webhook signature or provide the secret in the Authorization header or request body.',
        }), {
        status: 401,
        headers: JSON_HEADERS,
      });
      }
    } else {
      // No secret configured - allow if in dev mode
      if (!allowDevMode) {
        console.error('[auth-signup-guard] No secret configured and not in dev mode');
        return new Response(JSON.stringify({ 
          error: 'Server misconfigured',
          message: 'SIGNUP_GUARD_SECRET environment variable is not set.'
        }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }
      hasValidAuth = true; // Dev mode allows all
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
