/**
 * Coordinate converter for AVAC PDF form fields
 * Converts Preview.app coordinates (top-left origin) to PDF coordinates (bottom-left origin)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface PreviewCoordinates {
  left: number | null;
  top: number | null;
  width: number | null;
  height: number | null;
  description: string;
}

interface PreviewWorksheet {
  pageHeight: number;
  pageWidth: number;
  fields: {
    header: Record<string, PreviewCoordinates>;
    table: Record<string, PreviewCoordinates>;
    approval: Record<string, PreviewCoordinates>;
  };
}

interface PDFCoordinates {
  x: number;
  y: number;
  width?: number;
  height?: number;
  description?: string;
}

interface PDFCoordinateMap {
  profile: Record<string, PDFCoordinates>;
  tableHeader: Record<string, PDFCoordinates>;
  tableRow: {
    startY: number;
    rowHeight: number;
    maxRows: number;
  };
  delegate: Record<string, PDFCoordinates>;
  totals: Record<string, PDFCoordinates>;
  page: {
    width: number;
    height: number;
  };
}

/**
 * Convert Preview coordinates to PDF coordinates
 */
function convertCoordinates(
  previewCoords: PreviewCoordinates,
  pageHeight: number
): PDFCoordinates {
  if (previewCoords.left === null || previewCoords.top === null || 
      previewCoords.width === null || previewCoords.height === null) {
    throw new Error(`Incomplete coordinates for field: ${previewCoords.description}`);
  }

  return {
    x: previewCoords.left,
    y: pageHeight - (previewCoords.top + previewCoords.height),
    width: previewCoords.width,
    height: previewCoords.height,
    description: previewCoords.description
  };
}

/**
 * Convert Preview worksheet to PDF coordinate map
 */
export function convertPreviewToPDF(worksheetPath: string): PDFCoordinateMap {
  try {
    const worksheet: PreviewWorksheet = JSON.parse(readFileSync(worksheetPath, 'utf8'));
    
    const pdfCoords: PDFCoordinateMap = {
      profile: {},
      tableHeader: {},
      tableRow: {
        startY: 0,
        rowHeight: 0,
        maxRows: 10
      },
      delegate: {},
      totals: {},
      page: {
        width: worksheet.pageWidth,
        height: worksheet.pageHeight
      }
    };

    // Convert header fields
    for (const [fieldName, coords] of Object.entries(worksheet.fields.header)) {
      if (coords.left !== null && coords.top !== null && 
          coords.width !== null && coords.height !== null) {
        pdfCoords.profile[fieldName] = convertCoordinates(coords, worksheet.pageHeight);
      }
    }

    // Convert table fields - we'll use row 1 as the base and calculate others
    const tableFields: Record<string, PDFCoordinates> = {};
    let rowHeight = 0;
    let startY = 0;

    for (const [fieldName, coords] of Object.entries(worksheet.fields.table)) {
      if (coords.left !== null && coords.top !== null && 
          coords.width !== null && coords.height !== null) {
        
        const pdfCoords = convertCoordinates(coords, worksheet.pageHeight);
        
        // Extract row number from field name (e.g., "employeeName_row1" -> 1)
        const rowMatch = fieldName.match(/_row(\d+)$/);
        if (rowMatch) {
          const rowNum = parseInt(rowMatch[1]);
          const baseFieldName = fieldName.replace(/_row\d+$/, '');
          
          if (rowNum === 1) {
            // Store row 1 coordinates as base
            tableFields[baseFieldName] = pdfCoords;
            startY = pdfCoords.y;
          } else if (rowNum === 2) {
            // Calculate row height from difference between row 1 and row 2
            const row1Coords = tableFields[baseFieldName];
            if (row1Coords) {
              rowHeight = Math.abs(row1Coords.y - pdfCoords.y);
            }
          }
        } else {
          // Non-row fields (like headers)
          tableFields[fieldName] = pdfCoords;
        }
      }
    }

    // Store table header coordinates
    pdfCoords.tableHeader = tableFields;
    pdfCoords.tableRow.startY = startY;
    pdfCoords.tableRow.rowHeight = rowHeight;

    // Convert approval fields
    for (const [fieldName, coords] of Object.entries(worksheet.fields.approval)) {
      if (coords.left !== null && coords.top !== null && 
          coords.width !== null && coords.height !== null) {
        pdfCoords.delegate[fieldName] = convertCoordinates(coords, worksheet.pageHeight);
      }
    }

    return pdfCoords;
  } catch (error) {
    console.error('Error converting coordinates:', error);
    throw error;
  }
}

/**
 * Generate TypeScript coordinate map file
 */
