import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('buildAVAC');

/**
 * Sanitize text for PDF rendering by removing problematic characters
 */
function sanitizeTextForPDF(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/[\r\n\t]/g, ' ') // Replace newlines, carriage returns, and tabs with spaces
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII characters
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Calculate text position and size to fit within a box with proper text wrapping algorithm
 * Implements word boundary wrapping with font size optimization
 */
function getTextPositionAndSize(box: { x: number; y: number; width?: number; height?: number }, text: string, font: any, maxFontSize: number = 12) {
  // Sanitize text to prevent encoding errors
  const sanitizedText = sanitizeTextForPDF(text);
  // For rotated text (90 degrees), we want bottom alignment within the box
  const width = box.width || 50; // Default width if not provided
  const height = box.height || 20; // Default height if not provided
  
  // For 90-degree rotated text, we need to center it properly
  // The text should be horizontally centered and vertically bottom-aligned
  const textX = box.x + width/2; // Horizontal center of the box
  
  // Use E1 positioning for all text (3 units East from bottom)
  const eastOffset = 2 + 3; // E1: +3 units East from bottom
  
  // For 90-degree rotated text, the X coordinate controls horizontal position
  // So we need to move the text East by adjusting the X coordinate
  const textY = box.y + 2; // Bottom alignment (blue dot position)
  const textXWithEast = box.x + width/2 + eastOffset; // East movement based on row
  
  // Calculate the maximum text dimensions that can fit in the box
  // When text is rotated 90 degrees, the text width becomes the height constraint
  // and the text height becomes the width constraint
  const maxTextWidth = height - 4; // Leave 2pt padding on each side
  const maxTextHeight = width - 4; // Leave 2pt padding on each side
  
  // Start with the maximum font size and try to fit text
  let fontSize = maxFontSize;
  let textWidth = font.widthOfTextAtSize(sanitizedText, fontSize);
  let textHeight = font.heightAtSize(fontSize);
  
  // First, try to shrink font size to fit in one line
  while ((textWidth > maxTextWidth || textHeight > maxTextHeight) && fontSize > 6) {
    fontSize -= 0.5;
    textWidth = font.widthOfTextAtSize(sanitizedText, fontSize);
    textHeight = font.heightAtSize(fontSize);
  }
  
  // If text still doesn't fit at minimum font size, implement proper word wrapping
  if (textWidth > maxTextWidth && fontSize <= 6) {
    const words = sanitizedText.split(' ');
    const lineHeight = textHeight + 1; // Add 1pt spacing between lines
    const maxLines = Math.floor(maxTextHeight / lineHeight);
    
    // Implement proper word boundary wrapping algorithm
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (testWidth <= maxTextWidth) {
        // Word fits on current line
        currentLine = testLine;
      } else {
        // Word doesn't fit, need to wrap
        if (currentLine) {
          // Save current line and start new line with current word
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Single word is too long, need to break it
          const maxChars = Math.floor(word.length * maxTextWidth / testWidth);
          if (maxChars > 0) {
            lines.push(word.substring(0, maxChars));
            currentLine = '';
          } else {
            // Word is too long even when broken, skip it
            currentLine = '';
          }
        }
      }
    }
    
    // Add the last line if it exists
    if (currentLine) {
      lines.push(currentLine);
    }
    
    // Limit to maximum number of lines that can fit
    if (lines.length > maxLines) {
      lines.splice(maxLines);
      // Add ellipsis to indicate truncation
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const truncated = lastLine.substring(0, Math.max(0, lastLine.length - 3)) + '...';
        lines[lines.length - 1] = truncated;
      }
    }
    
    // For multiline text, use normal positioning (not E1) to keep it within bounds
    return {
      x: textX, // Use normal centered positioning for multiline
      y: textY,
      size: fontSize,
      lines: lines,
      fits: lines.length <= maxLines
    };
  }
  
  // Text fits in one line
  return { 
    x: textXWithEast, 
    y: textY, 
    size: fontSize,
    lines: [sanitizedText],
    fits: textWidth <= maxTextWidth && textHeight <= maxTextHeight
  };
}

/**
 * Draw text with automatic wrapping and sizing within a box
 */
function drawTextInBox(page: any, text: string, box: { x: number; y: number; width?: number; height?: number }, font: any, options: any = {}) {
  // Sanitize text to prevent encoding errors
  const sanitizedText = sanitizeTextForPDF(text);
  
  // Use the smart text fitting logic
  const textInfo = getTextPositionAndSize(
    { x: box.x, y: box.y, width: box.width, height: box.height }, 
    sanitizedText, 
    font, 
    options.maxFontSize || 12
  );
  
  debug.debug(`Drawing text "${sanitizedText}" with smart fitting:`, {
    fontSize: textInfo.size,
    lines: textInfo.lines.length,
    fits: textInfo.fits
  });
  
  // Draw each line of text with proper spacing for rotated text
  textInfo.lines.forEach((line, index) => {
    // For rotated text, we need to offset each line horizontally (not vertically)
    // Since text is rotated 90 degrees, "lines" are actually stacked horizontally
    const lineSpacing = font.heightAtSize(textInfo.size) + 1; // Add 1pt spacing between lines
    const lineX = textInfo.x + (index * lineSpacing);
    
    page.drawText(line, {
      x: lineX,
      y: textInfo.y,
      size: textInfo.size,
      font: font,
      color: options.color || rgb(0, 0, 0),
      rotate: degrees(90), // Rotate text 90 degrees clockwise
    });
  });
}

import { Paths, File } from 'expo-file-system';
import { writeAsStringAsync, readAsStringAsync, getInfoAsync, copyAsync } from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Profile, OvertimeLog } from '../../types';
import { avacCoordinates, fontSizes, fontFamilies, getRowYPosition, getMaxRowsPerPage } from './maps/qld_avac_v85';
import { formatMinutes } from '../time';
// import Base64 from 'react-native-base64';

// ROOT CAUSE FIX: Normalize asset paths before registration
// This prevents Metro from generating httpServerLocation with ./ prefix
import { patchAssetSourceResolver } from '../metro/assetPathNormalizer';
patchAssetSourceResolver();

// Import the template asset at module level to ensure proper bundling
// Use a relative path that Metro can properly resolve
const AVAC_TEMPLATE_ASSET = require('../../assets/pdf/AVAC template horizontal.pdf');

// OTA template support (feature-flagged)
let otaAvacMapping: any | null = null;
async function tryLoadOTATemplate(): Promise<ArrayBuffer | null> {
  try {
    const { isTemplateOTAEnabled, ensureTemplateUpToDate, loadCachedPDFArrayBuffer } = await import('./templateLoader');
    if (!isTemplateOTAEnabled()) return null;
    const result = await ensureTemplateUpToDate('avac_normal');
    otaAvacMapping = result.mapping || null;
    if (result.pdfPath) {
      const buf = await loadCachedPDFArrayBuffer(result.pdfPath);
      if (buf && buf.byteLength > 10000) {
        debug.debug('Using OTA template version:', result.version);
        return buf;
      }
    }
  } catch (e) {
    // Extract meaningful error information for logging
    const errorInfo = e instanceof Error 
      ? { message: e.message, name: e.name, stack: e.stack?.split('\n').slice(0, 3).join('\n') }
      : { error: String(e) };
    // Also check for CodedError properties (expo-router)
    const codedErrorInfo = (e as any)?.code ? { code: (e as any).code } : {};
    debug.warn('OTA template load failed (non-fatal):', { ...errorInfo, ...codedErrorInfo });
  }
  return null;
}

