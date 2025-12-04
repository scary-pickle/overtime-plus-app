/**
 * Supabase integration stub
 * This module provides stubbed Supabase functionality for offline-first operation
 * When Supabase credentials are provided, real sync functionality will be enabled
 */

import { Profile, OvertimeLog, ExportBatch, UsualShift, ShiftTemplate, LogTemplate, SubscriptionSnapshot, RemoteFeatureFlag } from '../types';
import { createClient } from '@supabase/supabase-js';
import { SecureStoreAdapter } from './auth/storageAdapter';
import { database } from './db/sqlite';
import { profileStorage } from './storage/profile';
import { createScopedLogger, maskUserId, maskEmail, maskName } from './utils/logger';

const debug = createScopedLogger('supabase');

// Check for Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate HTTPS requirement for Supabase URL (blocking for non-local hosts)
// Allow localhost/127.0.0.1/local IPs for local development
const isLocalhost = SUPABASE_URL && (
  SUPABASE_URL.includes('localhost') || 
  SUPABASE_URL.includes('127.0.0.1') ||
  SUPABASE_URL.includes('0.0.0.0') ||
  SUPABASE_URL.includes('10.0.0.') || // Local network IPs
  SUPABASE_URL.includes('192.168.') || // Local network IPs
  SUPABASE_URL.match(/^http:\/\/10\.\d+\.\d+\.\d+/) // Any 10.x.x.x IP
);

if (SUPABASE_URL && !SUPABASE_URL.startsWith('https://') && !isLocalhost) {
  const msg = 'Invalid Supabase URL - must use HTTPS (non-localhost).';
  debug.error('SECURITY BLOCK:', msg, 'URL:', SUPABASE_URL.substring(0, 50) + '...');
  throw new Error(msg);
} else if (isLocalhost) {
  debug.debug('Using local Supabase instance (HTTP allowed for localhost)');
}

export const supabaseEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const templateOTAEnabled = (process.env.EXPO_PUBLIC_TEMPLATE_OTA === 'true');

debug.debug('Supabase enabled:', supabaseEnabled);

// Stub interfaces for when Supabase is not configured
interface SupabaseClient {
  auth: {
    signIn: (credentials: any) => Promise<any>;
    signUp: (credentials: any) => Promise<any>;
    signOut: () => Promise<any>;
    getSession: () => Promise<any>;
    signInWithPassword?: (credentials: any) => Promise<any>;
    signInWithOtp?: (credentials: any) => Promise<any>;
    verifyOtp?: (params: any) => Promise<any>;
    updateUser?: (params: any) => Promise<any>;
    resend?: (params: any) => Promise<any>;
  };
  from: (table: string) => any;
  functions?: {
    invoke: (name: string, options?: any) => Promise<any>;
  };
}

// Stub Supabase client
const createStubClient = (): SupabaseClient => ({
  auth: {
    signIn: async () => {
      debug.debug('Stub: signIn called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    signUp: async () => {
      debug.debug('Stub: signUp called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    signInWithPassword: async () => {
      debug.debug('Stub: signInWithPassword called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    signInWithOtp: async () => {
      debug.debug('Stub: signInWithOtp called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    signOut: async () => {
      debug.debug('Stub: signOut called');
      return { error: null };
    },
    getSession: async () => {
      debug.debug('Stub: getSession called');
      return { data: { session: null }, error: null };
    },
    verifyOtp: async () => {
      debug.debug('Stub: verifyOtp called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    updateUser: async () => {
      debug.debug('Stub: updateUser called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    resend: async () => {
      debug.debug('Stub: resend called');
      return { data: null, error: new Error('Supabase not configured') };
    },
  },
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
  }),
  functions: {
    invoke: async () => {
      debug.debug('Stub: functions.invoke called');
      return { data: null, error: new Error('Supabase not configured') };
    },
  },
});

// Real Supabase client (when configured)
// Lazy-initialized to ensure database is ready before session restoration
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  // If already initialized, return it
  if (supabaseClient) {
    return supabaseClient;
  }

  // If not enabled, return stub immediately
  if (!supabaseEnabled) {
    supabaseClient = createStubClient();
    return supabaseClient;
  }

  // Initialize real Supabase client for React Native/Expo with SecureStore storage
  // Use chunked SecureStoreAdapter for session persistence (no 2048 byte limit)
  // Detect session in URL is disabled (handled via Linking), PKCE is default in RN
  // @ts-ignore - allow passing storage adapter even if our local type is minimal
  debug.debug('[supabase] Initializing Supabase client', {
    url: SUPABASE_URL ? `${SUPABASE_URL.substring(0, 20)}...` : 'MISSING',
    hasAnonKey: !!SUPABASE_ANON_KEY,
    anonKeyLength: SUPABASE_ANON_KEY?.length || 0,
  });
  
  try {
    supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        storage: SecureStoreAdapter,
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
        detectSessionInUrl: false,
      },
      global: {
        // Add fetch options for better error handling
        fetch: (url, options = {}) => {
          // Only log non-session-related requests to reduce noise
          const urlStr = typeof url === 'string' ? url : 'non-string';
          if (!urlStr.includes('/auth/v1/token') && !urlStr.includes('/auth/v1/user')) {
            debug.debug('[supabase] Making request', {
              url: urlStr.substring(0, 50),
              method: options.method || 'GET',
            });
          }
          return fetch(url, options);
        },
      },
    }) as unknown as SupabaseClient;
    debug.debug('[supabase] Client initialized successfully');
    
    // After client initialization, Supabase should automatically restore session from storage
    // However, this happens asynchronously, so we trigger restoration here (fire-and-forget)
    // The actual session check will happen in checkSession() with retries
    (async () => {
      try {
        // @ts-ignore
        const { data: initialSession } = await (supabaseClient as any).auth.getSession();
        debug.debug('[supabase] Initial session check after client init:', {
          hasSession: !!initialSession?.session,
          hasUser: !!initialSession?.session?.user,
        });
        
        // CRITICAL: Check if database still has the session after Supabase's getSession call
        // Only check if database is initialized
        try {
          const { database } = await import('./db/sqlite');
          // Check if database is initialized by trying to access it
          // The database.init() should be called elsewhere, but we'll handle gracefully if not
          const sessionCount = await database.countAuthSessions().catch(() => 0);
          const allKeys = await database.getAllAuthSessionKeys().catch(() => []);
          debug.debug('🔍 Database state AFTER initial session check:', {
            sessionCount,
            keysCount: allKeys.length
            // DO NOT log actual keys - they're sensitive
          });
        } catch (dbError) {
          // Database might not be initialized yet - this is non-fatal
          debug.debug('Database not available for session check (non-fatal)');
        }
      } catch (sessionError) {
        debug.error('Error checking initial session (non-fatal):', sessionError);
        // Non-fatal - session restoration might still be in progress
      }
    })();
  } catch (error) {
    debug.error('Failed to create Supabase client:', error);
    throw error;
  }

  return supabaseClient;
}

// Lazy initialization - only create client when accessed
// This ensures database is initialized before Supabase tries to restore session
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    return (client as any)[prop];
  },
});

/**
 * Authentication functions
 */
export const auth = {
  async signIn(email: string, password: string) {
    if (!supabaseEnabled) {
      throw new Error('Supabase not configured');
    }
    // @ts-ignore
    return await (supabase as any).auth.signInWithPassword({ email, password });
  },

  async signUp(email: string, password: string) {
    if (!supabaseEnabled) {
      throw new Error('Supabase not configured');
    }
    // @ts-ignore
    return await (supabase as any).auth.signUp({ email, password });
  },

  async signOut() {
    if (!supabaseEnabled) {
      return { error: null };
    }
    return await supabase.auth.signOut();
  },

  async getCurrentUser() {
    if (!supabaseEnabled) {
      return null;
    }
    // @ts-ignore
    const { data } = await (supabase as any).auth.getSession();
    return data.session?.user || null;
  },
};

/**
 * Helper function to get a valid access token, refreshing if necessary
 * This is critical for direct REST API calls which don't benefit from autoRefreshToken
 */
// Cache the access token to avoid repeated SecureStore reads
let cachedAccessToken: { token: string; expiresAt: number } | null = null;
const TOKEN_CACHE_TTL = 5000; // Cache for 5 seconds

// Clear token cache when session changes
export function clearTokenCache() {
  cachedAccessToken = null;
}

