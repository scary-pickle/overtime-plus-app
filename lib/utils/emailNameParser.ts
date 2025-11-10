/**
 * Utility to parse name from QLD Health email addresses
 * Format: firstname.lastname@health.qld.gov.au
 * Sometimes includes numbers: firstname.lastname123@health.qld.gov.au
 */

export function parseNameFromEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  // Extract the part before @
  const atIndex = email.indexOf('@');
  if (atIndex === -1) {
    return '';
  }

  const localPart = email.substring(0, atIndex).trim();

  // Handle format: firstname.lastname or firstname.lastname123
  // Split by dots
  const parts = localPart.split('.');

  if (parts.length < 2) {
    // Single name or no dots - return as is with first letter capitalized
    return parts[0]
      ? parts[0].replace(/\d/g, '').charAt(0).toUpperCase() + 
        parts[0].replace(/\d/g, '').slice(1).toLowerCase()
      : '';
  }

  // Extract firstname and lastname (remove numbers from lastname)
  const firstName = parts[0].trim();
  const lastName = parts.slice(1).join('.').replace(/\d/g, '').trim(); // Join remaining parts and remove numbers

  // Capitalize first letter of each word
  const capitalize = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const firstNameFormatted = capitalize(firstName);
  const lastNameFormatted = capitalize(lastName);

  // Return formatted name
  return `${firstNameFormatted} ${lastNameFormatted}`.trim();
}


