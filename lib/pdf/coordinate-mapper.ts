/**
 * Coordinate mapping tool for AVAC template
 * This helps identify the exact coordinates for each field
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Create a coordinate mapping PDF with numbered grid
 * This helps identify exact coordinates for each field
 */
export async function createCoordinateMapper(): Promise<string> {
  try {
    // Load the AVAC template
    const templateAsset = require('../../assets/pdf/AVAC template.pdf');
    const response = await fetch(templateAsset);
    const templateBytes = await response.arrayBuffer();
    
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    
    // Add coordinate grid
    await drawCoordinateGrid(page);
    
    // Add field labels at key positions
    await drawFieldLabels(page);
    
    // Save the coordinate mapper PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `AVAC_Coordinate_Mapper_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Convert to base64 and save
    const binaryString = String.fromCharCode(...pdfBytes);
    const base64String = btoa(binaryString);
    
    // Save to cache directory
    const { writeAsStringAsync } = await import('expo-file-system/legacy');
    const { Paths } = await import('expo-file-system');
    const fileUri = `${Paths.cache}/${fileName}`;
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
        size: 8,
        font: helvetica,
        color: rgb(0, 0, 0),
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
        size: 8,
        font: helvetica,
        color: rgb(0, 0, 0),
      });
    }
  }
}

/**
 * Draw field labels at key positions
 */
async function drawFieldLabels(page: any) {
  const helvetica = await page.doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await page.doc.embedFont(StandardFonts.HelveticaBold);
  
  // Key field positions to identify
  const fieldLabels = [
    { text: 'ORG_UNIT_NO', x: 200, y: 480 },
    { text: 'ORG_UNIT_NAME', x: 200, y: 460 },
    { text: 'LOCATION', x: 200, y: 440 },
    { text: 'SERVICE_ENQUIRY', x: 200, y: 500 },
    { text: 'EMPLOYEE_NAME', x: 200, y: 420 },
    { text: 'PAYROLL_NUMBER', x: 200, y: 400 },
    { text: 'PAY_LEVEL', x: 200, y: 380 },
    { text: 'COST_CENTRE', x: 200, y: 360 },
    { text: 'DELEGATE_NAME', x: 200, y: 120 },
    { text: 'DELEGATE_POSITION', x: 200, y: 100 },
    { text: 'AREA_CODE', x: 200, y: 80 },
    { text: 'PHONE', x: 300, y: 80 },
  ];
  
  fieldLabels.forEach(field => {
    page.drawText(field.text, {
      x: field.x,
      y: field.y,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 0, 0), // Red color for visibility
    });
  });
}