async function getValidAccessToken(): Promise<string | null> {
  if (!supabaseEnabled) {
    return null;
  }

  try {
    // Check cache first (avoid repeated SecureStore reads)
    if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
      return cachedAccessToken.token;
    }

    // Get session from auth store first
    const { useAuthStore } = await import('./state/authStore');
    const authState = useAuthStore.getState();
    let session = authState.session;
    
    // If not in auth store, try getSession()
    if (!session) {
      // @ts-ignore
      const result = await (supabase as any).auth.getSession();
      session = result?.data?.session;
    }
    
    if (!session?.access_token) {
      debug.debug('[getValidAccessToken] No session available');
      return null;
    }

    // Check if token is expired or about to expire (within 60 seconds)
    // JWT tokens contain an 'exp' claim with expiration timestamp
    try {
      const tokenParts = session.access_token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        const exp = payload.exp; // Expiration timestamp (seconds since epoch)
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        
        // If token expires within 60 seconds, refresh it
        if (exp && exp - now < 60) {
          debug.debug('[getValidAccessToken] Token expiring soon, refreshing...', {
            expiresIn: exp - now,
          });
          
          // Refresh the session
          // @ts-ignore
          const { data: refreshData, error: refreshError } = await (supabase as any).auth.refreshSession({
            refresh_token: session.refresh_token,
          });
          
          if (refreshError) {
            debug.error('[getValidAccessToken] Failed to refresh session:', refreshError);
            return null;
          }
          
          if (refreshData?.session?.access_token) {
            debug.debug('[getValidAccessToken] Session refreshed successfully');
            // Update auth store with new session
            const { useAuthStore } = await import('./state/authStore');
            useAuthStore.setState({ session: refreshData.session, user: refreshData.session.user });
            // Cache the new token
            cachedAccessToken = { token: refreshData.session.access_token, expiresAt: Date.now() + TOKEN_CACHE_TTL };
            return refreshData.session.access_token;
          }
        }
      }
    } catch (tokenError) {
      // If we can't parse the token, try refreshing anyway
      debug.debug('[getValidAccessToken] Could not parse token, attempting refresh:', tokenError);
      // @ts-ignore
      const { data: refreshData, error: refreshError } = await (supabase as any).auth.refreshSession({
        refresh_token: session.refresh_token,
      });
      
      if (!refreshError && refreshData?.session?.access_token) {
        const { useAuthStore } = await import('./state/authStore');
        useAuthStore.setState({ session: refreshData.session, user: refreshData.session.user });
        // Cache the new token
        cachedAccessToken = { token: refreshData.session.access_token, expiresAt: Date.now() + TOKEN_CACHE_TTL };
        return refreshData.session.access_token;
      }
    }
    
    // Cache the token before returning
    if (session.access_token) {
      cachedAccessToken = { token: session.access_token, expiresAt: Date.now() + TOKEN_CACHE_TTL };
    }
    return session.access_token;
  } catch (error) {
    debug.error('[getValidAccessToken] Error getting valid access token:', error);
    return null;
  }
}

/**
 * Helper function to make an authenticated REST API request with automatic token refresh
 */
async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  retryOnExpired = true
): Promise<Response> {
  const accessToken = await getValidAccessToken();
  
  if (!accessToken) {
    throw new Error('No valid access token available - please sign in again');
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
    'apikey': SUPABASE_ANON_KEY!,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If we get a JWT expired error and retry is enabled, refresh and retry once
  if (!response.ok && retryOnExpired) {
    // Clone the response so we can read it without consuming the original
    const clonedResponse = response.clone();
    const errorText = await clonedResponse.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    
    // Check if it's a JWT expired error or unauthorized
    if (
      errorData.code === 'PGRST303' ||
      errorData.message === 'JWT expired' ||
      response.status === 401 ||
      response.status === 403
    ) {
      debug.debug('[authenticatedFetch] JWT expired, refreshing token and retrying...');
      
      // Force refresh the session
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      const session = authState.session;
      
      if (session?.refresh_token) {
        // @ts-ignore
        const { data: refreshData, error: refreshError } = await (supabase as any).auth.refreshSession({
          refresh_token: session.refresh_token,
        });
        
        if (!refreshError && refreshData?.session?.access_token) {
          // Update auth store
          useAuthStore.setState({ session: refreshData.session, user: refreshData.session.user });
          // Update cache
          cachedAccessToken = { token: refreshData.session.access_token, expiresAt: Date.now() + TOKEN_CACHE_TTL };
          
          // Retry the request with new token
          const newHeaders = {
            ...options.headers,
            'Authorization': `Bearer ${refreshData.session.access_token}`,
            'apikey': SUPABASE_ANON_KEY!,
            'Content-Type': 'application/json',
          };
          
          return fetch(url, {
            ...options,
            headers: newHeaders,
          });
        }
      }
    }
  }

  return response;
}

/**
 * Profile sync functions
 */
export const profileSync = {
  async uploadProfile(profile: Profile, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      debug.debug('Stub: uploadProfile called');
      return;
    }

    if (!userId) {
      debug.debug('[profileSync.uploadProfile] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      debug.debug('[profileSync.uploadProfile] Uploading profile to Supabase', {
        userId: maskUserId(userId),
        email: maskEmail(profile.email),
        fullName: maskName(profile.fullName),
      });

      // Try to get session from auth store first (most reliable)
      // Import authStore to get current session
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() with retries
      if (!sessionToUse) {
        debug.debug('[profileSync.uploadProfile] Session not in auth store, trying getSession()');
        let sessionData: any = null;
        let sessionError: any = null;
        const maxRetries = 5;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          // @ts-ignore
          const result = await (supabase as any).auth.getSession();
          sessionData = result?.data;
          sessionError = result?.error;
          
          if (!sessionError && sessionData?.session) {
            sessionToUse = sessionData.session;
            debug.debug('[profileSync.uploadProfile] Session loaded from getSession()', {
              attempt,
              userId: maskUserId(sessionToUse.user?.id),
              matchesUploadUserId: sessionToUse.user?.id === userId,
            });
            break;
          }
          
          if (attempt < maxRetries) {
            debug.debug('[profileSync.uploadProfile] Session not found, retrying...', { attempt, error: sessionError });
            // Exponential backoff to allow session to propagate
            await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          }
        }
      }
      
      if (!sessionToUse) {
        debug.debug('[profileSync.uploadProfile] No session available, cannot upload profile');
        throw new Error('No active session - please sign in again');
      }
      
      // Ensure session is set on client before making request
      // This ensures the client will include the session token in the request
      debug.debug('[profileSync.uploadProfile] Ensuring session is set on client', {
        userId: sessionToUse.user?.id,
        hasAccessToken: !!sessionToUse.access_token,
        hasRefreshToken: !!sessionToUse.refresh_token,
      });
      
      // Set session with retries to ensure it's properly set
      let sessionSet = false;
      let setSessionError: any = null;
      const maxSetRetries = 3;
      for (let attempt = 1; attempt <= maxSetRetries; attempt++) {
        try {
          // @ts-ignore - supabase typings expect token pair
          const { data, error } = await (supabase as any).auth.setSession({
            access_token: sessionToUse.access_token,
            refresh_token: sessionToUse.refresh_token,
          });
          if (error) {
            setSessionError = error;
            debug.debug('[profileSync.uploadProfile] Error setting session (attempt ' + attempt + '):', error);
            if (attempt < maxSetRetries) {
              await new Promise(resolve => setTimeout(resolve, 200 * attempt));
            }
          } else if (data?.session) {
            sessionSet = true;
            setSessionError = null;
            sessionToUse = data.session;
            debug.debug('[profileSync.uploadProfile] Session set on client successfully (attempt ' + attempt + ')');
            break;
          } else {
            setSessionError = new Error('No session returned from setSession');
            debug.debug('[profileSync.uploadProfile] No session returned from setSession (attempt ' + attempt + ')');
            if (attempt < maxSetRetries) {
              await new Promise(resolve => setTimeout(resolve, 200 * attempt));
            }
          }
        } catch (err) {
          setSessionError = err;
          debug.debug('[profileSync.uploadProfile] Exception while setting session (attempt ' + attempt + '):', err);
          if (attempt < maxSetRetries) {
            await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          }
        }
      }
      
      if (!sessionSet) {
        debug.debug('[profileSync.uploadProfile] Failed to set session after retries:', setSessionError);
        throw new Error('Failed to set session - please try again');
      }
      
      // Instead of waiting for SecureStore to persist (which can be very slow),
      // we'll use the in-memory session to make an authenticated request
      // by manually setting the Authorization header via the REST API
      debug.debug('[profileSync.uploadProfile] Using direct REST API with in-memory session token');
      
      const accessToken = sessionToUse.access_token;
      if (!accessToken) {
        debug.debug('[profileSync.uploadProfile] No access token available in session');
        throw new Error('No access token available - please try signing in again');
      }
      
      // Make direct REST API call with Authorization header
      // This bypasses the need for getSession() to work (which requires SecureStore persistence)
      const restUrl = `${SUPABASE_URL}/rest/v1/profiles`;
      const apiKey = SUPABASE_ANON_KEY;
      
      const profileData = {
        user_id: userId,
        email: profile.email,
        display_name: profile.fullName,
        metadata: profile,
        updated_at: new Date().toISOString(),
      };
      
      debug.debug('[profileSync.uploadProfile] Making authenticated REST request', {
        url: restUrl.substring(0, 50) + '...',
        hasAccessToken: !!accessToken,
        hasApiKey: !!apiKey,
      });
      
      const response = await authenticatedFetch(restUrl, {
        method: 'POST',
        headers: {
          'Prefer': 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(profileData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        debug.debug('[profileSync.uploadProfile] REST request failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        const error = errorData;
        debug.error('[profileSync.uploadProfile] Error uploading profile:', error);
        throw error;
      }
      
      const data = await response.json();

      const uploadedUserId = data?.[0]?.user_id || userId;
      debug.debug('[profileSync.uploadProfile] Profile uploaded successfully to Supabase', {
        user_id: maskUserId(uploadedUserId),
        dataReceived: !!data,
      });
    } catch (error) {
      debug.error('[profileSync.uploadProfile] Failed to upload profile to Supabase:', error);
      // Don't throw - allow local save to continue even if sync fails
      // The caller will handle the error appropriately
    }
  },

  async downloadProfile(userId?: string | null): Promise<Profile | null> {
    if (!supabaseEnabled) {
      debug.debug('Stub: downloadProfile called');
      return null;
    }

    if (!userId) {
      debug.debug('[profileSync.downloadProfile] No userId provided, skipping Supabase download');
      return null;
    }

    try {
      debug.debug('[profileSync.downloadProfile] Downloading profile from Supabase', {
        userId: maskUserId(userId),
      });

      // Try to get session from auth store first
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() (but don't wait long)
      if (!sessionToUse) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        sessionToUse = result?.data?.session;
      }
      
      // Use direct REST API if we have a session, otherwise fall back to Supabase client
      if (sessionToUse?.access_token) {
        const accessToken = sessionToUse.access_token;
        const restUrl = `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&deleted_at=is.null&select=*`;
        const apiKey = SUPABASE_ANON_KEY;
        
        debug.debug('[profileSync.downloadProfile] Using direct REST API with session token');
        
        const response = await authenticatedFetch(restUrl, {
          method: 'GET',
        });
        
        if (!response.ok) {
          if (response.status === 404 || response.status === 406) {
            // No profile found - this is OK
            debug.debug('[profileSync.downloadProfile] No profile found in Supabase');
            return null;
          }
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          debug.error('[profileSync.downloadProfile] Error downloading profile:', errorData);
          throw errorData;
        }
        
        const dataArray = await response.json();
        const data = Array.isArray(dataArray) && dataArray.length > 0 ? dataArray[0] : null;
        
        if (!data || !data.metadata) {
          debug.debug('[profileSync.downloadProfile] Profile found but metadata is empty');
          return null;
        }

        debug.debug('[profileSync.downloadProfile] Profile downloaded successfully from Supabase', {
          user_id: maskUserId(data.user_id),
          email: maskEmail(data.email),
          display_name: maskName(data.display_name),
        });

        return data.metadata as Profile;
      } else {
        // Fallback to Supabase client (may fail if session not persisted yet)
        debug.debug('[profileSync.downloadProfile] No session available, using Supabase client (may fail)');
        // @ts-ignore
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No profile found - this is OK
            debug.debug('[profileSync.downloadProfile] No profile found in Supabase');
            return null;
          }
          debug.error('[profileSync.downloadProfile] Error downloading profile:', error);
          throw error;
        }

        if (!data || !data.metadata) {
          debug.debug('[profileSync.downloadProfile] Profile found but metadata is empty');
          return null;
        }

        debug.debug('[profileSync.downloadProfile] Profile downloaded successfully from Supabase', {
          user_id: maskUserId(data.user_id),
          email: maskEmail(data.email),
          display_name: maskName(data.display_name),
        });

        return data.metadata as Profile;
      }
    } catch (error) {
      debug.error('[profileSync.downloadProfile] Failed to download profile from Supabase:', error);
      // Don't throw - allow local load to continue even if sync fails
      return null;
    }
  },
};

