/**
 * Validates email format and filters out placeholder emails
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return false;
  }

  // Filter out common placeholder/example emails
  const lowerEmail = email.toLowerCase();
  const placeholderPatterns = [
    /^example@example\.com$/,
    /^test@test\.com$/,
    /^noreply@/,
    /^no-reply@/,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(lowerEmail)) {
      return false;
    }
  }

  return true;
}

/**
 * Removes duplicate emails, preserving order of first occurrence
 */
export function deduplicateEmails(emails: string[]): string[] {
  return [...new Set(emails)];
}
