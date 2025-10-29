/**
 * Coordinate validation and verification utilities for AVAC PDF form
 * Provides comprehensive testing and validation of field coordinates
 */

import { readFileSync } from 'fs';
import { testSingleField, testMultipleFields, generateVerificationPDF } from './field-tester';

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

interface TestField {
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  description?: string;
}

/**
 * Load and parse the Preview coordinates worksheet
 */
function loadWorksheet(worksheetPath: string): PreviewWorksheet {
  try {
    return JSON.parse(readFileSync(worksheetPath, 'utf8'));
  } catch (error) {
    console.error('Error loading worksheet:', error);
    throw error;
  }
}

/**
 * Convert Preview coordinates to PDF coordinates for testing
 */
function convertToPDFCoords(
  previewCoords: PreviewCoordinates,
  pageHeight: number
): TestField {
  if (previewCoords.left === null || previewCoords.top === null || 
      previewCoords.width === null || previewCoords.height === null) {
    throw new Error(`Incomplete coordinates: ${previewCoords.description}`);
  }

  return {
    name: previewCoords.description,
    x: previewCoords.left,
    y: pageHeight - (previewCoords.top + previewCoords.height),
    width: previewCoords.width,
    height: previewCoords.height,
    description: previewCoords.description
  };
}

/**
 * Validate that all required coordinates are present
 */