/**
 * Overtime logs sync functions
 */
export const logsSync = {
  async uploadLog(log: OvertimeLog, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      return;
    }

    if (!userId) {
      debug.debug('[logsSync.uploadLog] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      // Convert minutes to hours for the hours field (for querying)
      const hours = log.minutesOvertime / 60;

      // Check if log already exists using authenticated REST API
      const checkUrl = `${SUPABASE_URL}/rest/v1/overtime_logs?user_id=eq.${userId}&extras->>id=eq.${log.id}&deleted_at=is.null&select=id&limit=1`;
      
      const checkResponse = await authenticatedFetch(checkUrl, {
        method: 'GET',
      });
      
      let existingId: string | null = null;
      if (checkResponse.ok) {
        const existingData = await checkResponse.json();
        if (Array.isArray(existingData) && existingData.length > 0) {
          existingId = existingData[0].id;
        }
      }

      const logData = {
        user_id: userId,
        date: log.date,
        hours: hours,
        rate: null, // Not used in our app
        notes: log.comments || null,
        extras: log, // Store full object including original ID in extras JSONB
        updated_at: log.updatedAt || new Date().toISOString(),
        deleted_at: log.deletedAt || null, // Include soft delete timestamp
      };

      let response: Response;
      if (existingId) {
        // Update existing log
        debug.debug('[logsSync.uploadLog] Updating existing log', { existingId, logId: log.id });
        const updateUrl = `${SUPABASE_URL}/rest/v1/overtime_logs?id=eq.${existingId}&select=*`;
        response = await authenticatedFetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(logData),
        });
      } else {
        // Insert new log
        debug.debug('[logsSync.uploadLog] Inserting new log', { logId: log.id });
        const insertUrl = `${SUPABASE_URL}/rest/v1/overtime_logs?select=*`;
        response = await authenticatedFetch(insertUrl, {
          method: 'POST',
          headers: {
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(logData),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        debug.error('[logsSync.uploadLog] Error uploading log:', errorData);
        throw errorData;
      }

      debug.debug('[logsSync.uploadLog] Log uploaded successfully to Supabase', {
        logId: log.id,
      });
    } catch (error) {
      debug.error('[logsSync.uploadLog] Failed to upload log to Supabase:', error);
      throw error;
    }
  },

  async uploadLogs(logs: OvertimeLog[], userId?: string | null): Promise<void> {
    if (!supabaseEnabled || !userId) {
      return;
    }

    try {
      debug.debug('[logsSync.uploadLogs] Uploading logs to Supabase', {
        count: logs.length,
        userId: userId.substring(0, 8) + '...',
      });

      // Upload logs in batches to avoid overwhelming the API
      const batchSize = 50;
      for (let i = 0; i < logs.length; i += batchSize) {
        const batch = logs.slice(i, i + batchSize);
        await Promise.all(batch.map(log => this.uploadLog(log, userId).catch(err => {
          debug.error(`[logsSync.uploadLogs] Failed to upload log ${log.id}:`, err);
          // Continue with other logs even if one fails
        })));
      }

      debug.debug('[logsSync.uploadLogs] All logs uploaded successfully');
    } catch (error) {
      debug.error('[logsSync.uploadLogs] Failed to upload logs:', error);
      throw error;
    }
  },

  async downloadLogs(userId?: string | null): Promise<OvertimeLog[]> {
    if (!supabaseEnabled) {
      return [];
    }

    if (!userId) {
      debug.debug('[logsSync.downloadLogs] No userId provided, skipping Supabase download');
      return [];
    }

    try {
      debug.debug('[logsSync.downloadLogs] Downloading logs from Supabase', {
        userId: userId.substring(0, 8) + '...',
      });

      // Get a valid access token (will refresh if expired)
      const accessToken = await getValidAccessToken();
      
      // Use direct REST API if we have a valid token, otherwise fall back to Supabase client
      if (accessToken) {
        const apiKey = SUPABASE_ANON_KEY;
        const restUrl = `${SUPABASE_URL}/rest/v1/overtime_logs?user_id=eq.${userId}&deleted_at=is.null&order=date.desc,created_at.desc&select=*`;
        
        debug.debug('[logsSync.downloadLogs] Using direct REST API with session token');
        
        // Use authenticatedFetch which handles token refresh automatically
        const response = await authenticatedFetch(restUrl, {
          method: 'GET',
        });
        
        if (!response.ok) {
          if (response.status === 404 || response.status === 406) {
            // No logs found - this is OK
            debug.debug('[logsSync.downloadLogs] No logs found in Supabase');
            return [];
          }
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          debug.error('[logsSync.downloadLogs] Error downloading logs:', errorData);
          throw errorData;
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data) || data.length === 0) {
          debug.debug('[logsSync.downloadLogs] No logs found in Supabase');
          return [];
        }

        // Extract full objects from extras JSONB
        const logs = data
          .map((row: any) => {
            if (row.extras && typeof row.extras === 'object') {
              return row.extras as OvertimeLog;
            }
            debug.debug('[logsSync.downloadLogs] Row missing extras:', { rowId: row.id, hasExtras: !!row.extras });
            return null;
          })
          .filter((log: OvertimeLog | null): log is OvertimeLog => log !== null);

        debug.debug('[logsSync.downloadLogs] Logs downloaded successfully from Supabase', {
          count: logs.length,
          rawCount: data.length,
        });

        return logs;
      } else {
        // Fallback to Supabase client (may fail if session not persisted yet)
        debug.debug('[logsSync.downloadLogs] No session available, using Supabase client (may fail)');
        // @ts-ignore
        const { data, error } = await supabase
          .from('overtime_logs')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          debug.error('[logsSync.downloadLogs] Error downloading logs:', error);
          throw error;
        }

        if (!data || data.length === 0) {
          debug.debug('[logsSync.downloadLogs] No logs found in Supabase');
          return [];
        }

        // Extract full objects from extras JSONB
        const logs = data
          .map((row: any) => {
            if (row.extras && typeof row.extras === 'object') {
              return row.extras as OvertimeLog;
            }
            debug.debug('[logsSync.downloadLogs] Row missing extras:', { rowId: row.id, hasExtras: !!row.extras });
            return null;
          })
          .filter((log: OvertimeLog | null): log is OvertimeLog => log !== null);

        debug.debug('[logsSync.downloadLogs] Logs downloaded successfully from Supabase', {
          count: logs.length,
          rawCount: data.length,
        });

        return logs;
      }
    } catch (error) {
      debug.error('[logsSync.downloadLogs] Failed to download logs from Supabase:', error);
      return [];
    }
  },

  async syncLogs(localLogs: OvertimeLog[], userId?: string | null): Promise<{
    uploaded: number;
    downloaded: number;
    conflicts: number;
  }> {
    if (!supabaseEnabled || !userId) {
      return { uploaded: 0, downloaded: 0, conflicts: 0 };
    }

    try {
      // Upload local logs
      await this.uploadLogs(localLogs, userId);
      const uploaded = localLogs.length;

      // Download remote logs
      const remoteLogs = await this.downloadLogs(userId);
      const downloaded = remoteLogs.length;

      // Simple conflict resolution: local wins (we already uploaded local)
      // In the future, we could implement more sophisticated conflict resolution
      const conflicts = 0;

      return { uploaded, downloaded, conflicts };
    } catch (error) {
      debug.error('[logsSync.syncLogs] Failed to sync logs:', error);
      return { uploaded: 0, downloaded: 0, conflicts: 0 };
    }
  },

  async deleteLog(logId: string, userId?: string | null): Promise<void> {
    if (!supabaseEnabled || !userId) {
      return;
    }

    try {
      // Find the log by user_id and extras.id
      // @ts-ignore
      const { data: existing } = await supabase
        .from('overtime_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('extras->>id', logId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        // Soft delete using RPC function to bypass RLS policy issues
        // @ts-ignore
        const { error } = await supabase.rpc('soft_delete_overtime_log', {
          log_uuid: existing.id,
        });

        if (error) {
          debug.error('[logsSync.deleteLog] Error deleting log:', error);
          throw error;
        }

        debug.debug('[logsSync.deleteLog] Log deleted successfully from Supabase', {
          logId,
        });
      }
    } catch (error) {
      debug.error('[logsSync.deleteLog] Failed to delete log from Supabase:', error);
      throw error;
    }
  },
};

