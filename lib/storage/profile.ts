import * as SecureStore from 'expo-secure-store';
import { Profile } from '../../types';
import { encrypt, decrypt } from '../utils/encryption';
import { createScopedLogger, maskUserId as maskUserIdUtil } from '../utils/logger';

const PROFILE_KEY_PREFIX = 'overtime_plus_profile';
const LEGACY_PROFILE_KEY = 'overtime_plus_profile'; // Old key for migration

const debug = createScopedLogger('profileStorage');
const maskUserId = (userId?: string | null) =>
  userId ? maskUserIdUtil(userId) || 'anonymous' : 'anonymous';

function getProfileKey(userId?: string | null): string {
  if (!userId) {
    // For unauthenticated users, use legacy key
    return LEGACY_PROFILE_KEY;
  }
  return `${PROFILE_KEY_PREFIX}_${userId}`;
}

export class ProfileStorage {
  async saveProfile(profile: Profile, userId?: string | null): Promise<void> {
    try {
      const profileKey = getProfileKey(userId);
      debug.debug('Saving profile to storage', {
        userId: maskUserId(userId ?? null),
        profileKey,
        hasEmployeeInitial: !!profile.employeeInitial,
        fieldCount: Object.keys(profile).length,
      });
      
      // Encrypt PII fields before storing
      const profileToSave = { ...profile };
      if (profileToSave.employeeInitial) {
        try {
          profileToSave.employeeInitial = await encrypt(profileToSave.employeeInitial);
        } catch (encryptError) {
          debug.error('Failed to encrypt initials (blocking save):', encryptError);
          throw new Error('Could not securely store profile data. Please try again.');
        }
      }
      if (profileToSave.email) {
        try {
          profileToSave.email = await encrypt(profileToSave.email);
        } catch (encryptError) {
          debug.error('Failed to encrypt email (blocking save):', encryptError);
          throw new Error('Could not securely store profile data. Please try again.');
        }
      }
      
      const profileJson = JSON.stringify(profileToSave);
      await SecureStore.setItemAsync(profileKey, profileJson);
      debug.debug('Profile saved successfully to storage');
    } catch (error) {
      debug.error('Failed to save profile:', error);
      throw new Error('Failed to save profile to secure storage');
    }
  }

  async loadProfile(userId?: string | null): Promise<Profile | null> {
    try {
      const profileKey = getProfileKey(userId);
      debug.debug('Loading profile from storage', {
        userId: maskUserId(userId ?? null),
        profileKey,
      });
      const profileJson = await SecureStore.getItemAsync(profileKey);
      if (!profileJson) {
        return null;
      }
      
      const profile = JSON.parse(profileJson) as any;
      
      // Decrypt PII fields after loading
      // The decrypt function will return the original value if it's not encrypted (old data)
      if (profile.employeeInitial) {
        profile.employeeInitial = await decrypt(profile.employeeInitial);
      }
      if (profile.email) {
        profile.email = await decrypt(profile.email);
      }
      
      // Migration: Convert old profile format to new format
      if (profile.delegateSignatureUri !== undefined && profile.employeeInitial === undefined) {
        debug.debug('Migrating profile from old format');
        // Generate employee initial from full name
        profile.employeeInitial = this.generateInitials(profile.fullName || '');
        // Remove old signature field
        delete profile.delegateSignatureUri;

        // Save the migrated profile (will encrypt PII fields)
        await this.saveProfile(profile as Profile, userId);
        debug.debug('Profile migrated successfully');
      }

      // Ensure employee initial is always set
      if (!profile.employeeInitial && profile.fullName) {
        profile.employeeInitial = this.generateInitials(profile.fullName);
        // Save the updated profile (will encrypt PII fields)
        await this.saveProfile(profile as Profile, userId);
      }
      
      // Migration: Add concurrent employment default if missing
      if (profile.concurrentEmploymentDefault === undefined) {
        profile.concurrentEmploymentDefault = false;
        // Save the updated profile (will encrypt PII fields)
        await this.saveProfile(profile as Profile, userId);
      }
      
      // Migration: Add email field if missing
      if (profile.email === undefined) {
        profile.email = '';
        // Save the updated profile (will encrypt PII fields)
        await this.saveProfile(profile as Profile, userId);
      }
      
      // Migration: Add isSMO field if missing
      if (profile.isSMO === undefined) {
        profile.isSMO = false; // Default to non-SMO
        // Save the updated profile (will encrypt PII fields)
        await this.saveProfile(profile as Profile, userId);
      }

      debug.debug('Profile loaded from storage', {
        hasEmployeeInitial: !!profile.employeeInitial,
        isSMO: profile.isSMO,
        fieldCount: Object.keys(profile).length,
      });
      return profile as Profile;
    } catch (error) {
      debug.error('Failed to load profile:', error);
      return null;
    }
  }

  async deleteProfile(userId?: string | null): Promise<void> {
    try {
      const profileKey = getProfileKey(userId);
      await SecureStore.deleteItemAsync(profileKey);
      debug.debug('Profile deleted successfully', { profileKey });
    } catch (error) {
      debug.error('Failed to delete profile:', error);
      throw new Error('Failed to delete profile from secure storage');
    }
  }

