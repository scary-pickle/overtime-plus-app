import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { Paths } from 'expo-file-system';
import { writeAsStringAsync, readAsStringAsync, getInfoAsync } from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Profile, OvertimeLog } from '../../types';

// Import SMO coordinates from the worksheet
import smoCoordinates from '../../preview-coordinates-worksheet-smo.json';

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
function drawTextInBox(page: any, text: string, box: { left: number; top: number; width?: number; height?: number }, font: any, options: any = {}) {
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
    options.maxFontSize || 12
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
function drawFieldOverlay(page: any, box: { left: number; top: number; width?: number; height?: number }, label: string) {
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
    color: rgb(0, 0.8, 0, 0.2), // Semi-transparent green fill
  });
  
  // Draw field label
  page.drawText(label, {
    x: x + 2,
    y: y + height - 2,
    size: 8,
    font: page.doc.embedFont(StandardFonts.HelveticaBold),
    color: rgb(0, 0.5, 0), // Dark green text
    rotate: degrees(90),
  });
}

/**
 * Load SMO AVAC template PDF
 */
async function loadSMOAVACTemplate(): Promise<ArrayBuffer> {
  try {
    console.log('Loading SMO AVAC template...');
    
    // Load the SMO template using Asset system
    const templateAsset = Asset.fromModule(require('../../assets/pdf/SMO AVAC Template.pdf'));
    
    if (!templateAsset.downloaded) {
      console.log('Downloading SMO template asset...');
      await templateAsset.downloadAsync();
    }
    
    console.log('SMO template asset downloaded, localUri:', templateAsset.localUri);
    
    if (templateAsset.localUri) {
      const base64Data = await readAsStringAsync(templateAsset.localUri, { encoding: 'base64' });
      console.log('SMO template data read, length:', base64Data.length);
      
      if (base64Data.length > 0) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('SMO AVAC template loaded successfully, size:', bytes.length);
        return bytes.buffer;
      }
    }
    
    throw new Error('Failed to load SMO template');
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
    console.log('📝 Drawing header section...');
    
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
    
    // Draw table section for first 3 rows
    console.log('📝 Drawing table section...');
    
    for (let rowNum = 1; rowNum <= 3; rowNum++) {
      console.log(`📝 Drawing row ${rowNum}...`);
      
      // Personnel Assignment ID
      const personnelBox = smoCoordinates.fields.table[`personnelAssignmentNo_row${rowNum}`];
      if (personnelBox && profile.payrollNumber) {
        drawTextInBox(page, profile.payrollNumber, personnelBox, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
      
      // Concurrent Employment tickbox
      const tickbox = smoCoordinates.fields.table[`tickbox_row${rowNum}`];
      if (tickbox && logs[rowNum - 1]?.concurrentEmployment) {
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
      const dateBox = smoCoordinates.fields.table[`date_row${rowNum}`];
      if (dateBox && logs[rowNum - 1]) {
        const date = new Date(logs[rowNum - 1].date).toLocaleDateString('en-AU');
        drawTextInBox(page, date, dateBox, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
      
      // Rostered Start
      const rosteredStartBox = smoCoordinates.fields.table[`rosteredStart_row${rowNum}`];
      if (rosteredStartBox && logs[rowNum - 1]?.rosteredStart) {
        drawTextInBox(page, logs[rowNum - 1].rosteredStart, rosteredStartBox, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
      
      // Rostered Finish
      const rosteredFinishBox = smoCoordinates.fields.table[`rosteredFinish_row${rowNum}`];
      if (rosteredFinishBox && logs[rowNum - 1]?.rosteredFinish) {
        drawTextInBox(page, logs[rowNum - 1].rosteredFinish, rosteredFinishBox, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
      
      // Actual Start
      const actualStartBox = smoCoordinates.fields.table[`actualStart_row${rowNum}`];
      if (actualStartBox && logs[rowNum - 1]?.actualStart) {
        drawTextInBox(page, logs[rowNum - 1].actualStart, actualStartBox, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
      
      // Actual Finish
      const actualFinishBox = smoCoordinates.fields.table[`actualFinish_row${rowNum}`];
      if (actualFinishBox && logs[rowNum - 1]?.actualFinish) {
        drawTextInBox(page, logs[rowNum - 1].actualFinish, actualFinishBox, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
      
      // Meal Break
      const mealBreakBox = smoCoordinates.fields.table[`mealBreak_row${rowNum}`];
      if (mealBreakBox && logs[rowNum - 1]?.mealBreakMinutes) {
        drawTextInBox(page, logs[rowNum - 1].mealBreakMinutes.toString(), mealBreakBox, helvetica, { 
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
        const box = smoCoordinates.fields.table[`${key}_row${rowNum}`];
        if (box && logs[rowNum - 1]?.smoCategories?.[key as keyof typeof logs[rowNum - 1].smoCategories]) {
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
      const commentsBox = smoCoordinates.fields.table[`comments_row${rowNum}`];
      if (commentsBox && logs[rowNum - 1]?.comments) {
        drawTextInBox(page, logs[rowNum - 1].comments, commentsBox, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
      
      // Employee Initial
      const initialBox = smoCoordinates.fields.table[`employeeInitial_row${rowNum}`];
      if (initialBox && logs[rowNum - 1]?.initials) {
        drawTextInBox(page, logs[rowNum - 1].initials, initialBox, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
    }
    
    // Draw approval section
    console.log('📝 Drawing approval section...');
    
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
      drawFieldOverlay(page, smoCoordinates.fields.header.employeeName, 'Employee Name');
      drawTextInBox(page, profile.fullName, smoCoordinates.fields.header.employeeName, helvetica, { 
        color: rgb(0, 0, 0) 
      });
    }
    
    // Organisational Unit No. - 8 boxes
    for (let i = 1; i <= 8; i++) {
      const boxKey = `orgUnitNo_box${i}` as keyof typeof smoCoordinates.fields.header;
      const box = smoCoordinates.fields.header[boxKey];
      if (box) {
        drawFieldOverlay(page, box, `Org Unit ${i}`);
        if (profile.orgUnitNo && profile.orgUnitNo[i - 1]) {
          drawTextInBox(page, profile.orgUnitNo[i - 1], box, helvetica, { 
            color: rgb(0, 0, 0) 
          });
        }
      }
    }
    
    // Organisation unit name
    if (smoCoordinates.fields.header.orgUnitName) {
      drawFieldOverlay(page, smoCoordinates.fields.header.orgUnitName, 'Org Unit Name');
      drawTextInBox(page, profile.orgUnitName, smoCoordinates.fields.header.orgUnitName, helvetica, { 
        color: rgb(0, 0, 0) 
      });
    }
    
    // Location
    if (smoCoordinates.fields.header.location) {
      drawFieldOverlay(page, smoCoordinates.fields.header.location, 'Location');
      drawTextInBox(page, profile.location, smoCoordinates.fields.header.location, helvetica, { 
        color: rgb(0, 0, 0) 
      });
    }
    
    // Draw table section overlays for first 3 rows
    console.log('📝 Drawing table section overlays...');
    
    for (let rowNum = 1; rowNum <= 3; rowNum++) {
      console.log(`📝 Drawing row ${rowNum} overlays...`);
      
      // Personnel Assignment ID
      const personnelBox = smoCoordinates.fields.table[`personnelAssignmentNo_row${rowNum}`];
      if (personnelBox) {
        drawFieldOverlay(page, personnelBox, `Personnel ID R${rowNum}`);
        if (profile.payrollNumber) {
          drawTextInBox(page, profile.payrollNumber, personnelBox, helvetica, { 
            color: rgb(0, 0, 0) 
          });
        }
      }
      
      // Concurrent Employment tickbox
      const tickbox = smoCoordinates.fields.table[`tickbox_row${rowNum}`];
      if (tickbox) {
        drawFieldOverlay(page, tickbox, `Concurrent R${rowNum}`);
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
      const dateBox = smoCoordinates.fields.table[`date_row${rowNum}`];
      if (dateBox) {
        drawFieldOverlay(page, dateBox, `Date R${rowNum}`);
        if (logs[rowNum - 1]) {
          const date = new Date(logs[rowNum - 1].date).toLocaleDateString('en-AU');
          drawTextInBox(page, date, dateBox, helvetica, { 
            color: rgb(0, 0, 0) 
          });
        }
      }
      
      // Rostered Start
      const rosteredStartBox = smoCoordinates.fields.table[`rosteredStart_row${rowNum}`];
      if (rosteredStartBox) {
        drawFieldOverlay(page, rosteredStartBox, `Rostered Start R${rowNum}`);
        if (logs[rowNum - 1]?.rosteredStart) {
          drawTextInBox(page, logs[rowNum - 1].rosteredStart, rosteredStartBox, helvetica, { 
            color: rgb(0, 0, 0) 
          });
        }
      }
      
      // Rostered Finish
      const rosteredFinishBox = smoCoordinates.fields.table[`rosteredFinish_row${rowNum}`];
      if (rosteredFinishBox) {
        drawFieldOverlay(page, rosteredFinishBox, `Rostered Finish R${rowNum}`);
        if (logs[rowNum - 1]?.rosteredFinish) {
          drawTextInBox(page, logs[rowNum - 1].rosteredFinish, rosteredFinishBox, helvetica, { 
            color: rgb(0, 0, 0) 
          });
        }
      }
      
      // Actual Start
      const actualStartBox = smoCoordinates.fields.table[`actualStart_row${rowNum}`];
      if (actualStartBox) {
        drawFieldOverlay(page, actualStartBox, `Actual Start R${rowNum}`);
        if (logs[rowNum - 1]?.actualStart) {
          drawTextInBox(page, logs[rowNum - 1].actualStart, actualStartBox, helvetica, { 
            color: rgb(0, 0, 0) 
          });
        }
      }
      
      // Actual Finish
      const actualFinishBox = smoCoordinates.fields.table[`actualFinish_row${rowNum}`];
      if (actualFinishBox) {
        drawFieldOverlay(page, actualFinishBox, `Actual Finish R${rowNum}`);
        if (logs[rowNum - 1]?.actualFinish) {
          drawTextInBox(page, logs[rowNum - 1].actualFinish, actualFinishBox, helvetica, { 
            color: rgb(0, 0, 0) 
          });
        }
      }
      
      // Meal Break
      const mealBreakBox = smoCoordinates.fields.table[`mealBreak_row${rowNum}`];
      if (mealBreakBox) {
        drawFieldOverlay(page, mealBreakBox, `Meal Break R${rowNum}`);
        if (logs[rowNum - 1]?.mealBreakMinutes) {
          drawTextInBox(page, logs[rowNum - 1].mealBreakMinutes.toString(), mealBreakBox, helvetica, { 
            color: rgb(0, 0, 0) 
          });
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
        const box = smoCoordinates.fields.table[`${key}_row${rowNum}`];
        if (box) {
          drawFieldOverlay(page, box, `${label} R${rowNum}`);
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
      const commentsBox = smoCoordinates.fields.table[`comments_row${rowNum}`];
      if (commentsBox) {
        drawFieldOverlay(page, commentsBox, `Comments R${rowNum}`);
        if (logs[rowNum - 1]?.comments) {
          drawTextInBox(page, logs[rowNum - 1].comments, commentsBox, helvetica, { 
            color: rgb(0, 0, 0) 
          });
        }
      }
      
      // Employee Initial
      const initialBox = smoCoordinates.fields.table[`employeeInitial_row${rowNum}`];
      if (initialBox) {
        drawFieldOverlay(page, initialBox, `Initial R${rowNum}`);
        if (logs[rowNum - 1]?.initials) {
          drawTextInBox(page, logs[rowNum - 1].initials, initialBox, helvetica, { 
            color: rgb(0, 0, 0) 
          });
        }
      }
    }
    
    // Draw approval section overlays
    console.log('📝 Drawing approval section overlays...');
    
    // Delegate's Signature
    if (smoCoordinates.fields.approval.delegateSignature) {
      drawFieldOverlay(page, smoCoordinates.fields.approval.delegateSignature, 'Delegate Signature');
    }
    
    // Delegate's full name
    if (smoCoordinates.fields.approval.delegateFullName) {
      drawFieldOverlay(page, smoCoordinates.fields.approval.delegateFullName, 'Delegate Name');
      if (profile.delegateName) {
        drawTextInBox(page, profile.delegateName, smoCoordinates.fields.approval.delegateFullName, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
    }
    
    // Delegate's position title
    if (smoCoordinates.fields.approval.delegatePosition) {
      drawFieldOverlay(page, smoCoordinates.fields.approval.delegatePosition, 'Delegate Position');
      if (profile.delegatePosition) {
        drawTextInBox(page, profile.delegatePosition, smoCoordinates.fields.approval.delegatePosition, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
    }
    
    // Contact telephone number
    if (smoCoordinates.fields.approval.contactPhone) {
      drawFieldOverlay(page, smoCoordinates.fields.approval.contactPhone, 'Contact Phone');
      if (profile.delegatePhone) {
        drawTextInBox(page, profile.delegatePhone, smoCoordinates.fields.approval.contactPhone, helvetica, { 
          color: rgb(0, 0, 0) 
        });
      }
    }
    
    // Approval Date
    if (smoCoordinates.fields.approval.approvalDate) {
      drawFieldOverlay(page, smoCoordinates.fields.approval.approvalDate, 'Approval Date');
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
