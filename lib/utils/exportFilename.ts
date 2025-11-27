/**
 * Utility functions for generating export filenames
 */

import { ExportBatch } from '../../types';
import { Profile } from '../../lib/state/profileStore';

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
  
  // Handle single name case
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '' };
  }
  
  // Handle multiple names - first name is first part, last name is last part
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  
  return { firstName, lastName };
}

/**
 * Generate filename for SMO AVAC
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
 * Generate filename for regular AVAC
 */
function generateAVACFileName(profile: Profile): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const nameInfo = parseName(profile.fullName);
  
  if (nameInfo && nameInfo.firstName && nameInfo.lastName) {
    const firstName = nameInfo.firstName.replace(/[^a-zA-Z0-9]/g, '_');
    const lastName = nameInfo.lastName.replace(/[^a-zA-Z0-9]/g, '_');
    return `AVAC_${firstName}_${lastName}_${dateStr}.pdf`;
  } else if (nameInfo && nameInfo.firstName) {
    const firstName = nameInfo.firstName.replace(/[^a-zA-Z0-9]/g, '_');
    return `AVAC_${firstName}_${dateStr}.pdf`;
  } else {
    return `AVAC_${dateStr}.pdf`;
  }
}

/**
 * Get the export filename from an export batch
 * Uses customName if available, otherwise generates from profile
 */
export function getExportFileName(exportBatch: ExportBatch, profile?: Profile | null): string {
  // If customName is provided and ends with .pdf, use it
  if (exportBatch.customName) {
    const customName = exportBatch.customName.trim();
    if (customName.endsWith('.pdf')) {
      return customName;
    }
    // If it doesn't end with .pdf, add it
    return `${customName}.pdf`;
  }
  
  // If no customName, generate from profile
  if (profile) {
    return profile.isSMO 
      ? generateSMOProductionFileName(profile)
      : generateAVACFileName(profile);
  }
  
  // Fallback to batch ID if no profile available
  return `${exportBatch.id}.pdf`;
}

/**
 * Get a shortened display name for the export (without person's name)
 * Format: Uses customName if available, otherwise "SMO_AVAC_2025-11-27" or "AVAC_2025-11-27"
 * This is used for display in the UI, while the full filename is used when sharing
 */
export function getExportDisplayName(exportBatch: ExportBatch, profile?: Profile | null): string {
  // If customName exists, use it directly (without .pdf extension)
  const customName = exportBatch.customName?.trim();
  if (customName) {
    // Remove .pdf extension if present for display
    return customName.endsWith('.pdf') ? customName.slice(0, -4) : customName;
  }
  
  // No custom name, generate shortened format: PREFIX_DATE
  const dateStr = new Date(exportBatch.createdAt).toISOString().split('T')[0];
  
  // Determine if it's SMO format
  const isSMO = profile?.isSMO || false;
  
  // Return shortened format: PREFIX_DATE
  return isSMO ? `SMO_AVAC_${dateStr}` : `AVAC_${dateStr}`;
}

