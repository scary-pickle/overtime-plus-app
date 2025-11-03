export function toFriendlyAuthMessage(message: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Incorrect email or password.';
  if (m.includes('email already registered') || m.includes('user already registered')) return 'An account with this email already exists.';
  if (m.includes('email not confirmed') || m.includes('confirm') || m.includes('email not verified')) return 'Please verify your email to continue.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please try again later.';
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch')) return 'Network issue. Check your connection and try again.';
  return message || 'Something went wrong. Please try again.';
}


