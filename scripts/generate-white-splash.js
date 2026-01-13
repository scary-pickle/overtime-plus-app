#!/usr/bin/env node

/**
 * Script to generate a completely white splash screen image
 * This ensures no logo appears on the native splash, preventing size mismatch
 * The React Native overlay will show the logo at 60% immediately
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
const outputPath = path.join(__dirname, '../assets/splash-white.png');

async function generateWhiteSplash() {
  try {
    // Get the original image metadata to match dimensions
    const metadata = await sharp(inputPath).metadata();
    const width = metadata.width;
    const height = metadata.height;

    console.log('Generating white splash image...');

    // Create a completely white image with the same dimensions as the icon
    await sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .png()
      .toFile(outputPath);

    console.log(`✓ White splash image generated: ${outputPath}`);
    console.log(`  Size: ${width}x${height}`);
    console.log(`  This will show no logo on native splash - React Native overlay handles it`);
  } catch (error) {
    console.error('Error generating white splash image:', error);
    process.exit(1);
  }
}

generateWhiteSplash();
