/**
 * public/_headers caches everything under /assets/ for a year, because Vite
 * hashes the names of the files it writes there (VTL-95). Files copied from
 * public/assets/ keep their names, so each one needs a short-cache exception,
 * or a changed logo would stay stale in browsers for a year.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const headers = readFileSync(join(root, 'public', '_headers'), 'utf8');

/** Each rule: its path line and the header lines under it */
function parseRules(text: string): { path: string; lines: string[] }[] {
  const rules: { path: string; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;
    if (!raw.startsWith(' ')) rules.push({ path: raw.trim(), lines: [] });
    else rules.at(-1)?.lines.push(raw.trim());
  }
  return rules;
}

describe('public/_headers', () => {
  const rules = parseRules(headers);

  it('caches hashed /assets/ files for a year', () => {
    const broad = rules.find((r) => r.path === '/assets/*');
    expect(broad?.lines).toContain('Cache-Control: public, max-age=31536000, immutable');
  });

  it.each(readdirSync(join(root, 'public', 'assets')))(
    'gives the unhashed public/assets/%s a short cache, after the broad rule',
    (file) => {
      const index = rules.findIndex((r) => r.path === `/assets/${file}`);
      expect(index).toBeGreaterThan(rules.findIndex((r) => r.path === '/assets/*'));
      const rule = rules[index];
      // Detach first, or the two Cache-Control values are joined
      expect(rule?.lines[0]).toBe('! Cache-Control');
      expect(rule?.lines).toContain('Cache-Control: public, max-age=14400, must-revalidate');
    },
  );
});
