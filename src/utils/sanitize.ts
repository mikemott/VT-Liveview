/**
 * HTML Sanitization Utilities
 * Prevents XSS attacks by escaping user-controlled content
 */

/** HTML entity map for escaping */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/** Regex pattern for characters that need escaping */
const ESCAPE_PATTERN = /[&<>"'`=/]/g;

/**
 * Escape HTML special characters to prevent XSS
 * Use this when inserting user-controlled text into HTML
 *
 * @param str - The string to escape (can be null/undefined)
 * @returns Escaped string safe for HTML insertion, or empty string if input is nullish
 *
 * @example
 * escapeHTML('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHTML(str: string | null | undefined): string {
  if (str == null) {
    return '';
  }

  return String(str).replace(ESCAPE_PATTERN, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Escape HTML and truncate to max length
 * Useful for displaying user content in limited-width UI elements
 *
 * @param str - The string to escape and truncate
 * @param maxLength - Maximum length before truncation (default: 500)
 * @returns Escaped and possibly truncated string
 */
export function escapeAndTruncate(
  str: string | null | undefined,
  maxLength = 500
): string {
  const escaped = escapeHTML(str);

  if (escaped.length <= maxLength) {
    return escaped;
  }

  return escaped.slice(0, maxLength - 3) + '...';
}

/**
 * Check if a string contains potentially dangerous HTML
 * Useful for logging/monitoring attempts
 *
 * @param str - The string to check
 * @returns True if the string contains HTML-like patterns
 */
export function containsHTML(str: string | null | undefined): boolean {
  if (str == null) {
    return false;
  }

  // Check for common XSS patterns
  const patterns = [
    /<[a-z]/i, // HTML tags
    /javascript:/i, // JavaScript protocol
    /on\w+=/i, // Event handlers like onclick=
    /data:/i, // Data URIs
  ];

  return patterns.some((pattern) => pattern.test(str));
}
