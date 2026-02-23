/**
 * PDF Storage Service (local-only)
 * Handles local PDF cache management.
 */

import { Paths } from 'expo-file-system';
import { getInfoAsync, deleteAsync } from 'expo-file-system/legacy';
import { createScopedLogger } from '../utils/logger';
import { ExportBatch } from '../../types';

const debug = createScopedLogger('pdfStorage');

function looksLikeLocalPath(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('/') || uri.startsWith(Paths?.cache?.uri || '');
}

async function deleteLocalPdfIfExists(uri: string): Promise<void> {
  if (!looksLikeLocalPath(uri)) return;
  try {
    const info = await getInfoAsync(uri);
    if (info.exists) {
      await deleteAsync(uri, { idempotent: true });
      debug.debug('Deleted cached PDF', { uri: uri.substring(0, 80) });
    }
  } catch (err) {
    debug.warn('Failed to delete cached PDF (non-fatal):', err);
  }
}

/**
 * Check if a URI is a local path
 */
export function isLocalPath(uri: string): boolean {
  if (!uri) return false;
  if (uri.startsWith('file://')) return true;
  try {
    if (Paths?.cache?.uri && uri.includes(Paths.cache.uri)) return true;
  } catch (e) {
    // Paths might not be available, ignore
  }
  return true;
}

/**
 * Classify a PDF URI as either 'local' or 'unknown'
 */
export function classifyPdfUri(uri?: string | null): 'local' | 'unknown' {
  if (!uri) return 'unknown';
  if (isLocalPath(uri)) return 'local';
  return 'unknown';
}

/**
 * Best-effort cleanup of local cached PDFs for given export batches.
 */
export async function clearCachedPdfsForBatches(batches: ExportBatch[]): Promise<void> {
  for (const batch of batches) {
    if (batch.pdfUri) {
      await deleteLocalPdfIfExists(batch.pdfUri);
    }
  }
}

/**
 * Clear cached PDF from local cache
 */
export async function clearCachedPDF(batchId: string): Promise<boolean> {
  try {
    const fileName = `${batchId}.pdf`;
    const cacheDir = Paths?.cache?.uri;
    if (!cacheDir) {
      return false;
    }

    const localCachePath = cacheDir.endsWith('/') ? `${cacheDir}${fileName}` : `${cacheDir}/${fileName}`;

    const cacheInfo = await getInfoAsync(localCachePath);
    if (cacheInfo.exists) {
      await deleteAsync(localCachePath, { idempotent: true });
      debug.debug('Cached PDF deleted', localCachePath);
      return true;
    }
    return false;
  } catch (error) {
    debug.error('Failed to clear cached PDF:', error);
    return false;
  }
}

/**
 * Check if a URI is a cloud/remote URL (not a local file).
 * In offline mode, all PDFs are generated locally, so this always returns false.
 */
export function isCloudURL(uri: string): boolean {
  if (!uri) return false;
  return uri.startsWith('https://') || uri.startsWith('http://');
}

/**
 * Download a PDF from cloud storage to local cache.
 * Not used in offline mode — throws if called.
 */
export async function downloadPDFFromStorage(_cloudUri: string, _batchId: string, _preferredFileName?: string): Promise<string> {
  throw new Error('Cloud PDF storage is not supported in offline mode');
}
