import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { Paths } from 'expo-file-system';
import { writeAsStringAsync, readAsStringAsync, getInfoAsync, copyAsync } from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Profile, OvertimeLog } from '../../types';

// Import SMO coordinates from the worksheet
import smoCoordinates from '../../preview-coordinates-worksheet-smo.json';

// OTA template support (feature-flagged)
let otaSmoMapping: any | null = null;
async function tryLoadOTASMOTemplate(): Promise<ArrayBuffer | null> {
  try {
    const { isTemplateOTAEnabled, ensureTemplateUpToDate, loadCachedPDFArrayBuffer } = await import('./templateLoader');
    if (!isTemplateOTAEnabled()) return null;
    const result = await ensureTemplateUpToDate('avac_smo');
    otaSmoMapping = result.mapping || null;
    if (result.pdfPath) {
      const buf = await loadCachedPDFArrayBuffer(result.pdfPath);
      if (buf && buf.byteLength > 10000) {
        console.log('[SMO AVAC] Using OTA template version:', result.version);
        return buf;
      }
    }
  } catch (e) {
    console.warn('[SMO AVAC] OTA template load failed (non-fatal):', e);
  }
  return null;
}

function getMaxRowsPerPageResolved(defaultRows: number): number {
  try {
    if (otaSmoMapping && typeof otaSmoMapping?.table?.maxRows === 'number') {
      return otaSmoMapping.table.maxRows;
    }
  } catch {}
  return defaultRows;
}
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
function getTextPositionAndSize(box: { x: number; y: number; width?: number; height?: number }, text: string, font: any, maxFontSize: number = 12, rowNumber?: number) {
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
function drawTextInBox(page: any, text: string, box: { left: number; top: number; width?: number; height?: number }, font: any, options: any = {}, rowNumber?: number) {
  // Convert Preview coordinates to PDF coordinates
  const x = box.left;
  const y = page.getHeight() - (box.top + (box.height || 20));
  const width = box.width || 50;
  const height = box.height || 20;
  
  // Use the smart text fitting logic
  const textInfo = getTextPositionAndSize(
    { x, y, width, height }, 
    text, 
    font, 
    options.maxFontSize || 12,
    rowNumber
  );
  
  console.log(`📝 Drawing text "${text}" with smart fitting:`, {
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

/**
 * Draw a green overlay box for field verification
 */
function drawFieldOverlay(page: any, box: { left: number; top: number; width?: number; height?: number }, label: string, font: any) {
  // Convert Preview coordinates to PDF coordinates
  const x = box.left;
  const y = page.getHeight() - (box.top + (box.height || 20));
  const width = box.width || 50;
  const height = box.height || 20;
  
  // Draw green rectangle
  page.drawRectangle({
    x: x,
    y: y,
    width: width,
    height: height,
    borderColor: rgb(0, 1, 0), // Green border
    borderWidth: 2,
    color: rgb(0, 0.8, 0), // Green fill
    opacity: 0.2,
  });
  
  // Draw field label
  page.drawText(label, {
    x: x + 2,
    y: y + height - 2,
    size: 8,
    font: font,
    color: rgb(0, 0.5, 0), // Dark green text
    rotate: degrees(90),
  });
  
}

/**
 * Copy SMO template to cache directory
 */
async function copySMOAVACTemplateToCache(): Promise<void> {
  try {
    const templatePath = `${Paths.cache.uri}/SMO_AVAC_Template.pdf`;
    const fileInfo = await getInfoAsync(templatePath);
    
    if (!fileInfo.exists) {
      console.log('SMO template not found in cache, attempting to copy from assets...');
      
      try {
        // Load the template asset using the proper Expo Asset approach
        const templateAsset = Asset.fromModule(require('../../assets/pdf/SMO AVAC Template.pdf'));
        console.log('SMO template asset created:', templateAsset);
        
        // Download the asset if needed
        if (!templateAsset.downloaded) {
          console.log('Downloading SMO template asset...');
          await templateAsset.downloadAsync();
          console.log('SMO template asset download completed');
        }
        
        console.log('SMO template asset downloaded, localUri:', templateAsset.localUri);
        
        if (templateAsset.localUri) {
          // Validate the downloaded file before copying
          try {
            const downloadedFileInfo = await getInfoAsync(templateAsset.localUri);
            console.log('Downloaded SMO template file info:', downloadedFileInfo);
            
            if (downloadedFileInfo.exists && downloadedFileInfo.size) {
              const MIN_FILE_SIZE = 10000; // 10KB minimum
              if (downloadedFileInfo.size < MIN_FILE_SIZE) {
                console.warn(`Downloaded SMO template file too small (${downloadedFileInfo.size} bytes), likely corrupted. Skipping copy.`);
                throw new Error(`Downloaded file too small: ${downloadedFileInfo.size} bytes`);
              }
              
              // Copy the template to cache using the proper copyAsync syntax
              console.log('Copying SMO template to cache...');
              await copyAsync({ from: templateAsset.localUri, to: templatePath });
              
              // Verify the copied file
              const copiedFileInfo = await getInfoAsync(templatePath);
              if (copiedFileInfo.exists && copiedFileInfo.size && copiedFileInfo.size >= MIN_FILE_SIZE) {
                console.log('SMO template copied to cache successfully, size:', copiedFileInfo.size);
              } else {
                throw new Error('Copied file validation failed');
              }
            } else {
              throw new Error('Downloaded file does not exist or has no size');
            }
          } catch (validationError) {
            console.warn('SMO template validation failed, skipping copy:', validationError);
            throw validationError;
          }
        } else {
          console.log('SMO template asset localUri not available');
          console.log('Asset details:', {
            downloaded: templateAsset.downloaded,
            localUri: templateAsset.localUri,
            uri: templateAsset.uri
          });
        }
      } catch (assetError) {
        console.error('SMO asset loading failed:', assetError);
        console.log('SMO asset loading error details:', assetError);
      }
    } else {
      console.log('SMO template already exists in cache');
    }
  } catch (error) {
    console.error('Failed to copy SMO template:', error);
    console.log('Copy SMO template error details:', error);
  }
}

/**
 * Load SMO AVAC template PDF
 */
async function loadSMOAVACTemplate(): Promise<ArrayBuffer> {
  try {
    console.log('Loading SMO AVAC template...');

    // OTA path first if enabled
    const otaBuf = await tryLoadOTASMOTemplate();
    if (otaBuf && otaBuf.byteLength > 0) {
      return otaBuf;
    }
    
    // First, check if template exists in cache (fastest path)
    const templatePath = `${Paths.cache.uri}/SMO_AVAC_Template.pdf`;
    const cacheFileInfo = await getInfoAsync(templatePath);
    
    if (cacheFileInfo.exists && cacheFileInfo.size && cacheFileInfo.size >= 10000) {
      console.log('SMO template found in cache, loading from cache...');
      const base64Data = await readAsStringAsync(templatePath, { encoding: 'base64' });
      const MIN_BASE64_SIZE = 13000;
      
      if (base64Data.length > MIN_BASE64_SIZE) {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        console.log('SMO AVAC template loaded successfully from cache, size:', bytes.length);
        return bytes.buffer;
      }
    }
    
    // Try to copy template to cache if it doesn't exist or is corrupted
    // This ensures we have a working copy in cache
    try {
      await copySMOAVACTemplateToCache();
      // After copying, try loading from cache again
      const newCacheFileInfo = await getInfoAsync(templatePath);
      if (newCacheFileInfo.exists && newCacheFileInfo.size && newCacheFileInfo.size >= 10000) {
        console.log('SMO template copied to cache, loading from cache...');
        const base64Data = await readAsStringAsync(templatePath, { encoding: 'base64' });
        const MIN_BASE64_SIZE = 13000;
        
        if (base64Data.length > MIN_BASE64_SIZE) {
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          console.log('SMO AVAC template loaded successfully from cache after copy, size:', bytes.length);
          return bytes.buffer;
        }
      }
    } catch (copyError) {
      console.warn('Failed to copy SMO template to cache (non-fatal):', copyError);
      // Continue anyway - we'll try other methods
    }
    
    // Try the SMO template using Asset system
    try {
      console.log('Loading SMO template using Asset system...');
      const templateAsset = Asset.fromModule(require('../../assets/pdf/SMO AVAC Template.pdf'));
      
      if (!templateAsset.downloaded) {
        console.log('Downloading SMO template asset...');
        await templateAsset.downloadAsync();
      }
      
      console.log('SMO template asset downloaded, localUri:', templateAsset.localUri);
      
      if (templateAsset.localUri) {
        // Check file size before reading
        try {
          const fileInfo = await getInfoAsync(templateAsset.localUri);
          console.log('SMO template file info:', fileInfo);
          
          if (fileInfo.exists && fileInfo.size) {
            // Validate file size (PDFs should be at least several KB)
            const MIN_FILE_SIZE = 10000; // 10KB minimum
            if (fileInfo.size < MIN_FILE_SIZE) {
              console.warn(`SMO template file too small (${fileInfo.size} bytes), likely corrupted. Trying fallbacks...`);
              throw new Error(`File too small: ${fileInfo.size} bytes`);
            }
            console.log(`SMO template file size OK: ${fileInfo.size} bytes`);
          }
        } catch (fileInfoError) {
          console.warn('Could not check file info, proceeding anyway:', fileInfoError);
        }
        
        const base64Data = await readAsStringAsync(templateAsset.localUri, { encoding: 'base64' });
        console.log('SMO template data read, base64 length:', base64Data.length);
        
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
          
          console.log('SMO AVAC template loaded successfully from Asset system, size:', bytes.length);
          return bytes.buffer;
        } else {
          console.warn(`SMO template file too small (${base64Data.length} base64 chars), likely corrupted. Trying fallbacks...`);
        }
      }
    } catch (assetError) {
      console.log('Asset system loading failed:', assetError);
    }
    
    // Try direct file path as fallback
    const directTemplatePath = 'assets/pdf/SMO AVAC Template.pdf';
    console.log('Trying direct template path:', directTemplatePath);
    
    try {
      const base64Data = await readAsStringAsync(directTemplatePath, { encoding: 'base64' });
      console.log('Direct SMO template data read, length:', base64Data.length);
      
      const MIN_BASE64_SIZE = 13000;
      if (base64Data.length > MIN_BASE64_SIZE) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('SMO AVAC template loaded successfully from direct path, size:', bytes.length);
        return bytes.buffer;
      } else {
        console.warn(`Direct SMO template file too small (${base64Data.length} base64 chars)`);
      }
    } catch (directError) {
      console.log('Direct template loading failed:', directError);
    }
    
    // Fallback to cache directory (reuse templatePath from earlier)
    console.log('Trying cache template path:', templatePath);
    
    try {
      // Check if template exists in cache
      const fileInfo = await getInfoAsync(templatePath);
      console.log('SMO Template file info:', fileInfo);
      
      if (fileInfo.exists) {
        console.log('SMO Template found in cache, reading...');
        const base64Data = await readAsStringAsync(templatePath, { encoding: 'base64' });
        console.log('Cache SMO template data read, length:', base64Data.length);
        
        const MIN_BASE64_SIZE = 13000;
        if (base64Data.length > MIN_BASE64_SIZE) {
          // Convert base64 to ArrayBuffer
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          console.log('SMO AVAC template loaded successfully from cache, size:', bytes.length);
          return bytes.buffer;
        } else {
          console.warn(`Cache SMO template file too small (${base64Data.length} base64 chars)`);
        }
      } else {
        console.log('SMO Template not found in cache');
      }
    } catch (cacheError) {
      console.log('Cache template loading failed:', cacheError);
    }
    
    throw new Error('Failed to load SMO template: all loading methods failed or file is too small');
  } catch (error) {
    console.error('Failed to load SMO AVAC template:', error);
    throw error;
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
      result += chars.charAt((bitmap >> 6) & 63);
      result += chars.charAt(bitmap & 63);
    }
    return result;
  }
}

/**
 * Generate filename for SMO test AVAC
 */
function generateSMOFileName(): string {
  const dateStr = new Date().toISOString().split('T')[0];
  return `SMO_AVAC_Test_Overlay_${dateStr}.pdf`;
}

/**
 * Draw header section on SMO AVAC page
 */
async function drawSMOHeaderSection(
  page: any,
  profile: Profile,
  helvetica: any,
  helveticaBold: any
): Promise<void> {
  console.log('📝 Drawing SMO header section...');
  
  // Employee Name
  if (smoCoordinates.fields.header.employeeName) {
    drawTextInBox(page, profile.fullName, smoCoordinates.fields.header.employeeName, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  // Organisational Unit No. - 8 boxes
  for (let i = 1; i <= 8; i++) {
    const boxKey = `orgUnitNo_box${i}` as keyof typeof smoCoordinates.fields.header;
    const box = smoCoordinates.fields.header[boxKey];
    if (box && profile.orgUnitNo && profile.orgUnitNo[i - 1]) {
      drawTextInBox(page, profile.orgUnitNo[i - 1], box, helvetica, { 
        color: rgb(0, 0, 0) 
      });
    }
  }
  
  // Organisation unit name
  if (smoCoordinates.fields.header.orgUnitName) {
    drawTextInBox(page, profile.orgUnitName, smoCoordinates.fields.header.orgUnitName, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  // Location
  if (smoCoordinates.fields.header.location) {
    drawTextInBox(page, profile.location, smoCoordinates.fields.header.location, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
}

/**
 * Draw approval section on SMO AVAC page
 */
async function drawSMOApprovalSection(
  page: any,
  profile: Profile,
  helvetica: any,
  helveticaBold: any
): Promise<void> {
  console.log('📝 Drawing SMO approval section...');
  
  // Delegate's full name
  if (smoCoordinates.fields.approval.delegateFullName && profile.delegateName) {
    drawTextInBox(page, profile.delegateName, smoCoordinates.fields.approval.delegateFullName, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  // Delegate's position title
  if (smoCoordinates.fields.approval.delegatePosition && profile.delegatePosition) {
    drawTextInBox(page, profile.delegatePosition, smoCoordinates.fields.approval.delegatePosition, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  // Contact telephone number
  if (smoCoordinates.fields.approval.contactPhone && profile.delegatePhone) {
    drawTextInBox(page, profile.delegatePhone, smoCoordinates.fields.approval.contactPhone, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  // Approval Date
  if (smoCoordinates.fields.approval.approvalDate) {
    const currentDate = new Date().toLocaleDateString('en-AU');
    drawTextInBox(page, currentDate, smoCoordinates.fields.approval.approvalDate, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
}

/**
 * Draw a single log row on SMO AVAC page
 */
async function drawSMOLogRow(
  page: any,
  log: OvertimeLog,
  rowNum: number,
  profile: Profile,
  helvetica: any,
  helveticaBold: any
): Promise<void> {
  console.log(`📝 Drawing SMO log row ${rowNum}...`);
  
  // Personnel Assignment ID
  const personnelBox = (smoCoordinates.fields.table as any)[`personnelAssignmentNo_row${rowNum}`];
  if (personnelBox && profile.payrollNumber) {
    drawTextInBox(page, profile.payrollNumber, personnelBox, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  // Concurrent Employment tickbox
  const tickbox = (smoCoordinates.fields.table as any)[`tickbox_row${rowNum}`];
  if (tickbox && log.concurrentEmployment) {
    page.drawText('X', {
      x: tickbox.left + (tickbox.width || 10) / 2 + 2,
      y: page.getHeight() - (tickbox.top + (tickbox.height || 10) / 2) - 3,
      size: 12,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: degrees(90),
    });
  }
  
  // Date
  const dateBox = (smoCoordinates.fields.table as any)[`date_row${rowNum}`];
  if (dateBox) {
    const date = new Date(log.date).toLocaleDateString('en-AU');
    drawTextInBox(page, date, dateBox, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  // Rostered Start
  const rosteredStartBox = (smoCoordinates.fields.table as any)[`rosteredStart_row${rowNum}`];
  if (rosteredStartBox && log.rosteredStart) {
    const rosteredStartText = log.rosteredStart === 'N/A' ? '-' : log.rosteredStart;
    drawTextInBox(page, rosteredStartText, rosteredStartBox, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }

  // Rostered Finish
  const rosteredFinishBox = (smoCoordinates.fields.table as any)[`rosteredFinish_row${rowNum}`];
  if (rosteredFinishBox && log.rosteredFinish) {
    const rosteredFinishText = log.rosteredFinish === 'N/A' ? '-' : log.rosteredFinish;
    drawTextInBox(page, rosteredFinishText, rosteredFinishBox, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }

  // Actual Start
  const actualStartBox = (smoCoordinates.fields.table as any)[`actualStart_row${rowNum}`];
  if (actualStartBox && log.actualStart) {
    const actualStartText = log.actualStart === 'N/A' ? '-' : log.actualStart;
    drawTextInBox(page, actualStartText, actualStartBox, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }

  // Actual Finish
  const actualFinishBox = (smoCoordinates.fields.table as any)[`actualFinish_row${rowNum}`];
  if (actualFinishBox && log.actualFinish) {
    const actualFinishText = log.actualFinish === 'N/A' ? '-' : log.actualFinish;
    drawTextInBox(page, actualFinishText, actualFinishBox, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  // Meal Break
  const mealBreakBox = (smoCoordinates.fields.table as any)[`mealBreak_row${rowNum}`];
  if (mealBreakBox && log.mealBreakMinutes) {
    drawTextInBox(page, log.mealBreakMinutes.toString(), mealBreakBox, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  // SMO-specific tick boxes
  const smoTickBoxes = [
    { key: 'vmoAdditionalHours', label: 'VMO Additional' },
    { key: 'overtime', label: 'Overtime' },
    { key: 'oncall', label: 'On-call' },
    { key: 'physicalRecall', label: 'Physical Recall' },
    { key: 'digitalRecall', label: 'Digital Recall' },
    { key: 'extraShift', label: 'Extra Shift' },
    { key: 'approvedForPayment', label: 'Approved Payment' }
  ];
  
  smoTickBoxes.forEach(({ key, label }) => {
    const box = (smoCoordinates.fields.table as any)[`${key}_row${rowNum}`];
    if (box && log.smoCategories && log.smoCategories[key as keyof typeof log.smoCategories]) {
      page.drawText('X', {
        x: box.left + (box.width || 10) / 2 + 2,
        y: page.getHeight() - (box.top + (box.height || 10) / 2) - 3,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
        rotate: degrees(90),
      });
    }
  });
  
  // Comments
  const commentsBox = (smoCoordinates.fields.table as any)[`comments_row${rowNum}`];
  if (commentsBox && log.comments) {
    drawTextInBox(page, log.comments, commentsBox, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
  
  // Employee Initial
  const initialBox = (smoCoordinates.fields.table as any)[`employeeInitial_row${rowNum}`];
  if (initialBox && log.initials) {
    drawTextInBox(page, log.initials, initialBox, helvetica, { 
      color: rgb(0, 0, 0) 
    });
  }
}

/**
 * Build production SMO AVAC PDF without overlay boxes
 */
export async function buildSMOAVAC(
  profile: Profile,
  logs: OvertimeLog[],
  customFileName?: string
): Promise<string> {
  try {
    // Load the SMO AVAC template PDF
    const templateBytes = await loadSMOAVACTemplate();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    
    console.log('SMO template loaded, building production PDF...');
    
    // Load fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Draw header section
    await drawSMOHeaderSection(page, profile, helvetica, helveticaBold);
    
    // Draw approval section
    await drawSMOApprovalSection(page, profile, helvetica, helveticaBold);
    
    // Draw table section for available logs (3 rows per page)
    console.log('📝 Drawing table section...');
    const maxRowsPerPage = 3; // SMO template has 3 rows per page
    let currentPage = page;
    let currentRow = 1; // SMO uses 1-based row numbers (row1, row2, row3)
    
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      
      if (currentRow > maxRowsPerPage) {
        // Create new page by copying the first page (template with all headers/fields)
        console.log(`Creating new SMO page for log ${i + 1} (currentRow: ${currentRow})`);
        
        // Copy the first page to get a fresh template with all fields
        const [copiedPage] = await pdfDoc.copyPages(pdfDoc, [0]);
        pdfDoc.addPage(copiedPage);
        
        // Get the newly added page
        const pages = pdfDoc.getPages();
        currentPage = pages[pages.length - 1];
        currentRow = 1;
        
        // Redraw header and approval sections on the new page
        await drawSMOHeaderSection(currentPage, profile, helvetica, helveticaBold);
        await drawSMOApprovalSection(currentPage, profile, helvetica, helveticaBold);
      }
      
      // Draw the log row
      await drawSMOLogRow(currentPage, log, currentRow, profile, helvetica, helveticaBold);
      currentRow++;
    }
    
    // Save PDF to file
    const pdfBytes = await pdfDoc.save();
    const fileName = customFileName || generateSMOProductionFileName(profile);
    
    // Use cache directory
    const fileUri = `${Paths.cache.uri}/${fileName}`;
    
    // Convert Uint8Array to base64 string
    let base64String: string;
    try {
      const binaryString = String.fromCharCode(...pdfBytes);
      base64String = btoa(binaryString);
    } catch (error) {
      console.log('btoa not available, using custom base64 encoding');
      base64String = uint8ArrayToBase64(pdfBytes);
    }
    
    await writeAsStringAsync(fileUri, base64String, { encoding: 'base64' });
    
    console.log(`SMO AVAC PDF generated: ${fileUri}`);
    return fileUri;
  } catch (error) {
    console.error('Failed to build SMO AVAC PDF:', error);
    throw new Error('Failed to generate SMO AVAC PDF');
  }
}

/**
 * Generate filename for production SMO AVAC
 */
function generateSMOProductionFileName(profile: Profile): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const nameInfo = parseName(profile.fullName);
  
  if (nameInfo && nameInfo.firstName && nameInfo.lastName) {
    const firstName = nameInfo.firstName.replace(/[^a-zA-Z0-9]/g, '_');
    const lastName = nameInfo.lastName.replace(/[^a-zA-Z0-9]/g, '_');
    return `SMO_AVAC_${firstName}_${lastName}_${dateStr}.pdf`;
  } else if (nameInfo && nameInfo.firstName) {
    const firstName = nameInfo.firstName.replace(/[^a-zA-Z0-9]/g, '_');
    return `SMO_AVAC_${firstName}_${dateStr}.pdf`;
  } else {
    return `SMO_AVAC_${dateStr}.pdf`;
  }
}

/**
 * Parse first and last name from full name string
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
  
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '' };
  }
  
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  
  return { firstName, lastName };
}

/**
 * Build SMO AVAC PDF with green overlay boxes for coordinate verification
 */
export async function buildSMOAVACTest(
  profile: Profile,
  logs: OvertimeLog[]
): Promise<string> {
  try {
    // Load the SMO AVAC template PDF
    const templateBytes = await loadSMOAVACTemplate();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    
    console.log('SMO template loaded, adding green overlay boxes...');
    
    // Load fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Draw header section overlays
    console.log('📝 Drawing header section overlays...');
    
    // Employee Name
    if (smoCoordinates.fields.header.employeeName) {
      drawFieldOverlay(page, smoCoordinates.fields.header.employeeName, 'Employee Name', helveticaBold);
      drawTextInBox(page, profile.fullName, smoCoordinates.fields.header.employeeName, helvetica, { 
        color: rgb(0, 0, 0) 
      });
    }
    
    // Organisational Unit No. - 8 boxes
    for (let i = 1; i <= 8; i++) {
      const boxKey = `orgUnitNo_box${i}` as keyof typeof smoCoordinates.fields.header;
      const box = smoCoordinates.fields.header[boxKey];
      if (box) {
        drawFieldOverlay(page, box, `Org Unit ${i}`, helveticaBold);
        if (profile.orgUnitNo && profile.orgUnitNo[i - 1]) {
          drawTextInBox(page, profile.orgUnitNo[i - 1], box, helvetica, { 
            color: rgb(0, 0, 0) 
          });
        }
      }
    }
    
    // Organisation unit name
    if (smoCoordinates.fields.header.orgUnitName) {
      drawFieldOverlay(page, smoCoordinates.fields.header.orgUnitName, 'Org Unit Name', helveticaBold);
      drawTextInBox(page, profile.orgUnitName, smoCoordinates.fields.header.orgUnitName, helvetica, { 
        color: rgb(0, 0, 0) 
      });
    }
    
    // Location
    if (smoCoordinates.fields.header.location) {
      drawFieldOverlay(page, smoCoordinates.fields.header.location, 'Location', helveticaBold);
      drawTextInBox(page, profile.location, smoCoordinates.fields.header.location, helvetica, { 
        color: rgb(0, 0, 0) 
      });
    }
    
    // Draw table section overlays for first 3 rows
    console.log('📝 Drawing table section overlays...');
    
    for (let rowNum = 1; rowNum <= 5; rowNum++) {
      console.log(`📝 Drawing row ${rowNum} overlays...`);
      
      // Personnel Assignment ID
      const personnelBox = (smoCoordinates.fields.table as any)[`personnelAssignmentNo_row${rowNum}`];
      if (personnelBox) {
        drawFieldOverlay(page, personnelBox, `Personnel ID R${rowNum}`, helveticaBold);
        if (profile.payrollNumber) {
          drawTextInBox(page, profile.payrollNumber, personnelBox, helvetica, { 
            color: rgb(0, 0, 0) 
          }, rowNum);
        }
      }
      
      // Concurrent Employment tickbox
      const tickbox = (smoCoordinates.fields.table as any)[`tickbox_row${rowNum}`];
      if (tickbox) {
        drawFieldOverlay(page, tickbox, `Concurrent R${rowNum}`, helveticaBold);
        // Draw 'X' if concurrent employment
        if (logs[rowNum - 1]?.concurrentEmployment) {
          page.drawText('X', {
            x: tickbox.left + (tickbox.width || 10) / 2 + 2,
            y: page.getHeight() - (tickbox.top + (tickbox.height || 10) / 2) - 3,
            size: 12,
            font: helveticaBold,
            color: rgb(0, 0, 0),
            rotate: degrees(90),
          });
        }
      }
      
      // Date
      const dateBox = (smoCoordinates.fields.table as any)[`date_row${rowNum}`];
      if (dateBox) {
        drawFieldOverlay(page, dateBox, `Date R${rowNum}`, helveticaBold);
        if (logs[rowNum - 1]) {
          const date = new Date(logs[rowNum - 1].date).toLocaleDateString('en-AU');
          drawTextInBox(page, date, dateBox, helvetica, { 
            color: rgb(0, 0, 0) 
          }, rowNum);
        }
      }
      
      // Rostered Start
      const rosteredStartBox = (smoCoordinates.fields.table as any)[`rosteredStart_row${rowNum}`];
      if (rosteredStartBox) {
        drawFieldOverlay(page, rosteredStartBox, `Rostered Start R${rowNum}`, helveticaBold);
        if (logs[rowNum - 1]?.rosteredStart) {
          const rosteredStartRaw = logs[rowNum - 1]?.rosteredStart ?? 'N/A';
          const rosteredStartText = rosteredStartRaw === 'N/A' ? '-' : rosteredStartRaw;
          drawTextInBox(page, rosteredStartText as string, rosteredStartBox, helvetica, { 
            color: rgb(0, 0, 0) 
          }, rowNum);
        }
      }

      // Rostered Finish
      const rosteredFinishBox = (smoCoordinates.fields.table as any)[`rosteredFinish_row${rowNum}`];
      if (rosteredFinishBox) {
        drawFieldOverlay(page, rosteredFinishBox, `Rostered Finish R${rowNum}`, helveticaBold);
        if (logs[rowNum - 1]?.rosteredFinish) {
          const rosteredFinishRaw = logs[rowNum - 1]?.rosteredFinish ?? 'N/A';
          const rosteredFinishText = rosteredFinishRaw === 'N/A' ? '-' : rosteredFinishRaw;
          drawTextInBox(page, rosteredFinishText as string, rosteredFinishBox, helvetica, { 
            color: rgb(0, 0, 0) 
          }, rowNum);
        }
      }

      // Actual Start
      const actualStartBox = (smoCoordinates.fields.table as any)[`actualStart_row${rowNum}`];
      if (actualStartBox) {
        drawFieldOverlay(page, actualStartBox, `Actual Start R${rowNum}`, helveticaBold);
        if (logs[rowNum - 1]?.actualStart) {
          const actualStartText = logs[rowNum - 1].actualStart === 'N/A' ? '-' : logs[rowNum - 1].actualStart;
          drawTextInBox(page, actualStartText, actualStartBox, helvetica, { 
            color: rgb(0, 0, 0) 
          }, rowNum);
        }
      }

      // Actual Finish
      const actualFinishBox = (smoCoordinates.fields.table as any)[`actualFinish_row${rowNum}`];
      if (actualFinishBox) {
        drawFieldOverlay(page, actualFinishBox, `Actual Finish R${rowNum}`, helveticaBold);
        if (logs[rowNum - 1]?.actualFinish) {
          const actualFinishText = logs[rowNum - 1].actualFinish === 'N/A' ? '-' : logs[rowNum - 1].actualFinish;
          drawTextInBox(page, actualFinishText, actualFinishBox, helvetica, { 
            color: rgb(0, 0, 0) 
          }, rowNum);
        }
      }
      
      // Meal Break
      const mealBreakBox = (smoCoordinates.fields.table as any)[`mealBreak_row${rowNum}`];
      if (mealBreakBox) {
        drawFieldOverlay(page, mealBreakBox, `Meal Break R${rowNum}`, helveticaBold);
        if (logs[rowNum - 1]?.mealBreakMinutes !== undefined) {
          drawTextInBox(page, String(logs[rowNum - 1]?.mealBreakMinutes ?? ''), mealBreakBox, helvetica, { 
            color: rgb(0, 0, 0) 
          }, rowNum);
        }
      }
      
      // SMO-specific tick boxes
      const smoTickBoxes = [
        { key: 'vmoAdditionalHours', label: 'VMO Additional' },
        { key: 'overtime', label: 'Overtime' },
        { key: 'oncall', label: 'On-call' },
        { key: 'physicalRecall', label: 'Physical Recall' },
        { key: 'digitalRecall', label: 'Digital Recall' },
        { key: 'extraShift', label: 'Extra Shift' },
        { key: 'approvedForPayment', label: 'Approved Payment' }
      ];
      
      smoTickBoxes.forEach(({ key, label }) => {
        const box = (smoCoordinates.fields.table as any)[`${key}_row${rowNum}`];
        if (box) {
          drawFieldOverlay(page, box, `${label} R${rowNum}`, helveticaBold);
          // Draw 'X' for demonstration
          page.drawText('X', {
            x: box.left + (box.width || 10) / 2 + 2,
            y: page.getHeight() - (box.top + (box.height || 10) / 2) - 3,
            size: 10,
            font: helveticaBold,
            color: rgb(0, 0, 0),
            rotate: degrees(90),
          });
        }
      });
      
      // Comments
      const commentsBox = (smoCoordinates.fields.table as any)[`comments_row${rowNum}`];
      if (commentsBox) {
        drawFieldOverlay(page, commentsBox, `Comments R${rowNum}`, helveticaBold);
        if (logs[rowNum - 1]?.comments) {
          drawTextInBox(page, logs[rowNum - 1]?.comments ?? '', commentsBox, helvetica, { 
            color: rgb(0, 0, 0) 
          }, rowNum);
        }
      }
      
      // Employee Initial
      const initialBox = (smoCoordinates.fields.table as any)[`employeeInitial_row${rowNum}`];
      if (initialBox) {
        drawFieldOverlay(page, initialBox, `Initial R${rowNum}`, helveticaBold);
        if (logs[rowNum - 1]?.initials) {
          drawTextInBox(page, logs[rowNum - 1].initials, initialBox, helvetica, { 
            color: rgb(0, 0, 0) 
          }, rowNum);
        }
      }
    }
    
    // Draw approval section overlays
    console.log('📝 Drawing approval section overlays...');
    
    // Delegate's Signature
    if (smoCoordinates.fields.approval.delegateSignature) {
      drawFieldOverlay(page, smoCoordinates.fields.approval.delegateSignature, 'Delegate Signature', helveticaBold);
    }
    
    // Delegate's full name
    if (smoCoordinates.fields.approval.delegateFullName) {
      drawFieldOverlay(page, smoCoordinates.fields.approval.delegateFullName, 'Delegate Name', helveticaBold);
      if (profile.delegateName) {
        drawTextInBox(page, profile.delegateName, smoCoordinates.fields.approval.delegateFullName, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
    }
    
    // Delegate's position title
    if (smoCoordinates.fields.approval.delegatePosition) {
      drawFieldOverlay(page, smoCoordinates.fields.approval.delegatePosition, 'Delegate Position', helveticaBold);
      if (profile.delegatePosition) {
        drawTextInBox(page, profile.delegatePosition, smoCoordinates.fields.approval.delegatePosition, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
    }
    
    // Contact telephone number
    if (smoCoordinates.fields.approval.contactPhone) {
      drawFieldOverlay(page, smoCoordinates.fields.approval.contactPhone, 'Contact Phone', helveticaBold);
      if (profile.delegatePhone) {
        drawTextInBox(page, profile.delegatePhone, smoCoordinates.fields.approval.contactPhone, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
    }
    
    // Approval Date
    if (smoCoordinates.fields.approval.approvalDate) {
      drawFieldOverlay(page, smoCoordinates.fields.approval.approvalDate, 'Approval Date', helveticaBold);
      const currentDate = new Date().toLocaleDateString('en-AU');
      drawTextInBox(page, currentDate, smoCoordinates.fields.approval.approvalDate, helvetica, { 
        color: rgb(0, 0, 0) 
      });
    }
    
    // Save PDF to file
    const pdfBytes = await pdfDoc.save();
    const fileName = generateSMOFileName();
    
    // Use cache directory
    const fileUri = `${Paths.cache.uri}/${fileName}`;
    
    // Convert Uint8Array to base64 string
    let base64String: string;
    try {
      const binaryString = String.fromCharCode(...pdfBytes);
      base64String = btoa(binaryString);
    } catch (error) {
      console.log('btoa not available, using custom base64 encoding');
      base64String = uint8ArrayToBase64(pdfBytes);
    }
    
    await writeAsStringAsync(fileUri, base64String, { encoding: 'base64' });
    
    console.log(`SMO AVAC test PDF generated: ${fileUri}`);
    return fileUri;
  } catch (error) {
    console.error('Failed to build SMO AVAC test PDF:', error);
    throw new Error('Failed to generate SMO AVAC test PDF');
  }
}
