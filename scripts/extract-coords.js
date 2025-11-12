const fs = require('fs');
const path = require('path');

// Extract normal AVAC coordinates
const tsContent = fs.readFileSync('lib/pdf/maps/qld_avac_v85.ts', 'utf8');
const match = tsContent.match(/export const avacCoordinates: CoordinateMap = ({[\s\S]*?});/);
if (match) {
  let objStr = match[1];
  // Simple conversion - this is a basic approach
  // We'll need to manually fix any issues
  try {
    // Use eval in a safe way (only for local dev)
    const coords = eval('(' + objStr + ')');
    coords.meta = {
      maxRowsPerPage: 10,
      version: 'v1'
    };
    fs.writeFileSync('supabase/sql/avac_normal_coords.json', JSON.stringify(coords, null, 2));
    console.log('✓ Extracted normal AVAC coordinates');
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

// Extract SMO coordinates
const smoContent = fs.readFileSync('preview-coordinates-worksheet-smo.json', 'utf8');
const smoData = JSON.parse(smoContent);
// Convert Preview coordinates to PDF coordinates format
const smoCoords = {
  profile: {},
  table: {},
  delegate: {},
  totals: {},
  page: {
    width: smoData.pageWidth,
    height: smoData.pageHeight
  },
  meta: {
    maxRowsPerPage: 3,
    version: 'v1',
    coordinateSystem: 'preview' // Indicates these need conversion
  }
};

// Convert header fields
if (smoData.fields.header) {
  Object.entries(smoData.fields.header).forEach(([key, val]) => {
    smoCoords.profile[key] = {
      x: val.left,
      y: smoData.pageHeight - (val.top + val.height),
      width: val.width,
      height: val.height,
      description: val.description
    };
  });
}

// Convert table fields
if (smoData.fields.table) {
  Object.entries(smoData.fields.table).forEach(([key, val]) => {
    smoCoords.table[key] = {
      x: val.left,
      y: smoData.pageHeight - (val.top + val.height),
      width: val.width,
      height: val.height,
      description: val.description
    };
  });
}

fs.writeFileSync('supabase/sql/avac_smo_coords.json', JSON.stringify(smoCoords, null, 2));
console.log('✓ Extracted SMO AVAC coordinates');

