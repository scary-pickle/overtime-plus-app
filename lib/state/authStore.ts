import { create } from 'zustand';
import { supabase, supabaseEnabled } from '../supabase';
import { isAllowedDomain, isValidEmail, validatePasswordStrength } from '../auth/validation';
import { toFriendlyAuthMessage } from '../auth/errors';
import { useOnboardingStore } from './onboardingStore';
import { useSubscriptionStore } from './subscriptionStore';
import { revenuecatClient } from '../subscription/revenuecat';
import { database } from '../db/sqlite';
import { profileStorage } from '../storage/profile';
import * as SecureStore from 'expo-secure-store';
import { createScopedLogger, maskEmail, maskUserId } from '../utils/logger';
import { clearCachedPdfsForBatches, deleteStoredPdfs } from '../storage/pdfStorage';

const CURRENT_USER_ID_KEY = 'overtime_plus_current_user_id';
const debug = createScopedLogger('authStore');

// Simple client-side rate limiting to throttle repeated auth attempts
const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const AUTH_MAX_ATTEMPTS = 5;
type AuthAction = 'password' | 'otp';
const authAttemptLog: Record<AuthAction, { timestamps: number[] }> = {
  password: { timestamps: [] },
  otp: { timestamps: [] },
};

function consumeAuthAttempt(action: AuthAction) {
  const now = Date.now();
  const windowStart = now - AUTH_RATE_LIMIT_WINDOW_MS;
  const bucket = authAttemptLog[action];
  bucket.timestamps = bucket.timestamps.filter(ts => ts >= windowStart);
  if (bucket.timestamps.length >= AUTH_MAX_ATTEMPTS) {
    throw new Error('Too many attempts. Please wait a moment and try again.');
  }
  bucket.timestamps.push(now);
}

function resetAuthAttempts(action: AuthAction) {
  authAttemptLog[action].timestamps = [];
}

/**
 * Determines if an error is network-related (offline, connection failure, etc.)
 * Network errors should not cause logout when we have a valid cached session
 */
function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error?.message || '';
  const errorCode = error?.code || '';
  const errorStatus = error?.status || '';
  
  // Check for common network error indicators
  const networkErrorPatterns = [
    'Network request failed',
    'fetch',
    'network',
    'offline',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'timeout',
    'ERR_INTERNET_DISCONNECTED',
    'ERR_NETWORK_CHANGED',
  ];
  
  const hasNetworkPattern = networkErrorPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
    errorCode.toLowerCase().includes(pattern.toLowerCase())
  );
  
  // Supabase-specific network errors
  const isSupabaseNetworkError = 
    errorStatus === 0 || // Status 0 usually means network failure
    errorCode === 'PGRST116' || // PostgREST connection error
    (errorMessage && (
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('Load failed')
    ));
  
  return hasNetworkPattern || isSupabaseNetworkError;
}

