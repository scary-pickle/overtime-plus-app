import { Profile } from '../../types';

export interface OnboardingValidationResult {
  isValid: boolean;
  missingFields: { field: keyof Profile; label: string; section: string }[];
}

/**
 * Validates profile for onboarding completion
 * Delegate information is optional
 * payLevel is required only if isSMO is false
 */
export function validateOnboardingProfile(profile: Partial<Profile>): OnboardingValidationResult {
  const missingFields: { field: keyof Profile; label: string; section: string }[] = [];

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
    isSMO: 'Are you an SMO?',
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

  // Required fields (excluding delegate info)
  const requiredFields: (keyof Profile)[] = [
    'fullName',
    'payrollNumber',
    'email',
    'employeeInitial',
    'location', // hospital
    'orgUnitName', // department
    'orgUnitNo',
    'isSMO',
  ];

  // Check each required field
  requiredFields.forEach(field => {
    const value = profile[field];
    if (value === undefined || value === null || 
        (typeof value === 'string' && value.trim().length === 0) ||
        (typeof value === 'boolean' && field === 'isSMO' && value === undefined)) {
      missingFields.push({
        field,
        label: fieldLabels[field] || field,
        section: fieldSections[field] || 'Other',
      });
    }
  });

  // Conditionally required: payLevel (only if isSMO is false)
  if (profile.isSMO === false) {
    if (!profile.payLevel || (typeof profile.payLevel === 'string' && profile.payLevel.trim().length === 0)) {
      missingFields.push({
        field: 'payLevel',
        label: fieldLabels.payLevel,
        section: fieldSections.payLevel,
      });
    }
  }

  // Delegate information is optional - don't validate it

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}