/**
 * Shifts sync functions (for UsualShift patterns)
 */
export const shiftsSync = {
  async uploadShift(shift: UsualShift, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      return;
    }

    if (!userId) {
      debug.debug('[shiftsSync.uploadShift] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      // Check if shift already exists using authenticated REST API
      const checkUrl = `${SUPABASE_URL}/rest/v1/shifts?user_id=eq.${userId}&extras->>id=eq.${shift.id}&notes=eq.usual_shift_pattern&deleted_at=is.null&select=id&limit=1`;
      
      const checkResponse = await authenticatedFetch(checkUrl, {
        method: 'GET',
      });
      
      let existingId: string | null = null;
      if (checkResponse.ok) {
        const existingData = await checkResponse.json();
        if (Array.isArray(existingData) && existingData.length > 0) {
          existingId = existingData[0].id;
        }
      }

      const shiftData = {
        user_id: userId,
        start_at: new Date(shift.activeFrom).toISOString(), // Use activeFrom as start_at for querying
        end_at: shift.activeTo ? new Date(shift.activeTo).toISOString() : null,
        department: null,
        hospital: null,
        notes: 'usual_shift_pattern', // Marker to identify this as a UsualShift pattern
        extras: shift, // Store full UsualShift object in extras JSONB
        updated_at: new Date().toISOString(),
        deleted_at: shift.deletedAt || null, // Include soft delete timestamp
      };

      let response: Response;
      if (existingId) {
        // Update existing shift
        debug.debug('[shiftsSync.uploadShift] Updating existing shift', { existingId, shiftId: shift.id });
        const updateUrl = `${SUPABASE_URL}/rest/v1/shifts?id=eq.${existingId}&select=*`;
        response = await authenticatedFetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(shiftData),
        });
      } else {
        // Insert new shift
        debug.debug('[shiftsSync.uploadShift] Inserting new shift', { shiftId: shift.id });
        const insertUrl = `${SUPABASE_URL}/rest/v1/shifts?select=*`;
        response = await authenticatedFetch(insertUrl, {
          method: 'POST',
          headers: {
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(shiftData),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        debug.error('[shiftsSync.uploadShift] Error uploading shift:', errorData);
        throw errorData;
      }

      debug.debug('[shiftsSync.uploadShift] Shift uploaded successfully to Supabase', {
        shiftId: shift.id,
      });
    } catch (error) {
      debug.error('[shiftsSync.uploadShift] Failed to upload shift to Supabase:', error);
      throw error;
    }
  },

  async uploadShifts(shifts: UsualShift[], userId?: string | null): Promise<void> {
    if (!supabaseEnabled || !userId) {
      return;
    }

    try {
      debug.debug('[shiftsSync.uploadShifts] Uploading shifts to Supabase', {
        count: shifts.length,
        userId: userId.substring(0, 8) + '...',
      });

      // Upload shifts in parallel
      await Promise.all(shifts.map(shift => this.uploadShift(shift, userId).catch(err => {
        debug.error(`[shiftsSync.uploadShifts] Failed to upload shift ${shift.id}:`, err);
        // Continue with other shifts even if one fails
      })));

      debug.debug('[shiftsSync.uploadShifts] All shifts uploaded successfully');
    } catch (error) {
      debug.error('[shiftsSync.uploadShifts] Failed to upload shifts:', error);
      throw error;
    }
  },

  async downloadShifts(userId?: string | null): Promise<UsualShift[]> {
    if (!supabaseEnabled) {
      return [];
    }

    if (!userId) {
      debug.debug('[shiftsSync.downloadShifts] No userId provided, skipping Supabase download');
      return [];
    }

    try {
      debug.debug('[shiftsSync.downloadShifts] Downloading shifts from Supabase', {
        userId: userId.substring(0, 8) + '...',
      });

      // Get session from auth store
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() (but don't wait long)
      if (!sessionToUse) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        sessionToUse = result?.data?.session;
      }
      
      // Use direct REST API if we have a session, otherwise fall back to Supabase client
      if (sessionToUse?.access_token) {
        const accessToken = sessionToUse.access_token;
        const apiKey = SUPABASE_ANON_KEY;
        const restUrl = `${SUPABASE_URL}/rest/v1/shifts?user_id=eq.${userId}&notes=eq.usual_shift_pattern&deleted_at=is.null&order=start_at.desc&select=*`;
        
        debug.debug('[shiftsSync.downloadShifts] Using direct REST API with session token');
        
        const response = await authenticatedFetch(restUrl, {
          method: 'GET',
        });
        
        if (!response.ok) {
          if (response.status === 404 || response.status === 406) {
            // No shifts found - this is OK
            debug.debug('[shiftsSync.downloadShifts] No shifts found in Supabase');
            return [];
          }
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          debug.error('[shiftsSync.downloadShifts] Error downloading shifts:', errorData);
          throw errorData;
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data) || data.length === 0) {
          debug.debug('[shiftsSync.downloadShifts] No shifts found in Supabase');
          return [];
        }

        // Extract full UsualShift objects from extras JSONB
        const shifts = data
          .map((row: any) => {
            if (row.extras && typeof row.extras === 'object') {
              return row.extras as UsualShift;
            }
            debug.debug('[shiftsSync.downloadShifts] Row missing extras:', { rowId: row.id, hasExtras: !!row.extras });
            return null;
          })
          .filter((shift: UsualShift | null): shift is UsualShift => shift !== null);

        debug.debug('[shiftsSync.downloadShifts] Shifts downloaded successfully from Supabase', {
          count: shifts.length,
          rawCount: data.length,
        });

        return shifts;
      } else {
        // Fallback to Supabase client (may fail if session not persisted yet)
        debug.debug('[shiftsSync.downloadShifts] No session available, using Supabase client (may fail)');
        // @ts-ignore
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('user_id', userId)
          .eq('notes', 'usual_shift_pattern') // Only get UsualShift patterns
          .is('deleted_at', null)
          .order('start_at', { ascending: false });

        if (error) {
          debug.error('[shiftsSync.downloadShifts] Error downloading shifts:', error);
          throw error;
        }

        if (!data || data.length === 0) {
          debug.debug('[shiftsSync.downloadShifts] No shifts found in Supabase');
          return [];
        }

        // Extract full UsualShift objects from extras JSONB
        const shifts = data
          .map((row: any) => {
            if (row.extras && typeof row.extras === 'object') {
              return row.extras as UsualShift;
            }
            debug.debug('[shiftsSync.downloadShifts] Row missing extras:', { rowId: row.id, hasExtras: !!row.extras });
            return null;
          })
          .filter((shift: UsualShift | null): shift is UsualShift => shift !== null);

        debug.debug('[shiftsSync.downloadShifts] Shifts downloaded successfully from Supabase', {
          count: shifts.length,
          rawCount: data.length,
        });

        return shifts;
      }
    } catch (error) {
      debug.error('[shiftsSync.downloadShifts] Failed to download shifts from Supabase:', error);
      return [];
    }
  },

  async deleteShift(shiftId: string, userId?: string | null): Promise<void> {
    if (!supabaseEnabled || !userId) {
      return;
    }

    try {
      // Find the shift by user_id and extras.id
      // @ts-ignore
      const { data: existing } = await supabase
        .from('shifts')
        .select('id')
        .eq('user_id', userId)
        .eq('extras->>id', shiftId)
        .eq('notes', 'usual_shift_pattern')
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        // Soft delete using RPC function to bypass RLS policy issues
        // @ts-ignore
        const { error } = await supabase.rpc('soft_delete_shift', {
          shift_uuid: existing.id,
        });

        if (error) {
          debug.error('[shiftsSync.deleteShift] Error deleting shift:', error);
          throw error;
        }

        debug.debug('[shiftsSync.deleteShift] Shift deleted successfully from Supabase', {
          shiftId,
        });
      }
    } catch (error) {
      debug.error('[shiftsSync.deleteShift] Failed to delete shift from Supabase:', error);
      throw error;
    }
  },
};

/**
 * Shift templates sync functions (for ShiftTemplate)
 */
