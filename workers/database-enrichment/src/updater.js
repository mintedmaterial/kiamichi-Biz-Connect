/**
 * Generate SQL update statement for a business email
 * @param {number} businessId - Business ID
 * @param {string|null} email - Email address
 * @returns {string} SQL update statement
 */
export function updateBusinessEmail(businessId, email) {
  // Escape single quotes in email
  const escapedEmail = email ? `'${email.replace(/'/g, "''")}'` : 'NULL';
  
  return `UPDATE businesses SET email = ${escapedEmail} WHERE id = ${businessId};`;
}

/**
 * Generate batch update array from matches
 * @param {Array} matches - Array of match objects
 * @returns {Array} Array of update objects
 */
export function batchUpdateEmails(matches) {
  return matches
    .filter(match => match.emails && match.emails.length > 0)
    .map(match => ({
      businessId: match.dbBusinessId,
      email: match.emails[0] // Use first email
    }));
}
