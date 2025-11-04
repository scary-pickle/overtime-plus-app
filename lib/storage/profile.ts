import * as SecureStore from 'expo-secure-store';
import { Profile } from '../../types';

const PROFILE_KEY_PREFIX = 'overtime_plus_profile';
const LEGACY_PROFILE_KEY = 'overtime_plus_profile'; // Old key for migration

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
      console.log('Saving profile to storage:', {
        userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous',
        profileKey,
        hasEmployeeInitial: !!profile.employeeInitial,
        employeeInitial: profile.employeeInitial,
        allFields: Object.keys(profile)
      });
      const profileJson = JSON.stringify(profile);
      await SecureStore.setItemAsync(profileKey, profileJson);
      console.log('Profile saved successfully to storage');
    } catch (error) {
      console.error('Failed to save profile:', error);
      throw new Error('Failed to save profile to secure storage');
    }
  }

  async loadProfile(userId?: string | null): Promise<Profile | null> {
    try {
      const profileKey = getProfileKey(userId);
      console.log('Loading profile from storage:', { 
        userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous',
        profileKey 
      });
      const profileJson = await SecureStore.getItemAsync(profileKey);
      if (!profileJson) {
        return null;
      }
      
      const profile = JSON.parse(profileJson) as any;
      
      // Migration: Convert old profile format to new format
      if (profile.delegateSignatureUri !== undefined && profile.employeeInitial === undefined) {
        console.log('Migrating profile from old format...');
        console.log('Profile before migration:', { fullName: profile.fullName, delegateSignatureUri: profile.delegateSignatureUri });
        // Generate employee initial from full name
        profile.employeeInitial = this.generateInitials(profile.fullName || '');
        console.log('Generated employee initial:', profile.employeeInitial);
        // Remove old signature field
        delete profile.delegateSignatureUri;
        
        // Save the migrated profile
        await this.saveProfile(profile as Profile, userId);
        console.log('Profile migrated successfully');
      }
      
      // Ensure employee initial is always set
      if (!profile.employeeInitial && profile.fullName) {
        console.log('Setting missing employee initial from full name:', profile.fullName);
        profile.employeeInitial = this.generateInitials(profile.fullName);
        // Save the updated profile
        await this.saveProfile(profile as Profile, userId);
      }
      
      // Migration: Add concurrent employment default if missing
      if (profile.concurrentEmploymentDefault === undefined) {
        console.log('Adding missing concurrentEmploymentDefault field...');
        profile.concurrentEmploymentDefault = false;
        // Save the updated profile
        await this.saveProfile(profile as Profile, userId);
      }
      
      // Migration: Add email field if missing
      if (profile.email === undefined) {
        console.log('Adding missing email field...');
        profile.email = '';
        // Save the updated profile
        await this.saveProfile(profile as Profile, userId);
      }
      
      // Migration: Add isSMO field if missing
      if (profile.isSMO === undefined) {
        console.log('Adding missing isSMO field...');
        profile.isSMO = false; // Default to non-SMO
        // Save the updated profile
        await this.saveProfile(profile as Profile, userId);
      }
      
      console.log('Profile loaded from storage:', {
        hasEmployeeInitial: !!profile.employeeInitial,
        employeeInitial: profile.employeeInitial,
        isSMO: profile.isSMO,
        allFields: Object.keys(profile)
      });
      return profile as Profile;
    } catch (error) {
      console.error('Failed to load profile:', error);
      return null;
    }
  }

  async deleteProfile(userId?: string | null): Promise<void> {
    try {
      const profileKey = getProfileKey(userId);
      await SecureStore.deleteItemAsync(profileKey);
      console.log('Profile deleted successfully', { profileKey });
    } catch (error) {
      console.error('Failed to delete profile:', error);
      throw new Error('Failed to delete profile from secure storage');
    }
  }

  async hasProfile(userId?: string | null): Promise<boolean> {
    try {
      const profileKey = getProfileKey(userId);
      const profileJson = await SecureStore.getItemAsync(profileKey);
      return profileJson !== null;
    } catch (error) {
      console.error('Failed to check profile existence:', error);
      return false;
    }
  }

  // Clear old legacy profile (from before auth was implemented)
  async clearLegacyProfile(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(LEGACY_PROFILE_KEY);
      console.log('Legacy profile cleared successfully');
    } catch (error) {
      console.error('Failed to clear legacy profile:', error);
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
  isProfileComplete(profile: Profile): boolean {
    // Base required fields for all users
    const baseRequiredFields: (keyof Profile)[] = [
      'fullName', 'payrollNumber', 'orgUnitNo', 'orgUnitName', 'location',
      'delegateName', 'delegatePosition',
      'delegateAreaCode', 'delegatePhone', 'employeeInitial', 'email'
    ];

    // For SMO users, payLevel is optional
    const requiredFields: (keyof Profile)[] = profile.isSMO 
      ? baseRequiredFields 
      : [...baseRequiredFields, 'payLevel'];

    return requiredFields.every(field => {
      const value = profile[field];
      return typeof value === 'string' && value.trim().length > 0;
    });
  }

  // Helper to get missing fields with user-friendly names
  getMissingFields(profile: Profile): { field: keyof Profile; label: string; section: string }[] {
    // Base required fields for all users
    const baseRequiredFields: (keyof Profile)[] = [
      'fullName', 'payrollNumber', 'orgUnitNo', 'orgUnitName', 'location',
      'delegateName', 'delegatePosition',
      'delegateAreaCode', 'delegatePhone', 'employeeInitial', 'email'
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
      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
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
