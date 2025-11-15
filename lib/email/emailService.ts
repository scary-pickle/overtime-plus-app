import * as MailComposer from 'expo-mail-composer';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { Profile, ExportBatch } from '../../types';
import { getDelegateForDepartment } from '../data/hospitalDepartments';
import { createScopedLogger } from '../utils/logger';
import { isCloudURL, downloadPDFFromStorage } from '../storage/pdfStorage';

const debug = createScopedLogger('emailService');

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
    debug.error('Error fetching recipient:', error);
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
  recipientName?: string,
  exportBatch?: ExportBatch
): {
  recipients: string[];
  subject: string;
  body: string;
  attachments: string[];
} {
  // Use custom template or default
  const template = profile.emailTemplate || DEFAULT_EMAIL_TEMPLATE;
  
  // Calculate total hours from export batch or default to 0
  const totalMinutes = exportBatch?.totalMinutes || 0;
  const totalHours = Math.floor(totalMinutes / 60);
  
  // Prepare template variables
  const variables = {
    'User Name': profile.fullName,
    'Date': new Date().toLocaleDateString('en-AU'),
    'Total Hours': totalHours.toString(),
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
 * Send AVAC email using mailto: URL (respects default mail app but no attachment)
 * This opens the user's default email app (e.g., Outlook if set as default)
 */
export async function sendAVACEmailViaMailto(profile: Profile, exportBatch?: ExportBatch): Promise<{
  success: boolean;
  error?: string;
  needsAttachment?: boolean;
}> {
  try {
    // Get recipient based on hospital and department
    const recipient = await getRecipientForDepartment(profile.location, profile.orgUnitName);
    if (!recipient || !recipient.email) {
      return {
        success: false,
        error: `No recipient email found for ${profile.orgUnitName} at ${profile.location}. Please contact your administrator or use the Share button instead.`
      };
    }
    
    // Use custom template or default
    const template = profile.emailTemplate || DEFAULT_EMAIL_TEMPLATE;
    
    // Calculate total hours from export batch or default to 0
    const totalMinutes = exportBatch?.totalMinutes || 0;
    const totalHours = Math.floor(totalMinutes / 60);
    
    // Prepare template variables
    const variables = {
      'User Name': profile.fullName,
      'Date': new Date().toLocaleDateString('en-AU'),
      'Total Hours': totalHours.toString(),
    };
    
    // Parse template
    const body = parseEmailTemplate(template, variables);
    const subject = `AVAC Submission - ${profile.fullName}`;
    
    // Create mailto URL
    const mailtoUrl = `mailto:${recipient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Check if device can open mailto URLs
    const canOpen = await Linking.canOpenURL(mailtoUrl);
    if (!canOpen) {
      return {
        success: false,
        error: 'No email app is configured on this device. Please set up an email account in Settings.'
      };
    }
    
    // Open the default email app with pre-filled fields
    await Linking.openURL(mailtoUrl);
    
    return {
      success: true,
      needsAttachment: true // User needs to manually attach the PDF
    };
    
  } catch (error) {
    debug.error('Error opening email app:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

/**
 * Send AVAC email using device's email app (Apple Mail only with attachment)
 * Note: This always opens Apple Mail, regardless of default mail app setting
 */
export async function sendAVACEmailWithAttachment(profile: Profile, pdfUri: string, exportBatch?: ExportBatch): Promise<{
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
    
    // Ensure PDF is a local file path (expo-mail-composer requires local paths)
    let localPdfUri = pdfUri;
    if (isCloudURL(pdfUri)) {
      try {
        // Extract batchId from exportBatch or from URI
        const batchId = exportBatch?.id || pdfUri.split('/').pop()?.replace('.pdf', '') || 'unknown';
        debug.log('Downloading PDF from cloud storage for email attachment...');
        localPdfUri = await downloadPDFFromStorage(pdfUri, batchId);
        debug.log('PDF downloaded to local path:', localPdfUri);
      } catch (downloadError) {
        debug.error('Failed to download PDF for email attachment:', downloadError);
        return {
          success: false,
          error: 'Failed to download PDF file. Please check your connection and try again.'
        };
      }
    }
    
    // Ensure the file path is in the correct format and file exists
    try {
      const { getInfoAsync } = await import('expo-file-system/legacy');
      // Normalize path - ensure it has file:// prefix if it's a local path without it
      // Paths.cache.uri from expo-file-system should already have file://, but handle both cases
      if (!localPdfUri.startsWith('file://') && !localPdfUri.startsWith('http://') && !localPdfUri.startsWith('https://')) {
        // If it starts with /, add file://, otherwise add file:///
        localPdfUri = localPdfUri.startsWith('/') ? `file://${localPdfUri}` : `file:///${localPdfUri}`;
      }
      
      // Verify file exists (getInfoAsync handles paths with or without file:// prefix)
      const fileInfo = await getInfoAsync(localPdfUri);
      if (!fileInfo.exists) {
        debug.error('PDF file does not exist at path:', localPdfUri);
        return {
          success: false,
          error: 'PDF file not found. Please try regenerating the export.'
        };
      }
      debug.log('PDF file verified, exists:', fileInfo.exists, 'size:', fileInfo.size);
    } catch (fileCheckError) {
      debug.error('Failed to verify PDF file:', fileCheckError);
      return {
        success: false,
        error: 'Failed to access PDF file. Please try regenerating the export.'
      };
    }
    
    // Compose email
    const emailData = composeAVACEmail(profile, localPdfUri, recipient.email, recipient.name, exportBatch);
    
    // Open email composer (always opens Apple Mail)
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
    debug.error('Error sending AVAC email:', error);
    // Handle different error types - the Babel runtime error might not be a standard Error
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    } else if (error && typeof error === 'string') {
      errorMessage = error;
    }
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Get recipient information for AVAC submission
 * Returns recipient email and formatted message for sharing
 */
export async function getAVACRecipientInfo(profile: Profile, exportBatch?: ExportBatch): Promise<{
  success: boolean;
  error?: string;
  recipientEmail?: string;
  recipientName?: string;
  subject?: string;
  body?: string;
}> {
  try {
    // Get recipient based on hospital and department
    const recipient = await getRecipientForDepartment(profile.location, profile.orgUnitName);
    if (!recipient || !recipient.email) {
      return {
        success: false,
        error: `No recipient email found for ${profile.orgUnitName} at ${profile.location}. Please contact your administrator or use the Share button instead.`
      };
    }
    
    // Use custom template or default
    const template = profile.emailTemplate || DEFAULT_EMAIL_TEMPLATE;
    
    // Calculate total hours from export batch or default to 0
    const totalMinutes = exportBatch?.totalMinutes || 0;
    const totalHours = Math.floor(totalMinutes / 60);
    
    // Prepare template variables
    const variables = {
      'User Name': profile.fullName,
      'Date': new Date().toLocaleDateString('en-AU'),
      'Total Hours': totalHours.toString(),
    };
    
    // Parse template
    const body = parseEmailTemplate(template, variables);
    const subject = `AVAC Submission - ${profile.fullName}`;
    
    return {
      success: true,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      subject,
      body
    };
  } catch (error) {
    debug.error('Error getting recipient info:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

/**
 * Send AVAC email using the method specified in user profile
 * Defaults to share-sheet method if not specified
 */
export async function sendAVACEmail(profile: Profile, pdfUri: string, exportBatch?: ExportBatch): Promise<{
  success: boolean;
  error?: string;
  recipientEmail?: string;
  recipientName?: string;
  subject?: string;
  body?: string;
  useShareSheet?: boolean;
  useAppleMail?: boolean;
}> {
  const method = profile.emailSubmissionMethod || 'share-sheet';
  
  if (method === 'apple-mail') {
    // Use expo-mail-composer (Apple Mail with full pre-fill including attachment)
    const result = await sendAVACEmailWithAttachment(profile, pdfUri, exportBatch);
    return {
      ...result,
      useAppleMail: true
    };
  } else {
    // Use share sheet method (works with Outlook, requires clipboard paste)
    const recipientInfo = await getAVACRecipientInfo(profile, exportBatch);
    
    if (!recipientInfo.success) {
      return {
        success: false,
        error: recipientInfo.error
      };
    }
    
    return {
      success: true,
      recipientEmail: recipientInfo.recipientEmail,
      recipientName: recipientInfo.recipientName,
      subject: recipientInfo.subject,
      body: recipientInfo.body,
      useShareSheet: true
    };
  }
}

/**
 * Get default email template
 */
export function getDefaultEmailTemplate(): string {
  return DEFAULT_EMAIL_TEMPLATE;
}
