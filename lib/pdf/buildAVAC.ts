import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

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
  const textX = box.x + width/2; // Horizontal center of the box
  const textY = box.y + 2; // Small padding from the bottom edge of the box
  
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
    
    return {
      x: textX,
      y: textY,
      size: fontSize,
      lines: lines,
      fits: lines.length <= maxLines
    };
  }
  
  // Text fits in one line
  return { 
    x: textX, 
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
  
  // Simple positioning - center the text in the box
  const width = box.width || 50; // Default width if not provided
  const height = box.height || 20; // Default height if not provided
  const textX = box.x + width / 2;
  const textY = box.y + 2; // Small padding from bottom
  
  // Use a simple font size
  const fontSize = options.maxFontSize || 10;
  
  console.log(`📝 Drawing text "${sanitizedText}" at (${textX}, ${textY}) with size ${fontSize}`);
  
  page.drawText(sanitizedText, {
    x: textX,
    y: textY,
    size: fontSize,
    font: font,
    color: options.color || rgb(0, 0, 0),
    rotate: degrees(90), // Rotate text 90 degrees clockwise
  });
}

import { Paths, File } from 'expo-file-system';
import { writeAsStringAsync, readAsStringAsync, getInfoAsync, copyAsync } from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Profile, OvertimeLog } from '../../types';
import { avacCoordinates, fontSizes, fontFamilies, getRowYPosition, getMaxRowsPerPage } from './maps/qld_avac_v85';
import { formatMinutes } from '../time';
// import Base64 from 'react-native-base64';

/**
 * Copy template to cache directory
 */
async function copyTemplateToCache(): Promise<void> {
  try {
    const templatePath = `${Paths.cache.uri}/AVAC_Template_Horizontal.pdf`;
    const fileInfo = await getInfoAsync(templatePath);
    
    if (!fileInfo.exists) {
      console.log('Template not found in cache, attempting to copy from assets...');
      
      try {
        // Load the template asset using the proper Expo Asset approach
        const templateAsset = Asset.fromModule(require('../../assets/pdf/AVAC template horizontal.pdf'));
        console.log('Template asset created:', templateAsset);
        
        // Download the asset if needed
        if (!templateAsset.downloaded) {
          console.log('Downloading template asset...');
          await templateAsset.downloadAsync();
          console.log('Template asset download completed');
        }
        
        console.log('Template asset downloaded, localUri:', templateAsset.localUri);
        
        if (templateAsset.localUri) {
          // Copy the template to cache using the proper copyAsync syntax
          console.log('Copying template to cache...');
          await copyAsync({ from: templateAsset.localUri, to: templatePath });
          console.log('Template copied to cache successfully');
        } else {
          console.log('Template asset localUri not available');
          console.log('Asset details:', {
            downloaded: templateAsset.downloaded,
            localUri: templateAsset.localUri,
            uri: templateAsset.uri
          });
        }
      } catch (assetError) {
        console.error('Asset loading failed:', assetError);
        console.log('Asset loading error details:', assetError);
      }
    } else {
      console.log('Template already exists in cache');
    }
  } catch (error) {
    console.error('Failed to copy template:', error);
    console.log('Copy template error details:', error);
  }
}

/**
 * Load AVAC template PDF
 * This function handles loading the template from assets
 */