export const shiftTemplatesSync = {
  async uploadTemplate(template: ShiftTemplate, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      return;
    }

    if (!userId) {
      debug.debug('[shiftTemplatesSync.uploadTemplate] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      // Get session from auth store
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() (but don't wait long)
      if (!sessionToUse) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        sessionToUse = result?.data?.session;
      }
      
      if (!sessionToUse?.access_token) {
        debug.debug('[shiftTemplatesSync.uploadTemplate] No session available, cannot upload template');
        throw new Error('No active session - please sign in again');
      }

      const accessToken = sessionToUse.access_token;
      const apiKey = SUPABASE_ANON_KEY;
      
      // Check if template already exists using direct REST API
      const checkUrl = `${SUPABASE_URL}/rest/v1/shifts?user_id=eq.${userId}&extras->>id=eq.${template.id}&notes=eq.shift_template&deleted_at=is.null&select=id&limit=1`;
      
      const checkResponse = await authenticatedFetch(checkUrl, {
        method: 'GET',
      });
      
      let existingId: string | null = null;
      if (checkResponse.ok) {
        const existingData = await checkResponse.json();
        if (Array.isArray(existingData) && existingData.length > 0) {
          existingId = existingData[0].id;
        }
      }

      // Store template in shifts table with notes='shift_template' marker
      // Use a dummy date for start_at/end_at since templates don't have dates
      const templateData = {
        user_id: userId,
        start_at: new Date().toISOString(), // Dummy date for querying
        end_at: null,
        department: null,
        hospital: null,
        notes: 'shift_template', // Marker to identify this as a ShiftTemplate
        extras: template, // Store full ShiftTemplate object in extras JSONB
        updated_at: new Date().toISOString(),
        deleted_at: template.deletedAt || null, // Include soft delete timestamp
      };

      let response: Response;
      if (existingId) {
        // Update existing template
        debug.debug('[shiftTemplatesSync.uploadTemplate] Updating existing template', { existingId, templateId: template.id });
        const updateUrl = `${SUPABASE_URL}/rest/v1/shifts?id=eq.${existingId}&select=*`;
        response = await authenticatedFetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(templateData),
        });
      } else {
        // Insert new template
        debug.debug('[shiftTemplatesSync.uploadTemplate] Inserting new template', { templateId: template.id });
        const insertUrl = `${SUPABASE_URL}/rest/v1/shifts?select=*`;
        response = await authenticatedFetch(insertUrl, {
          method: 'POST',
          headers: {
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(templateData),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        debug.error('[shiftTemplatesSync.uploadTemplate] Error uploading template:', errorData);
        throw errorData;
      }

      debug.debug('[shiftTemplatesSync.uploadTemplate] Template uploaded successfully to Supabase', {
        templateId: template.id,
      });
    } catch (error) {
      debug.error('[shiftTemplatesSync.uploadTemplate] Failed to upload template to Supabase:', error);
      throw error;
    }
  },

  async downloadTemplates(userId?: string | null): Promise<ShiftTemplate[]> {
    if (!supabaseEnabled) {
      return [];
    }

    if (!userId) {
      debug.debug('[shiftTemplatesSync.downloadTemplates] No userId provided, skipping Supabase sync');
      return [];
    }

    try {
      // Get session from auth store
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() (but don't wait long)
      if (!sessionToUse) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        sessionToUse = result?.data?.session;
      }
      
      if (!sessionToUse?.access_token) {
        debug.debug('[shiftTemplatesSync.downloadTemplates] No session available, cannot download templates');
        return [];
      }

      const accessToken = sessionToUse.access_token;
      const apiKey = SUPABASE_ANON_KEY;
      
      // Fetch templates from shifts table where notes='shift_template'
      const url = `${SUPABASE_URL}/rest/v1/shifts?user_id=eq.${userId}&notes=eq.shift_template&deleted_at=is.null&select=*&order=created_at.desc`;
      
      const response = await authenticatedFetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        debug.error('[shiftTemplatesSync.downloadTemplates] Error downloading templates:', errorText);
        return [];
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        debug.debug('[shiftTemplatesSync.downloadTemplates] Invalid response format, returning empty array');
        return [];
      }

      // Extract templates from extras JSONB field
      const templates: ShiftTemplate[] = data
        .map((row: any) => {
          try {
            const template = row.extras as ShiftTemplate;
            if (template && template.id && template.label) {
              return template;
            }
            return null;
          } catch (error) {
            debug.error('[shiftTemplatesSync.downloadTemplates] Error parsing template:', error);
            return null;
          }
        })
        .filter((template: ShiftTemplate | null): template is ShiftTemplate => template !== null);

      debug.debug('[shiftTemplatesSync.downloadTemplates] Downloaded templates from Supabase', {
        count: templates.length,
      });

      return templates;
    } catch (error) {
      debug.error('[shiftTemplatesSync.downloadTemplates] Failed to download templates from Supabase:', error);
      return [];
    }
  },

  async deleteTemplate(templateId: string, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      return;
    }

    if (!userId) {
      debug.debug('[shiftTemplatesSync.deleteTemplate] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      // Get session from auth store
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() (but don't wait long)
      if (!sessionToUse) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        sessionToUse = result?.data?.session;
      }
      
      if (!sessionToUse?.access_token) {
        debug.debug('[shiftTemplatesSync.deleteTemplate] No session available, cannot delete template');
        throw new Error('No active session - please sign in again');
      }

      const accessToken = sessionToUse.access_token;
      const apiKey = SUPABASE_ANON_KEY;
      
      // Find template by extras->>id and notes='shift_template'
      const findUrl = `${SUPABASE_URL}/rest/v1/shifts?user_id=eq.${userId}&extras->>id=eq.${templateId}&notes=eq.shift_template&deleted_at=is.null&select=id&limit=1`;
      
      const findResponse = await authenticatedFetch(findUrl, {
        method: 'GET',
      });

      if (!findResponse.ok) {
        const errorText = await findResponse.text();
        debug.error('[shiftTemplatesSync.deleteTemplate] Error finding template:', errorText);
        throw new Error('Failed to find template');
      }

      const findData = await findResponse.json();
      
      if (!Array.isArray(findData) || findData.length === 0) {
        debug.debug('[shiftTemplatesSync.deleteTemplate] Template not found in Supabase', { templateId });
        return;
      }

      const supabaseId = findData[0].id;

      // Soft delete by setting deleted_at
      const deleteUrl = `${SUPABASE_URL}/rest/v1/shifts?id=eq.${supabaseId}`;
      const deleteResponse = await authenticatedFetch(deleteUrl, {
        method: 'PATCH',
        headers: {
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          deleted_at: new Date().toISOString(),
        }),
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        debug.error('[shiftTemplatesSync.deleteTemplate] Error deleting template:', errorData);
        throw errorData;
      }

      debug.debug('[shiftTemplatesSync.deleteTemplate] Template deleted successfully from Supabase', {
        templateId,
      });
    } catch (error) {
      debug.error('[shiftTemplatesSync.deleteTemplate] Failed to delete template from Supabase:', error);
      throw error;
    }
  },
};

/**
 * Log templates sync functions (for LogTemplate)
 */
