#!/usr/bin/env node

/**
 * Script to generate a splash screen image at 60% size with white padding
 * This ensures the native splash screen shows the logo at 60% instead of 100%
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp is not installed. Please install it first:');
  console.error('  npm install --save-dev sharp');
  process.exit(1);
}

const inputPath = path.join(__dirname, '../assets/icon.png');
const outputPath = path.join(__dirname, '../assets/splash-60.png');

async function generateSplash() {
  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.error(`Error: Input file not found: ${inputPath}`);
      process.exit(1);
    }

    console.log('Generating splash image at 60% size...');

    // Get the original image metadata
    const metadata = await sharp(inputPath).metadata();
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    // Calculate 60% size
    const targetWidth = Math.round(originalWidth * 0.6);
    const targetHeight = Math.round(originalHeight * 0.6);

    // Calculate padding needed to center the 60% image in the original canvas
    // We want the final image to be the same size as the original, but with the logo at 60%
    const paddingTop = Math.round((originalHeight - targetHeight) / 2);
    const paddingBottom = originalHeight - targetHeight - paddingTop;
    const paddingLeft = Math.round((originalWidth - targetWidth) / 2);
    const paddingRight = originalWidth - targetWidth - paddingLeft;

    // Resize the image to 60% first
    const resized = await sharp(inputPath)
      .resize(targetWidth, targetHeight, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      });

    // Add white padding to center it in the original canvas size
    await resized
      .extend({
        top: paddingTop,
        bottom: paddingBottom,
        left: paddingLeft,
        right: paddingRight,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .toFile(outputPath);

    console.log(`✓ Splash image generated: ${outputPath}`);
    console.log(`  Original size: ${originalWidth}x${originalHeight}`);
    console.log(`  Logo size: ${targetWidth}x${targetHeight} (60%)`);
    console.log(`  Final size: ${originalWidth}x${originalHeight} (with padding)`);
  } catch (error) {
    console.error('Error generating splash image:', error);
    process.exit(1);
  }
}

generateSplash();
