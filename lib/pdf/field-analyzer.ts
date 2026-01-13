/**
 * Field analyser for AVAC template
 * This helps identify the exact positions of all input fields
 */

export interface FieldPosition {
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  description: string;
  section: 'header' | 'table' | 'approval';
}

/**
 * AVAC template field positions based on analysis
 * These coordinates need to be verified and adjusted
 */
export const avacFieldPositions: FieldPosition[] = [
  // Header section fields (top of form)
  {
    name: 'orgUnitNo',
    x: 150,
    y: 800,
    description: 'Organisational unit no.',
    section: 'header'
  },
  {
    name: 'orgUnitName', 
    x: 150,
    y: 780,
    description: 'Organisational unit name',
    section: 'header'
  },
  {
    name: 'location',
    x: 150,
    y: 760,
    description: 'Location',
    section: 'header'
  },
  {
    name: 'serviceEnquiryNumber',
    x: 400,
    y: 800,
    description: 'Service enquiry number',
    section: 'header'
  },
  
  // Table header fields (in table area)
  {
    name: 'employeeName',
    x: 200,
    y: 750,
    description: 'Employee Name',
    section: 'table'
  },
  {
    name: 'payrollNumber',
    x: 100,
    y: 750,
    description: 'Personnel assignment number',
    section: 'table'
  },
  {
    name: 'payLevel',
    x: 300,
    y: 750,
    description: 'Pay Level',
    section: 'table'
  },
  {
    name: 'costCentre',
    x: 400,
    y: 750,
    description: 'Cost Centre',
    section: 'table'
  },
  
  // Table row fields (for each of the 10 rows)
  // Row 1 coordinates (subsequent rows calculated by adding rowHeight)
  {
    name: 'date_1',
    x: 50,
    y: 700,
    description: 'Date (Row 1)',
    section: 'table'
  },
  {
    name: 'rosteredStart_1',
    x: 100,
    y: 700,
    description: 'Rostered Start (Row 1)',
    section: 'table'
  },
  {
    name: 'rosteredFinish_1',
    x: 150,
    y: 700,
    description: 'Rostered Finish (Row 1)',
    section: 'table'
  },
  {
    name: 'actualStart_1',
    x: 200,
    y: 700,
    description: 'Actual Start (Row 1)',
    section: 'table'
  },
  {
    name: 'actualFinish_1',
    x: 250,
    y: 700,
    description: 'Actual Finish (Row 1)',
    section: 'table'
  },
  {
    name: 'mealBreak_1',
    x: 300,
    y: 700,
    description: 'Meal break (Row 1)',
    section: 'table'
  },
  {
    name: 'overtime_1',
    x: 350,
    y: 700,
    description: 'Overtime/Oncall/Recall (Row 1)',
    section: 'table'
  },
  {
    name: 'comments_1',
    x: 400,
    y: 700,
    description: 'Comments (Row 1)',
    section: 'table'
  },
  
  // Approval section fields (bottom of form)
  {
    name: 'delegateName',
    x: 200,
    y: 150,
    description: 'Delegate full name',
    section: 'approval'
  },
  {
    name: 'delegatePosition',
    x: 200,
    y: 130,
    description: 'Delegate position title',
    section: 'approval'
  },
  {
    name: 'areaCode',
    x: 400,
    y: 150,
    description: 'Area code',
    section: 'approval'
  },
  {
    name: 'phone',
    x: 500,
    y: 150,
    description: 'Contact telephone number',
    section: 'approval'
  },
  {
    name: 'delegateSignature',
    x: 200,
    y: 110,
    width: 200,
    height: 30,
    description: 'Delegate signature',
    section: 'approval'
  }
];

/**
 * Calculate coordinates for table rows
 */
export function getTableRowCoordinates(rowIndex: number, baseField: FieldPosition): FieldPosition {
  const rowHeight = 20; // Height between rows
  const startY = 700; // First row Y position
  
  return {
    ...baseField,
    name: baseField.name.replace('_1', `_${rowIndex + 1}`),
    y: startY - (rowIndex * rowHeight),
    description: baseField.description.replace('(Row 1)', `(Row ${rowIndex + 1})`)
  };
}

/**
 * Get all field positions for a specific section
 */
export function getFieldsBySection(section: 'header' | 'table' | 'approval'): FieldPosition[] {
  return avacFieldPositions.filter(field => field.section === section);
}

/**
 * Get all table row fields for a specific row
 */
export function getTableRowFields(rowIndex: number): FieldPosition[] {
  const baseFields = avacFieldPositions.filter(field => 
    field.section === 'table' && field.name.includes('_1')
  );
  
  return baseFields.map(field => getTableRowCoordinates(rowIndex, field));
}
