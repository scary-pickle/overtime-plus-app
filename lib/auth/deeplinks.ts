import * as Linking from 'expo-linking';
import { supabase } from '../supabase';

function hasAuthParams(url: string): boolean {
  try {
    const u = new URL(url);
    const qp = u.searchParams;
    const hasCode = !!qp.get('code');
    const hasVerifier = !!qp.get('code_verifier');
    // Some providers return in fragment, try that as well
    if (!hasCode || !hasVerifier) {
      const frag = new URLSearchParams(u.hash.replace(/^#/, ''));
      return !!frag.get('code') && !!frag.get('code_verifier');
    }
    return hasCode && hasVerifier;
  } catch {
    return false;
  }
}

export function getRedirectUri(): string {
  // Uses app scheme from app.config.ts (scheme: 'overtime-plus')
  return Linking.createURL('/', { scheme: 'overtime-plus' });
}

export async function exchangeSessionFromUrl(url: string): Promise<boolean> {
  try {
    if (!hasAuthParams(url)) return false;
    // @ts-ignore - supabase client has full auth API
    const { data, error } = await (supabase as any).auth.exchangeCodeForSession(url);
    if (error) {
      console.warn('exchangeCodeForSession error', error.message);
      return false;
    }
    return !!data?.session;
  } catch (error) {
    console.warn('exchangeCodeForSession failed', error);
    return false;
  }
}

export function subscribeToAuthDeepLinks(): () => void {
  const handler = async ({ url }: { url: string }) => {
    if (!url) return;
    await exchangeSessionFromUrl(url);
  };

  const subscription = Linking.addEventListener('url', handler);

  // Also process the initial URL if the app was cold-started via the link
  (async () => {
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      await exchangeSessionFromUrl(initialUrl);
    }
  })();

  return () => subscription.remove();
}


