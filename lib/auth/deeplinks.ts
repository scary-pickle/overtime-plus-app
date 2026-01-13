import * as Linking from 'expo-linking';
import { supabase } from '../supabase';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('deeplinks');

function hasAuthParams(url: string): boolean {
  // In implicit flow, Supabase sends access_token (and optionally refresh_token)
  // in the URL fragment for magic links, email verification, and password reset.
  try {
    const params = parseUrlParams(url);
    return !!params.access_token;
  } catch {
    return false;
  }
}

/**
 * Parse URL and extract parameters from both query string and fragment
 * React Native doesn't handle fragments well, so we need to convert them to query params
 */
function parseUrlParams(url: string): { [key: string]: string } {
  try {
    const u = new URL(url);
    const params: { [key: string]: string } = {};
    
    // Get query params
    u.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    // Get fragment params (Supabase sends tokens in fragments)
    if (u.hash) {
      const frag = new URLSearchParams(u.hash.replace(/^#/, ''));
      frag.forEach((value, key) => {
        params[key] = value;
      });
    }
    
    return params;
  } catch (error) {
    debug.warn('Failed to parse URL:', error);
    return {};
  }
}

/**
 * Check if URL is a password reset flow
 */
function isPasswordReset(url: string): boolean {
  const params = parseUrlParams(url);
  return params.type === 'recovery' && !!params.access_token && !!params.refresh_token;
}

export function getRedirectUri(): string {
  // Use the app scheme from app.config.ts. Hardcode to avoid misconfigured env.
  // For password reset and other auth flows, Supabase will append tokens as URL fragments
  // (#access_token=...&refresh_token=...&type=recovery|signup|magiclink)
  return 'overtime-plus://auth-callback';
}

export async function exchangeSessionFromUrl(url: string): Promise<boolean> {
  try {
    if (!hasAuthParams(url)) return false;

    const params = parseUrlParams(url);
    const access_token = params.access_token;
    const refresh_token = params.refresh_token;

    if (!access_token) {
      debug.warn('exchangeSessionFromUrl called without access_token');
      return false;
    }

    debug.debug('Setting session from URL tokens', {
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
      type: params.type,
    });

    // @ts-ignore - supabase client has full auth API
    const { data, error } = await (supabase as any).auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      debug.warn('setSession from URL tokens failed', {
        message: error.message,
        status: (error as any)?.status,
        code: (error as any)?.code,
      });
      return false;
    }

    return !!data?.session;
  } catch (error) {
    debug.warn('exchangeSessionFromUrl failed', error);
    return false;
  }
}

/**
 * Handle password reset deep link by routing to reset-password screen
 * Returns true if handled, false otherwise
 */
export async function handlePasswordResetLink(url: string): Promise<boolean> {
  if (!isPasswordReset(url)) {
    return false;
  }

  try {
    const params = parseUrlParams(url);
    const { access_token, refresh_token, type } = params;

    if (!access_token || !refresh_token) {
      debug.warn('Password reset link missing required tokens');
      return false;
    }

    debug.debug('Password reset link detected, routing to reset-password screen');

    // Use router to navigate - expo-router provides a global router instance
    try {
      const { router } = await import('expo-router');
      const queryParams = new URLSearchParams({
        access_token,
        refresh_token,
        type: type || 'recovery',
      }).toString();
      router.replace(`/auth/reset-password?${queryParams}`);
      return true;
    } catch (routerError) {
      debug.error('Failed to navigate to reset-password:', routerError);
      return false;
    }
  } catch (error) {
    debug.error('Failed to handle password reset link:', error);
    return false;
  }
}

export function subscribeToAuthDeepLinks(): () => void {
  const handler = async ({ url }: { url: string }) => {
    if (!url) return;
    
    // Check if it's a password reset flow first
    const handled = await handlePasswordResetLink(url);
    if (handled) {
      return;
    }
    
    // Otherwise, handle as regular auth flow
    await exchangeSessionFromUrl(url);
  };

  const subscription = Linking.addEventListener('url', handler);

  // Also process the initial URL if the app was cold-started via the link
  (async () => {
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      // Check if it's a password reset flow first
      const handled = await handlePasswordResetLink(initialUrl);
      if (!handled) {
        await exchangeSessionFromUrl(initialUrl);
      }
    }
  })();

  return () => subscription.remove();
}


