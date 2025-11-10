import * as SecureStore from 'expo-secure-store';
import * as LZString from 'lz-string';

type ChunkedMeta = {
  version: 1;
  chunks: number;
  compressed: boolean;
};

const COMPRESSED_MARKER = '__COMPRESSED__';
const META_SUFFIX = '__meta__';
const CHUNK_SUFFIX = '__chunk__';
const CHUNK_SIZE = 1700; // Max Safe chunk size (SecureStore limit is 2048 bytes)
const SECURE_STORE_OPTIONS = { keychainService: 'overtime-securestore' };

const metaKey = (key: string) => `${key}${META_SUFFIX}`;
const chunkKey = (key: string, index: number) => `${key}${CHUNK_SUFFIX}${index}`;

function isSupabaseSessionKey(key: string): boolean {
  return key.includes('supabase') ||
    key.includes('auth') ||
    key.includes('session') ||
    key.includes('sb-');
}

async function readMeta(key: string): Promise<ChunkedMeta | null> {
  try {
    const raw = await SecureStore.getItemAsync(metaKey(key), SECURE_STORE_OPTIONS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) {
      return null;
    }
    const chunks = Number(parsed.chunks);
    if (!Number.isFinite(chunks) || chunks < 0) {
      return null;
    }
    return {
      version: 1,
      chunks: Math.floor(chunks),
      compressed: Boolean(parsed.compressed),
    };
  } catch (error) {
    console.warn('SecureStoreAdapter.readMeta failed; treating metadata as absent', error);
    return null;
  }
}

async function clearChunkedData(key: string, meta?: ChunkedMeta | null): Promise<void> {
  const resolvedMeta = meta ?? (await readMeta(key));
  if (resolvedMeta) {
    const removals: Promise<void>[] = [];
    for (let i = 0; i < resolvedMeta.chunks; i++) {
      removals.push(SecureStore.deleteItemAsync(chunkKey(key, i), SECURE_STORE_OPTIONS));
    }
    removals.push(SecureStore.deleteItemAsync(metaKey(key), SECURE_STORE_OPTIONS));
    await Promise.allSettled(removals);
  }
  try {
    await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  } catch {
    // ignore legacy key removal errors
  }
}