async function loadAVACTemplate(): Promise<ArrayBuffer> {
  try {
    console.log('Attempting to load AVAC template...');
    
    // Try the new AVAC template first using Asset system
    try {
      console.log('Loading AVAC template using Asset system...');
      const templateAsset = Asset.fromModule(require('../../assets/pdf/AVAC template horizontal.pdf'));
      
      if (!templateAsset.downloaded) {
        console.log('Downloading template asset...');
        await templateAsset.downloadAsync();
      }
      
      console.log('Template asset downloaded, localUri:', templateAsset.localUri);
      
      if (templateAsset.localUri) {
        const base64Data = await readAsStringAsync(templateAsset.localUri, { encoding: 'base64' });
        console.log('Template data read, length:', base64Data.length);
        
        if (base64Data.length > 0) {
          // Convert base64 to ArrayBuffer
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          console.log('AVAC template loaded successfully from Asset system, size:', bytes.length);
          return bytes.buffer;
        }
      }
    } catch (assetError) {
      console.log('Asset system loading failed:', assetError);
    }
    
    // Try direct file path as fallback
    const newTemplatePath = 'assets/pdf/AVAC template horizontal.pdf';
    console.log('Trying direct template path:', newTemplatePath);
    
    try {
      const base64Data = await readAsStringAsync(newTemplatePath, { encoding: 'base64' });
      console.log('Direct template data read, length:', base64Data.length);
      
      if (base64Data.length > 0) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('AVAC template loaded successfully from direct path, size:', bytes.length);
        return bytes.buffer;
      }
    } catch (directError) {
      console.log('Direct template loading failed:', directError);
    }
    
    // Try the manually copied template as fallback
    const manualTemplatePath = 'cache/AVAC_Template_Horizontal.pdf';
    console.log('Trying manual template path:', manualTemplatePath);
    
    try {
      const base64Data = await readAsStringAsync(manualTemplatePath, { encoding: 'base64' });
      console.log('Manual template data read, length:', base64Data.length);
      
      if (base64Data.length > 0) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('AVAC template loaded successfully from manual path, size:', bytes.length);
        return bytes.buffer;
      }
    } catch (manualError) {
      console.log('Manual template loading failed:', manualError);
    }
    
    // Fallback to cache directory
    const templatePath = `${Paths.cache.uri}/AVAC_Template_Horizontal.pdf`;
    console.log('Trying cache template path:', templatePath);
    
    // Check if template exists in cache
    const fileInfo = await getInfoAsync(templatePath);
    console.log('Template file info:', fileInfo);
    
    if (fileInfo.exists) {
      console.log('Template found in cache, reading...');
      const base64Data = await readAsStringAsync(templatePath, { encoding: 'base64' });
      console.log('Template data read, length:', base64Data.length);
      
      if (base64Data.length > 0) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('AVAC template loaded successfully, size:', bytes.length);
        return bytes.buffer;
      } else {
        console.log('Template file is empty, using fallback');
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
    const maxRowsPerPage = getMaxRowsPerPage();
    let currentPage = page;
    let currentRow = 0;
    
    for (const log of logs) {
      if (currentRow >= maxRowsPerPage) {
        // Create new page using the template
        const newPage = pdfDoc.addPage([avacCoordinates.page.width, avacCoordinates.page.height]);
        
        // Copy the template content to the new page
        // Note: This is a simplified approach - in practice, you might want to 
        // copy specific elements from the template page
        currentPage = newPage;
        currentRow = 0;
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
  
  // Draw employee name (from profile)
  const employeeNameBox = avacCoordinates.table[`employeeName_row${rowNum}`];
  console.log(`📝 Employee name box for row ${rowNum}:`, employeeNameBox);
  if (employeeNameBox) {
    console.log(`📝 Drawing employee name: ${profile.fullName}`);
    drawTextInBox(page, profile.fullName, employeeNameBox, helvetica, { color: rgb(0, 0, 0) });
  } else {
    console.log(`❌ No employee name box found for row ${rowNum}`);
  }

  // Draw pay level (from profile)
  const payLevelBox = avacCoordinates.table[`payLevel_row${rowNum}`];
  if (payLevelBox) {
    drawTextInBox(page, profile.payLevel, payLevelBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw date
  const dateBox = avacCoordinates.table[`date_row${rowNum}`];
  if (dateBox) {
    drawTextInBox(page, date, dateBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw rostered start
  const rosteredStartBox = avacCoordinates.table[`rosteredStart_row${rowNum}`];
  if (rosteredStartBox && log.rosteredStart) {
    drawTextInBox(page, log.rosteredStart, rosteredStartBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw rostered finish
  const rosteredFinishBox = avacCoordinates.table[`rosteredFinish_row${rowNum}`];
  if (rosteredFinishBox && log.rosteredFinish) {
    drawTextInBox(page, log.rosteredFinish, rosteredFinishBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw actual start
  const actualStartBox = avacCoordinates.table[`actualStart_row${rowNum}`];
  if (actualStartBox) {
    drawTextInBox(page, log.actualStart, actualStartBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw actual finish
  const actualFinishBox = avacCoordinates.table[`actualFinish_row${rowNum}`];
  if (actualFinishBox) {
    drawTextInBox(page, log.actualFinish, actualFinishBox, helvetica, { color: rgb(0, 0, 0) });
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

  // Draw personnel assignment number
  const personnelBox = avacCoordinates.table[`personnelAssignmentNo_row${rowNum}`];
  if (personnelBox) {
    drawTextInBox(page, profile.payrollNumber, personnelBox, helvetica, { color: rgb(0, 0, 0) });
  }

  // Draw employee initials
  const initialsBox = avacCoordinates.table[`employeeInitial_row${rowNum}`];
  if (initialsBox) {
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