/**
 * Wraps a promise with a timeout to prevent hanging when offline
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error = new Error('Request timed out')
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(timeoutError), timeoutMs)
    ),
  ]);
}

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  error: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  pendingPassword: string | null;
  hasCompletedOnboarding: boolean;
  isDeletingAccount: boolean;

  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<'success' | 'verify' | 'error'>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  requestEmailOtp: (email: string, shouldCreateUser?: boolean) => Promise<boolean>;
  verifyEmailOtp: (email: string, token: string) => Promise<'success' | 'error'>;
  completeOnboarding: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true, // Start as true - we haven't checked session yet
  error: null,
  emailVerified: false,
  pendingEmail: null,
  pendingPassword: null,
  hasCompletedOnboarding: false,
  isDeletingAccount: false,

  clearError: () => set({ error: null }),

  checkSession: async () => {
    set({ isLoading: true, error: null });
    // Watchdog to prevent getting stuck on splash when offline/requests hang
    let finished = false;
    const watchdog = setTimeout(() => {
      const state = get();
      if (!finished && state.isLoading) {
        debug.warn('checkSession watchdog fired - forcing loading false for offline fallback');
        set({ isLoading: false, error: null });
      }
    }, 4500);
    const markFinished = () => {
      if (!finished) {
        finished = true;
        clearTimeout(watchdog);
      }
    };
    try {
      debug.debug('Getting session from Supabase...');
      
      // CRITICAL: Try reading from SecureStore FIRST before attempting getSession()
      // This ensures we can use cached session immediately when offline
      // Supabase's getSession() might try to make network requests even when offline
      let session = null;
      let user = null;
      let error: any = null;
      let gotSessionFromCache = false;
      
      // First, try to read session directly from SecureStore (fast, works offline)
      debug.debug('Attempting to read session directly from SecureStore first...');
      try {
        const { SecureStoreAdapter } = await import('../auth/storageAdapter');
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (supabaseUrl) {
          // Extract project ref from URL (e.g., https://xyzabc.supabase.co -> xyzabc)
          const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
          const projectRef = urlMatch ? urlMatch[1] : supabaseUrl.split('//')[1]?.split('.')[0];
          
          if (projectRef) {
            // Try the standard Supabase session key format
            const possibleKeys = [
              `sb-${projectRef}-auth-token`,
              `sb-${projectRef}-auth-token-session-data`, // SQLite adapter format
            ];
            
            for (const sessionKey of possibleKeys) {
              debug.debug('Attempting to read session directly from SecureStore:', sessionKey.substring(0, 30) + '...');
              try {
                const sessionData = await SecureStoreAdapter.getItem(sessionKey);
                if (sessionData) {
                  debug.debug('Found session data in SecureStore, length:', sessionData.length);
                  try {
                    const parsed = JSON.parse(sessionData);
                    // Check if it's a session object with required fields
                    if (parsed?.access_token && parsed?.user) {
                      debug.debug('✅ Successfully read session from SecureStore directly (offline mode)');
                      session = parsed;
                      user = parsed.user;
                      gotSessionFromCache = true;
                      break; // Break out of key loop
                    } else if (parsed?.session?.access_token && parsed?.session?.user) {
                      // Sometimes Supabase wraps it in a session property
                      debug.debug('✅ Found wrapped session in SecureStore (offline mode)');
                      session = parsed.session;
                      user = parsed.session.user;
                      gotSessionFromCache = true;
                      break; // Break out of key loop
                    } else {
                      debug.debug('Session data found but missing required fields:', {
                        hasAccessToken: !!parsed?.access_token,
                        hasUser: !!parsed?.user,
                        hasWrappedSession: !!parsed?.session,
                        keys: Object.keys(parsed || {}),
                      });
                    }
                  } catch (parseError) {
                    debug.warn('Failed to parse session data from SecureStore:', parseError);
                  }
                }
              } catch (keyError) {
                debug.debug('Failed to read key', sessionKey.substring(0, 30) + '...:', keyError);
              }
            }
          }
        }
      } catch (fallbackError) {
        debug.warn('Direct SecureStore read failed:', fallbackError);
      }
      
      // If we got session from cache, skip getSession() entirely (we're offline)
      if (!gotSessionFromCache) {
        debug.debug('No cached session found, trying getSession()...');
        // Try getSession() with a short timeout - if it times out, we're likely offline
        try {
          // @ts-ignore
          const result = await withTimeout(
            (supabase as any).auth.getSession(),
            2000, // 2 second timeout - if offline, this will timeout quickly
            new Error('getSession timeout - likely offline')
          ) as { data?: { session?: any } | null; error?: any } | null;
          error = result?.error;
          const resultSession = result?.data?.session ?? null;
          const resultUser = resultSession?.user ?? null;
          
          if (resultSession && resultUser) {
            debug.debug('Got session from getSession()');
            session = resultSession;
            user = resultUser;
          } else if (error && !isNetworkError(error)) {
            throw error;
          }
        } catch (timeoutError) {
          debug.warn('getSession timed out - likely offline, using cached session if available');
          error = timeoutError;
          // If getSession times out, we're offline - use cached session if we found one
          // If we didn't find a cached session, we'll handle that below
        }
      }
      
      debug.debug('Session check result:', {
        hasSession: !!session,
        hasUser: !!user,
        gotSessionFromCache,
        hasError: !!error,
        errorMessage: error?.message,
      });
      
      // If we have an error and it's not a network error, and we don't have a cached session, throw it
      if (error && !isNetworkError(error) && !gotSessionFromCache) {
        throw error;
      }
      
      // If we don't have a session at this point, we can't proceed
      if (!session || !user) {
        debug.warn('No session found - user needs to sign in');
        // Clear any partial state
        // Wrap signOut in timeout to prevent hanging when offline
        // If offline, signOut will fail but we don't care - we're just clearing local state
        try {
          await withTimeout(
            (supabase as any).auth.signOut(),
            2000, // 2 second timeout
            new Error('signOut timeout - likely offline')
          );
        } catch (signOutError) {
          // Ignore signOut errors when offline - we're just clearing local state anyway
          debug.debug('signOut failed (likely offline), continuing with local state clear:', signOutError);
        }
        set({
          session: null,
          user: null,
          emailVerified: false,
          hasCompletedOnboarding: false,
          isLoading: false,
        });
        return;
      }
      
      // If we got session from cache, skip all network operations (we're offline)
      if (gotSessionFromCache) {
        debug.debug('Using cached session, skipping token refresh and user verification (offline mode)');
      }

      // If we have a session, check if the access token is expired and refresh if needed
      // Skip this if we got session from cache (we're offline)
      if (session && user && session.access_token && !gotSessionFromCache) {
        // Check if access token is expired or about to expire (within 60 seconds)
        try {
          const tokenParts = session.access_token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            const exp = payload.exp; // Expiration timestamp (seconds since epoch)
            const now = Math.floor(Date.now() / 1000); // Current time in seconds
            
            // If token is expired or expires within 60 seconds, refresh it
            if (exp && exp - now < 60) {
              debug.debug('Access token expired or expiring soon, refreshing...', {
                expiresIn: exp - now,
                expired: exp - now < 0,
              });
              
              // Try to refresh the session using the refresh token
              // Use timeout to prevent hanging when offline
              if (session.refresh_token) {
                try {
                // @ts-ignore
                  const refreshPromise = (supabase as any).auth.refreshSession({
                  refresh_token: session.refresh_token,
                });
                  const refreshResult = await withTimeout(
                    refreshPromise,
                    5000, // 5 second timeout
                    new Error('Token refresh timeout - likely offline')
                  ) as { data?: any; error?: any } | null;
                  const refreshData = refreshResult?.data;
                  const refreshError = refreshResult?.error;
                
                if (refreshError) {
                  // Check if this is a network error
                  if (isNetworkError(refreshError)) {
                    debug.warn('Failed to refresh expired session due to network error - allowing offline use with cached session', {
                      errorMessage: refreshError.message,
                    });
                    // Don't clear session on network errors - allow offline use
                    // The token may be expired, but we'll keep the session for offline access
                    // It will be refreshed when network is available
                  } else {
                    debug.error('Failed to refresh expired session (non-network error):', refreshError);
                    // This is an actual auth error - clear session
                    // Wrap signOut in timeout to prevent hanging when offline
                    try {
                      await withTimeout(
                        (supabase as any).auth.signOut(),
                        2000, // 2 second timeout
                        new Error('signOut timeout - likely offline')
                      );
                    } catch (signOutError) {
                      debug.debug('signOut failed (likely offline), continuing with local state clear:', signOutError);
                    }
                    set({
                      session: null,
                      user: null,
                      emailVerified: false,
                      hasCompletedOnboarding: false,
                      isLoading: false,
                    });
                    debug.debug('Session cleared due to refresh failure');
                    return;
                  }
                }
                
                if (refreshData?.session?.access_token) {
                  debug.debug('Session refreshed successfully after expiration');
                  session = refreshData.session;
                  user = session.user;
                } else {
                  debug.error('Refresh succeeded but no session returned');
                  // Wrap signOut in timeout to prevent hanging when offline
                  try {
                    await withTimeout(
                      (supabase as any).auth.signOut(),
                      2000, // 2 second timeout
                      new Error('signOut timeout - likely offline')
                    );
                  } catch (signOutError) {
                    debug.debug('signOut failed (likely offline), continuing with local state clear:', signOutError);
                  }
                  set({
                    session: null,
                    user: null,
                    emailVerified: false,
                    hasCompletedOnboarding: false,
                    isLoading: false,
                  });
                  return;
                  }
                } catch (refreshTimeoutError) {
                  // Timeout or network error - allow offline use with cached session
                  if (isNetworkError(refreshTimeoutError)) {
                    debug.warn('Token refresh timed out due to network - allowing offline use with cached session');
                    // Continue with cached session
                  } else {
                    throw refreshTimeoutError;
                  }
                }
              } else {
                debug.error('Access token expired but no refresh token available');
                // Wrap signOut in timeout to prevent hanging when offline
                try {
                  await withTimeout(
                    (supabase as any).auth.signOut(),
                    2000, // 2 second timeout
                    new Error('signOut timeout - likely offline')
                  );
                } catch (signOutError) {
                  debug.debug('signOut failed (likely offline), continuing with local state clear:', signOutError);
                }
                set({
                  session: null,
                  user: null,
                  emailVerified: false,
                  hasCompletedOnboarding: false,
                  isLoading: false,
                });
                return;
              }
            }
          }
        } catch (tokenError) {
          debug.warn('Could not parse access token, attempting refresh anyway:', tokenError);
          // If we can't parse the token, try refreshing anyway
          if (session.refresh_token) {
            try {
            // @ts-ignore
              const refreshPromise = (supabase as any).auth.refreshSession({
              refresh_token: session.refresh_token,
            });
              const refreshResult = await withTimeout(
                refreshPromise,
                5000, // 5 second timeout
                new Error('Token refresh timeout - likely offline')
              ) as { data?: any; error?: any } | null;
              const refreshData = refreshResult?.data;
              const refreshError = refreshResult?.error;
            
            if (!refreshError && refreshData?.session?.access_token) {
              debug.debug('Session refreshed successfully (token parse error case)');
              session = refreshData.session;
              user = session.user;
            } else {
              // Check if this is a network error
              if (isNetworkError(refreshError)) {
                debug.warn('Failed to refresh session after token parse error due to network error - allowing offline use', {
                  errorMessage: refreshError?.message,
                });
                // Don't clear session on network errors - allow offline use
              } else {
                debug.error('Failed to refresh session after token parse error (non-network error):', refreshError);
                // Wrap signOut in timeout to prevent hanging when offline
                try {
                  await withTimeout(
                    (supabase as any).auth.signOut(),
                    2000, // 2 second timeout
                    new Error('signOut timeout - likely offline')
                  );
                } catch (signOutError) {
                  debug.debug('signOut failed (likely offline), continuing with local state clear:', signOutError);
                }
                set({
                  session: null,
                  user: null,
                  emailVerified: false,
                  hasCompletedOnboarding: false,
                  isLoading: false,
                });
                return;
                }
              }
            } catch (refreshTimeoutError) {
              // Timeout or network error - allow offline use with cached session
              if (isNetworkError(refreshTimeoutError)) {
                debug.warn('Token refresh timed out after parse error - allowing offline use');
                // Continue with cached session
              } else {
                throw refreshTimeoutError;
              }
            }
          }
        }
      }

      // If we have a session, verify the user still exists in Supabase
      // IMPORTANT: Only verify if we have network connectivity. If offline, trust the cached session.
      // Skip verification if we got the session from cache (we're offline)
      if (session && user && !gotSessionFromCache) {
        debug.debug('Verifying user still exists...', { userId: maskUserId(user.id) });
        try {
          // Verify the user still exists by calling getUser() - this will fail if user was deleted
          // Use timeout to prevent hanging when offline
          // @ts-ignore
          const getUserPromise = (supabase as any).auth.getUser();
          const userResult = await withTimeout(
            getUserPromise,
            5000, // 5 second timeout - if offline, this will timeout quickly
            new Error('User verification timeout - likely offline')
          ) as { data?: any; error?: any } | null;
          const userData = userResult?.data;
          const userError = userResult?.error;
          if (userError) {
            // Check if this is a network error - if so, allow offline use with cached session
            if (isNetworkError(userError)) {
              debug.warn('User verification failed due to network error - allowing offline use with cached session', {
                errorMessage: userError.message,
                hasCachedSession: !!session,
                hasCachedUser: !!user,
              });
              // Don't clear session on network errors - allow offline use
              // The session is valid, we just can't verify it right now
            } else {
              // This is an actual auth error (user deleted, invalid token, etc.) - clear session
              debug.error('User validation failed - user may have been deleted:', userError);
              // Wrap signOut in timeout to prevent hanging when offline
              try {
                await withTimeout(
                  (supabase as any).auth.signOut(),
                  2000, // 2 second timeout
                  new Error('signOut timeout - likely offline')
                );
              } catch (signOutError) {
                debug.debug('signOut failed (likely offline), continuing with local state clear:', signOutError);
              }
              set({
                session: null,
                user: null,
                emailVerified: false,
                hasCompletedOnboarding: false,
                isLoading: false,
              });
              debug.debug('Session cleared due to invalid user');
              return;
            }
          } else {
            debug.debug('User verified successfully');
          }
        } catch (verifyError) {
          // Check if this is a network error or timeout
          if (isNetworkError(verifyError)) {
            debug.warn('User verification failed due to network error - allowing offline use with cached session', {
              errorMessage: verifyError instanceof Error ? verifyError.message : String(verifyError),
              hasCachedSession: !!session,
              hasCachedUser: !!user,
            });
            // Don't clear session on network errors - allow offline use
          } else {
            // This is an unexpected error - log it but don't clear session unless it's clearly an auth error
            debug.error('Error verifying user (non-network):', verifyError);
            // Only clear session if it's clearly an authentication error
            // For unknown errors, be conservative and allow offline use
            const errorMessage = verifyError instanceof Error ? verifyError.message : String(verifyError);
            if (errorMessage.includes('Invalid') || errorMessage.includes('expired') || errorMessage.includes('revoked')) {
              debug.debug('Session cleared due to authentication error');
              // Wrap signOut in timeout to prevent hanging when offline
              try {
                await withTimeout(
                  (supabase as any).auth.signOut(),
                  2000, // 2 second timeout
                  new Error('signOut timeout - likely offline')
                );
              } catch (signOutError) {
                debug.debug('signOut failed (likely offline), continuing with local state clear:', signOutError);
              }
              set({
                session: null,
                user: null,
                emailVerified: false,
                hasCompletedOnboarding: false,
                isLoading: false,
              });
              return;
            } else {
              debug.warn('Unknown verification error - allowing offline use to be safe');
            }
          }
        }
      } else if (gotSessionFromCache && session && user) {
        debug.debug('Using cached session, skipping user verification (offline mode)', {
          userId: maskUserId(user.id),
          hasSession: !!session,
          hasUser: !!user,
        });
      }

      // Check onboarding status and get the result directly
      // Wrap in timeout to prevent hanging when offline
      const onboardingStore = useOnboardingStore.getState();
      let hasCompletedOnboarding = false;
      try {
        hasCompletedOnboarding = await withTimeout(
          onboardingStore.checkOnboardingStatus(user?.id),
          3000, // 3 second timeout - should be fast if using local storage
          new Error('checkOnboardingStatus timeout - likely offline')
        );
      } catch (onboardingError) {
        // If checkOnboardingStatus times out or fails, default to false
        // User can complete onboarding when online
        debug.warn('checkOnboardingStatus timed out or failed, defaulting to false:', onboardingError);
        hasCompletedOnboarding = false;
      }

      // Store current user ID in SecureStore for widget access
      if (user?.id) {
        await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, user.id);
      } else {
        await SecureStore.deleteItemAsync(CURRENT_USER_ID_KEY);
      }

      debug.debug('Setting state:', {
        hasSession: !!session,
        hasUser: !!user,
        userId: maskUserId(user?.id),
        emailVerified: !!user?.email_confirmed_at,
        hasCompletedOnboarding,
      });
      
      set({
        session,
        user,
        emailVerified: !!user?.email_confirmed_at,
        hasCompletedOnboarding,
        isLoading: false,
      });
      
      debug.debug('State set complete');
    } catch (e) {
      debug.error('Error getting session:', e);
      
      // Check if this is a network error or timeout - if so, try to preserve any cached session
      // Timeout errors should be treated as network errors
      const isTimeoutError = e instanceof Error && (
        e.message.includes('timeout') || 
        e.message.includes('timed out') ||
        e.message.includes('Request timed out')
      );
      if (isNetworkError(e) || isTimeoutError) {
        debug.warn('Session check failed due to network error or timeout - attempting to use cached session');
        try {
          // Try to get session from Supabase storage (should work offline)
          // Use timeout to prevent hanging even here
          // @ts-ignore
          const cachedSessionPromise = (supabase as any).auth.getSession();
          const cachedSessionResult = await withTimeout(
            cachedSessionPromise,
            2000, // 2 second timeout
            new Error('getSession timeout in catch block')
          ) as { data?: { session?: any } | null } | null;
          const cachedSessionData = cachedSessionResult?.data;
          if (cachedSessionData?.session && cachedSessionData?.session?.user) {
            const cachedSession = cachedSessionData.session;
            const cachedUser = cachedSession.user;
            debug.debug('Using cached session for offline access', {
              hasSession: !!cachedSession,
              hasUser: !!cachedUser,
              userId: maskUserId(cachedUser?.id),
            });
            
            // Use cached session for offline access
            // Check onboarding status with timeout to prevent hanging
            const onboardingStore = useOnboardingStore.getState();
            let hasCompletedOnboarding = false;
            try {
              // Use timeout to prevent hanging - if it times out, default to false
              hasCompletedOnboarding = await withTimeout(
                onboardingStore.checkOnboardingStatus(cachedUser?.id),
                3000, // 3 second timeout
                new Error('checkOnboardingStatus timeout')
              );
            } catch (onboardingError) {
              debug.warn('checkOnboardingStatus timed out or failed, defaulting to false:', onboardingError);
              // Default to false if check fails - user can complete onboarding when online
              hasCompletedOnboarding = false;
            }
            
            if (cachedUser?.id) {
              await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, cachedUser.id);
            }
            
            set({
              session: cachedSession,
              user: cachedUser,
              emailVerified: !!cachedUser?.email_confirmed_at,
              hasCompletedOnboarding,
              isLoading: false,
              error: null, // Don't show error for network issues when we have cached session
            });
            return;
          }
        } catch (cacheError) {
          debug.warn('Failed to retrieve cached session:', cacheError);
          // If we can't get cached session, try one more time without timeout
          // This is a last resort - getSession should work offline
          try {
            // @ts-ignore
            const directCachedResult = await (supabase as any).auth.getSession();
            if (directCachedResult?.data?.session && directCachedResult?.data?.session?.user) {
              const cachedSession = directCachedResult.data.session;
              const cachedUser = cachedSession.user;
              debug.debug('Using cached session from direct call', {
                hasSession: !!cachedSession,
                hasUser: !!cachedUser,
                userId: maskUserId(cachedUser?.id),
              });
              
              const onboardingStore = useOnboardingStore.getState();
              let hasCompletedOnboarding = false;
              try {
                // Use timeout to prevent hanging - if it times out, default to false
                hasCompletedOnboarding = await withTimeout(
                  onboardingStore.checkOnboardingStatus(cachedUser?.id),
                  3000, // 3 second timeout
                  new Error('checkOnboardingStatus timeout')
                );
              } catch (onboardingError) {
                debug.warn('checkOnboardingStatus timed out or failed, defaulting to false:', onboardingError);
                // Default to false if check fails - user can complete onboarding when online
                hasCompletedOnboarding = false;
              }
              
              if (cachedUser?.id) {
                await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, cachedUser.id);
              }
              
              set({
                session: cachedSession,
                user: cachedUser,
                emailVerified: !!cachedUser?.email_confirmed_at,
                hasCompletedOnboarding,
                isLoading: false,
                error: null,
              });
              return;
            }
          } catch (directError) {
            debug.warn('Direct cached session retrieval also failed:', directError);
          }
        }
      }
      
      // If we get here, either it's not a network error, or we couldn't get a cached session
      // Clear session on non-network errors or when no cached session is available
      // Wrap signOut in timeout to prevent hanging when offline
      try {
        await withTimeout(
          (supabase as any).auth.signOut(),
          2000, // 2 second timeout
          new Error('signOut timeout - likely offline')
        );
      } catch (signOutError) {
        // Ignore signOut errors when offline - we're just clearing local state anyway
        debug.debug('signOut failed (likely offline), continuing with local state clear:', signOutError);
      }
      set({
        session: null,
        user: null,
        emailVerified: false,
        hasCompletedOnboarding: false,
        isLoading: false,
        error: toFriendlyAuthMessage(e instanceof Error ? e.message : 'Failed to get session'),
      });
    }
    finally {
      markFinished();
    }
  },

  signIn: async (email: string, password: string) => {
    const emailMasked = email.replace(/(^.).+(@.*$)/, '$1***$2');
    debug.debug('===== SIGN IN START =====');
    debug.debug('signing in', { emailMasked, passwordLength: password.length });
    set({ isLoading: true, error: null });
    try {
      consumeAuthAttempt('password');
    } catch (rateError: any) {
      set({ isLoading: false, error: toFriendlyAuthMessage(rateError.message) });
      return 'error';
    }
    debug.debug('set isLoading to true');
    try {
      debug.debug('calling supabase.auth.signInWithPassword');
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signInWithPassword({ email, password });
      debug.debug('signInWithPassword response', {
        hasData: !!data,
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        hasError: !!error,
        errorCode: (error as any)?.code,
        errorMessage: error?.message,
        errorStatus: (error as any)?.status,
      });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        debug.error('error received', { message: msg, fullMessage: error.message });
        if (msg.includes('email not confirmed') || msg.includes('confirm your email') || msg.includes('email not verified')) {
          debug.debug('email not confirmed - redirecting to verify');
          set({
            isLoading: false,
            error: toFriendlyAuthMessage(error.message),
            pendingEmail: email,
            emailVerified: false,
          });
          debug.debug('===== SIGN IN - NEEDS VERIFICATION =====');
          return 'verify';
        }
        debug.error('throwing error', { message: error.message });
        throw error;
      }
      let session = data?.session ?? null;
      let user = session?.user ?? null;
      debug.debug('success - extracting session/user', {
        hasSession: !!session,
        hasUser: !!user,
        userId: maskUserId(user?.id),
        userEmail: maskEmail(user?.email),
        emailConfirmedAt: user?.email_confirmed_at,
        emailVerified: !!user?.email_confirmed_at,
      });
      
      // Explicitly set session on Supabase client to ensure it's available for subsequent requests
      // This is important for session persistence across app restarts
      if (session) {
        try {
          debug.debug('Setting session on Supabase client after sign-in');
          // @ts-ignore
          const { data: setData, error: setError } = await (supabase as any).auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          if (setError) {
            debug.warn('Error setting session after sign-in (non-fatal):', setError);
          } else if (setData?.session) {
            debug.debug('Session set on client successfully');
            // Use the session returned from setSession as it may have updated tokens
            session = setData.session;
            user = session?.user ?? null;
          }
        } catch (setSessionError) {
          debug.warn('Exception setting session after sign-in (non-fatal):', setSessionError);
          // Continue anyway - the session should still be stored by the storage adapter
        }
      }
      
      // Check onboarding status
      const onboardingStore = useOnboardingStore.getState();
      await onboardingStore.checkOnboardingStatus(user?.id);

      // Store current user ID in SecureStore for widget access
      if (user?.id) {
        await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, user.id);
      }

      set({
        session,
        user,
        emailVerified: !!user?.email_confirmed_at,
        pendingEmail: null,
        pendingPassword: null,
        hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
        isLoading: false,
      });
      resetAuthAttempts('password');
      debug.debug('===== SIGN IN COMPLETE - SUCCESS =====');
      return 'success';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed';
      debug.error('===== SIGN IN FAILED =====', {
        message: msg,
        error: e,
        errorString: String(e),
        errorName: e instanceof Error ? e.name : 'Unknown',
        errorCode: (e as any)?.code,
      });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return 'error';
    }
  },

  signUp: async (email: string, password: string) => {
    debug.debug('invoked', { emailMasked: email.replace(/(^.).+(@.*$)/, '$1***$2') });
    set({ isLoading: true, error: null });
    try {
      if (!isValidEmail(email)) {
        debug.error('invalid email format');
        throw new Error('Invalid email format');
      }
      if (!isAllowedDomain(email)) {
        debug.error('domain not allowed');
        throw new Error('Email domain not allowed');
      }
      const pw = validatePasswordStrength(password);
      if (!pw.valid) {
        debug.error('password weak', { issues: pw.errors });
        throw new Error(`Password requirements: ${pw.errors.join(', ')}`);
      }
      // Use normal signUp flow - it will send "Confirm sign up" email template (configured to show OTP code)
      debug.debug('calling supabase.auth.signUp');
      
      // Validate Supabase URL format before making request
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
        debug.error('Invalid Supabase URL:', supabaseUrl);
        throw new Error('Supabase URL is not configured correctly. Please check your environment variables.');
      }
      
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Don't send redirect links, just OTP code in email
        },
      });
      if (error) {
        debug.error('supabase error', { 
          code: (error as any)?.code, 
          message: error.message,
          status: (error as any)?.status,
          name: error.name,
          stack: error.stack,
        });
        
        // Provide more helpful error messages
        if (error.message?.includes('Network request failed') || error.message?.includes('fetch')) {
          throw new Error('Unable to connect to Supabase. Please check:\n1. Your internet connection\n2. Your Supabase URL is correct\n3. Your Supabase project is active');
        }
        
        throw error;
      }
      debug.debug('signup response', { hasUser: !!data?.user, hasSession: !!data?.session });
      // User created, confirmation email sent (configured to show OTP code in template)
      set({
        pendingEmail: email,
        pendingPassword: password,
        emailVerified: false,
        isLoading: false,
        user: data?.user ?? null,
        session: null,
      });
      debug.debug('completed OK');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed';
      debug.error('failed', { message: msg });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return false;
    }
  },

  requestEmailOtp: async (email: string, shouldCreateUser = false) => {
    const emailMasked = email.replace(/(^.).+(@.*$)/, '$1***$2');
    debug.debug('sending OTP', { emailMasked, shouldCreateUser });
    set({ isLoading: true, error: null });
    try {
      consumeAuthAttempt('otp');
    } catch (rateError: any) {
      set({ isLoading: false, error: toFriendlyAuthMessage(rateError.message) });
      return false;
    }
    try {
      // @ts-ignore
      const { data, error } = await (supabase as any).auth.signInWithOtp({
        email,
        options: { 
          shouldCreateUser,
          emailRedirectTo: undefined, // Don't send redirect links, only OTP codes
        },
      });
      debug.debug('response', { 
        hasData: !!data, 
        hasError: !!error,
        errorCode: (error as any)?.code,
        errorMessage: error?.message,
        dataKeys: data ? Object.keys(data) : [],
      });
      if (error) {
        debug.error('error details', { 
          code: (error as any)?.code,
          message: error.message,
          status: (error as any)?.status,
        });
        throw error;
      }
      debug.debug('OTP sent successfully');
      set({ pendingEmail: email, isLoading: false });
      resetAuthAttempts('otp');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send code';
      debug.error('failed', { 
        message: msg,
        error: e,
        errorString: String(e),
      });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      return false;
    }
  },

  verifyEmailOtp: async (email: string, token: string) => {
    const emailMasked = email.replace(/(^.).+(@.*$)/, '$1***$2');
    debug.debug('===== VERIFY OTP START =====');
    debug.debug('verifying', { 
      emailMasked, 
      email: maskEmail(email), 
      tokenLength: token.length,
      token: token.length > 0 ? '***' : 'empty',
    });
    debug.debug('current state before verification', {
      pendingEmail: get().pendingEmail,
      pendingPassword: !!get().pendingPassword,
      hasUser: !!get().user,
      hasSession: !!get().session,
      emailVerified: get().emailVerified,
    });
    set({ isLoading: true, error: null });
    try {
      consumeAuthAttempt('otp');
    } catch (rateError: any) {
      set({ isLoading: false, error: toFriendlyAuthMessage(rateError.message) });
      return 'error';
    }
    debug.debug('set isLoading to true');
    try {
      const attemptTypes: Array<'email' | 'signup'> = ['email', 'signup'];
      let session: any = null;
      let lastError: Error | null = null;
      debug.debug('starting verification attempts', { attemptTypes });
      for (const type of attemptTypes) {
        debug.debug('===== Attempting verification with type:', type, '=====');
        debug.debug('calling supabase.auth.verifyOtp', { 
          email: maskEmail(email), 
          tokenLength: token.length,
          type,
        });
        // @ts-ignore
        const { data, error } = await (supabase as any).auth.verifyOtp({ email, token, type });
        debug.debug('verifyOtp response received', {
          type,
          hasData: !!data,
          hasSession: !!data?.session,
          hasUser: !!data?.user,
          hasError: !!error,
          errorCode: (error as any)?.code,
          errorMessage: error?.message,
          errorStatus: (error as any)?.status,
          errorName: error?.name,
          dataKeys: data ? Object.keys(data) : [],
          sessionKeys: data?.session ? Object.keys(data.session) : [],
          userKeys: data?.user ? Object.keys(data.user) : [],
        });
        if (!error && (data?.session || data?.user)) {
          debug.debug('SUCCESS with type', type);
          session = data?.session ?? null;
          lastError = null;
          debug.debug('session extracted', {
            hasSession: !!session,
            sessionKeys: session ? Object.keys(session) : [],
            userId: maskUserId(session?.user?.id),
            userEmail: maskEmail(session?.user?.email),
          });
          // Set session immediately after verification to ensure it's available for subsequent requests
          if (session) {
            debug.debug('Setting session on Supabase client immediately after verification');
            // @ts-ignore
            const { data: setData, error: setError } = await (supabase as any).auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
            if (setError) {
              debug.error('Error setting session:', setError);
            } else if (setData?.session) {
              session = setData.session;
              debug.debug('Session set on client successfully');
              // Wait for session to propagate (SecureStore operations are async)
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Try to verify session, but don't fail if it's not immediately available
              let sessionVerified = false;
              for (let attempt = 1; attempt <= 3; attempt++) {
                // @ts-ignore
                const verifyResult = await (supabase as any).auth.getSession();
                if (verifyResult?.error) {
                  debug.error('Session verification error (attempt ' + attempt + '):', verifyResult.error);
                } else if (verifyResult?.data?.session) {
                  sessionVerified = true;
                  debug.debug('Session verified (attempt ' + attempt + ')');
                  break;
                } else {
                  debug.debug('Session not yet available in getSession (attempt ' + attempt + ')');
                }
                
                if (attempt < 3) {
                  await new Promise(resolve => setTimeout(resolve, 200 * attempt));
                }
              }
              
              if (!sessionVerified) {
                debug.warn('WARNING: Session not verified via getSession, but setSession succeeded - proceeding anyway');
              }
            } else {
              debug.debug('setSession did not return a session; continuing with verifyOtp session');
            }
          }
          break;
        }
        if (error) {
          lastError = error;
          debug.error('FAILED with type', type, { 
            message: error.message,
            code: (error as any)?.code,
            status: (error as any)?.status,
            name: error.name,
            errorString: String(error),
            errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          });
        }
      }
      debug.debug('after loop', {
        hasSession: !!session,
        hasLastError: !!lastError,
        lastErrorMessage: lastError?.message,
      });
      if (!session) {
        debug.debug('no session from verifyOtp, trying getSession fallback');
        // Ensure we have an active session in case verifyOtp returned only a user object
        // @ts-ignore
        const { data: fallbackSession, error: fallbackError } = await (supabase as any).auth.getSession();
        debug.debug('getSession fallback result', {
          hasSession: !!fallbackSession?.session,
          hasError: !!fallbackError,
          errorMessage: fallbackError?.message,
        });
        if (fallbackSession?.session) {
          session = fallbackSession.session;
          debug.debug('using fallback session', {
            hasSession: !!session,
            userId: session?.user?.id,
          });
        } else if (fallbackError) {
          lastError = fallbackError;
          debug.error('fallback getSession error', {
            message: fallbackError.message,
            code: (fallbackError as any)?.code,
          });
        }
      }
      if (!session) {
        debug.error('NO SESSION FOUND - throwing error');
        if (lastError) {
          debug.error('throwing lastError', {
            message: lastError.message,
            code: (lastError as any)?.code,
            name: lastError.name,
          });
          throw lastError;
        }
        debug.error('throwing generic error');
        throw new Error('Verification failed. Try again.');
      }
      debug.debug('session found, checking pending password', {
        hasPendingPassword: !!get().pendingPassword,
        hasSessionUser: !!session.user,
      });
      // Only set password if user was created without one (OTP-only signup)
      // If user was created via signUp with password, it's already set, so skip
      const pendingPassword = get().pendingPassword;
      if (pendingPassword && session.user) {
        debug.debug('attempting to apply pending password');
        // Check if user already has a password set (if they do, skip update)
        // We can't easily check this, so we'll try to update and ignore "same password" errors
        try {
          debug.debug('calling updateUser with password');
          // @ts-ignore
          const { error } = await (supabase as any).auth.updateUser({ password: pendingPassword });
          if (error && !error.message.includes('same password')) {
            debug.warn('password update error (non-fatal)', { 
              message: error.message,
              code: (error as any)?.code,
            });
            // Don't throw - password might already be set, verification succeeded
          } else {
            debug.debug('password update successful or same password');
          }
        } catch (e) {
          // Ignore password update errors - verification already succeeded
          debug.warn('password update failed (non-fatal)', {
            error: e,
            errorString: String(e),
          });
        }
      }
      debug.debug('fetching fresh session to ensure flags are updated');
      // Fetch fresh session/user to ensure flags are updated
      // The session should already be set from the verification step above
      // @ts-ignore
      let latestData = await (supabase as any).auth.getSession();
      let latest = latestData?.data;
      if (latestData?.error || !latest?.session) {
        debug.error('Error getting session after verification, retrying setSession:', latestData?.error);
        // If getSession fails or returns no session, try setting the session again
        if (session) {
          debug.debug('Retrying setSession due to getSession error');
          // @ts-ignore
          const { data: retrySet } = await (supabase as any).auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          const retrySession = retrySet?.session ?? session;
          session = retrySession;
          // Try getSession again
          // @ts-ignore
          const retryData = await (supabase as any).auth.getSession();
          latest = retryData?.data ?? { session: retrySession };
        }
     }
      const finalSession = latest?.session ?? session;
      const finalUser = finalSession?.user ?? null;
      debug.debug('final session/user state', {
        hasFinalSession: !!finalSession,
        hasFinalUser: !!finalUser,
        userId: maskUserId(finalUser?.id),
        userEmail: maskEmail(finalUser?.email),
        emailConfirmedAt: finalUser?.email_confirmed_at,
        emailVerified: !!finalUser?.email_confirmed_at,
      });
      // Check onboarding status (new users will have onboarding incomplete)
      const onboardingStore = useOnboardingStore.getState();
      await onboardingStore.checkOnboardingStatus(finalUser?.id);

      // Store current user ID in SecureStore for widget access
      if (finalUser?.id) {
        await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, finalUser.id);
      }

      debug.debug('updating store state');
      set({
        session: finalSession,
        user: finalUser,
        emailVerified: true,
        pendingEmail: null,
        pendingPassword: null,
        hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
        isLoading: false,
      });
      resetAuthAttempts('otp');
      debug.debug('===== VERIFICATION COMPLETE - SUCCESS =====', { 
        hasUser: !!finalUser,
        emailVerified: true,
        hasCompletedOnboarding: onboardingStore.hasCompletedOnboarding,
      });
      return 'success';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to verify code';
      debug.error('===== VERIFICATION FAILED =====', { 
        message: msg,
        error: e,
        errorString: String(e),
        errorName: e instanceof Error ? e.name : 'Unknown',
        errorCode: (e as any)?.code,
        errorStack: e instanceof Error ? e.stack : undefined,
      });
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      debug.debug('set isLoading to false and error to:', toFriendlyAuthMessage(msg));
      return 'error';
    }
  },

  completeOnboarding: async () => {
    const { user } = get();
    const onboardingStore = useOnboardingStore.getState();
    await onboardingStore.completeOnboarding(user?.id);
    set({ hasCompletedOnboarding: true });
  },

  deleteAccount: async () => {
    const { user } = get();
    const userId = user?.id || null;
    const now = new Date().toISOString();
    set({ isDeletingAccount: true, error: null });
    let cloudCleanupFailed = false;

    try {
      // Flag cloud data for deletion (best-effort, non-blocking)
      if (supabaseEnabled && userId) {
        try {
          await (supabase as any).from('profiles').update({ account_deleted_at: now }).eq('user_id', userId);
        } catch (error) {
          debug.error('[deleteAccount] Failed to mark profile deleted in Supabase', error);
        }

        const tables = ['overtime_logs', 'shifts', 'export_batches'] as const;
        for (const table of tables) {
          try {
            await (supabase as any).from(table).update({ deleted_at: now }).eq('user_id', userId);
          } catch (error) {
            debug.error(`[deleteAccount] Failed to flag ${table} rows for deletion`, error);
          }
        }

        try {
          const functionsClient = (supabase as any).functions;
          if (!functionsClient?.invoke) {
            throw new Error('Supabase functions client unavailable');
          }

          const invokeWithTimeout = async (ms: number) => {
            return await Promise.race([
              functionsClient.invoke('delete-account', { body: { reason: 'user_initiated' } }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Delete account timeout')), ms)),
            ]) as any;
          };

          let hardDeleteError = null;
          // Increased retries and timeout: 60s first attempt, 30s retries, up to 3 attempts
          const timeouts = [60000, 30000, 30000]; // 60s, 30s, 30s
          for (let attempt = 1; attempt <= 3; attempt++) {
            const timeout = timeouts[attempt - 1] || 30000;
            const result = await invokeWithTimeout(timeout).catch(err => ({ error: err }));
            hardDeleteError = (result as any)?.error || null;
            if (!hardDeleteError) {
              debug.debug(`[deleteAccount] delete-account succeeded on attempt ${attempt}`);
              break;
            }
            debug.warn(`[deleteAccount] delete-account attempt ${attempt} failed (timeout: ${timeout}ms)`, hardDeleteError);
            if (attempt < 3) {
              // Exponential backoff: 300ms, 600ms, 900ms
              await new Promise(res => setTimeout(res, 300 * attempt));
            }
          }

          if (hardDeleteError) {
            throw hardDeleteError;
          }
        } catch (error) {
          cloudCleanupFailed = true;
          debug.error('[deleteAccount] Hard delete function failed', error);
          // Do not throw; continue to local wipe and sign-out
        }
      }

      // Sign out from RevenueCat to clear entitlement state
      try {
        await revenuecatClient.logOut();
      } catch (error) {
        debug.error('[deleteAccount] RevenueCat logout failed (non-fatal)', error);
      }

      // Gather export batches before clearing DB for later cleanup
      let exportBatches: any[] = [];
      try {
        await database.init();
        exportBatches = await database.getExportBatches(userId);
      } catch (error) {
        debug.error('[deleteAccount] Failed to load export batches for cleanup (non-fatal)', error);
      }

      // Wipe local profile and cached data
      try {
        await profileStorage.deleteProfile(userId);
      } catch (error) {
        debug.error('[deleteAccount] Failed to delete local profile', error);
      }

      try {
        await database.clearAllData();
        await database.clearAuthSessions();
        await database.clearLegacyData();
      } catch (error) {
        debug.error('[deleteAccount] Failed to clear local database', error);
      }

      // Reset onboarding flag locally (and remotely if possible)
      try {
        const onboardingStore = useOnboardingStore.getState();
        await onboardingStore.resetOnboarding(userId);
      } catch (error) {
        debug.error('[deleteAccount] Failed to reset onboarding flags', error);
      }

      // Clean up cached PDFs locally and in storage (best-effort)
      if (exportBatches.length > 0) {
        try {
          await clearCachedPdfsForBatches(exportBatches);
          await deleteStoredPdfs(exportBatches);
        } catch (error) {
          debug.error('[deleteAccount] Failed to clean up PDFs (non-fatal)', error);
        }
      }

      // Sign out of Supabase and clear stored IDs
      try {
        // @ts-ignore
        await (supabase as any).auth.signOut();
      } catch (error) {
        debug.error('[deleteAccount] Supabase signOut failed (non-fatal)', error);
      }
      await SecureStore.deleteItemAsync(CURRENT_USER_ID_KEY);

      // Reset subscription state
      const subscriptionStore = useSubscriptionStore.getState();
      subscriptionStore.reset();

      // Cancel all notifications and clear notification state
      try {
        const { notificationManager } = require('../notifications');
        await notificationManager.clearAllNotificationState(userId);
      } catch (error) {
        debug.error('[deleteAccount] Failed to clear notifications (non-fatal):', error);
      }

      set({
        user: null,
        session: null,
        emailVerified: false,
        hasCompletedOnboarding: false,
        pendingEmail: null,
        pendingPassword: null,
        isLoading: false,
      });

      if (cloudCleanupFailed) {
        set({ error: 'Cloud cleanup may not have completed. Local data was wiped; please try again to ensure cloud data is removed.' });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete account';
      debug.error('[deleteAccount] Failed', e);
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
      throw e;
    } finally {
      set({ isDeletingAccount: false });
    }
  },

  signOut: async () => {
    const { user } = get();
    let exportBatches: any[] = [];
    set({ isLoading: true, error: null });
    try {
      // Prefetch export batches to clear cached PDFs on logout
      if (user?.id) {
        try {
          await database.init();
          exportBatches = await database.getExportBatches(user.id);
        } catch (error) {
          debug.error('[signOut] Failed to load export batches for cache cleanup (non-fatal):', error);
        }
      }

      // @ts-ignore
      const { error } = await (supabase as any).auth.signOut();
      if (error) throw error;
      
      // Clear current user ID from SecureStore
      await SecureStore.deleteItemAsync(CURRENT_USER_ID_KEY);
      
      // Reset subscription cache and RevenueCat identity
      // Safely log out from RevenueCat (may fail if native module not available)
      try {
        await revenuecatClient.logOut();
      } catch (error) {
        // Ignore errors - native module may not be available
      }
      const subscriptionStore = useSubscriptionStore.getState();
      subscriptionStore.reset();

      // Best-effort PDF cache cleanup so exports are removed on logout
      if (exportBatches.length > 0) {
        try {
          await clearCachedPdfsForBatches(exportBatches);
        } catch (error) {
          debug.error('[signOut] Failed to clear cached PDFs (non-fatal):', error);
        }
      }
      
      // Cancel all notifications and clear notification state
      try {
        const { notificationManager } = require('../notifications');
        await notificationManager.clearAllNotificationState(user?.id);
      } catch (error) {
        debug.error('[signOut] Failed to clear notifications (non-fatal):', error);
      }
      
      set({
        user: null,
        session: null,
        emailVerified: false,
        hasCompletedOnboarding: false,
        pendingEmail: null,
        pendingPassword: null,
        isLoading: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign out failed';
      set({ isLoading: false, error: toFriendlyAuthMessage(msg) });
    }
  },
}));
