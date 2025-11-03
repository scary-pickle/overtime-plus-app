export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
}

export function isAllowedDomain(email: string, allowedDomain?: string | null): boolean {
  // Use env var if not provided, default to requiring @health.qld.gov.au if flag is true
  const requireDomain = process.env.EXPO_PUBLIC_AUTH_REQUIRE_DOMAIN === 'true';
  if (!requireDomain && allowedDomain === undefined) return true;
  
  const domain = allowedDomain ?? (requireDomain ? 'health.qld.gov.au' : null);
  if (!domain) return true;
  
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return false;
  const emailDomain = email.slice(atIndex + 1).toLowerCase();
  return emailDomain === domain.toLowerCase();
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  return { valid: errors.length === 0, errors };
}
