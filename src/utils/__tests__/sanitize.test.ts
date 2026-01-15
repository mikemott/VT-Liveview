/**
 * Tests for HTML sanitization utilities
 */

import { describe, it, expect } from 'vitest';
import { escapeHTML, escapeAndTruncate, containsHTML } from '../sanitize';

describe('escapeHTML', () => {
  it('should escape < and > characters', () => {
    expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
  });

  it('should escape & character', () => {
    expect(escapeHTML('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape quotes', () => {
    expect(escapeHTML('"quoted"')).toBe('&quot;quoted&quot;');
    expect(escapeHTML("it's")).toBe('it&#x27;s');
  });

  it('should escape forward slash', () => {
    expect(escapeHTML('</script>')).toBe('&lt;&#x2F;script&gt;');
  });

  it('should escape backticks', () => {
    expect(escapeHTML('`code`')).toBe('&#x60;code&#x60;');
  });

  it('should escape equals sign', () => {
    expect(escapeHTML('onclick=alert()')).toBe('onclick&#x3D;alert()');
  });

  it('should handle null input', () => {
    expect(escapeHTML(null)).toBe('');
  });

  it('should handle undefined input', () => {
    expect(escapeHTML(undefined)).toBe('');
  });

  it('should handle empty string', () => {
    expect(escapeHTML('')).toBe('');
  });

  it('should leave safe strings unchanged', () => {
    expect(escapeHTML('Hello World')).toBe('Hello World');
    expect(escapeHTML('Route 100')).toBe('Route 100');
  });

  it('should prevent XSS script injection', () => {
    const malicious = '<script>alert("xss")</script>';
    const escaped = escapeHTML(malicious);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
  });

  it('should prevent event handler injection', () => {
    const malicious = '<img src="x" onerror="alert(1)">';
    const escaped = escapeHTML(malicious);
    expect(escaped).not.toContain('onerror=');
    expect(escaped).toContain('onerror&#x3D;');
  });
});

describe('escapeAndTruncate', () => {
  it('should escape and preserve short strings', () => {
    expect(escapeAndTruncate('<b>Short</b>', 100)).toBe('&lt;b&gt;Short&lt;&#x2F;b&gt;');
  });

  it('should truncate long strings with ellipsis', () => {
    const longString = 'a'.repeat(600);
    const result = escapeAndTruncate(longString, 500);
    expect(result.length).toBe(500);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should use default max length of 500', () => {
    const longString = 'a'.repeat(600);
    const result = escapeAndTruncate(longString);
    expect(result.length).toBe(500);
  });

  it('should handle null input', () => {
    expect(escapeAndTruncate(null)).toBe('');
  });

  it('should not cut through HTML entities when truncating', () => {
    // String with many & characters that expand to &amp; (5 chars each)
    const manyAmps = '&'.repeat(20); // 20 chars, expands to 100 chars escaped
    const result = escapeAndTruncate(manyAmps, 50);

    // Should not contain broken entities like "&am" or "&amp"
    expect(result).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#x27;|#x2F;|#x60;|#x3D;)/);

    // Should end with ... and be valid
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('should handle strings at exactly max length', () => {
    const exactString = 'a'.repeat(500);
    const result = escapeAndTruncate(exactString);
    expect(result.length).toBe(500);
    expect(result.endsWith('...')).toBe(false);
  });
});

describe('containsHTML', () => {
  it('should detect HTML tags', () => {
    expect(containsHTML('<script>')).toBe(true);
    expect(containsHTML('<div>')).toBe(true);
    expect(containsHTML('<a href="x">')).toBe(true);
  });

  it('should detect javascript: protocol', () => {
    expect(containsHTML('javascript:alert(1)')).toBe(true);
    expect(containsHTML('JAVASCRIPT:void(0)')).toBe(true);
  });

  it('should detect event handlers', () => {
    expect(containsHTML('onclick=')).toBe(true);
    expect(containsHTML('onmouseover=')).toBe(true);
    expect(containsHTML('onerror=')).toBe(true);
  });

  it('should detect data URIs', () => {
    expect(containsHTML('data:text/html')).toBe(true);
  });

  it('should return false for safe strings', () => {
    expect(containsHTML('Hello World')).toBe(false);
    expect(containsHTML('Route I-89')).toBe(false);
    expect(containsHTML('Temperature: 72°F')).toBe(false);
  });

  it('should handle null/undefined', () => {
    expect(containsHTML(null)).toBe(false);
    expect(containsHTML(undefined)).toBe(false);
  });
});