function splitIntoChunks(data: string): string[] {
  if (data.length === 0) {
    return [''];
  }
  const chunks: string[] = [];
  // For base64 strings, we can safely split at any point
  // Base64 strings are ASCII-safe and can be split character-by-character
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

function maybeCompress(key: string, value: string): { payload: string; compressed: boolean } {
  const sizeInBytes = new TextEncoder().encode(value).length;
  if (!isSupabaseSessionKey(key) || sizeInBytes <= 1500) {
    return { payload: value, compressed: false };
  }
  try {
    const compressed = LZString.compress(value);
    if (compressed && compressed.length < value.length) {
      return { payload: compressed, compressed: true };
    }
  } catch (error) {
    console.warn('SecureStoreAdapter.setItem: compression failed, storing uncompressed payload', error);
  }
  return { payload: value, compressed: false };
}

// Removed decodePayload function - we now handle decompression directly in getItem

export const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const isDev = process.env.NODE_ENV !== 'production';
    const debug = (...args: any[]) => {
      if (isDev && isSupabaseSessionKey(key)) {
        console.log('[SecureStoreAdapter.getItem]', ...args);
      }
    };
    
    try {
      debug('Reading key:', key.substring(0, 20) + '...');
      const meta = await readMeta(key);
      if (meta) {
        debug('Found chunked data:', { chunks: meta.chunks, compressed: meta.compressed });
        const chunkReads = await Promise.all(
          Array.from({ length: meta.chunks }, (_, index) =>
            SecureStore.getItemAsync(chunkKey(key, index), SECURE_STORE_OPTIONS)
          )
        );

        if (chunkReads.some(chunk => chunk == null)) {
          console.warn('SecureStoreAdapter.getItem: detected incomplete chunk data; clearing stored chunks');
          await clearChunkedData(key, meta);
          return null;
        }

        debug('All chunks read successfully:', { chunkCount: chunkReads.length, chunkLengths: chunkReads.map(c => c?.length || 0) });
        
        // Join chunks - no base64 encoding, just join directly
        const joinedData = chunkReads.join('');
        debug('Joined data length:', joinedData.length, 'expected from chunks:', chunkReads.reduce((sum, c) => sum + (c?.length || 0), 0));
        
        // If compressed, decompress directly (no base64 decoding needed)
        if (meta.compressed) {
          try {
            // Decompress the LZString compressed data directly
            const decompressed = LZString.decompress(joinedData);
            if (!decompressed) {
              console.warn('SecureStoreAdapter.getItem: decompression returned null');
              debug('Decompression returned null');
              await clearChunkedData(key, meta);
              return null;
            }
            debug('Decompressed successfully, length:', decompressed.length);
            return decompressed;
          } catch (decompressError) {
            console.warn('SecureStoreAdapter.getItem: decompression failed', decompressError);
            debug('Decompression error:', decompressError);
            await clearChunkedData(key, meta);
            return null;
          }
        }
        
        // Not compressed, return as-is
        debug('Payload not compressed, returning as-is');
        debug('Successfully read chunked data, length:', joinedData.length);
        return joinedData;
      }

      // Legacy fallback (single value, optional compression marker)
      const legacyValue = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
      if (!legacyValue) {
        debug('No value found for key');
        return null;
      }

      debug('Found legacy value, length:', legacyValue.length);
      if (legacyValue.startsWith(COMPRESSED_MARKER)) {
        const compressedData = legacyValue.substring(COMPRESSED_MARKER.length);
        try {
          const decompressed = LZString.decompress(compressedData);
          if (!decompressed) {
            await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
            return null;
          }
          debug('Successfully decompressed legacy value, length:', decompressed.length);
          return decompressed;
        } catch (error) {
          console.warn('SecureStoreAdapter.getItem: legacy decompression failed; clearing value', error);
          await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
          return null;
        }
      }

      debug('Returning legacy value as-is');
      return legacyValue;
    } catch (error) {
      console.warn('SecureStoreAdapter.getItem failed', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const isDev = process.env.NODE_ENV !== 'production';
    const debug = (...args: any[]) => {
      if (isDev && isSupabaseSessionKey(key)) {
        console.log('[SecureStoreAdapter.setItem]', ...args);
      }
    };
    
    try {
      debug('Setting key:', key.substring(0, 20) + '...', 'value length:', value.length);
      await clearChunkedData(key);

      const { payload, compressed } = maybeCompress(key, value);
      
      // Check if we need to chunk based on byte size
      const payloadBytes = new TextEncoder().encode(payload).length;
      const needsChunking = payloadBytes > CHUNK_SIZE;
      
      debug('Preparing to store:', { 
        originalLength: value.length, 
        payloadLength: payload.length, 
        payloadBytes,
        compressed,
        needsChunking 
      });
      
      let chunks: string[];
      if (needsChunking) {
        // Only chunk if we absolutely have to (payload > 1700 bytes)
        // For compressed data, we can't split it - it must be stored as-is
        // So if compressed data is too large, we have a problem
        if (compressed) {
          console.warn('SecureStoreAdapter.setItem: Compressed data exceeds chunk size, cannot split compressed data');
          debug('Compressed data too large, cannot chunk');
          // Try to store anyway - might work if SecureStore allows slightly larger values
          chunks = [payload];
        } else {
          // Uncompressed data can be chunked
          chunks = splitIntoChunks(payload);
        }
      } else {
        // Data fits in one chunk - store directly without base64 encoding
        // This avoids corruption issues with base64 encoding
        chunks = [payload];
      }
      
      debug('Storing as chunks:', { chunks: chunks.length, compressed, originalLength: value.length, payloadLength: payload.length, payloadBytes });

      await Promise.all(
        chunks.map((chunk, index) =>
          SecureStore.setItemAsync(chunkKey(key, index), chunk, SECURE_STORE_OPTIONS)
        )
      );

      const meta: ChunkedMeta = {
        version: 1,
        chunks: chunks.length,
        compressed,
      };
      await SecureStore.setItemAsync(metaKey(key), JSON.stringify(meta), SECURE_STORE_OPTIONS);
      // Ensure legacy key is cleared (in case older versions stored it)
      await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
      debug('Successfully stored chunked data');
    } catch (error) {
      console.warn('SecureStoreAdapter.setItem failed', error);
      // Attempt best-effort cleanup to avoid partial state
      await clearChunkedData(key);
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await clearChunkedData(key);
    } catch (error) {
      console.warn('SecureStoreAdapter.removeItem failed', error);
    }
  },
};

export type StorageAdapter = typeof SecureStoreAdapter;