export const logTemplatesSync = {
  async uploadTemplate(template: LogTemplate, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      return;
    }

    if (!userId) {
      debug.debug('[logTemplatesSync.uploadTemplate] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      // Get session from auth store
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() (but don't wait long)
      if (!sessionToUse) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        sessionToUse = result?.data?.session;
      }
      
      if (!sessionToUse?.access_token) {
        debug.debug('[logTemplatesSync.uploadTemplate] No session available, cannot upload template');
        throw new Error('No active session - please sign in again');
      }

      const accessToken = sessionToUse.access_token;
      const apiKey = SUPABASE_ANON_KEY;
      
      // Check if template already exists using direct REST API
      const checkUrl = `${SUPABASE_URL}/rest/v1/shifts?user_id=eq.${userId}&extras->>id=eq.${template.id}&notes=eq.log_template&deleted_at=is.null&select=id&limit=1`;
      
      const checkResponse = await authenticatedFetch(checkUrl, {
        method: 'GET',
      });
      
      let existingId: string | null = null;
      if (checkResponse.ok) {
        const existingData = await checkResponse.json();
        if (Array.isArray(existingData) && existingData.length > 0) {
          existingId = existingData[0].id;
        }
      }

      // Store template in shifts table with notes='log_template' marker
      // Use a dummy date for start_at/end_at since templates don't have dates
      const templateData = {
        user_id: userId,
        start_at: new Date().toISOString(), // Dummy date for querying
        end_at: null,
        department: null,
        hospital: null,
        notes: 'log_template', // Marker to identify this as a LogTemplate
        extras: template, // Store full LogTemplate object in extras JSONB
        updated_at: new Date().toISOString(),
        deleted_at: template.deletedAt || null, // Include soft delete timestamp
      };

      let response: Response;
      if (existingId) {
        // Update existing template
        debug.debug('[logTemplatesSync.uploadTemplate] Updating existing template', { existingId, templateId: template.id });
        const updateUrl = `${SUPABASE_URL}/rest/v1/shifts?id=eq.${existingId}&select=*`;
        response = await authenticatedFetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(templateData),
        });
      } else {
        // Insert new template
        debug.debug('[logTemplatesSync.uploadTemplate] Inserting new template', { templateId: template.id });
        const insertUrl = `${SUPABASE_URL}/rest/v1/shifts?select=*`;
        response = await authenticatedFetch(insertUrl, {
          method: 'POST',
          headers: {
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(templateData),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        debug.error('[logTemplatesSync.uploadTemplate] Error uploading template:', errorData);
        throw errorData;
      }

      debug.debug('[logTemplatesSync.uploadTemplate] Template uploaded successfully to Supabase', {
        templateId: template.id,
      });
    } catch (error) {
      debug.error('[logTemplatesSync.uploadTemplate] Failed to upload template to Supabase:', error);
      throw error;
    }
  },

  async downloadTemplates(userId?: string | null): Promise<LogTemplate[]> {
    if (!supabaseEnabled) {
      return [];
    }

    if (!userId) {
      debug.debug('[logTemplatesSync.downloadTemplates] No userId provided, skipping Supabase sync');
      return [];
    }

    try {
      // Get session from auth store
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() (but don't wait long)
      if (!sessionToUse) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        sessionToUse = result?.data?.session;
      }
      
      if (!sessionToUse?.access_token) {
        debug.debug('[logTemplatesSync.downloadTemplates] No session available, cannot download templates');
        return [];
      }

      const accessToken = sessionToUse.access_token;
      const apiKey = SUPABASE_ANON_KEY;
      
      // Fetch templates from shifts table where notes='log_template'
      const url = `${SUPABASE_URL}/rest/v1/shifts?user_id=eq.${userId}&notes=eq.log_template&deleted_at=is.null&select=*&order=created_at.desc`;
      
      const response = await authenticatedFetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        debug.error('[logTemplatesSync.downloadTemplates] Error downloading templates:', errorText);
        return [];
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        debug.debug('[logTemplatesSync.downloadTemplates] Invalid response format, returning empty array');
        return [];
      }

      // Extract templates from extras JSONB field
      const templates: LogTemplate[] = data
        .map((row: any) => {
          try {
            const template = row.extras as LogTemplate;
            if (template && template.id && template.name) {
              return template;
            }
            return null;
          } catch (error) {
            debug.error('[logTemplatesSync.downloadTemplates] Error parsing template:', error);
            return null;
          }
        })
        .filter((template: LogTemplate | null): template is LogTemplate => template !== null);

      debug.debug('[logTemplatesSync.downloadTemplates] Downloaded templates from Supabase', {
        count: templates.length,
      });

      return templates;
    } catch (error) {
      debug.error('[logTemplatesSync.downloadTemplates] Failed to download templates from Supabase:', error);
      return [];
    }
  },

  async deleteTemplate(templateId: string, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      return;
    }

    if (!userId) {
      debug.debug('[logTemplatesSync.deleteTemplate] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      // Get session from auth store
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() (but don't wait long)
      if (!sessionToUse) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        sessionToUse = result?.data?.session;
      }
      
      if (!sessionToUse?.access_token) {
        debug.debug('[logTemplatesSync.deleteTemplate] No session available, cannot delete template');
        throw new Error('No active session - please sign in again');
      }

      const accessToken = sessionToUse.access_token;
      const apiKey = SUPABASE_ANON_KEY;
      
      // Find template by extras->>id and notes='log_template'
      const findUrl = `${SUPABASE_URL}/rest/v1/shifts?user_id=eq.${userId}&extras->>id=eq.${templateId}&notes=eq.log_template&deleted_at=is.null&select=id&limit=1`;
      
      const findResponse = await authenticatedFetch(findUrl, {
        method: 'GET',
      });

      if (!findResponse.ok) {
        const errorText = await findResponse.text();
        debug.error('[logTemplatesSync.deleteTemplate] Error finding template:', errorText);
        throw new Error('Failed to find template');
      }

      const findData = await findResponse.json();
      
      if (!Array.isArray(findData) || findData.length === 0) {
        debug.debug('[logTemplatesSync.deleteTemplate] Template not found in Supabase', { templateId });
        return;
      }

      const supabaseId = findData[0].id;

      // Soft delete by setting deleted_at
      const deleteUrl = `${SUPABASE_URL}/rest/v1/shifts?id=eq.${supabaseId}`;
      const deleteResponse = await authenticatedFetch(deleteUrl, {
        method: 'PATCH',
        headers: {
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          deleted_at: new Date().toISOString(),
        }),
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        debug.error('[logTemplatesSync.deleteTemplate] Error deleting template:', errorData);
        throw errorData;
      }

      debug.debug('[logTemplatesSync.deleteTemplate] Template deleted successfully from Supabase', {
        templateId,
      });
    } catch (error) {
      debug.error('[logTemplatesSync.deleteTemplate] Failed to delete template from Supabase:', error);
      throw error;
    }
  },
};

/**
 * Export batches sync functions
 */