function getMaxRowsPerPageResolved(): number {
  // If OTA mapping supplies an explicit max rows, prefer it; else use legacy helper
  try {
    if (otaAvacMapping && typeof otaAvacMapping?.table?.maxRows === 'number') {
      return otaAvacMapping.table.maxRows;
    }
  } catch {}
  return getMaxRowsPerPage();
}

/**
 * Copy template to cache directory
 */
async function copyTemplateToCache(): Promise<void> {
  try {
    const templatePath = `${Paths.cache.uri}/AVAC_Template_Horizontal.pdf`;
    const fileInfo = await getInfoAsync(templatePath);
    
    if (!fileInfo.exists) {
      debug.debug('Template not found in cache, attempting to copy from assets...');
      
      try {
        // Load the template asset using the proper Expo Asset approach
        const templateAsset = Asset.fromModule(AVAC_TEMPLATE_ASSET);
        debug.debug('Template asset created:', templateAsset);
        
        // Download the asset if needed
        if (!templateAsset.downloaded) {
          debug.debug('Downloading template asset...');
          debug.debug('Template asset URI:', templateAsset.uri);
          debug.debug('Template asset hash:', templateAsset.hash);
          try {
            // If it's a development server URL, try fetching directly first
            if (templateAsset.uri && (templateAsset.uri.startsWith('http://') || templateAsset.uri.startsWith('https://'))) {
              debug.debug('Attempting direct fetch from development server...');
              try {
              // Fix the URL encoding issue - Metro is generating incorrectly encoded paths
              let fetchUri = templateAsset.uri;
              
              // Decode the unstable_path parameter properly
              if (fetchUri.includes('unstable_path=')) {
                try {
                  const url = new URL(fetchUri);
                  const unstablePath = url.searchParams.get('unstable_path');
                  
                  if (unstablePath) {
                    // Decode the path - handle the case where platform=ios is embedded in the path
                    let decodedPath = unstablePath;
                    try {
                      // First, check if there's a query string embedded in the path
                      const pathMatch = unstablePath.match(/^([^?]+)(\?.*)?$/);
                      if (pathMatch) {
                        decodedPath = decodeURIComponent(pathMatch[1]);
                        // If there was a query string, we need to handle it separately
                        if (pathMatch[2]) {
                          // The query string is already in the URL, so we just need to fix the path
                          const queryParams = new URLSearchParams(pathMatch[2]);
                          queryParams.forEach((value, key) => {
                            url.searchParams.set(key, value);
                          });
                        }
                      } else {
                        decodedPath = decodeURIComponent(unstablePath);
                      }
                    } catch (e) {
                      // If decoding fails, try to fix it manually
                      decodedPath = unstablePath.replace(/%2F/g, '/').replace(/^\.%2F/, './');
                      // Remove any embedded query strings
                      const queryIndex = decodedPath.indexOf('?');
                      if (queryIndex > 0) {
                        decodedPath = decodedPath.substring(0, queryIndex);
                      }
                    }
                    
                    // Remove leading ./ if present (Metro doesn't handle this well)
                    if (decodedPath.startsWith('./')) {
                      decodedPath = decodedPath.substring(2);
                    }
                    
                    // Update the URL with the fixed path
                    url.searchParams.set('unstable_path', decodedPath);
                    fetchUri = url.toString();
                    debug.debug('Fixed URL encoding, trying:', fetchUri);
                  }
                } catch (urlError) {
                  // If URL parsing fails, try manual fix
                  if (fetchUri.includes('unstable_path=.%2Fassets%2Fpdf')) {
                    fetchUri = fetchUri.replace('unstable_path=.%2Fassets%2Fpdf', 'unstable_path=assets/pdf');
                    debug.debug('Manually fixed URL encoding, trying:', fetchUri);
                  }
                }
              }
                
                const response = await fetch(fetchUri);
                if (response.ok) {
                  const blob = await response.blob();
                  const arrayBuffer = await blob.arrayBuffer();
                  if (arrayBuffer.byteLength > 10000) {
                    // Valid PDF - save it directly
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                    const tempPath = `${Paths.cache.uri}/AVAC_Template_Temp_${Date.now()}.pdf`;
                    await writeAsStringAsync(tempPath, base64, { encoding: 'base64' });
                    // Copy to final location
                    await copyAsync({ from: tempPath, to: templatePath });
                    debug.debug('Template downloaded successfully via direct fetch');
                    return; // Success - exit early
                  } else {
                  debug.warn('Direct fetch returned file too small:', arrayBuffer.byteLength);
                  // Try to read the response text to see what we got
                  const text = await response.text();
                  debug.warn('Response text (first 200 chars):', text.substring(0, 200));
                  }
                } else {
                debug.warn('Direct fetch failed with status:', response.status);
                const text = await response.text().catch(() => '');
                debug.warn('Error response:', text.substring(0, 200));
                }
              } catch (fetchError) {
                debug.warn('Direct fetch failed, trying Asset.downloadAsync:', fetchError);
              }
            }
            
            // Fall back to Asset.downloadAsync
            await templateAsset.downloadAsync();
            debug.debug('Template asset download completed');
          } catch (downloadError) {
            debug.error('Template asset download failed:', downloadError);
            throw downloadError;
          }
        }
        
        debug.debug('Template asset downloaded, localUri:', templateAsset.localUri);
        debug.debug('Template asset URI:', templateAsset.uri);
        debug.debug('Template asset hash:', templateAsset.hash);
        
        if (templateAsset.localUri) {
          // Validate the downloaded file before copying
          try {
            const downloadedFileInfo = await getInfoAsync(templateAsset.localUri);
            debug.debug('Downloaded template file info:', downloadedFileInfo);
            
            if (downloadedFileInfo.exists && downloadedFileInfo.size) {
              const MIN_FILE_SIZE = 10000; // 10KB minimum
              if (downloadedFileInfo.size < MIN_FILE_SIZE) {
                debug.warn(`Downloaded template file too small (${downloadedFileInfo.size} bytes), likely corrupted. Skipping copy.`);
                debug.warn('Template asset URI:', templateAsset.uri);
                debug.warn('Template asset hash:', templateAsset.hash);
                // Try to read the file to see what it contains
                try {
                  const fileContent = await readAsStringAsync(templateAsset.localUri, { encoding: 'utf8' });
                  debug.warn('File content (first 200 chars):', fileContent.substring(0, 200));
                } catch (readError) {
                  debug.warn('Could not read file content:', readError);
                }
                throw new Error(`Downloaded file too small: ${downloadedFileInfo.size} bytes`);
              }
              
              // Copy the template to cache using the proper copyAsync syntax
              debug.debug('Copying template to cache...');
              await copyAsync({ from: templateAsset.localUri, to: templatePath });
              
              // Verify the copied file
              const copiedFileInfo = await getInfoAsync(templatePath);
              if (copiedFileInfo.exists && copiedFileInfo.size && copiedFileInfo.size >= MIN_FILE_SIZE) {
                debug.debug('Template copied to cache successfully, size:', copiedFileInfo.size);
              } else {
                throw new Error('Copied file validation failed');
              }
            } else {
              throw new Error('Downloaded file does not exist or has no size');
            }
          } catch (validationError) {
            debug.warn('Template validation failed, skipping copy:', validationError);
            throw validationError;
          }
        } else {
        debug.debug('Template asset localUri not available');
        debug.debug('Asset details:', {
            downloaded: templateAsset.downloaded,
            localUri: templateAsset.localUri,
            uri: templateAsset.uri
          });
        }
      } catch (assetError) {
      debug.error('Asset loading failed:', assetError);
      debug.debug('Asset loading error details:', assetError);
      }
    } else {
      debug.debug('Template already exists in cache');
    }
  } catch (error) {
    debug.error('Failed to copy template:', error);
    debug.debug('Copy template error details:', error);
  }
}

