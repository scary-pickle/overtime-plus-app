/**
 * PDF Storage Service
 * Handles uploading/downloading PDFs to/from Supabase Storage
 */

import { supabase, supabaseEnabled, getSupabaseConfig } from '../supabase';
import { Paths } from 'expo-file-system';
import { readAsStringAsync, writeAsStringAsync, getInfoAsync, uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('pdfStorage');

const EXPORTS_BUCKET = 'exports';
const isDevLoggingEnabled = process.env.NODE_ENV !== 'production';
const STORAGE_URI_PREFIX = `storage://${EXPORTS_BUCKET}/`;

function isUuidSegment(segment: string | undefined): boolean {
  if (!segment) return false;
  return /^[0-9a-fA-F-]{32,36}$/.test(segment);
}

function extractStoragePath(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith(STORAGE_URI_PREFIX)) {
    return uri.slice(STORAGE_URI_PREFIX.length);
  }
  if (uri.startsWith('storage://')) {
    const withoutScheme = uri.replace('storage://', '');
    const parts = withoutScheme.split('/');
    const bucketId = parts.shift();
    if (!bucketId || bucketId !== EXPORTS_BUCKET) {
      return null;
    }
    return parts.join('/');
  }
  if (uri.startsWith(`${EXPORTS_BUCKET}/`)) {
    return uri.slice(EXPORTS_BUCKET.length + 1);
  }
  const parts = uri.split('/');
  if (parts.length === 2 && parts[1].endsWith('.pdf') && isUuidSegment(parts[0])) {
    return uri;
  }
  return null;
}

/**
 * Upload PDF to Supabase Storage
 * @param pdfUri - Local file path to the PDF
 * @param batchId - Export batch ID
 * @param userId - User ID
 * @returns Storage path (exports/{userId}/{batchId}.pdf) or original local URI
 */