export function validateWorksheet(worksheetPath: string): {
  valid: boolean;
  missing: string[];
  completed: string[];
  total: number;
} {
  const worksheet = loadWorksheet(worksheetPath);
  const missing: string[] = [];
  const completed: string[] = [];
  let total = 0;

  // Check all fields
  for (const [sectionName, section] of Object.entries(worksheet.fields)) {
    for (const [fieldName, coords] of Object.entries(section)) {
      total++;
      if (coords.left === null || coords.top === null || 
          coords.width === null || coords.height === null) {
        missing.push(`${sectionName}.${fieldName}`);
      } else {
        completed.push(`${sectionName}.${fieldName}`);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    completed,
    total
  };
}

/**
 * Test a single field from the worksheet
 */
export async function testWorksheetField(
  worksheetPath: string,
  sectionName: string,
  fieldName: string
): Promise<string> {
  const worksheet = loadWorksheet(worksheetPath);
  const coords = worksheet.fields[sectionName as keyof typeof worksheet.fields][fieldName];
  
  if (!coords || coords.left === null || coords.top === null || 
      coords.width === null || coords.height === null) {
    throw new Error(`Field ${sectionName}.${fieldName} not found or incomplete`);
  }

  const pdfCoords = convertToPDFCoords(coords, worksheet.pageHeight);
  return testSingleField(fieldName, pdfCoords);
}

/**
 * Test all completed fields from a section
 */
export async function testWorksheetSection(
  worksheetPath: string,
  sectionName: 'header' | 'table' | 'approval'
): Promise<string> {
  const worksheet = loadWorksheet(worksheetPath);
  const section = worksheet.fields[sectionName];
  const fields: Record<string, TestField> = {};

  for (const [fieldName, coords] of Object.entries(section)) {
    if (coords.left !== null && coords.top !== null && 
        coords.width !== null && coords.height !== null) {
      fields[fieldName] = convertToPDFCoords(coords, worksheet.pageHeight);
    }
  }

  if (Object.keys(fields).length === 0) {
    throw new Error(`No completed fields found in section ${sectionName}`);
  }

  return testMultipleFields(fields);
}

/**
 * Generate comprehensive verification PDF with all completed fields
 */
export async function generateWorksheetVerification(worksheetPath: string): Promise<string> {
  const worksheet = loadWorksheet(worksheetPath);
  const allFields: Record<string, TestField> = {};

  // Collect all completed fields
  for (const [sectionName, section] of Object.entries(worksheet.fields)) {
    for (const [fieldName, coords] of Object.entries(section)) {
      if (coords.left !== null && coords.top !== null && 
          coords.width !== null && coords.height !== null) {
        const pdfCoords = convertToPDFCoords(coords, worksheet.pageHeight);
        allFields[`${sectionName}_${fieldName}`] = pdfCoords;
      }
    }
  }

  if (Object.keys(allFields).length === 0) {
    throw new Error('No completed fields found in worksheet');
  }

  return generateVerificationPDF(allFields);
}

/**
 * Test specific field types (e.g., all orgUnitNo boxes, all row 1 fields)
 */
export async function testFieldGroup(
  worksheetPath: string,
  fieldPattern: string
): Promise<string> {
  const worksheet = loadWorksheet(worksheetPath);
  const fields: Record<string, TestField> = {};

  // Find all fields matching the pattern
  for (const [sectionName, section] of Object.entries(worksheet.fields)) {
    for (const [fieldName, coords] of Object.entries(section)) {
      if (fieldName.includes(fieldPattern) && 
          coords.left !== null && coords.top !== null && 
          coords.width !== null && coords.height !== null) {
        const pdfCoords = convertToPDFCoords(coords, worksheet.pageHeight);
        fields[`${sectionName}_${fieldName}`] = pdfCoords;
      }
    }
  }

  if (Object.keys(fields).length === 0) {
    throw new Error(`No fields found matching pattern: ${fieldPattern}`);
  }

  return testMultipleFields(fields);
}

/**
 * Generate progress report
 */
export function generateProgressReport(worksheetPath: string): {
  summary: {
    total: number;
    completed: number;
    remaining: number;
    percentage: number;
  };
  sections: {
    header: { total: number; completed: number; percentage: number };
    table: { total: number; completed: number; percentage: number };
    approval: { total: number; completed: number; percentage: number };
  };
  recommendations: string[];
} {
  const worksheet = loadWorksheet(worksheetPath);
  const validation = validateWorksheet(worksheetPath);
  
  const sections = {
    header: { total: 0, completed: 0, percentage: 0 },
    table: { total: 0, completed: 0, percentage: 0 },
    approval: { total: 0, completed: 0, percentage: 0 }
  };

  // Count by section
  for (const [sectionName, section] of Object.entries(worksheet.fields)) {
    let total = 0;
    let completed = 0;
    
    for (const coords of Object.values(section)) {
      total++;
      if (coords.left !== null && coords.top !== null && 
          coords.width !== null && coords.height !== null) {
        completed++;
      }
    }
    
    sections[sectionName as keyof typeof sections] = {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  const recommendations: string[] = [];
  
  if (sections.header.percentage < 100) {
    recommendations.push('Complete header section first - these are the easiest to measure');
  }
  
  if (sections.table.percentage < 50) {
    recommendations.push('Focus on table row 1 fields - measure one complete row first');
  }
  
  if (sections.approval.percentage < 100) {
    recommendations.push('Complete approval section - these are at the bottom of the form');
  }

  return {
    summary: {
      total: validation.total,
      completed: validation.completed.length,
      remaining: validation.missing.length,
      percentage: validation.total > 0 ? Math.round((validation.completed.length / validation.total) * 100) : 0
    },
    sections,
    recommendations
  };
}

/**
 * CLI usage for testing
 */
export async function runCoordinateTests(worksheetPath: string): Promise<void> {
  console.log('🔍 Validating coordinate worksheet...');
  
  const validation = validateWorksheet(worksheetPath);
  console.log(`📊 Progress: ${validation.completed.length}/${validation.total} fields completed (${Math.round((validation.completed.length / validation.total) * 100)}%)`);
  
  if (!validation.valid) {
    console.log('❌ Missing coordinates:');
    validation.missing.slice(0, 10).forEach(field => console.log(`  - ${field}`));
    if (validation.missing.length > 10) {
      console.log(`  ... and ${validation.missing.length - 10} more`);
    }
    return;
  }
  
  console.log('✅ All coordinates complete! Generating verification PDF...');
  
  try {
    const verificationPath = await generateWorksheetVerification(worksheetPath);
    console.log(`📄 Verification PDF generated: ${verificationPath}`);
  } catch (error) {
    console.error('❌ Failed to generate verification PDF:', error);
  }
}
