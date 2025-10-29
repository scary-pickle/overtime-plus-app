import * as SecureStore from 'expo-secure-store';
import { Profile } from '../../types';

const PROFILE_KEY = 'overtime_plus_profile';

export class ProfileStorage {
  async saveProfile(profile: Profile): Promise<void> {
    try {
      console.log('Saving profile to storage:', {
        hasEmployeeInitial: !!profile.employeeInitial,
        employeeInitial: profile.employeeInitial,
        allFields: Object.keys(profile)
      });
      const profileJson = JSON.stringify(profile);
      await SecureStore.setItemAsync(PROFILE_KEY, profileJson);
      console.log('Profile saved successfully to storage');
    } catch (error) {
      console.error('Failed to save profile:', error);
      throw new Error('Failed to save profile to secure storage');
    }
  }

  async loadProfile(): Promise<Profile | null> {
    try {
      const profileJson = await SecureStore.getItemAsync(PROFILE_KEY);
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
        await this.saveProfile(profile as Profile);
        console.log('Profile migrated successfully');
      }
      
      // Ensure employee initial is always set
      if (!profile.employeeInitial && profile.fullName) {
        console.log('Setting missing employee initial from full name:', profile.fullName);
        profile.employeeInitial = this.generateInitials(profile.fullName);
        // Save the updated profile
        await this.saveProfile(profile as Profile);
      }
      
      // Migration: Add concurrent employment default if missing
      if (profile.concurrentEmploymentDefault === undefined) {
        console.log('Adding missing concurrentEmploymentDefault field...');
        profile.concurrentEmploymentDefault = false;
        // Save the updated profile
        await this.saveProfile(profile as Profile);
      }
      
      // Migration: Add email field if missing
      if (profile.email === undefined) {
        console.log('Adding missing email field...');
        profile.email = '';
        // Save the updated profile
        await this.saveProfile(profile as Profile);
      }
      
      console.log('Profile loaded from storage:', {
        hasEmployeeInitial: !!profile.employeeInitial,
        employeeInitial: profile.employeeInitial,
        allFields: Object.keys(profile)
      });
      return profile as Profile;
    } catch (error) {
      console.error('Failed to load profile:', error);
      return null;
    }
  }

  async deleteProfile(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(PROFILE_KEY);
      console.log('Profile deleted successfully');
    } catch (error) {
      console.error('Failed to delete profile:', error);
      throw new Error('Failed to delete profile from secure storage');
    }
  }

  async hasProfile(): Promise<boolean> {
    try {
      const profileJson = await SecureStore.getItemAsync(PROFILE_KEY);
      return profileJson !== null;
    } catch (error) {
      console.error('Failed to check profile existence:', error);
      return false;
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
    const requiredFields = profile.isSMO 
      ? baseRequiredFields 
      : [...baseRequiredFields, 'payLevel'];

    return requiredFields.every(field => {
      const value = profile[field];
      return typeof value === 'string' && value.trim().length > 0;
    });
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
      emailTemplate: undefined // Will use default template
    };
  }
}

// Singleton instance
export const profileStorage = new ProfileStorage();