  async hasProfile(userId?: string | null): Promise<boolean> {
    try {
      const profileKey = getProfileKey(userId);
      const profileJson = await SecureStore.getItemAsync(profileKey);
      return profileJson !== null;
    } catch (error) {
      debug.error('Failed to check profile existence:', error);
      return false;
    }
  }

  // Clear old legacy profile (from before auth was implemented)
  async clearLegacyProfile(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(LEGACY_PROFILE_KEY);
      debug.debug('Legacy profile cleared successfully');
    } catch (error) {
      debug.error('Failed to clear legacy profile:', error);
      // Don't throw - this is a cleanup operation
    }
  }

  // Helper to generate initials from full name
  generateInitials(fullName: string): string {
    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return names.map(name => name.charAt(0)).join('').toUpperCase().substring(0, 3);
  }

  // Helper to validate profile completeness
  // Note: Delegate information is optional (only required for PDF generation)
  isProfileComplete(profile: Profile): boolean {
    // Base required fields for all users (excluding delegate info)
    const baseRequiredFields: (keyof Profile)[] = [
      'fullName', 'payrollNumber', 'orgUnitName', 'location',
      'employeeInitial', 'email', 'isSMO'
    ];

    // For SMO users, payLevel is optional
    const requiredFields: (keyof Profile)[] = profile.isSMO 
      ? baseRequiredFields 
      : [...baseRequiredFields, 'payLevel'];

    return requiredFields.every(field => {
      const value = profile[field];
      if (field === 'isSMO') {
        return typeof value === 'boolean'; // isSMO can be true or false, just needs to be set
      }
      return typeof value === 'string' && value.trim().length > 0;
    });
  }

  // Helper to get missing fields with user-friendly names
  // Note: Delegate information is optional (only required for PDF generation)
  getMissingFields(profile: Profile): { field: keyof Profile; label: string; section: string }[] {
    // Base required fields for all users (excluding delegate info)
    const baseRequiredFields: (keyof Profile)[] = [
      'fullName', 'payrollNumber', 'orgUnitName', 'location',
      'employeeInitial', 'email', 'isSMO'
    ];

    // For SMO users, payLevel is optional
    const requiredFields: (keyof Profile)[] = profile.isSMO 
      ? baseRequiredFields 
      : [...baseRequiredFields, 'payLevel'];

    // Field labels mapping
    const fieldLabels: Record<keyof Profile, string> = {
      fullName: 'Full Name',
      payrollNumber: 'Payroll Number',
      orgUnitNo: 'Organisation Unit No',
      orgUnitName: 'Department',
      location: 'Hospital',
      delegateName: 'Delegate Name',
      delegatePosition: 'Delegate Position',
      delegateAreaCode: 'Area Code',
      delegatePhone: 'Phone Number',
      employeeInitial: 'Employee Initial',
      email: 'Email Address',
      payLevel: 'Pay Level',
      serviceEnquiryNumber: 'Service Enquiry Number',
      pdfTemplateVersion: 'PDF Template Version',
      timezone: 'Timezone',
      concurrentEmploymentDefault: 'Concurrent Employment Default',
      emailTemplate: 'Email Template',
      emailSubmissionMethod: 'Email Submission Method',
      isSMO: 'Is SMO',
    };

    // Section mapping
    const fieldSections: Record<keyof Profile, string> = {
      fullName: 'Employee Details',
      payrollNumber: 'Employee Details',
      orgUnitNo: 'Organisation',
      orgUnitName: 'Organisation',
      location: 'Organisation',
      delegateName: 'Delegate Details',
      delegatePosition: 'Delegate Details',
      delegateAreaCode: 'Delegate Details',
      delegatePhone: 'Delegate Details',
      employeeInitial: 'Employee Details',
      email: 'Employee Details',
      payLevel: 'Employee Details',
      serviceEnquiryNumber: 'Organisation',
      pdfTemplateVersion: 'Settings',
      timezone: 'Settings',
      concurrentEmploymentDefault: 'Settings',
      emailTemplate: 'Settings',
      emailSubmissionMethod: 'Settings',
      isSMO: 'Employee Details',
    };

    const missingFields: { field: keyof Profile; label: string; section: string }[] = [];

    requiredFields.forEach(field => {
      const value = profile[field];
      if (field === 'isSMO') {
        // isSMO can be true or false, just needs to be set (not undefined)
        if (value === undefined) {
          missingFields.push({
            field,
            label: fieldLabels[field] || field,
            section: fieldSections[field] || 'Other',
          });
        }
      } else if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        missingFields.push({
          field,
          label: fieldLabels[field] || field,
          section: fieldSections[field] || 'Other',
        });
      }
    });

    return missingFields;
  }

  // Helper to create default profile
  createDefaultProfile(): Profile {
    return {
      fullName: '',
      payrollNumber: '',
      orgUnitNo: '',
      orgUnitName: '',
      location: '',
      payLevel: '',
      serviceEnquiryNumber: '',
      delegateName: '',
      delegatePosition: '',
      delegateAreaCode: '(07)',
      delegatePhone: '',
      employeeInitial: '',
      pdfTemplateVersion: 'qld_avac_v8.5',
      timezone: 'Australia/Brisbane',
      concurrentEmploymentDefault: false, // Default to off/empty
      email: '',
      emailTemplate: undefined, // Will use default template
      isSMO: false // Default to non-SMO
    };
  }
}

// Singleton instance
export const profileStorage = new ProfileStorage();