/**
 * Load AVAC template PDF
 * This function handles loading the template from assets
 */
async function loadAVACTemplate(): Promise<ArrayBuffer> {
  try {
    debug.debug('Attempting to load AVAC template...');

    // OTA path first if enabled
    const otaBuf = await tryLoadOTATemplate();
    if (otaBuf && otaBuf.byteLength > 0) {
      return otaBuf;
    }
    
    // Try to read the asset directly from the bundle (bypass Metro)
    // This works in production builds where assets are bundled
    // Skip this in development mode to avoid React Native module initialization errors
    try {
      // Only try this if we're in production mode (when assets are bundled)
      // In development mode, this causes errors with PushNotificationIOS initialization
      if (__DEV__) {
        // Skip bundle read in development mode to avoid errors
        throw new Error('Skipping bundle read in development mode');
      }
      
      debug.debug('Attempting to read asset directly from bundle...');
      // Use dynamic import to avoid loading react-native modules that might cause errors
      const { Image } = await import('react-native');
      if (Image && typeof Image.resolveAssetSource === 'function') {
        const assetSource = Image.resolveAssetSource(AVAC_TEMPLATE_ASSET);
        
        if (assetSource && assetSource.uri) {
          debug.debug('Asset source resolved:', assetSource);
          
          // If it's a local file path (production build), read it directly
          if (assetSource.uri.startsWith('file://') || assetSource.uri.startsWith('/')) {
            debug.debug('Reading asset from local file path:', assetSource.uri);
            const base64Data = await readAsStringAsync(assetSource.uri, { encoding: 'base64' });
            const MIN_BASE64_SIZE = 13000;
            
            if (base64Data.length > MIN_BASE64_SIZE) {
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              debug.debug('AVAC template loaded successfully from bundle, size:', bytes.length);
              return bytes.buffer;
            }
          }
          // If it's a remote URL, try fetching it
          else if (assetSource.uri.startsWith('http://') || assetSource.uri.startsWith('https://')) {
            debug.debug('Fetching asset from remote URL:', assetSource.uri);
            const response = await fetch(assetSource.uri);
            if (response.ok) {
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              if (arrayBuffer.byteLength > 10000) {
                const bytes = new Uint8Array(arrayBuffer);
                debug.debug('AVAC template loaded successfully from remote URL, size:', bytes.length);
                return bytes.buffer;
              }
            }
          }
        }
      }
    } catch (resolveError) {
      // Silently fail - this is expected in development mode
      // The error is usually "Cannot read property 'default' of undefined" or PushNotificationIOS initialization
      // which is harmless since we fall back to cache/Asset system
    }
    
    // First, check if template exists in cache (fastest path)
    const templatePath = `${Paths.cache.uri}/AVAC_Template_Horizontal.pdf`;
    const cacheFileInfo = await getInfoAsync(templatePath);
    
    if (cacheFileInfo.exists && cacheFileInfo.size && cacheFileInfo.size >= 10000) {
      debug.debug('Template found in cache, loading from cache...');
      const base64Data = await readAsStringAsync(templatePath, { encoding: 'base64' });
      const MIN_BASE64_SIZE = 13000;
      
      if (base64Data.length > MIN_BASE64_SIZE) {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        console.log('AVAC template loaded successfully from cache, size:', bytes.length);
        return bytes.buffer;
      }
    }
    
    // Try to copy template to cache if it doesn't exist or is corrupted
    // This ensures we have a working copy in cache
    try {
      await copyTemplateToCache();
      // After copying, try loading from cache again
      const newCacheFileInfo = await getInfoAsync(templatePath);
      if (newCacheFileInfo.exists && newCacheFileInfo.size && newCacheFileInfo.size >= 10000) {
        debug.debug('Template copied to cache, loading from cache...');
        const base64Data = await readAsStringAsync(templatePath, { encoding: 'base64' });
        const MIN_BASE64_SIZE = 13000;
        
        if (base64Data.length > MIN_BASE64_SIZE) {
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          debug.debug('AVAC template loaded successfully from cache after copy, size:', bytes.length);
          return bytes.buffer;
        }
      }
    } catch (copyError) {
      debug.warn('Failed to copy template to cache (non-fatal):', copyError);
      // Continue anyway - we'll try other methods
    }
    
    // Try the new AVAC template first using Asset system
    try {
      debug.debug('Loading AVAC template using Asset system...');
      const templateAsset = Asset.fromModule(AVAC_TEMPLATE_ASSET);
      
      debug.debug('Template asset URI:', templateAsset.uri);
      debug.debug('Template asset hash:', templateAsset.hash);
      
      if (!templateAsset.downloaded) {
        debug.debug('Downloading template asset...');
        try {
          // If it's a development server URL, try fetching directly first
          if (templateAsset.uri && (templateAsset.uri.startsWith('http://') || templateAsset.uri.startsWith('https://'))) {
            debug.debug('Attempting direct fetch from development server...');
            try {
              // Fix the URL encoding issue - Metro is generating incorrectly encoded paths
              let fetchUri = templateAsset.uri;
              
              // Decode the unstable_path parameter properly
              if (fetchUri.includes('unstable_path=')) {
                try {
                  const url = new URL(fetchUri);
                  const unstablePath = url.searchParams.get('unstable_path');
                  
                  if (unstablePath) {
                    // Decode the path - handle the case where platform=ios is embedded in the path
                    let decodedPath = unstablePath;
                    try {
                      // First, check if there's a query string embedded in the path
                      const pathMatch = unstablePath.match(/^([^?]+)(\?.*)?$/);
                      if (pathMatch) {
                        decodedPath = decodeURIComponent(pathMatch[1]);
                        // If there was a query string, we need to handle it separately
                        if (pathMatch[2]) {
                          // The query string is already in the URL, so we just need to fix the path
                          const queryParams = new URLSearchParams(pathMatch[2]);
                          queryParams.forEach((value, key) => {
                            url.searchParams.set(key, value);
                          });
                        }
                      } else {
                        decodedPath = decodeURIComponent(unstablePath);
                      }
                    } catch (e) {
                      // If decoding fails, try to fix it manually
                      decodedPath = unstablePath.replace(/%2F/g, '/').replace(/^\.%2F/, './');
                      // Remove any embedded query strings
                      const queryIndex = decodedPath.indexOf('?');
                      if (queryIndex > 0) {
                        decodedPath = decodedPath.substring(0, queryIndex);
                      }
                    }
                    
                    // Remove leading ./ if present (Metro doesn't handle this well)
                    if (decodedPath.startsWith('./')) {
                      decodedPath = decodedPath.substring(2);
                    }
                    
                    // Update the URL with the fixed path
                    url.searchParams.set('unstable_path', decodedPath);
                    fetchUri = url.toString();
                    debug.debug('Fixed URL encoding, trying:', fetchUri);
                  }
                } catch (urlError) {
                  // If URL parsing fails, try manual fix
                  if (fetchUri.includes('unstable_path=.%2Fassets%2Fpdf')) {
                    fetchUri = fetchUri.replace('unstable_path=.%2Fassets%2Fpdf', 'unstable_path=assets/pdf');
                    debug.debug('Manually fixed URL encoding, trying:', fetchUri);
                  }
                }
              }
              
              const response = await fetch(fetchUri);
              if (response.ok) {
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                if (arrayBuffer.byteLength > 10000) {
                  // Valid PDF - convert to base64 and return
                  const bytes = new Uint8Array(arrayBuffer);
                  debug.debug('Template loaded successfully via direct fetch, size:', bytes.length);
                  return bytes.buffer;
                } else {
                  debug.warn('Direct fetch returned file too small:', arrayBuffer.byteLength);
                  // Try to read the response text to see what we got
                  const text = await response.text();
                  debug.warn('Response text (first 200 chars):', text.substring(0, 200));
                }
              } else {
                debug.warn('Direct fetch failed with status:', response.status);
                const text = await response.text().catch(() => '');
                debug.warn('Error response:', text.substring(0, 200));
              }
            } catch (fetchError) {
              debug.warn('Direct fetch failed, trying Asset.downloadAsync:', fetchError);
            }
          }
          
          // Fall back to Asset.downloadAsync
          await templateAsset.downloadAsync();
          debug.debug('Template asset download completed');
        } catch (downloadError) {
          console.error('Template asset download failed:', downloadError);
          throw downloadError;
        }
      }
      
      console.log('Template asset downloaded, localUri:', templateAsset.localUri);
      
      if (templateAsset.localUri) {
        // Check file size before reading
        try {
          const fileInfo = await getInfoAsync(templateAsset.localUri);
          console.log('AVAC template file info:', fileInfo);
          
          if (fileInfo.exists && fileInfo.size) {
            // Validate file size (PDFs should be at least several KB)
            const MIN_FILE_SIZE = 10000; // 10KB minimum
            if (fileInfo.size < MIN_FILE_SIZE) {
              console.warn(`AVAC template file too small (${fileInfo.size} bytes), likely corrupted. Trying fallbacks...`);
              console.warn('Template asset URI:', templateAsset.uri);
              console.warn('Template asset hash:', templateAsset.hash);
              // Try to read the file to see what it contains
              try {
                const fileContent = await readAsStringAsync(templateAsset.localUri, { encoding: 'utf8' });
                console.warn('File content (first 200 chars):', fileContent.substring(0, 200));
              } catch (readError) {
                console.warn('Could not read file content:', readError);
              }
              throw new Error(`File too small: ${fileInfo.size} bytes`);
            }
            console.log(`AVAC template file size OK: ${fileInfo.size} bytes`);
          }
        } catch (fileInfoError) {
          console.warn('Could not check file info, proceeding anyway:', fileInfoError);
        }
        
        const base64Data = await readAsStringAsync(templateAsset.localUri, { encoding: 'base64' });
        console.log('Template data read, base64 length:', base64Data.length);
        
        // Validate that the file is reasonable size (PDFs should be at least several KB)
        // Base64 is ~4/3 the size of binary, so 1000 bytes binary = ~1333 base64 chars
        // Minimum reasonable PDF size: ~10KB binary = ~13KB base64
        const MIN_BASE64_SIZE = 13000;
        
        if (base64Data.length > MIN_BASE64_SIZE) {
          // Convert base64 to ArrayBuffer
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          console.log('AVAC template loaded successfully from Asset system, size:', bytes.length);
          return bytes.buffer;
        } else {
          console.warn(`AVAC template file too small (${base64Data.length} base64 chars), likely corrupted. Trying fallbacks...`);
        }
      }
    } catch (assetError) {
      console.log('Asset system loading failed:', assetError);
      console.error('Asset error details:', {
        message: assetError instanceof Error ? assetError.message : String(assetError),
        stack: assetError instanceof Error ? assetError.stack : undefined,
        assetUri: AVAC_TEMPLATE_ASSET
      });
    }
    
    // Try direct file path as fallback - try multiple path formats
    const directPaths = [
      'assets/pdf/AVAC template horizontal.pdf',
      './assets/pdf/AVAC template horizontal.pdf',
      '../assets/pdf/AVAC template horizontal.pdf',
      '../../assets/pdf/AVAC template horizontal.pdf',
    ];
    
    for (const newTemplatePath of directPaths) {
      console.log('Trying direct template path:', newTemplatePath);
      try {
        const base64Data = await readAsStringAsync(newTemplatePath, { encoding: 'base64' });
        console.log('Direct template data read, length:', base64Data.length);
        
        const MIN_BASE64_SIZE = 13000;
        if (base64Data.length > MIN_BASE64_SIZE) {
          // Convert base64 to ArrayBuffer
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          console.log('AVAC template loaded successfully from direct path, size:', bytes.length);
          return bytes.buffer;
        } else {
          console.warn(`Direct AVAC template file too small (${base64Data.length} base64 chars)`);
        }
      } catch (directError) {
        console.log('Direct template loading failed for path:', newTemplatePath, directError);
        // Continue to next path
      }
    }
    
    // Try the manually copied template as fallback - try runtime cache locations
    const cachePaths = [
      `${Paths.cache.uri}/AVAC_Template_Horizontal.pdf`,
      `${Paths.cache.uri}/AVAC template horizontal.pdf`,
    ];
    
    for (const manualTemplatePath of cachePaths) {
      console.log('Trying manual template path:', manualTemplatePath);
      try {
        const fileInfo = await getInfoAsync(manualTemplatePath);
        if (fileInfo.exists && fileInfo.size && fileInfo.size >= 10000) {
          const base64Data = await readAsStringAsync(manualTemplatePath, { encoding: 'base64' });
          console.log('Manual template data read, length:', base64Data.length);
          
          const MIN_BASE64_SIZE = 13000;
          if (base64Data.length > MIN_BASE64_SIZE) {
            // Convert base64 to ArrayBuffer
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            console.log('AVAC template loaded successfully from manual path, size:', bytes.length);
            return bytes.buffer;
          } else {
            console.warn(`Manual AVAC template file too small (${base64Data.length} base64 chars)`);
          }
        } else {
          console.log('Manual template path does not exist or is too small:', manualTemplatePath);
        }
      } catch (manualError) {
        console.log('Manual template loading failed for path:', manualTemplatePath, manualError);
        // Continue to next path
      }
    }
    
    // Fallback to cache directory (reuse templatePath from earlier)
    console.log('Trying cache template path:', templatePath);
    
    // Check if template exists in cache
    const fileInfo = await getInfoAsync(templatePath);
    console.log('Template file info:', fileInfo);
    
    if (fileInfo.exists) {
      console.log('Template found in cache, reading...');
      const base64Data = await readAsStringAsync(templatePath, { encoding: 'base64' });
      console.log('Template data read, length:', base64Data.length);
      
      const MIN_BASE64_SIZE = 13000;
      if (base64Data.length > MIN_BASE64_SIZE) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('AVAC template loaded successfully from cache, size:', bytes.length);
        return bytes.buffer;
      } else {
        console.warn(`Cache AVAC template file too small (${base64Data.length} base64 chars)`);
        console.log('Template file is too small, using fallback');
        return new ArrayBuffer(0);
      }
    } else {
      console.log('Template not found in cache, using fallback');
      return new ArrayBuffer(0);
    }
  } catch (error) {
    console.error('Failed to load AVAC template:', error);
    console.log('Template loading error details:', error);
    console.log('Using fallback - creating new PDF');
    return new ArrayBuffer(0);
  }
}