export async function uploadPDFToStorage(
  pdfUri: string,
  batchId: string,
  userId: string
): Promise<string> {
  if (!supabaseEnabled) {
    return pdfUri; // Return local path if Supabase not available
  }

  if (!userId) {
    return pdfUri;
  }

  try {
    // Generate storage path: exports/{userId}/{batchId}.pdf
    const storagePath = `${userId}/${batchId}.pdf`;

    // Build direct storage upload URL
    const cfg = getSupabaseConfig();
    const storageUrl = `${cfg.url}/storage/v1/object/${EXPORTS_BUCKET}/${storagePath}`;

    // Get access token (prefer user session token for RLS)
    // @ts-ignore
    const { data: sessionData } = await (supabase as any).auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    // Upload using FileSystem.uploadAsync to avoid Blob/ArrayBuffer issues in RN
    const result = await uploadAsync(storageUrl, pdfUri, {
      httpMethod: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken || ''}`,
        'x-upsert': 'true',
        'Content-Type': 'application/pdf',
      },
      uploadType: FileSystemUploadType.BINARY_CONTENT,
    });

    if (result.status !== 200 && result.status !== 201) {
      debug.error('Upload failed', {
        status: result.status,
        body: result.body?.slice(0, 200),
      });
      throw new Error(`Upload failed with status ${result.status}`);
    }

    // Also cache the PDF locally for offline access
    try {
      const fileName = `${batchId}.pdf`;
      // Use Paths.cache.uri like other parts of the codebase
      const cacheDir = Paths?.cache?.uri;
      if (cacheDir) {
        // Ensure cacheDir ends with a slash
        const localCachePath = cacheDir.endsWith('/') ? `${cacheDir}${fileName}` : `${cacheDir}/${fileName}`;
        
        // Copy the local file to cache if it's not already there
        const { getInfoAsync } = await import('expo-file-system/legacy');
        const cacheExists = await getInfoAsync(localCachePath).then(info => info.exists).catch(() => false);
        
        if (!cacheExists && pdfUri !== localCachePath) {
          // Read the source file and write to cache
          const fileData = await readAsStringAsync(pdfUri, { encoding: 'base64' });
          await writeAsStringAsync(localCachePath, fileData, { encoding: 'base64' });
        }
      }
    } catch (cacheError) {
      // Non-fatal - cache error shouldn't prevent upload
      debug.warn('Failed to cache PDF locally (non-fatal):', cacheError);
    }

    return `storage://${EXPORTS_BUCKET}/${storagePath}`;
  } catch (error) {
    debug.error('Failed to upload PDF to Supabase Storage:', error);
    throw error;
  }
}

/**
 * Download PDF from Supabase Storage to local cache
 * @param cloudUrl - Cloud URL or storage path
 * @param batchId - Export batch ID
 * @returns Local file path
 */
export async function downloadPDFFromStorage(
  cloudUrl: string,
  batchId: string
): Promise<string> {
  if (!supabaseEnabled) {
    throw new Error('Supabase not enabled');
  }

  try {
    // First, check if PDF already exists in local cache
    const fileName = `${batchId}.pdf`;
    // Use Paths.cache.uri like other parts of the codebase
    const cacheDir = Paths?.cache?.uri;
    if (!cacheDir) {
      throw new Error('Cache directory not available');
    }
    // Ensure cacheDir ends with a slash
    const localCachePath = cacheDir.endsWith('/') ? `${cacheDir}${fileName}` : `${cacheDir}/${fileName}`;
    
    try {
      const { getInfoAsync } = await import('expo-file-system/legacy');
      const cacheInfo = await getInfoAsync(localCachePath);
      if (cacheInfo.exists) {
        return localCachePath;
      }
    } catch (cacheCheckError) {
      // Cache doesn't exist, continue with download
      if (isDevLoggingEnabled) {
        debug.warn('Cache miss for PDF', cacheCheckError);
      }
    }

    // Extract storage path from URI or use it directly
    let storagePath = extractStoragePath(cloudUrl);
    if (!storagePath && cloudUrl.startsWith('http')) {
      // Extract path from public URL: https://...supabase.co/storage/v1/object/public/exports/userId/batchId.pdf
      const urlParts = cloudUrl.split('/');
      const exportsIndex = urlParts.findIndex(part => part === EXPORTS_BUCKET);
      if (exportsIndex >= 0 && exportsIndex < urlParts.length - 1) {
        storagePath = urlParts.slice(exportsIndex + 1).join('/');
      } else {
        throw new Error('Invalid cloud URL format');
      }
    }
    if (!storagePath) {
      // Assume it's already a storage-relative path (legacy format userId/filename)
      storagePath = cloudUrl;
    }

    // Get access token for authenticated requests
    // @ts-ignore
    const { data: sessionData } = await (supabase as any).auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    // Try using Supabase's download method first (works better with auth)
    let response: Response;
    let downloadUrl: string;
    
    try {
      // @ts-ignore
      const { data, error } = await supabase.storage
        .from(EXPORTS_BUCKET)
        .download(storagePath);

      if (error) {
        throw error;
      }

      if (data) {
        // Try to convert Blob to base64
        // Note: In React Native, Supabase's .download() may not return a standard Blob
        let base64String: string;
        try {
          // Check if data has arrayBuffer method (standard Blob)
          if (typeof data.arrayBuffer === 'function') {
            const arrayBuffer = await data.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const chunkSize = 8192;
            let binaryString = '';
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.slice(i, i + chunkSize);
              binaryString += String.fromCharCode(...chunk);
            }
            base64String = btoa(binaryString);
          } else {
            // In React Native, the SDK might return something else
            // Throw to fall back to signed URL method
            throw new Error('Supabase SDK returned non-Blob data (React Native limitation), falling back to signed URL');
          }
        } catch (convertError) {
          // SDK download didn't work with Blob conversion - fall back to signed URL
          throw convertError; // Re-throw to trigger fallback
        }

        // Save to local cache
        // Ensure we have a valid cache directory path
        const finalCacheDir = Paths?.cache?.uri;
        if (!finalCacheDir) {
          throw new Error('Cache directory not available');
        }
        const finalLocalCachePath = finalCacheDir.endsWith('/') 
          ? `${finalCacheDir}${fileName}` 
          : `${finalCacheDir}/${fileName}`;
        
      await writeAsStringAsync(finalLocalCachePath, base64String, { encoding: 'base64' });
      return finalLocalCachePath;
      }
    } catch (sdkError) {
      // Expected in React Native: Supabase SDK .download() doesn't return standard Blob
      // Fall back to signed URL method which works reliably
      if (isDevLoggingEnabled) {
        debug.warn('Falling back to signed URL method:', sdkError);
      }
      // Fallback: Try signed URL (works better for private buckets)
      // @ts-ignore
      const { data: signedUrlData, error: signedError } = await supabase.storage
        .from(EXPORTS_BUCKET)
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (signedError || !signedUrlData?.signedUrl) {
        throw signedError || new Error('No signed URL returned');
      }

      downloadUrl = signedUrlData.signedUrl;

      // Download using fetch
      response = await fetch(downloadUrl, {
        headers: accessToken ? {
          'Authorization': `Bearer ${accessToken}`,
        } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
      }

      // Convert response to blob, then to base64
      let blob: Blob;
      try {
        blob = await response.blob();
      } catch (blobError) {
        // If blob() fails, try arrayBuffer as fallback
        const arrayBuffer = await response.arrayBuffer();
        blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      }

      // Convert Blob to base64
      let base64String: string;
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        // For large files, convert in chunks to avoid stack overflow
        const chunkSize = 8192;
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode(...chunk);
        }
        base64String = btoa(binaryString);
      } catch (convertError) {
        // Fallback: use FileReader if available (web) or arrayBuffer directly
        if (typeof FileReader !== 'undefined') {
          // FileReader is available (web)
          base64String = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              // Remove data URL prefix if present
              const base64 = result.includes(',') ? result.split(',')[1] : result;
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          // React Native: try direct arrayBuffer again
          try {
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const chunkSize = 8192;
            let binaryString = '';
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.slice(i, i + chunkSize);
              binaryString += String.fromCharCode(...chunk);
            }
            base64String = btoa(binaryString);
          } catch (finalError) {
            throw new Error(`Failed to convert PDF to base64: ${finalError}`);
          }
        }
      }

      // Save to local cache
      // Ensure we have a valid cache directory path
      const finalCacheDir = Paths?.cache?.uri;
      if (!finalCacheDir) {
        throw new Error('Cache directory not available');
      }
      const finalLocalCachePath = finalCacheDir.endsWith('/') 
        ? `${finalCacheDir}${fileName}` 
        : `${finalCacheDir}/${fileName}`;
      
        await writeAsStringAsync(finalLocalCachePath, base64String, { encoding: 'base64' });
        if (isDevLoggingEnabled) {
          debug.debug('Saved PDF to cache', finalLocalCachePath);
        }
        return finalLocalCachePath;
      }

      throw new Error('Storage download returned no data');
  } catch (error) {
    debug.error('Failed to download PDF from storage:', error);
    throw error;
  }
}

