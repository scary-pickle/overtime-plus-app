/**
 * Secure logging utility
 * - Only logs in development (NODE_ENV !== 'production')
 * - Automatically masks sensitive data (tokens, emails, user IDs, keys)
 * - Provides consistent logging interface across the app
 */

const isDev = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Masking utilities
const maskUserId = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  if (value.length <= 8) return '***';
  return `${value.substring(0, 8)}...`;
};

const maskEmail = (email?: string | null): string | undefined => {
  if (!email || typeof email !== 'string') return undefined;
  const [local, domain] = email.split('@');
  if (!domain || !local) return '***';
  return `${local[0]}***@${domain}`;
};

const maskToken = (token?: string | null, maxLength: number = 20): string | undefined => {
  if (!token) return undefined;
  if (token.length <= maxLength) return '***';
  return `${token.substring(0, maxLength)}...`;
};

const maskKey = (key?: string | null): string | undefined => {
  if (!key) return undefined;
  // Mask sensitive parts of keys (like auth-token, session keys)
  if (key.includes('auth-token') || key.includes('session')) {
    const parts = key.split('-');
    if (parts.length > 2) {
      return `${parts[0]}-${parts[1]}-***`;
    }
    return `${key.substring(0, 20)}...`;
  }
  if (key.length <= 20) return '***';
  return `${key.substring(0, 20)}...`;
};

const maskName = (name?: string | null): string | undefined => {
  if (!name || typeof name !== 'string') return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts
    .map(part => part.length > 0 ? `${part[0]}***` : '***')
    .join(' ');
};

// Recursively mask sensitive data in objects
const maskSensitiveData = (obj: any, depth: number = 0): any => {
  if (depth > 5) return '[Max depth reached]'; // Prevent infinite recursion
  if (obj === null || obj === undefined) return obj;
  
  // Handle Error objects specially
  if (obj instanceof Error) {
    const errorObj: any = {
      name: obj.name,
      message: obj.message,
    };
    if (obj.stack) {
      errorObj.stack = obj.stack;
    }
    // Copy any additional properties
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && !['name', 'message', 'stack'].includes(key)) {
        errorObj[key] = maskSensitiveData((obj as any)[key], depth + 1);
      }
    }
    return maskSensitiveData(errorObj, depth + 1);
  }
  
  if (typeof obj === 'string') {
    // Check if it looks like a token (long string, likely base64/JWT)
    if (obj.length > 100 && /^[A-Za-z0-9+/=_-]+$/.test(obj)) {
      return maskToken(obj);
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    // Handle empty objects
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return obj; // Return empty object as-is
    }
    
    const masked: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Mask sensitive keys
      if (
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('key') ||
        lowerKey.includes('session') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('credential')
      ) {
        if (typeof value === 'string') {
          masked[key] = maskToken(value);
        } else {
          masked[key] = '[Masked]';
        }
      } else if (lowerKey.includes('email')) {
        if (typeof value === 'string') {
          masked[key] = maskEmail(value);
        } else {
          masked[key] = maskSensitiveData(value, depth + 1);
        }
      } else if (lowerKey.includes('user') && (lowerKey.includes('id') || lowerKey === 'user')) {
        if (typeof value === 'string') {
          masked[key] = maskUserId(value);
        } else if (value && typeof value === 'object' && 'id' in value) {
          masked[key] = { ...value, id: maskUserId((value as any).id) };
        } else {
          masked[key] = maskSensitiveData(value, depth + 1);
        }
      } else if (lowerKey === 'key' && typeof value === 'string') {
        masked[key] = maskKey(value);
      } else {
        masked[key] = maskSensitiveData(value, depth + 1);
      }
    }
    return masked;
  }
  
  return obj;
};

/**
 * Safe logger that only logs in development and masks sensitive data
 */
export const logger = {
  /**
   * Log debug information (only in development)
   */
  debug: (...args: any[]): void => {
    if (!isDev) return;
    const masked = args.map(arg => maskSensitiveData(arg));
    console.log(...masked);
  },

  /**
   * Log errors (always logged, but sensitive data is masked)
   */
  error: (...args: any[]): void => {
    try {
      const masked = args.map(arg => maskSensitiveData(arg));
      // Handle empty objects and ensure proper serialization
      const safeArgs = masked.map(arg => {
        if (typeof arg === 'object' && arg !== null && Object.keys(arg).length === 0) {
          return '[Empty object]';
        }
        return arg;
      });
      console.error(...safeArgs);
    } catch (err) {
      // Fallback if masking fails
      console.error('[Logger error] Failed to mask data:', err);
      console.error(...args);
    }
  },

  /**
   * Log warnings (always logged, but sensitive data is masked)
   */
  warn: (...args: any[]): void => {
    try {
      const masked = args.map(arg => maskSensitiveData(arg));
      // Handle empty objects and ensure proper serialization
      const safeArgs = masked.map(arg => {
        if (typeof arg === 'object' && arg !== null && Object.keys(arg).length === 0) {
          return '[Empty object]';
        }
        return arg;
      });
      console.warn(...safeArgs);
    } catch (err) {
      // Fallback if masking fails
      console.warn('[Logger error] Failed to mask data:', err);
      console.warn(...args);
    }
  },

  /**
   * Log info (only in development)
   */
  info: (...args: any[]): void => {
    if (!isDev) return;
    const masked = args.map(arg => maskSensitiveData(arg));
    console.info(...masked);
  },

  /**
   * Log with a prefix (only in development)
   */
  log: (prefix: string, ...args: any[]): void => {
    if (!isDev) return;
    const masked = args.map(arg => maskSensitiveData(arg));
    console.log(`[${prefix}]`, ...masked);
  },
};

/**
 * Helper to create a scoped logger with a prefix
 */
export const createScopedLogger = (scope: string) => ({
  debug: (...args: any[]) => logger.debug(`[${scope}]`, ...args),
  error: (...args: any[]) => logger.error(`[${scope}]`, ...args),
  warn: (...args: any[]) => logger.warn(`[${scope}]`, ...args),
  info: (...args: any[]) => logger.info(`[${scope}]`, ...args),
  log: (...args: any[]) => logger.debug(`[${scope}]`, ...args), // Keep for backward compatibility, but use debug
});

// Export masking utilities for cases where manual masking is needed
export { maskUserId, maskEmail, maskToken, maskKey, maskName };

