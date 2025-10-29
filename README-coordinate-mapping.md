# AVAC PDF Coordinate Mapping Guide

This guide helps you manually measure and map all PDF form field coordinates for accurate text overlay in the AVAC template.

## Quick Start

1. **Open the worksheet**: `preview-coordinates-worksheet.json`
2. **Open your PDF**: `assets/pdf/AVAC template.pdf` in Preview.app
3. **Start measuring**: Use Preview's Inspector (⌘I) to get coordinates
4. **Test immediately**: Use the testing utilities to verify coordinates
5. **Convert when done**: Run the converter to generate production coordinates

## Files Created

- `preview-coordinates-worksheet.json` - Your measurement worksheet
- `lib/pdf/coordinate-converter.ts` - Converts Preview → PDF coordinates  
- `lib/pdf/field-tester.ts` - Test individual fields
- `lib/pdf/coordinate-validator.ts` - Validate and verify coordinates

## Step-by-Step Process

### 1. Measure Coordinates in Preview.app

1. Open `assets/pdf/AVAC template.pdf` in Preview
2. Press **⌘I** to open Inspector
3. Click the **selection tool** (crosshair icon)
4. Draw a box around each field (slightly inside borders for text padding)
5. Copy **Left, Top, Width, Height** values from Inspector
6. Paste values into `preview-coordinates-worksheet.json`

### 2. Test Individual Fields

```typescript
import { quickTestField } from './lib/pdf/field-tester';

// Test a single field immediately after measuring
await quickTestField('orgUnitNo_box1', 150, 200, 20, 15);
```

### 3. Validate Progress

```typescript
import { validateWorksheet, generateProgressReport } from './lib/pdf/coordinate-validator';

// Check what's completed
const validation = validateWorksheet('preview-coordinates-worksheet.json');
console.log(`Progress: ${validation.completed.length}/${validation.total} fields`);

// Get detailed progress report
const report = generateProgressReport('preview-coordinates-worksheet.json');
console.log(report);
```

### 4. Convert to Production Coordinates

```bash
# Convert Preview coordinates to PDF coordinates
npx ts-node lib/pdf/coordinate-converter.ts preview-coordinates-worksheet.json lib/pdf/maps/qld_avac_v85.ts
```

### 5. Generate Final Verification

```typescript
import { generateWorksheetVerification } from './lib/pdf/coordinate-validator';

// Generate PDF with ALL fields filled for final verification
await generateWorksheetVerification('preview-coordinates-worksheet.json');
```

## Field Categories

### Header Section (11 fields)
- `orgUnitNo_box1` through `orgUnitNo_box8` - 8 individual digit boxes
- `orgUnitName` - Organisational unit name
- `location` - Location  
- `serviceEnquiryNumber` - Serviceline enquiry number

### Table Section (120 fields)
- **10 rows × 12 columns each:**
  - `personnelAssignmentNo_row[1-10]`
  - `tickbox_row[1-10]` 
  - `employeeName_row[1-10]`
  - `payLevel_row[1-10]`
  - `date_row[1-10]`
  - `rosteredStart_row[1-10]`
  - `rosteredFinish_row[1-10]`
  - `actualStart_row[1-10]`
  - `actualFinish_row[1-10]`
  - `mealBreak_row[1-10]`
  - `overtime_row[1-10]`
  - `comments_row[1-10]`

### Approval Section (5 fields)
- `delegateSignature` - Delegate's Signature
- `delegateFullName` - Delegate's full name
- `delegatePosition` - Delegate's position title
- `contactPhone` - Contact telephone number
- `approvalDate` - Date

## Measurement Tips

### Preview.app Inspector Usage
- **Left**: Distance from left edge of page
- **Top**: Distance from top edge of page  
- **Width**: Width of the field
- **Height**: Height of the field

### Text Positioning Tips
- **Add 3-5 points left padding** for text margin inside boxes
- **Add 2-3 points top padding** to vertically center text
- **For 8-digit org unit boxes**: Measure each individual digit box
- **For tickboxes**: Measure the checkbox square itself
- **For table rows**: Measure row 1 first, then verify spacing with rows 2 and 10

### Coordinate System Notes
- **Preview uses**: Top-left origin (0,0 at top-left)
- **PDF uses**: Bottom-left origin (0,0 at bottom-left)
- **Conversion**: `y_pdf = page_height - (top + height)`
- **Page size**: 841.93 × 595.33 points (A4 landscape)

## Testing Workflow

### 1. Test Individual Fields
```typescript
// After measuring a field, test it immediately
const testPdf = await quickTestField('orgUnitNo_box1', 150, 200, 20, 15);
console.log(`Test PDF: ${testPdf}`);
```

### 2. Test Field Groups
```typescript
// Test all orgUnitNo boxes
await testFieldGroup('preview-coordinates-worksheet.json', 'orgUnitNo_box');

// Test all row 1 fields  
await testFieldGroup('preview-coordinates-worksheet.json', '_row1');
```

### 3. Test Sections
```typescript
// Test entire header section
await testWorksheetSection('preview-coordinates-worksheet.json', 'header');
```

### 4. Final Verification
```typescript
// Generate comprehensive verification PDF
await generateWorksheetVerification('preview-coordinates-worksheet.json');
```

## Troubleshooting

### Common Issues

**Text appears outside the box:**
- Check if you measured the box borders instead of the text area
- Add padding: `x = left + 3`, `y = top + 2`

**Text appears upside down:**
- Verify coordinate conversion is working
- Check that `y_pdf = page_height - (top + height)`

**Text overlaps with other elements:**
- Reduce font size or adjust coordinates
- Check if field width/height is correct

### Debugging Tools

```typescript
// Check coordinate conversion
import { convertPreviewToPDF } from './lib/pdf/coordinate-converter';
const pdfCoords = convertPreviewToPDF('preview-coordinates-worksheet.json');

// Validate worksheet
import { validateWorksheet } from './lib/pdf/coordinate-validator';
const validation = validateWorksheet('preview-coordinates-worksheet.json');
```

## Production Integration

Once all coordinates are verified:

1. **Convert coordinates**: Run the converter to generate `qld_avac_v85.ts`
2. **Update buildAVAC.ts**: Use the new coordinates in your PDF generation
3. **Test with real data**: Generate PDFs with actual user data
4. **Fine-tune**: Adjust coordinates based on real-world usage

## File Structure

```
├── preview-coordinates-worksheet.json     # Your measurement worksheet
├── lib/pdf/
│   ├── coordinate-converter.ts             # Preview → PDF conversion
│   ├── field-tester.ts                    # Individual field testing
│   ├── coordinate-validator.ts             # Validation and verification
│   └── maps/
│       └── qld_avac_v85.ts                # Generated production coordinates
└── assets/pdf/
    └── AVAC template.pdf                   # Template to measure
```

## Next Steps

1. **Start with header fields** - they're the easiest to measure
2. **Measure one table row completely** - then verify spacing
3. **Test frequently** - use the testing utilities after each field
4. **Complete the worksheet** - all 131 fields need coordinates
5. **Generate final verification** - ensure everything is correct
6. **Convert to production** - update your coordinate maps