/**
 * Delete PDF from Supabase Storage
 * @param batchId - Export batch ID
 * @param userId - User ID
 */
export async function deletePDFFromStorage(
  batchId: string,
  userId: string
): Promise<void> {
  if (!supabaseEnabled || !userId) {
    return;
  }

  try {
    const storagePath = `${userId}/${batchId}.pdf`;

    // @ts-ignore
    const { error } = await supabase.storage
      .from(EXPORTS_BUCKET)
      .remove([storagePath]);

    if (error) {
      debug.error('Error deleting PDF:', error);
      throw error;
    }

  } catch (error) {
    debug.error('Failed to delete PDF from storage:', error);
    throw error;
  }
}

/**
 * Get signed URL for temporary access (for web access)
 * @param batchId - Export batch ID
 * @param userId - User ID
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL
 */
export async function getSignedURL(
  batchId: string,
  userId: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!supabaseEnabled || !userId) {
    throw new Error('Supabase not enabled or userId missing');
  }

  try {
    const storagePath = `${userId}/${batchId}.pdf`;

    // @ts-ignore
    const { data, error } = await supabase.storage
      .from(EXPORTS_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      debug.error('Error creating signed URL:', error);
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error('No signed URL returned');
    }

    return data.signedUrl;
  } catch (error) {
    debug.error('Failed to create signed URL:', error);
    throw error;
  }
}

/**
 * Check if a URI points to Supabase storage
 */
export function isStoragePath(uri: string): boolean {
  return extractStoragePath(uri) !== null;
}

/**
 * Check if a URI is a cloud URL (Supabase storage or remote HTTP/S)
 */
export function isCloudURL(uri: string): boolean {
  if (!uri) return false;
  return isStoragePath(uri) || uri.startsWith('http://') || uri.startsWith('https://');
}

/**
 * Check if a URI is a local path
 */
export function isLocalPath(uri: string): boolean {
  if (!uri) return false;
  // Check if it's a cloud URL first
  if (isCloudURL(uri)) return false;
  // Check if it starts with file://
  if (uri.startsWith('file://')) return true;
  // Check if it includes cache path (safely handle undefined Paths)
  try {
    if (Paths?.cache?.uri && uri.includes(Paths.cache.uri)) return true;
  } catch (e) {
    // Paths might not be available, ignore
  }
  // If it's not a cloud URL and not file://, assume it's local
  return true;
}

/**
 * Classify a PDF URI as either 'cloud' or 'local'
 */
export function classifyPdfUri(uri?: string | null): 'cloud' | 'local' | 'unknown' {
  if (!uri) return 'unknown';
  if (isCloudURL(uri)) return 'cloud';
  if (isLocalPath(uri)) return 'local';
  return 'unknown';
}

/**
 * Clear cached PDF from local cache (for testing)
 * @param batchId - Export batch ID
 * @returns true if file was deleted, false if it didn't exist
 */
export async function clearCachedPDF(batchId: string): Promise<boolean> {
  try {
    const fileName = `${batchId}.pdf`;
    const cacheDir = Paths?.cache?.uri;
    if (!cacheDir) {
      if (isDevLoggingEnabled) {
        debug.debug('Cache directory not available');
      }
      return false;
    }
    
    const localCachePath = cacheDir.endsWith('/') ? `${cacheDir}${fileName}` : `${cacheDir}/${fileName}`;
    
    try {
      const { getInfoAsync, deleteAsync } = await import('expo-file-system/legacy');
      const cacheInfo = await getInfoAsync(localCachePath);
      if (cacheInfo.exists) {
        await deleteAsync(localCachePath, { idempotent: true });
        if (isDevLoggingEnabled) {
          debug.debug('Cached PDF deleted', localCachePath);
        }
        return true;
      } else {
        if (isDevLoggingEnabled) {
          debug.debug('Cached PDF not found', localCachePath);
        }
        return false;
      }
    } catch (error) {
      debug.error('Error clearing cached PDF:', error);
      return false;
    }
  } catch (error) {
    debug.error('Failed to clear cached PDF:', error);
    return false;
  }
}
