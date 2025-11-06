import * as SecureStore from 'expo-secure-store';
import * as LZString from 'lz-string';

// Marker prefix to indicate compressed data
const COMPRESSED_MARKER = '__COMPRESSED__';

// Check if a key is likely Supabase auth session data
function isSupabaseSessionKey(key: string): boolean {
  return key.includes('supabase') || 
         key.includes('auth') || 
         key.includes('session') ||
         key.includes('sb-'); // Supabase session keys typically start with 'sb-'
}

// A minimal storage adapter compatible with @supabase/supabase-js auth storage API
// Provides getItem, setItem, removeItem using Expo SecureStore for better security on mobile
// Automatically compresses large session data to stay within SecureStore's 2048 byte limit
export const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await SecureStore.getItemAsync(key, {
        keychainService: 'overtime-securestore',
      });
      
      if (!value) return null;
      
      // Check if value is compressed (has marker prefix)
      if (value.startsWith(COMPRESSED_MARKER)) {
        try {
          // Remove marker and decompress
          const compressedData = value.substring(COMPRESSED_MARKER.length);
          const decompressed = LZString.decompress(compressedData);
          
          if (!decompressed) {
            console.warn(
              `SecureStoreAdapter.getItem: Failed to decompress value for key "${key}". ` +
              `Data may be corrupted. Removing corrupted data to allow re-storage.`
            );
            // Remove corrupted compressed data so it can be re-stored
            // This allows Supabase to refresh the session instead of returning corrupted data
            try {
              await SecureStore.deleteItemAsync(key, {
                keychainService: 'overtime-securestore',
              });
            } catch (removeError) {
              // Ignore errors during cleanup
            }
            return null;
          }
          
          return decompressed;
        } catch (decompressError) {
          console.warn(
            `SecureStoreAdapter.getItem: Error decompressing value for key "${key}". ` +
            `Data may be corrupted. Removing corrupted data to allow re-storage.`,
            decompressError
          );
          // Remove corrupted compressed data so it can be re-stored
          try {
            await SecureStore.deleteItemAsync(key, {
              keychainService: 'overtime-securestore',
            });
          } catch (removeError) {
            // Ignore errors during cleanup
          }
          return null;
        }
      }
      
      // Return uncompressed value (backward compatibility)
      return value;
    } catch (error) {
      console.warn('SecureStoreAdapter.getItem failed', { key, error });
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const sizeInBytes = new TextEncoder().encode(value).length;
      let finalValue = value;
      let shouldCompress = false;
      
      // Compress if it's Supabase session data and exceeds size limit
      if (isSupabaseSessionKey(key) && sizeInBytes > 1500) {
        // Compress at 1500 bytes (before hitting 2048 limit) to leave room for compression overhead
        try {
          const compressed = LZString.compress(value);
          if (compressed) {
            // Calculate the final size including marker overhead
            const markerSize = new TextEncoder().encode(COMPRESSED_MARKER).length;
            const compressedSize = new TextEncoder().encode(compressed).length;
            const finalCompressedSize = markerSize + compressedSize;
            
            // Only use compression if the final size (compressed + marker) is actually smaller
            if (finalCompressedSize < sizeInBytes) {
              finalValue = COMPRESSED_MARKER + compressed;
              shouldCompress = true;
              const reduction = Math.round((1 - finalCompressedSize / sizeInBytes) * 100);
              console.log(
                `SecureStoreAdapter.setItem: Compressed value for key "${key}" from ${sizeInBytes} to ${finalCompressedSize} bytes (${reduction}% reduction)`
              );
            }
          }
        } catch (compressError) {
          console.warn(`SecureStoreAdapter.setItem: Failed to compress value for key "${key}"`, compressError);
          // Continue with uncompressed value
        }
      }
      
      // Check final size after compression
      const finalSizeInBytes = new TextEncoder().encode(finalValue).length;
      if (finalSizeInBytes > 2048) {
        console.warn(
          `SecureStoreAdapter.setItem: Value for key "${key}" is ${finalSizeInBytes} bytes (exceeds 2048 byte limit) even after compression. ` +
          `This may fail to store. Original size: ${sizeInBytes} bytes.`
        );
      }
      
      await SecureStore.setItemAsync(key, finalValue, {
        keychainService: 'overtime-securestore',
        // Use the most restrictive defaults available on the platform
      });
      
      if (shouldCompress) {
        console.log(`SecureStoreAdapter.setItem: Successfully stored compressed value for key "${key}"`);
      }
    } catch (error) {
      console.warn('SecureStoreAdapter.setItem failed', { key, error });
      // If it's a size-related error, provide more context
      if (error instanceof Error && (error.message.includes('2048') || error.message.includes('too large'))) {
        console.error(
          `SecureStoreAdapter: Failed to store value for "${key}" due to size limit. ` +
          `Consider reducing session data size or using alternative storage.`
        );
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key, {
        keychainService: 'overtime-securestore',
      });
    } catch (error) {
      console.warn('SecureStoreAdapter.removeItem failed', { key, error });
    }
  },
};

export type StorageAdapter = typeof SecureStoreAdapter;