export const exportSync = {
  async uploadExportBatch(batch: ExportBatch, userId?: string | null): Promise<ExportBatch | undefined> {
    if (!supabaseEnabled) {
      return;
    }

    if (!userId) {
      debug.debug('[exportSync.uploadExportBatch] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      // Check if PDF needs to be uploaded to cloud storage
      let remoteUri = batch.pdfUri;
      const { uploadPDFToStorage, isLocalPath, isCloudURL, isStoragePath } = await import('./storage/pdfStorage');

      if (batch.pdfUri) {
        if (isLocalPath(batch.pdfUri)) {
          try {
            remoteUri = await uploadPDFToStorage(batch.pdfUri, batch.id, userId);
          } catch (uploadError) {
            debug.error('[exportSync.uploadExportBatch] Failed to upload PDF to storage:', uploadError);
            // Continue with local path if upload fails - will retry later via sync queue
            remoteUri = batch.pdfUri;
          }
        } else if (isStoragePath(batch.pdfUri) || isCloudURL(batch.pdfUri)) {
          remoteUri = batch.pdfUri;
        }
      }

      // Get session from auth store
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() (but don't wait long)
      if (!sessionToUse) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        sessionToUse = result?.data?.session;
      }
      
      if (!sessionToUse?.access_token) {
        debug.debug('[exportSync.uploadExportBatch] No session available, cannot upload export batch');
        throw new Error('No active session - please sign in again');
      }

      const accessToken = sessionToUse.access_token;
      const apiKey = SUPABASE_ANON_KEY;
      
      // Check if batch already exists using direct REST API
      const checkUrl = `${SUPABASE_URL}/rest/v1/export_batches?user_id=eq.${userId}&params->>id=eq.${batch.id}&deleted_at=is.null&select=id&limit=1`;
      
      const checkResponse = await authenticatedFetch(checkUrl, {
        method: 'GET',
      });
      
      let existingId: string | null = null;
      if (checkResponse.ok) {
        const existingData = await checkResponse.json();
        if (Array.isArray(existingData) && existingData.length > 0) {
          existingId = existingData[0].id;
        }
      }

      // Update batch with cloud URL (keep local path in params for backward compatibility)
      const batchWithRemoteUri = {
        ...batch,
        pdfUri: remoteUri,
      };

      const batchData = {
        user_id: userId,
        requested_at: batch.createdAt,
        status: 'ready', // Default status for export batches
        result_url: remoteUri,
        error: null,
        params: batchWithRemoteUri,
        updated_at: new Date().toISOString(),
        deleted_at: batch.deletedAt || null, // Include soft delete timestamp
      };

      let response: Response;
      if (existingId) {
        // Update existing batch
        debug.debug('[exportSync.uploadExportBatch] Updating existing batch', { existingId, batchId: batch.id });
        const updateUrl = `${SUPABASE_URL}/rest/v1/export_batches?id=eq.${existingId}&select=*`;
        response = await authenticatedFetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(batchData),
        });
      } else {
        // Insert new batch
        debug.debug('[exportSync.uploadExportBatch] Inserting new batch', { batchId: batch.id });
        const insertUrl = `${SUPABASE_URL}/rest/v1/export_batches?select=*`;
        response = await authenticatedFetch(insertUrl, {
          method: 'POST',
          headers: {
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(batchData),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        debug.error('[exportSync.uploadExportBatch] Error uploading export batch:', errorData);
        throw errorData;
      }

      // Return updated batch with storage reference
      return batchWithRemoteUri;
    } catch (error) {
      debug.error('[exportSync.uploadExportBatch] Failed to upload export batch to Supabase:', error);
      throw error;
    }
  },

  async downloadExportBatches(userId?: string | null): Promise<ExportBatch[]> {
    if (!supabaseEnabled) {
      return [];
    }

    if (!userId) {
      debug.debug('[exportSync.downloadExportBatches] No userId provided, skipping Supabase download');
      return [];
    }

    try {
      debug.debug('[exportSync.downloadExportBatches] Downloading export batches from Supabase', {
        userId: userId.substring(0, 8) + '...',
      });

      // Get session from auth store
      const { useAuthStore } = await import('./state/authStore');
      const authState = useAuthStore.getState();
      let sessionToUse = authState.session;
      
      // If not in auth store, try getSession() (but don't wait long)
      if (!sessionToUse) {
        // @ts-ignore
        const result = await (supabase as any).auth.getSession();
        sessionToUse = result?.data?.session;
      }
      
      // Use direct REST API if we have a session, otherwise fall back to Supabase client
      if (sessionToUse?.access_token) {
        const accessToken = sessionToUse.access_token;
        const apiKey = SUPABASE_ANON_KEY;
        const restUrl = `${SUPABASE_URL}/rest/v1/export_batches?user_id=eq.${userId}&deleted_at=is.null&order=requested_at.desc&select=*`;
        
        debug.debug('[exportSync.downloadExportBatches] Using direct REST API with session token');
        
        const response = await authenticatedFetch(restUrl, {
          method: 'GET',
        });
        
        if (!response.ok) {
          if (response.status === 404 || response.status === 406) {
            // No export batches found - this is OK
            debug.debug('[exportSync.downloadExportBatches] No export batches found in Supabase');
            return [];
          }
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          debug.error('[exportSync.downloadExportBatches] Error downloading export batches:', errorData);
          throw errorData;
        }
        
        const data = await response.json();
        
        if (!data || !Array.isArray(data) || data.length === 0) {
          debug.debug('[exportSync.downloadExportBatches] No export batches found in Supabase');
          return [];
        }

        const { isCloudURL } = await import('./storage/pdfStorage');
        // Extract full ExportBatch objects from params JSONB
        const batches = data
          .map((row: any) => {
            if (row.params && typeof row.params === 'object') {
              const batch = row.params as ExportBatch;

              if (row.result_url && isCloudURL(row.result_url)) {
                batch.pdfUri = row.result_url;
              } else if (batch.pdfUri) {
                batch.pdfUri = batch.pdfUri;
              }

              return batch;
            }
            debug.debug('[exportSync.downloadExportBatches] Row missing params:', { rowId: row.id, hasParams: !!row.params });
            return null;
          })
          .filter((batch: ExportBatch | null): batch is ExportBatch => batch !== null);

        debug.debug('[exportSync.downloadExportBatches] Export batches downloaded successfully from Supabase', {
          count: batches.length,
          rawCount: data.length,
        });

        return batches;
      } else {
        // Fallback to Supabase client (may fail if session not persisted yet)
        debug.debug('[exportSync.downloadExportBatches] No session available, using Supabase client (may fail)');
        // @ts-ignore
        const { data, error } = await supabase
          .from('export_batches')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('requested_at', { ascending: false });

        if (error) {
          debug.error('[exportSync.downloadExportBatches] Error downloading export batches:', error);
          throw error;
        }

        if (!data || data.length === 0) {
          debug.debug('[exportSync.downloadExportBatches] No export batches found in Supabase');
          return [];
        }

        const { isCloudURL } = await import('./storage/pdfStorage');
        // Extract full ExportBatch objects from params JSONB
        const batches = data
          .map((row: any) => {
            if (row.params && typeof row.params === 'object') {
              const batch = row.params as ExportBatch;

              if (row.result_url && isCloudURL(row.result_url)) {
                batch.pdfUri = row.result_url;
              } else if (batch.pdfUri) {
                batch.pdfUri = batch.pdfUri;
              }

              return batch;
            }
            debug.debug('[exportSync.downloadExportBatches] Row missing params:', { rowId: row.id, hasParams: !!row.params });
            return null;
          })
          .filter((batch: ExportBatch | null): batch is ExportBatch => batch !== null);

        debug.debug('[exportSync.downloadExportBatches] Export batches downloaded successfully from Supabase', {
          count: batches.length,
          rawCount: data.length,
        });

        return batches;
      }
    } catch (error) {
      debug.error('[exportSync.downloadExportBatches] Failed to download export batches from Supabase:', error);
      return [];
    }
  },

  async deleteExportBatch(batchId: string, userId?: string | null): Promise<void> {
    if (!supabaseEnabled || !userId) {
      return;
    }

    try {
      // Find the batch by user_id and params.id
      // @ts-ignore
      const { data: existing } = await supabase
        .from('export_batches')
        .select('id')
        .eq('user_id', userId)
        .eq('params->>id', batchId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        // Soft delete using RPC function to bypass RLS policy issues
        // @ts-ignore
        const { error } = await supabase.rpc('soft_delete_export_batch', {
          batch_uuid: existing.id,
        });

        if (error) {
          debug.error('[exportSync.deleteExportBatch] Error deleting export batch:', error);
          throw error;
        }

        debug.debug('[exportSync.deleteExportBatch] Export batch deleted successfully from Supabase', {
          batchId,
        });
      }
    } catch (error) {
      debug.error('[exportSync.deleteExportBatch] Failed to delete export batch from Supabase:', error);
      throw error;
    }
  },
};

/**
 * Full sync function
 */
export const sync = {
  async fullSync(userId?: string | null): Promise<{
    success: boolean;
    profile: boolean;
    logs: boolean;
    shifts: boolean;
    exports: boolean;
    error?: string;
  }> {
    if (!supabaseEnabled) {
      return {
        success: false,
        profile: false,
        logs: false,
        shifts: false,
        exports: false,
        error: 'Supabase not configured'
      };
    }

    if (!userId) {
      return {
        success: false,
        profile: false,
        logs: false,
        shifts: false,
        exports: false,
        error: 'User ID required for sync'
      };
    }
    
    try {
      debug.debug('[sync.fullSync] Starting full sync for user:', userId.substring(0, 8) + '...');
      
      // Check connection first
      const isConnected = await sync.checkConnection();
      if (!isConnected) {
        return {
          success: false,
          profile: false,
          logs: false,
          shifts: false,
          exports: false,
          error: 'Cannot connect to Supabase'
        };
      }

      // Import stores to get current data
      const { useLogsStore } = await import('./state/logsStore');
      const { useShiftsStore } = await import('./state/shiftsStore');
      const { useProfileStore } = await import('./state/profileStore');
      
      const logsStore = useLogsStore.getState();
      const shiftsStore = useShiftsStore.getState();
      const profileStore = useProfileStore.getState();
      
      // Upload all local data
      const localLogs = logsStore.logs;
      const localShifts = shiftsStore.shifts;
      const localProfile = profileStore.profile;
      const localBatches = logsStore.exportBatches;
      
      // Upload logs
      let logsSuccess = true;
      try {
        await logsSync.uploadLogs(localLogs, userId);
        debug.debug('[sync.fullSync] Uploaded logs:', localLogs.length);
      } catch (error) {
        debug.error('[sync.fullSync] Failed to upload logs:', error);
        logsSuccess = false;
      }
      
      // Upload shifts
      let shiftsSuccess = true;
      try {
        await shiftsSync.uploadShifts(localShifts, userId);
        debug.debug('[sync.fullSync] Uploaded shifts:', localShifts.length);
      } catch (error) {
        debug.error('[sync.fullSync] Failed to upload shifts:', error);
        shiftsSuccess = false;
      }
      
      // Upload profile
      let profileSuccess = true;
      if (localProfile) {
        try {
          await profileSync.uploadProfile(localProfile, userId);
          debug.debug('[sync.fullSync] Uploaded profile');
        } catch (error) {
          debug.error('[sync.fullSync] Failed to upload profile:', error);
          profileSuccess = false;
        }
      }
      
      // Upload export batches (only upload PDFs that haven't been uploaded yet)
      let exportsSuccess = true;
      try {
        for (const batch of localBatches) {
          // Only upload if PDF is local (not already in cloud)
          // Check if pdfUri is a local path - if so, upload will happen in uploadExportBatch
          await exportSync.uploadExportBatch(batch, userId);
        }
        debug.debug('[sync.fullSync] Uploaded export batches:', localBatches.length);
      } catch (error) {
        debug.error('[sync.fullSync] Failed to upload export batches:', error);
        exportsSuccess = false;
      }
      
      // Download remote data
      try {
        const remoteLogs = await logsSync.downloadLogs(userId);
        const remoteShifts = await shiftsSync.downloadShifts(userId);
        const remoteProfile = await profileSync.downloadProfile(userId);
        const remoteBatches = await exportSync.downloadExportBatches(userId);
        
        // Merge with timestamp-based conflict resolution
        // Logs: merge with timestamp comparison
        const mergedLogs = sync.mergeLogsWithTimestamps(localLogs, remoteLogs);
        for (const log of mergedLogs) {
          const localLog = localLogs.find(l => l.id === log.id);
          const remoteLog = remoteLogs.find(l => l.id === log.id);
          
          if (localLog && remoteLog) {
            const localTime = new Date(localLog.updatedAt || localLog.createdAt);
            const remoteTime = new Date(remoteLog.updatedAt || remoteLog.createdAt);
            
            if (localTime > remoteTime) {
              // Local is newer - upload it
              await logsSync.uploadLog(localLog, userId).catch(() => {});
            } else {
              // Remote is newer - save it locally
              await database.updateOvertimeLog(remoteLog, userId).catch(() => {});
            }
          } else if (remoteLog) {
            // New remote log - save locally
            await database.createOvertimeLog(remoteLog, userId).catch(() => {});
          }
        }
        
        // Shifts: merge with timestamp comparison
        const mergedShifts = sync.mergeShiftsWithTimestamps(localShifts, remoteShifts);
        for (const shift of mergedShifts) {
          const localShift = localShifts.find(s => s.id === shift.id);
          const remoteShift = remoteShifts.find(s => s.id === shift.id);
          
          if (localShift && remoteShift) {
            // Compare by activeFrom (proxy for timestamp)
            const localTime = new Date(localShift.activeFrom);
            const remoteTime = new Date(remoteShift.activeFrom);
            
            if (localTime > remoteTime) {
              // Local is newer - upload it
              await shiftsSync.uploadShift(localShift, userId).catch(() => {});
            } else {
              // Remote is newer - save it locally
              await database.updateUsualShift(remoteShift, userId).catch(() => {});
            }
          } else if (remoteShift) {
            // New remote shift - save locally
            await database.createUsualShift(remoteShift, userId).catch(() => {});
          }
        }
        
        // Profile: use newer version
        if (remoteProfile && localProfile) {
          // Compare timestamps if available (Supabase stores updated_at)
          // For now, prefer remote if it exists
          await profileStorage.saveProfile(remoteProfile, userId).catch(() => {});
        } else if (remoteProfile) {
          await profileStorage.saveProfile(remoteProfile, userId).catch(() => {});
        }
        
        // Download cloud PDFs to local cache for offline access
        const { downloadPDFFromStorage, isCloudURL } = await import('./storage/pdfStorage');
        const { getExportFileName } = await import('./utils/exportFilename');
        // Get profile for filename generation (optional - will fall back to batch ID if not available)
        const profile = remoteProfile || localProfile || null;
        for (const batch of remoteBatches) {
          if (batch.pdfUri && isCloudURL(batch.pdfUri)) {
            try {
              // Get the preferred filename from export batch
              const preferredFileName = getExportFileName(batch, profile);
              await downloadPDFFromStorage(batch.pdfUri, batch.id, preferredFileName);
              debug.debug('[sync.fullSync] Downloaded PDF to local cache:', batch.id);
            } catch (error) {
              debug.error('[sync.fullSync] Failed to download PDF to cache:', batch.id, error);
              // Non-fatal - continue with other batches
            }
          }
        }
        
        // Reload stores with merged data
        await logsStore.loadLogs(userId);
        await shiftsStore.loadShifts(userId);
        if (remoteProfile) {
          await profileStore.loadProfile(userId);
        }
        
        debug.debug('[sync.fullSync] Full sync completed successfully');
      } catch (error) {
        debug.error('[sync.fullSync] Failed to download/merge remote data:', error);
      }
      
      const success = logsSuccess && shiftsSuccess && profileSuccess && exportsSuccess;
      
      return {
        success,
        profile: profileSuccess,
        logs: logsSuccess,
        shifts: shiftsSuccess,
        exports: exportsSuccess,
        error: success ? undefined : 'Some sync operations failed'
      };
    } catch (error) {
      debug.error('[sync.fullSync] Full sync failed:', error);
      return {
        success: false,
        profile: false,
        logs: false,
        shifts: false,
        exports: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  mergeLogsWithTimestamps(localLogs: OvertimeLog[], remoteLogs: OvertimeLog[]): OvertimeLog[] {
    const localMap = new Map(localLogs.map(log => [log.id, log]));
    const remoteMap = new Map(remoteLogs.map(log => [log.id, log]));
    
    const merged: OvertimeLog[] = [];
    
    // Process all logs (local and remote)
    const allLogIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
    
    for (const logId of allLogIds) {
      const localLog = localMap.get(logId);
      const remoteLog = remoteMap.get(logId);
      
      if (localLog && remoteLog) {
        // Both exist - compare timestamps
        const localTime = new Date(localLog.updatedAt || localLog.createdAt);
        const remoteTime = new Date(remoteLog.updatedAt || remoteLog.createdAt);
        
        // Use newer version
        merged.push(localTime > remoteTime ? localLog : remoteLog);
      } else if (localLog) {
        // Only local
        merged.push(localLog);
      } else if (remoteLog) {
        // Only remote
        merged.push(remoteLog);
      }
    }
    
    return merged;
  },

  mergeShiftsWithTimestamps(localShifts: UsualShift[], remoteShifts: UsualShift[]): UsualShift[] {
    const localMap = new Map(localShifts.map(shift => [shift.id, shift]));
    const remoteMap = new Map(remoteShifts.map(shift => [shift.id, shift]));
    
    const merged: UsualShift[] = [];
    
    // Process all shifts (local and remote)
    const allShiftIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
    
    for (const shiftId of allShiftIds) {
      const localShift = localMap.get(shiftId);
      const remoteShift = remoteMap.get(shiftId);
      
      if (localShift && remoteShift) {
        // Both exist - compare by activeFrom (proxy for timestamp)
        const localTime = new Date(localShift.activeFrom);
        const remoteTime = new Date(remoteShift.activeFrom);
        
        // Use newer version
        merged.push(localTime > remoteTime ? localShift : remoteShift);
      } else if (localShift) {
        // Only local
        merged.push(localShift);
      } else if (remoteShift) {
        // Only remote
        merged.push(remoteShift);
      }
    }
    
    return merged;
  },

  async checkConnection(): Promise<boolean> {
    if (!supabaseEnabled) {
      return false;
    }
    
    try {
      // Test connection by querying profiles table (lightweight query)
      // @ts-ignore
      const { error } = await supabase
        .from('profiles')
        .select('user_id')
        .limit(1);
      
      if (error) {
        debug.error('[sync.checkConnection] Connection check failed:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      debug.error('Connection check failed:', error);
      return false;
    }
  },
};

/**
 * Sync status and settings
 */
export const syncStatus = {
  isEnabled: supabaseEnabled,
  lastSync: null as Date | null,
  isOnline: true, // TODO: Implement network status detection
  autoSync: false, // TODO: Implement auto-sync setting
};

/**
 * Environment configuration helper
 */
export function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    enabled: supabaseEnabled,
  };
}

/**
 * Templates sync (metadata-only) - safe, local-first
 * Does not mutate production; uses whatever URL/KEY are configured.
 */
export const templatesSync = {
  async checkAndUpdate(): Promise<void> {
    if (!templateOTAEnabled || !supabaseEnabled) return;
    try {
      const { ensureTemplateUpToDate } = await import('./pdf/templateLoader');
      await Promise.all([
        ensureTemplateUpToDate('avac_normal'),
        ensureTemplateUpToDate('avac_smo'),
      ]);
    } catch (e) {
      debug.error('[templatesSync.checkAndUpdate] Failed:', e);
    }
  },
};

type SubscriptionRow = {
  subscription_status: string | null;
  subscription_expires_at: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  trial_consumed: boolean | null;
  subscription_product_id: string | null;
  subscription_cancelled_at: string | null;
  grace_period_until: string | null;
  data_retention_until: string | null;
  account_deleted_at: string | null;
  legacy_free_access: boolean | null;
  paywall_acknowledged_at: string | null;
};

function mapSubscriptionRow(row: SubscriptionRow | null): SubscriptionSnapshot | null {
  if (!row) {
    return null;
  }

  return {
    status: (row.subscription_status as SubscriptionSnapshot['status']) || 'none',
    subscriptionExpiresAt: row.subscription_expires_at,
    trialStartedAt: row.trial_started_at,
    trialExpiresAt: row.trial_expires_at,
    trialConsumed: Boolean(row.trial_consumed),
    subscriptionProductId: row.subscription_product_id,
    subscriptionCancelledAt: row.subscription_cancelled_at,
    gracePeriodUntil: row.grace_period_until,
    dataRetentionUntil: row.data_retention_until,
    accountDeletedAt: row.account_deleted_at,
    legacyFreeAccess: Boolean(row.legacy_free_access),
    paywallAcknowledgedAt: row.paywall_acknowledged_at,
  };
}

export async function fetchRemoteFeatureFlags(): Promise<Record<string, RemoteFeatureFlag>> {
  if (!supabaseEnabled) {
    return {};
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/remote_feature_flags?select=key,value,description,updated_at`;
    const response = await authenticatedFetch(url, { method: 'GET' });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load feature flags: ${errorText}`);
    }

    const rows = await response.json();
    const flags: Record<string, RemoteFeatureFlag> = {};
    rows.forEach((row: any) => {
      flags[row.key] = {
        key: row.key,
        value: row.value || {},
        description: row.description,
        updatedAt: row.updated_at,
      };
    });

    return flags;
  } catch (error) {
    debug.error('[fetchRemoteFeatureFlags] Failed to fetch feature flags:', error);
    return {};
  }
}

export const subscriptionApi = {
  async fetchSnapshot(userId?: string | null): Promise<SubscriptionSnapshot | null> {
    if (!supabaseEnabled || !userId) {
      return null;
    }

    try {
      const url = `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=subscription_status,subscription_expires_at,trial_started_at,trial_expires_at,trial_consumed,subscription_product_id,subscription_cancelled_at,grace_period_until,data_retention_until,account_deleted_at,legacy_free_access,paywall_acknowledged_at&limit=1`;
      const response = await authenticatedFetch(url, { method: 'GET' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch subscription snapshot: ${text}`);
      }

      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        return null;
      }

      return mapSubscriptionRow(rows[0]);
    } catch (error) {
      debug.error('[subscriptionApi.fetchSnapshot] Failed to load subscription data:', error);
      return null;
    }
  },

  async markPaywallAcknowledged(userId?: string | null): Promise<boolean> {
    if (!supabaseEnabled || !userId) {
      return false;
    }

    try {
      const url = `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`;
      const response = await authenticatedFetch(url, {
        method: 'PATCH',
        headers: {
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          paywall_acknowledged_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to mark paywall acknowledgement: ${text}`);
      }

      return true;
    } catch (error) {
      debug.error('[subscriptionApi.markPaywallAcknowledged] Failed:', error);
      return false;
    }
  },
};

/**
 * TODO: Phase-2 Implementation Notes
 * 
 * When implementing real Supabase integration:
 * 
 * 1. Install Supabase client:
 *    npm install @supabase/supabase-js
 * 
 * 2. Create Supabase project and get credentials
 * 
 * 3. Set environment variables:
 *    EXPO_PUBLIC_SUPABASE_URL=your-project-url
 *    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 * 
 * 4. Create database tables:
 *    - profiles (user_id, profile_data)
 *    - overtime_logs (user_id, log_data, created_at, updated_at)
 *    - export_batches (user_id, batch_data, created_at)
 * 
 * 5. Implement real sync functions with:
 *    - Conflict resolution
 *    - Offline queue
 *    - Incremental sync
 *    - Error handling
 * 
 * 6. Add authentication flow
 * 
 * 7. Add real-time subscriptions for multi-device sync
 */
