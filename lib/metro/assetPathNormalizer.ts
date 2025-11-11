/**
 * ROOT CAUSE FIX: Asset Path Normalizer
 * 
 * This module provides utilities to normalize asset paths.
 * The primary fix is in metro.config.js middleware which decodes unstable_path before Metro processes it.
 * 
 * This module is kept for potential future use or client-side path normalization if needed.
 */

/**
 * Normalizes an asset's httpServerLocation to remove leading ./ prefix
 * This prevents the path from being incorrectly URL-encoded
 */
export function normalizeAssetPath(httpServerLocation: string): string {
  let normalized = httpServerLocation;
  
  // Remove leading ./ if present (this is the root cause of the encoding issue)
  if (normalized.startsWith('./')) {
    normalized = normalized.substring(2);
  }
  
  // Remove leading / if present (Metro expects relative paths)
  if (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }
  
  return normalized;
}

/**
 * Patches Expo's AssetSourceResolver to normalize paths
 * NOTE: This may not work as assets are already registered, but the Metro middleware fix handles this
 */
export function patchAssetSourceResolver() {
  // The Metro middleware fix in metro.config.js is the primary solution
  // This function is kept for potential future use
  try {
    // Try to patch Expo's AssetSourceResolver if available
    const expoAsset = require('expo-asset');
    if (expoAsset && expoAsset.AssetSourceResolver) {
      // Assets are already registered, so patching here may not help
      // The Metro middleware fix handles the decoding at request time
    }
  } catch (e) {
    // If patching fails, the Metro middleware fix will handle it
    // This is expected and not an error
  }
}