/**
 * Convert Uint8Array to base64 string (React Native compatible)
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  // Use btoa if available (web), otherwise use a simple base64 implementation
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  } else {
    // Simple base64 encoding for React Native
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    while (i < binary.length) {
      const a = binary.charCodeAt(i++);
      const b = i < binary.length ? binary.charCodeAt(i++) : 0;
      const c = i < binary.length ? binary.charCodeAt(i++) : 0;
      const bitmap = (a << 16) | (b << 8) | c;
      result += chars.charAt((bitmap >> 18) & 63);
      result += chars.charAt((bitmap >> 12) & 63);
      result += i - 2 < binary.length ? chars.charAt((bitmap >> 6) & 63) : '=';
      result += i - 1 < binary.length ? chars.charAt(bitmap & 63) : '=';
    }
    return result;
  }
}

/**
 * Parse first and last name from full name string
 * Handles edge cases like missing names, single names, multiple middle names
 */
function parseName(fullName: string): { firstName: string; lastName: string } | null {
  if (!fullName || typeof fullName !== 'string') {
    return null;
  }
  
  const trimmedName = fullName.trim();
  if (trimmedName.length === 0) {
    return null;
  }
  
  const nameParts = trimmedName.split(/\s+/);
  
  // Handle single name case
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '' };
  }
  
  // Handle multiple names - first name is first part, last name is last part
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  
  return { firstName, lastName };
}

