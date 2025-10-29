/**
 * Field testing utility for AVAC PDF form
 * Generates test PDFs with individual fields filled for coordinate verification
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeAsStringAsync } from 'expo-file-system/legacy';
import { Paths } from 'expo-file-system';
import { Asset } from 'expo-asset';

interface TestField {
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  description?: string;
}

/**
 * Load AVAC template PDF
 */
async function loadAVACTemplate(): Promise<ArrayBuffer> {
  try {
    console.log('Loading AVAC template...');
    const templateAsset = Asset.fromModule(require('../../assets/pdf/AVAC template horizontal.pdf'));
    
    if (!templateAsset.downloaded) {
      await templateAsset.downloadAsync();
    }
    
    if (templateAsset.localUri) {
      const { readAsStringAsync } = await import('expo-file-system/legacy');
      const base64Data = await readAsStringAsync(templateAsset.localUri, { encoding: 'base64' });
      
      if (base64Data.length > 0) {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('AVAC template loaded successfully, size:', bytes.length);
        return bytes.buffer;
      }
    }
    
    throw new Error('Template not found');
  } catch (error) {
    console.error('Failed to load AVAC template:', error);
    throw error;
  }
}

/**
 * Generate test PDF with single field filled
 */
export async function testSingleField(
  fieldName: string,
  coordinates: TestField,
  testText?: string
): Promise<string> {
  try {
    console.log(`Testing field: ${fieldName}`);
    console.log('Coordinates:', coordinates);
    
    // Load template
    const templateBytes = await loadAVACTemplate();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    
    // Load fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Generate test text
    const displayText = testText || `TEST_${fieldName.toUpperCase()}`;
    
    // Draw the test text
    page.drawText(displayText, {
      x: coordinates.x,
      y: coordinates.y,
      size: 8,
      font: helvetica,
      color: rgb(1, 0, 0), // Red color for visibility
    });
    
    // Draw field label for reference
    page.drawText(`FIELD: ${fieldName}`, {
      x: coordinates.x,
      y: coordinates.y - 15,
      size: 6,
      font: helveticaBold,
      color: rgb(0, 0, 1), // Blue color
    });
    
    // Draw coordinates for reference
    page.drawText(`COORDS: (${coordinates.x}, ${coordinates.y})`, {
      x: coordinates.x,
      y: coordinates.y - 25,
      size: 6,
      font: helvetica,
      color: rgb(0, 0.5, 0), // Green color
    });
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `AVAC_Test_${fieldName}_${new Date().toISOString().split('T')[0]}.pdf`;
    const fileUri = `${Paths.cache}/${fileName}`;
    
    // Convert to base64 and save
    let base64String: string;
    try {
      const binaryString = String.fromCharCode(...pdfBytes);
      base64String = btoa(binaryString);
    } catch (error) {
      console.log('btoa not available, using custom base64 encoding');
      const uint8Array = new Uint8Array(pdfBytes);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      base64String = btoa(binary);
    }
    
    await writeAsStringAsync(fileUri, base64String, { encoding: 'base64' });
    
    console.log(`Test PDF generated: ${fileUri}`);
    return fileUri;
  } catch (error) {
    console.error(`Failed to test field ${fieldName}:`, error);
    throw error;
  }
}

/**
 * Generate test PDF with multiple fields filled
 */
export async function testMultipleFields(
  fields: Record<string, TestField>,
  testTexts?: Record<string, string>
): Promise<string> {
  try {
    console.log(`Testing ${Object.keys(fields).length} fields`);
    
    // Load template
    const templateBytes = await loadAVACTemplate();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    
    // Load fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Draw each field
    for (const [fieldName, coordinates] of Object.entries(fields)) {
      const displayText = testTexts?.[fieldName] || `TEST_${fieldName.toUpperCase()}`;
      
      // Draw the test text
      page.drawText(displayText, {
        x: coordinates.x,
        y: coordinates.y,
        size: 8,
        font: helvetica,
        color: rgb(1, 0, 0), // Red color for visibility
      });
      
      // Draw field label for reference
      page.drawText(fieldName, {
        x: coordinates.x,
        y: coordinates.y - 15,
        size: 6,
        font: helveticaBold,
        color: rgb(0, 0, 1), // Blue color
      });
    }
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `AVAC_Test_Multiple_${new Date().toISOString().split('T')[0]}.pdf`;
    const fileUri = `${Paths.cache}/${fileName}`;
    
    // Convert to base64 and save
    let base64String: string;
    try {
      const binaryString = String.fromCharCode(...pdfBytes);
      base64String = btoa(binaryString);
    } catch (error) {
      console.log('btoa not available, using custom base64 encoding');
      const uint8Array = new Uint8Array(pdfBytes);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      base64String = btoa(binary);
    }
    
    await writeAsStringAsync(fileUri, base64String, { encoding: 'base64' });
    
    console.log(`Test PDF generated: ${fileUri}`);
    return fileUri;
  } catch (error) {
    console.error('Failed to test multiple fields:', error);
    throw error;
  }
}

/**
 * Generate verification PDF with all fields filled
 */
export async function generateVerificationPDF(
  allCoordinates: Record<string, TestField>
): Promise<string> {
  try {
    console.log('Generating verification PDF with all fields...');
    
    // Load template
    const templateBytes = await loadAVACTemplate();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    
    // Load fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Draw all fields with debug labels
    for (const [fieldName, coordinates] of Object.entries(allCoordinates)) {
      // Generate appropriate test text based on field type
      let testText = '';
      if (fieldName.includes('orgUnitNo_box')) {
        testText = fieldName.slice(-1); // Just the digit number
      } else if (fieldName.includes('_row')) {
        const rowNum = fieldName.match(/_row(\d+)/)?.[1] || '1';
        testText = `R${rowNum}`;
      } else if (fieldName.includes('tickbox')) {
        testText = '☑'; // Checkmark
      } else if (fieldName.includes('signature')) {
        testText = 'SIGNATURE';
      } else {
        testText = fieldName.replace(/_/g, ' ').toUpperCase();
      }
      
      // Draw the test text
      page.drawText(testText, {
        x: coordinates.x,
        y: coordinates.y,
        size: 8,
        font: helvetica,
        color: rgb(1, 0, 0), // Red color for visibility
      });
      
      // Draw field label for reference
      page.drawText(fieldName, {
        x: coordinates.x,
        y: coordinates.y - 15,
        size: 6,
        font: helveticaBold,
        color: rgb(0, 0, 1), // Blue color
      });
    }
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `AVAC_Verification_All_Fields_${new Date().toISOString().split('T')[0]}.pdf`;
    const fileUri = `${Paths.cache}/${fileName}`;
    
    // Convert to base64 and save
    let base64String: string;
    try {
      const binaryString = String.fromCharCode(...pdfBytes);
      base64String = btoa(binaryString);
    } catch (error) {
      console.log('btoa not available, using custom base64 encoding');
      const uint8Array = new Uint8Array(pdfBytes);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      base64String = btoa(binary);
    }
    
    await writeAsStringAsync(fileUri, base64String, { encoding: 'base64' });
    
    console.log(`Verification PDF generated: ${fileUri}`);
    return fileUri;
  } catch (error) {
    console.error('Failed to generate verification PDF:', error);
    throw error;
  }
}

/**
 * Quick test function for immediate feedback
 */
export async function quickTestField(
  fieldName: string,
  x: number,
  y: number,
  width?: number,
  height?: number
): Promise<string> {
  return testSingleField(fieldName, { name: fieldName, x, y, width, height });
}
