/**
 * PDF cache cleanup utility
 * Deletes cached PDFs older than the specified TTL (Time To Live)
 * 
 * This helps manage local storage and reduces exposure of old PDF files
 */

import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import { createScopedLogger } from './logger';

const PDF_CACHE_TTL_DAYS = 30; // Delete PDFs older than 30 days
const debug = createScopedLogger('cacheCleanup');

/**
 * Clean up cached PDFs older than the TTL
 * @returns Number of PDFs deleted
 */
export async function cleanupOldPDFs(): Promise<number> {
  try {
    const cacheDir = Paths?.cache?.uri;
    if (!cacheDir) {
      debug.debug('Cache directory not available');
      return 0;
    }

    debug.debug('Starting PDF cache cleanup...');
    
    // Get all files in cache directory
    const { getInfoAsync, readDirectoryAsync } = await import('expo-file-system/legacy');
    const cacheInfo = await getInfoAsync(cacheDir);
    
    if (!cacheInfo.exists || !cacheInfo.isDirectory) {
      debug.debug('Cache directory does not exist or is not a directory');
      return 0;
    }

    const files = await readDirectoryAsync(cacheDir);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      debug.debug('No PDF files found in cache');
      return 0;
    }

    debug.debug(`Found ${pdfFiles.length} PDF file(s) in cache`);

    const now = Date.now();
    const ttlMs = PDF_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    let deletedCount = 0;

    for (const pdfFile of pdfFiles) {
      try {
        const filePath = cacheDir.endsWith('/') 
          ? `${cacheDir}${pdfFile}` 
          : `${cacheDir}/${pdfFile}`;
        
        const fileInfo = await getInfoAsync(filePath);
        
        if (fileInfo.exists && fileInfo.modificationTime) {
          const fileAge = now - fileInfo.modificationTime * 1000; // modificationTime is in seconds
          
          if (fileAge > ttlMs) {
            // File is older than TTL, delete it
            await FileSystem.deleteAsync(filePath, { idempotent: true });
            deletedCount++;
            debug.debug(`Deleted old PDF: ${pdfFile} (age: ${Math.floor(fileAge / (24 * 60 * 60 * 1000))} days)`);
          } else {
            debug.debug(`Keeping PDF: ${pdfFile} (age: ${Math.floor(fileAge / (24 * 60 * 60 * 1000))} days)`);
          }
        }
      } catch (fileError) {
        // Non-fatal - continue with other files
        debug.warn(`Failed to process PDF file ${pdfFile}:`, fileError);
      }
    }

    debug.debug(`PDF cache cleanup complete. Deleted ${deletedCount} file(s)`);
    return deletedCount;
  } catch (error) {
    debug.error('Failed to cleanup PDF cache:', error);
    return 0;
  }
}

/**
 * Get the TTL in days
 */
export function getCacheTTLDays(): number {
  return PDF_CACHE_TTL_DAYS;
}

