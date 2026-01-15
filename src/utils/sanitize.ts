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
 * Important: Truncates the ORIGINAL string before escaping to avoid
 * cutting through HTML entities (e.g., "&amp;" becoming "&am").
 *
 * @param str - The string to escape and truncate
 * @param maxLength - Maximum length before truncation (default: 500)
 * @returns Escaped and possibly truncated string
 */
export function escapeAndTruncate(
  str: string | null | undefined,
  maxLength = 500
): string {
  if (str == null) {
    return '';
  }

  const original = String(str);
  const escaped = escapeHTML(original);

  // If escaped version fits, return it
  if (escaped.length <= maxLength) {
    return escaped;
  }

  // Truncate original string before escaping to avoid cutting through entities.
  // Start with a conservative estimate and adjust if needed.
  // Reserve 3 chars for "..." suffix.
  const targetLength = maxLength - 3;

  // Binary search for the longest prefix that fits when escaped
  let low = 0;
  let high = original.length;
  let bestFit = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const truncated = original.slice(0, mid);
    const escapedTruncated = escapeHTML(truncated);

    if (escapedTruncated.length <= targetLength) {
      bestFit = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return escapeHTML(original.slice(0, bestFit)) + '...';
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
