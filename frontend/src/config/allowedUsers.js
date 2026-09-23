/**
 * Whitelist of emails permitted to register, sign in, and access Param Retrieval Studio.
 */
export const ALLOWED_EMAILS = [
  'mantriramitha.cs24@bmsce.ac.in',
  'maheshx43a@gmail.com',
  'amitraksharmukherjee@gmail.com',
  'ml9079725@gmail.com'
].map(email => email.toLowerCase().trim());

/**
 * Validates whether an email address is on the authorized whitelist.
 * @param {string} email
 * @returns {boolean}
 */
export function isEmailAllowed(email) {
  if (!email || typeof email !== 'string') return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase().trim());
}