export function generateCoordinateMap(worksheetPath: string, outputPath: string): void {
  try {
    const pdfCoords = convertPreviewToPDF(worksheetPath);
    
    const tsContent = `/**
 * AVAC v8.5 coordinate map - Generated from Preview.app measurements
 * All coordinates are in points (1/72 inch)
 * A4 page: ${pdfCoords.page.width} x ${pdfCoords.page.height} points
 */

export interface CoordinateMap {
  profile: Record<string, { x: number; y: number; width?: number; height?: number; description?: string }>;
  tableHeader: Record<string, { x: number; y: number; width?: number; height?: number; description?: string }>;
  tableRow: {
    startY: number;
    rowHeight: number;
    maxRows: number;
  };
  delegate: Record<string, { x: number; y: number; width?: number; height?: number; description?: string }>;
  totals: Record<string, { x: number; y: number; width?: number; height?: number; description?: string }>;
  page: {
    width: number;
    height: number;
  };
}

export const avacCoordinates: CoordinateMap = ${JSON.stringify(pdfCoords, null, 2)};

/**
 * Helper function to calculate row Y position
 */
export function getRowYPosition(rowIndex: number): number {
  return avacCoordinates.tableRow.startY + (rowIndex * avacCoordinates.tableRow.rowHeight);
}

/**
 * Helper function to get field coordinates for a specific row
 */
export function getFieldCoordinates(fieldName: string, rowIndex: number = 0): { x: number; y: number; width?: number; height?: number } | null {
  if (rowIndex === 0) {
    // Header or single field
    return avacCoordinates.profile[fieldName] || avacCoordinates.tableHeader[fieldName] || avacCoordinates.delegate[fieldName] || null;
  } else {
    // Table row field
    const baseField = avacCoordinates.tableHeader[fieldName];
    if (baseField) {
      return {
        x: baseField.x,
        y: getRowYPosition(rowIndex - 1),
        width: baseField.width,
        height: baseField.height
      };
    }
  }
  return null;
}
`;

    writeFileSync(outputPath, tsContent, 'utf8');
    console.log(`Generated coordinate map: ${outputPath}`);
  } catch (error) {
    console.error('Error generating coordinate map:', error);
    throw error;
  }
}

/**
 * Validate that all required coordinates are present
 */
export function validateCoordinates(worksheetPath: string): { valid: boolean; missing: string[] } {
  try {
    const worksheet: PreviewWorksheet = JSON.parse(readFileSync(worksheetPath, 'utf8'));
    const missing: string[] = [];

    // Check header fields
    for (const [fieldName, coords] of Object.entries(worksheet.fields.header)) {
      if (coords.left === null || coords.top === null || 
          coords.width === null || coords.height === null) {
        missing.push(`header.${fieldName}`);
      }
    }

    // Check table fields (sample a few rows)
    const tableFields = Object.keys(worksheet.fields.table);
    const sampleRows = [1, 2, 10]; // Check first, second, and last row
    
    for (const row of sampleRows) {
      for (const fieldType of ['personnelAssignmentNo', 'employeeName', 'date', 'rosteredStart', 'rosteredFinish', 'actualStart', 'actualFinish', 'mealBreak', 'overtime', 'comments']) {
        const fieldName = `${fieldType}_row${row}`;
        if (tableFields.includes(fieldName)) {
          const coords = worksheet.fields.table[fieldName];
          if (coords.left === null || coords.top === null || 
              coords.width === null || coords.height === null) {
            missing.push(`table.${fieldName}`);
          }
        }
      }
    }

    // Check approval fields
    for (const [fieldName, coords] of Object.entries(worksheet.fields.approval)) {
      if (coords.left === null || coords.top === null || 
          coords.width === null || coords.height === null) {
        missing.push(`approval.${fieldName}`);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  } catch (error) {
    console.error('Error validating coordinates:', error);
    return { valid: false, missing: ['Error reading worksheet'] };
  }
}

/**
 * CLI usage
 */
if (require.main === module) {
  const worksheetPath = process.argv[2] || 'preview-coordinates-worksheet.json';
  const outputPath = process.argv[3] || 'lib/pdf/maps/qld_avac_v85.ts';
  
  console.log('Converting coordinates...');
  console.log(`Input: ${worksheetPath}`);
  console.log(`Output: ${outputPath}`);
  
  // Validate first
  const validation = validateCoordinates(worksheetPath);
  if (!validation.valid) {
    console.error('Missing coordinates:', validation.missing);
    console.error('Please complete the worksheet before converting.');
    process.exit(1);
  }
  
  // Convert
  generateCoordinateMap(worksheetPath, outputPath);
  console.log('Conversion complete!');
}
