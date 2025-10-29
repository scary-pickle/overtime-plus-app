import * as MailComposer from 'expo-mail-composer';
import { Profile } from '../../types';
import { getDelegateForDepartment } from '../data/hospitalDepartments';

/**
 * Default email template with variables
 */
const DEFAULT_EMAIL_TEMPLATE = `Hello,

Please find attached my most recent AVAC.

Kind regards,
{User Name}`;

/**
 * Parse email template and replace variables
 */
export function parseEmailTemplate(template: string, variables: Record<string, string>): string {
  let parsedTemplate = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    parsedTemplate = parsedTemplate.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return parsedTemplate;
}

/**
 * Get recipient email for a specific hospital and department
 * First tries Supabase, falls back to local data
 */
export async function getRecipientForDepartment(hospital: string, department: string): Promise<{
  email: string;
  name?: string;
} | null> {
  try {
    // TODO: Implement Supabase lookup when backend is ready
    // For now, use local fallback data
    const delegate = getDelegateForDepartment(hospital, department);
    
    if (delegate) {
      return {
        email: delegate.delegateEmail || '', // Will be added to hospitalDepartments.ts
        name: delegate.delegateName
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching recipient:', error);
    return null;
  }
}

/**
 * Compose AVAC email with template and variables
 */
export function composeAVACEmail(
  profile: Profile,
  pdfUri: string,
  recipientEmail: string,
  recipientName?: string
): {
  recipients: string[];
  subject: string;
  body: string;
  attachments: string[];
} {
  // Use custom template or default
  const template = profile.emailTemplate || DEFAULT_EMAIL_TEMPLATE;
  
  // Prepare template variables
  const variables = {
    'User Name': profile.fullName,
    'Date': new Date().toLocaleDateString('en-AU'),
    'Total Hours': Math.floor(0 / 60).toString(), // Will be calculated from logs
  };
  
  // Parse template
  const body = parseEmailTemplate(template, variables);
  
  // Create subject
  const subject = `AVAC Submission - ${profile.fullName}`;
  
  return {
    recipients: [recipientEmail],
    subject,
    body,
    attachments: [pdfUri]
  };
}

/**
 * Send AVAC email using device's email app
 */
export async function sendAVACEmail(profile: Profile, pdfUri: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Check if email is available
    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      return {
        success: false,
        error: 'No email app is configured on this device. Please set up an email account in Settings.'
      };
    }
    
    // Get recipient based on hospital and department
    const recipient = await getRecipientForDepartment(profile.location, profile.orgUnitName);
    if (!recipient || !recipient.email) {
      return {
        success: false,
        error: `No recipient email found for ${profile.orgUnitName} at ${profile.location}. Please contact your administrator or use the Share button instead.`
      };
    }
    
    // Compose email
    const emailData = composeAVACEmail(profile, pdfUri, recipient.email, recipient.name);
    
    // Open email composer
    const result = await MailComposer.composeAsync({
      recipients: emailData.recipients,
      subject: emailData.subject,
      body: emailData.body,
      attachments: emailData.attachments,
    });
    
    if (result.status === MailComposer.MailComposerStatus.CANCELLED) {
      return {
        success: false,
        error: 'Email composition was cancelled'
      };
    }
    
    if (result.status === MailComposer.MailComposerStatus.SAVED) {
      return {
        success: true
      };
    }
    
    if (result.status === MailComposer.MailComposerStatus.SENT) {
      return {
        success: true
      };
    }
    
    return {
      success: false,
      error: 'Failed to send email'
    };
    
  } catch (error) {
    console.error('Error sending AVAC email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

/**
 * Get default email template
 */
export function getDefaultEmailTemplate(): string {
  return DEFAULT_EMAIL_TEMPLATE;
}