/**
 * Generate filename with user's name if available
 */
function generateFileName(profile: Profile): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const nameInfo = parseName(profile.fullName);
  
  if (nameInfo && nameInfo.firstName && nameInfo.lastName) {
    // Both first and last name available
    const firstName = nameInfo.firstName.replace(/[^a-zA-Z0-9]/g, '_');
    const lastName = nameInfo.lastName.replace(/[^a-zA-Z0-9]/g, '_');
    return `AVAC_${firstName}_${lastName}_${dateStr}.pdf`;
  } else if (nameInfo && nameInfo.firstName) {
    // Only first name available
    const firstName = nameInfo.firstName.replace(/[^a-zA-Z0-9]/g, '_');
    return `AVAC_${firstName}_${dateStr}.pdf`;
  } else {
    // No valid name available, fall back to original format
    return `AVAC_${dateStr}.pdf`;
  }
}

/**
 * Build AVAC PDF with profile and overtime logs
 */
export async function buildAVAC(
  profile: Profile,
  logs: OvertimeLog[],
  customFileName?: string
): Promise<string> {
  try {
    // Load the AVAC template PDF
    const templateBytes = await loadAVACTemplate();
    let pdfDoc: any;
    let page: any;
    
    console.log('Template bytes length:', templateBytes.byteLength);
    
    if (templateBytes.byteLength > 0) {
      // Load existing template
      console.log('Loading AVAC template...');
      pdfDoc = await PDFDocument.load(templateBytes);
      const pages = pdfDoc.getPages();
      page = pages[0];
      
      // FIX: Keep template in original orientation, rotate text instead
      // The template is internally portrait (595.32 x 841.92) but designed for landscape viewing.
      // We'll rotate individual text elements 90 degrees clockwise to appear horizontal.
      console.log('Template loaded, will rotate text elements 90 degrees clockwise');
    } else {
      // Create new PDF (fallback)
      console.log('Creating new PDF (template loading failed)');
      pdfDoc = await PDFDocument.create();
      page = pdfDoc.addPage([avacCoordinates.page.width, avacCoordinates.page.height]);
    }
    
    // Load fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Generate coordinate mapper for debugging (disabled for production)
    // await generateCoordinateMapper(pdfDoc, page);
    
    // Draw profile information
    await drawProfileSection(page, profile, helvetica, helveticaBold);
    
    // Draw delegate information
    await drawDelegateSection(page, profile, helvetica, helveticaBold);
    
    // Table headers are now part of the template, so we skip drawTableHeader
    
    // Draw overtime logs
  const maxRowsPerPage = getMaxRowsPerPageResolved();
    let currentPage = page;
    let currentRow = 0;
    
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      
      if (currentRow >= maxRowsPerPage) {
        // Create new page by copying the first page (template with all headers/fields)
        console.log(`Creating new page for log ${i + 1} (currentRow: ${currentRow})`);
        
        // Copy the first page to get a fresh template with all fields
        const [copiedPage] = await pdfDoc.copyPages(pdfDoc, [0]);
        pdfDoc.addPage(copiedPage);
        
        // Get the newly added page
        const pages = pdfDoc.getPages();
        currentPage = pages[pages.length - 1];
        currentRow = 0;
        
        // Redraw profile and delegate sections on the new page
        await drawProfileSection(currentPage, profile, helvetica, helveticaBold);
        await drawDelegateSection(currentPage, profile, helvetica, helveticaBold);
      }
      
      await drawLogRow(currentPage, log, currentRow, profile, helvetica, helveticaBold);
      currentRow++;
    }
    
    // Draw totals on last page
    await drawTotals(currentPage, logs, helveticaBold);
    
    // Save PDF to file
    const pdfBytes = await pdfDoc.save();
    const fileName = customFileName || generateFileName(profile);
    
    // Use cache directory - Paths.cache is an object, we need to use its uri property
    const fileUri = `${Paths.cache.uri}/${fileName}`;
    
    // Convert Uint8Array to base64 string (React Native compatible)
    // Try using the built-in btoa if available, otherwise use custom function
    let base64String: string;
    try {
      // Convert Uint8Array to string first
      const binaryString = String.fromCharCode(...pdfBytes);
      base64String = btoa(binaryString);
    } catch (error) {
      console.log('btoa not available, using custom base64 encoding');
      base64String = uint8ArrayToBase64(pdfBytes);
    }
    
    // Use legacy API for now to ensure compatibility
    await writeAsStringAsync(fileUri, base64String, { encoding: 'base64' });
    
    console.log(`PDF generated: ${fileUri}`);
    return fileUri;
  } catch (error) {
    console.error('Failed to build AVAC PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Generate coordinate mapper for debugging field positions
 */
async function generateCoordinateMapper(pdfDoc: any, page: any) {
  try {
    console.log('Generating coordinate mapper...');
    
    // Add coordinate grid
    await drawCoordinateGrid(page);
    
    // Add field labels at key positions
    await drawFieldLabels(page);
    
    // Save the coordinate mapper PDF
    const pdfBytes = await pdfDoc.save() as Uint8Array;
    const fileName = `AVAC_Coordinate_Mapper_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Convert to base64 and save using a more efficient method
    let base64String: string;
    try {
      // Try using the built-in btoa if available (web), otherwise use custom function
      const binaryString = Array.from(pdfBytes, byte => String.fromCharCode(byte)).join('');
      base64String = btoa(binaryString);
    } catch (error) {
      console.log('btoa not available, using custom base64 encoding');
      base64String = uint8ArrayToBase64(pdfBytes);
    }
    
    // Save to cache directory
    const fileUri = `${Paths.cache.uri}/${fileName}`;
    await writeAsStringAsync(fileUri, base64String, { encoding: 'base64' });
    
    console.log(`Coordinate mapper PDF generated: ${fileUri}`);
    return fileUri;
  } catch (error) {
    console.error('Failed to create coordinate mapper:', error);
    throw error;
  }
}

/**
 * Draw coordinate grid on the page
 */
async function drawCoordinateGrid(page: any) {
  const { width, height } = page.getSize();
  const helvetica = await page.doc.embedFont(StandardFonts.Helvetica);
  
  // Draw vertical lines every 50 points
  for (let x = 0; x < width; x += 50) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: height },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    
    // Add X coordinate labels
    if (x > 0) {
      page.drawText(x.toString(), {
        x: x + 2,
        y: height - 20,
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0),
        rotate: degrees(90)
      });
    }
  }
  
  // Draw horizontal lines every 50 points
  for (let y = 0; y < height; y += 50) {
    page.drawLine({
      start: { x: 0, y },
      end: { x: width, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    
    // Add Y coordinate labels
    if (y > 0) {
      page.drawText(y.toString(), {
        x: 2,
        y: y - 2,
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0),
        rotate: degrees(90)
      });
    }
  }
}

/**
 * Draw field labels at key positions using field analyzer
 */
async function drawFieldLabels(page: any) {
  const helvetica = await page.doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await page.doc.embedFont(StandardFonts.HelveticaBold);
  
  // Import field analyzer
  const { avacFieldPositions, getTableRowFields } = await import('./field-analyzer');
  
  // Draw all field positions
  avacFieldPositions.forEach(field => {
    // Draw the field label
    page.drawText(field.name.toUpperCase(), {
      x: field.x,
      y: field.y,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 0, 0), // Red color for visibility
      rotate: degrees(90)
    });
    
    // Draw coordinates
    page.drawText(`(${field.x}, ${field.y})`, {
      x: field.x,
      y: field.y - 15,
      size: 8,
      font: helvetica,
      color: rgb(0, 0, 1), // Blue color for coordinates
    });
    
    // Draw description
    page.drawText(field.description, {
      x: field.x,
      y: field.y - 25,
      size: 8,
      font: helvetica,
      color: rgb(0, 0.5, 0), // Green color for description
      rotate: degrees(90)
    });
  });
  
  // Draw table rows 2-5 for reference
  for (let row = 1; row < 5; row++) {
    const rowFields = getTableRowFields(row);
    rowFields.forEach(field => {
      // Draw the field label
      page.drawText(field.name.toUpperCase(), {
        x: field.x,
        y: field.y,
        size: 8,
        font: helveticaBold,
        color: rgb(0.5, 0, 0), // Darker red for subsequent rows
        rotate: degrees(90)
      });
      
      // Draw coordinates
      page.drawText(`(${field.x}, ${field.y})`, {
        x: field.x,
        y: field.y - 12,
        size: 7,
        font: helvetica,
        color: rgb(0, 0, 0.5), // Darker blue for coordinates
      });
    });
  }
}

/**
 * Draw AVAC form structure that mimics the actual AVAC template
 */
async function drawAVACFormStructure(page: any, helvetica: any, helveticaBold: any) {
  const { width, height } = page.getSize();
  
  // Title
  page.drawText('Attendance Variation and Allowance Claim (AVAC)', {
    x: width / 2 - 150,
    y: height - 50,
    size: fontSizes.title,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Organisational Details Section
  page.drawText('Organisational Details', {
    x: 50,
    y: height - 100,
    size: fontSizes.header,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Organisational fields
  page.drawText('Organisational unit no.:', {
    x: 50,
    y: height - 120,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Organisational unit name:', {
    x: 50,
    y: height - 140,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Location:', {
    x: 50,
    y: height - 160,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Service enquiry number:', {
    x: 50,
    y: height - 180,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Employee Details Section
  page.drawText('Employee Details', {
    x: 50,
    y: height - 220,
    size: fontSizes.header,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Employee fields
  page.drawText('Employee Name:', {
    x: 50,
    y: height - 240,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Personnel assignment number:', {
    x: 50,
    y: height - 260,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Pay Level:', {
    x: 50,
    y: height - 280,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Cost Centre:', {
    x: 50,
    y: height - 300,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Claim Details Section
  page.drawText('Claim Details', {
    x: 50,
    y: height - 340,
    size: fontSizes.header,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Table headers
  const headers = ['Date', 'Rostered Start', 'Rostered Finish', 'Actual Start', 'Actual Finish', 'Meal Break', 'Minutes OT', 'Category'];
  const startX = 50;
  const startY = height - 360;
  const colWidth = 80;
  
  headers.forEach((header, index) => {
    page.drawText(header, {
      x: startX + (index * colWidth),
      y: startY,
      size: fontSizes.small,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: degrees(90)
    });
  });
  
  // Draw table rows (1-10)
  for (let i = 1; i <= 10; i++) {
    const rowY = startY - (i * 20);
    page.drawText(i.toString(), {
      x: startX,
      y: rowY,
      size: fontSizes.small,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: degrees(90)
    });
  }
  
  // Totals Section
  page.drawText('Totals', {
    x: 50,
    y: height - 580,
    size: fontSizes.header,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Approval Section
  page.drawText('Approval', {
    x: 50,
    y: height - 620,
    size: fontSizes.header,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Approval fields
  page.drawText('Delegate\'s full name:', {
    x: 50,
    y: height - 640,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Delegate\'s position title:', {
    x: 50,
    y: height - 660,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Area code:', {
    x: 50,
    y: height - 680,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Contact telephone number:', {
    x: 50,
    y: height - 700,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Date:', {
    x: 50,
    y: height - 720,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Delegate\'s Signature:', {
    x: 50,
    y: height - 740,
    size: fontSizes.body,
    font: helvetica,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
}

/**
 * Draw professional form structure (when no template is available)
 */
async function drawProfessionalFormStructure(page: any, helveticaBold: any): Promise<void> {
  // Draw title with proper formatting
  page.drawText('Attendance Variation and Allowance Claim (AVAC)', {
    x: 50,
    y: 800,
    size: fontSizes.title,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Draw organizational details section
  page.drawText('Organisational Details', {
    x: 50,
    y: 760,
    size: fontSizes.header,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Draw field labels
  page.drawText('Organisational unit no.:', {
    x: 50,
    y: 740,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Organisational unit name:', {
    x: 50,
    y: 720,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Location:', {
    x: 50,
    y: 700,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Service enquiry number:', {
    x: 50,
    y: 680,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Draw employee details section
  page.drawText('Employee Details', {
    x: 50,
    y: 640,
    size: fontSizes.header,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Employee Name:', {
    x: 50,
    y: 620,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Personnel assignment number:', {
    x: 50,
    y: 600,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Pay Level:', {
    x: 50,
    y: 580,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Draw table with proper structure
  page.drawText('Claim Details', {
    x: 50,
    y: 540,
    size: fontSizes.header,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Draw table headers with proper spacing
  const headers = ['Date', 'Rostered Start', 'Rostered Finish', 'Actual Start', 'Actual Finish', 'Meal Break', 'Minutes OT', 'Category'];
  const headerX = [50, 120, 180, 240, 300, 360, 420, 480];
  
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], {
      x: headerX[i],
      y: 520,
      size: fontSizes.small,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: degrees(90)
    });
  }
  
  // Draw table rows (10 rows)
  for (let i = 0; i < 10; i++) {
    const y = 500 - (i * 20);
    // Draw row number
    page.drawText(`${i + 1}`, {
      x: 30,
      y: y,
      size: fontSizes.small,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: degrees(90)
    });
  }
  
  // Draw totals section
  page.drawText('Totals', {
    x: 50,
    y: 280,
    size: fontSizes.header,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  // Draw approval section
  page.drawText('Approval', {
    x: 50,
    y: 240,
    size: fontSizes.header,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Delegate\'s full name:', {
    x: 50,
    y: 220,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Delegate\'s position title:', {
    x: 50,
    y: 200,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Area code:', {
    x: 50,
    y: 180,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Contact telephone number:', {
    x: 50,
    y: 160,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Date:', {
    x: 50,
    y: 140,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
  
  page.drawText('Delegate\'s Signature:', {
    x: 50,
    y: 120,
    size: fontSizes.body,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: degrees(90)
  });
}

/**
 * Draw profile section
 */
async function drawProfileSection(
  page: any,
  profile: Profile,
  helvetica: any,
  helveticaBold: any
): Promise<void> {
  console.log('📝 Drawing profile section...');
  
  // Draw organisational unit number (8 digits)
  const orgUnitBoxes = [
    avacCoordinates.profile.orgUnitNo_box1,
    avacCoordinates.profile.orgUnitNo_box2,
    avacCoordinates.profile.orgUnitNo_box3,
    avacCoordinates.profile.orgUnitNo_box4,
    avacCoordinates.profile.orgUnitNo_box5,
    avacCoordinates.profile.orgUnitNo_box6,
    avacCoordinates.profile.orgUnitNo_box7,
    avacCoordinates.profile.orgUnitNo_box8
  ];
  
  for (let i = 0; i < profile.orgUnitNo.length && i < orgUnitBoxes.length; i++) {
    drawTextInBox(page, profile.orgUnitNo[i], orgUnitBoxes[i], helvetica, { 
      maxFontSize: 14, 
      color: rgb(0, 0, 0) 
    });
  }
  
  // Draw organisational unit name (department)
  console.log('📝 Drawing org unit name (department):', profile.orgUnitName, 'at:', avacCoordinates.profile.orgUnitName);
  drawTextInBox(page, profile.orgUnitName, avacCoordinates.profile.orgUnitName, helvetica, { 
    color: rgb(0, 0, 0) 
  });
  
  // Draw location (hospital)
  console.log('📝 Drawing location (hospital):', profile.location, 'at:', avacCoordinates.profile.location);
  drawTextInBox(page, profile.location, avacCoordinates.profile.location, helvetica, { 
    color: rgb(0, 0, 0) 
  });
  
  // Draw service enquiry number if provided
  if (profile.serviceEnquiryNumber) {
    drawTextInBox(page, profile.serviceEnquiryNumber, avacCoordinates.profile.serviceEnquiryNumber, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  console.log('✅ Profile section completed');
}

/**
 * Draw delegate section
 */
async function drawDelegateSection(
  page: any,
  profile: Profile,
  helvetica: any,
  helveticaBold: any
): Promise<void> {
  console.log('📝 Drawing delegate section...');
  console.log('Profile delegate properties:', {
    delegateName: profile.delegateName,
    delegatePosition: profile.delegatePosition,
    delegatePhone: profile.delegatePhone,
    hasDelegateName: 'delegateName' in profile,
    profileKeys: Object.keys(profile)
  });
  
  // Employee initial is now handled in log rows, no delegate signature needed
  
  // Draw delegate full name
  drawTextInBox(page, profile.delegateName || '', avacCoordinates.delegate.delegateFullName, helvetica, { 
    color: rgb(0, 0, 0) 
  });
  
  // Draw delegate position title
  drawTextInBox(page, profile.delegatePosition || '', avacCoordinates.delegate.delegatePosition, helvetica, { 
    color: rgb(0, 0, 0) 
  });
  
  // Draw contact telephone number
  drawTextInBox(page, profile.delegatePhone || '', avacCoordinates.delegate.contactPhone, helvetica, { 
    color: rgb(0, 0, 0) 
  });
  
  // Draw approval date (current date)
  const currentDate = new Date().toLocaleDateString('en-AU');
  drawTextInBox(page, currentDate, avacCoordinates.delegate.approvalDate, helvetica, { 
    color: rgb(0, 0, 0) 
  });
  
  console.log('✅ Delegate section completed');
}

/**
 * Draw table header
 */
async function drawTableHeader(page: any, helveticaBold: any): Promise<void> {
  const table = avacCoordinates.table;
  
  const headers = [
    { text: 'Date', x: table.date_row1.x, y: table.date_row1.y },
    { text: 'Rostered Start', x: table.rosteredStart_row1.x, y: table.rosteredStart_row1.y },
    { text: 'Rostered Finish', x: table.rosteredFinish_row1.x, y: table.rosteredFinish_row1.y },
    { text: 'Actual Start', x: table.actualStart_row1.x, y: table.actualStart_row1.y },
    { text: 'Actual Finish', x: table.actualFinish_row1.x, y: table.actualFinish_row1.y },
    { text: 'Meal Break', x: table.mealBreak_row1.x, y: table.mealBreak_row1.y },
    { text: 'Minutes OT', x: table.minutesOvertime_row1.x, y: table.minutesOvertime_row1.y },
    { text: 'Category', x: table.category_row1.x, y: table.category_row1.y },
  ];
  
  for (const header of headers) {
    page.drawText(header.text, {
      x: header.x,
      y: header.y,
      size: fontSizes.header,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: degrees(90)
    });
  }
}

/**
 * Draw a single log row
 */
async function drawLogRow(
  page: any,
  log: OvertimeLog,
  rowIndex: number,
  profile: Profile,
  helvetica: any,
  helveticaBold: any
): Promise<void> {
  console.log(`📝 Drawing log row ${rowIndex + 1} for log ${log.id}`);
  
  // Get the row coordinates from the new coordinate system
  const rowNum = rowIndex + 1; // Convert 0-based to 1-based row number
  
  // Format date
  const date = new Date(log.date).toLocaleDateString('en-AU');
  
  // Draw employee name (use swap partner details for shift swap Person B logs)
  const employeeNameBox = avacCoordinates.table[`employeeName_row${rowNum}`];
  console.log(`📝 Employee name box for row ${rowNum}:`, employeeNameBox);
  if (employeeNameBox) {
    // For shift swaps, identify Person B's log by checking if initials don't match profile
    // Person A's log will have initials matching profile.employeeInitial
    // Person B's log will have different initials
    let employeeName = profile.fullName;
    const isPersonBLog = log.isShiftSwap && 
                         log.swapPartnerName && 
                         log.initials && 
                         profile.employeeInitial && 
                         log.initials.toUpperCase() !== profile.employeeInitial.toUpperCase();
    
    if (isPersonBLog) {
      // This is Person B's log - use Person B's details from swapPartner fields
      employeeName = log.swapPartnerName || profile.fullName;
      console.log(`📝 Drawing employee name (Person B): ${employeeName} (initials: ${log.initials} vs profile: ${profile.employeeInitial})`);
    } else {
      // This is Person A's log or a regular log - use profile
      employeeName = profile.fullName;
      console.log(`📝 Drawing employee name (Person A/Regular): ${employeeName} (initials: ${log.initials})`);
    }
    drawTextInBox(page, employeeName, employeeNameBox, helvetica, { color: rgb(0, 0, 0) });
  } else {
    console.log(`❌ No employee name box found for row ${rowNum}`);
  }

  // Draw pay level (use swap partner pay level for shift swap Person B logs)
  const payLevelBox = avacCoordinates.table[`payLevel_row${rowNum}`];
  if (payLevelBox) {
    // Same logic: identify Person B by initials mismatch
    const isPersonBLog = log.isShiftSwap && 
                         log.swapPartnerName && 
                         log.initials && 
                         profile.employeeInitial && 
                         log.initials.toUpperCase() !== profile.employeeInitial.toUpperCase();
    
    let payLevel = profile.payLevel;
    if (isPersonBLog && log.swapPartnerPayLevel) {
      payLevel = log.swapPartnerPayLevel;
    }
    drawTextInBox(page, payLevel, payLevelBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw date
  const dateBox = avacCoordinates.table[`date_row${rowNum}`];
  if (dateBox) {
    drawTextInBox(page, date, dateBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw rostered start
  const rosteredStartBox = avacCoordinates.table[`rosteredStart_row${rowNum}`];
  if (rosteredStartBox && log.rosteredStart) {
    const rosteredStartText = log.rosteredStart === 'N/A' ? '-' : log.rosteredStart;
    drawTextInBox(page, rosteredStartText, rosteredStartBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw rostered finish
  const rosteredFinishBox = avacCoordinates.table[`rosteredFinish_row${rowNum}`];
  if (rosteredFinishBox && log.rosteredFinish) {
    const rosteredFinishText = log.rosteredFinish === 'N/A' ? '-' : log.rosteredFinish;
    drawTextInBox(page, rosteredFinishText, rosteredFinishBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw actual start
  const actualStartBox = avacCoordinates.table[`actualStart_row${rowNum}`];
  if (actualStartBox) {
    const actualStartText = log.actualStart === 'N/A' ? '-' : log.actualStart;
    drawTextInBox(page, actualStartText, actualStartBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw actual finish
  const actualFinishBox = avacCoordinates.table[`actualFinish_row${rowNum}`];
  if (actualFinishBox) {
    const actualFinishText = log.actualFinish === 'N/A' ? '-' : log.actualFinish;
    drawTextInBox(page, actualFinishText, actualFinishBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw meal break minutes
  const mealBreakBox = avacCoordinates.table[`mealBreak_row${rowNum}`];
  if (mealBreakBox) {
    const mealBreakText = `${log.mealBreakMinutes || 0}`;
    drawTextInBox(page, mealBreakText, mealBreakBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw overtime/oncall/recall category
  const overtimeBox = avacCoordinates.table[`overtime_row${rowNum}`];
  if (overtimeBox) {
    drawTextInBox(page, log.category, overtimeBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw comments
  const commentsBox = avacCoordinates.table[`comments_row${rowNum}`];
  if (commentsBox && log.comments) {
    drawTextInBox(page, log.comments, commentsBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw personnel assignment number (use swap partner payroll number for shift swap Person B logs)
  const personnelBox = avacCoordinates.table[`personnelAssignmentNo_row${rowNum}`];
  if (personnelBox) {
    // Same logic: identify Person B by initials mismatch
    const isPersonBLog = log.isShiftSwap && 
                         log.swapPartnerName && 
                         log.initials && 
                         profile.employeeInitial && 
                         log.initials.toUpperCase() !== profile.employeeInitial.toUpperCase();
    
    let payrollNumber = profile.payrollNumber;
    if (isPersonBLog && log.swapPartnerPayrollNumber) {
      payrollNumber = log.swapPartnerPayrollNumber;
    }
    drawTextInBox(page, payrollNumber, personnelBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw employee initials
  // Always draw initials for all logs (both Person A and Person B in shift swaps, and regular logs)
  const initialsBox = avacCoordinates.table[`employeeInitial_row${rowNum}`];
  if (initialsBox && log.initials) {
    drawTextInBox(page, log.initials, initialsBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw tickbox for concurrent employment (only if log.concurrentEmployment is true)
  const tickbox = avacCoordinates.table[`tickbox_row${rowNum}`];
  if (tickbox && log.concurrentEmployment) {
    // Draw 'X' in the tickbox with adjusted X positioning only
    const tickboxWidth = tickbox.width || 10; // Default width if not provided
    const tickboxHeight = tickbox.height || 10; // Default height if not provided
    page.drawText('X', {
      x: tickbox.x + tickboxWidth / 2 + 2, // Adjusted X positioning (moved right)
      y: tickbox.y + tickboxHeight / 2 - 3, // Original Y positioning (no change)
      size: 12,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: degrees(90), // Rotate the 'X'
    });
  }
  
  console.log(`✅ Completed log row ${rowIndex + 1}`);
}

/**
 * Draw totals section
 */
async function drawTotals(
  page: any,
  logs: OvertimeLog[],
  helveticaBold: any
): Promise<void> {
  // Skip totals section to avoid drawing text in wrong location
  console.log('📝 Skipping totals section to avoid drawing text in wrong location');
  return;
  
  console.log('✅ Totals section completed');
}

/**
 * Validate logs before PDF generation
 */
export function validateLogsForPDF(logs: OvertimeLog[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (logs.length === 0) {
    errors.push('No logs to export');
  }
  
  const readyLogs = logs.filter(log => log.status === 'ready');
  if (readyLogs.length === 0) {
    errors.push('No ready logs to export');
  }
  
  const maxRowsPerPage = getMaxRowsPerPage();
  if (readyLogs.length > maxRowsPerPage * 3) { // Allow up to 3 pages
    errors.push(`Too many logs (${readyLogs.length}). Maximum ${maxRowsPerPage * 3} logs allowed.`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get PDF file info
 */
export async function getPDFInfo(fileUri: string): Promise<{
  size: number;
  exists: boolean;
  uri: string;
}> {
  try {
    const info = await getInfoAsync(fileUri);
    return {
      size: info.exists ? info.size || 0 : 0,
      exists: info.exists,
      uri: fileUri,
    };
  } catch (error) {
    console.error('Failed to get PDF info:', error);
    return {
      size: 0,
      exists: false,
      uri: fileUri,
    };
  }
}
