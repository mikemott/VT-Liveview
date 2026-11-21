/**
 * `vh` is the viewport with the browser toolbars hidden. On iOS Safari and in
 * in-app browsers the toolbars are usually showing, so anything sized or placed
 * with `vh` runs behind them: the bottom search bar and chips were cut off on
 * phones (VTL-93). Every `vh` declaration must be followed, in the same rule,
 * by the same property in `dvh` (the visible viewport); the `vh` line stays as
 * the fallback for browsers without `dvh`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

const VH = /\d(?:\.\d+)?vh\b/;
const DVH = /\d(?:\.\d+)?dvh\b/;

/** `vh` declarations with no later `dvh` declaration of the same property in the same block */
function missingDvh(css: string): string[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Innermost blocks only: declarations never contain braces
  return [...noComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((m) => {
    const selector = m[1]!.trim();
    const decls = m[2]!
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d.includes(':'))
      .map((d) => {
        const i = d.indexOf(':');
        return { prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() };
      });
    return decls.flatMap((decl, i) => {
      if (!VH.test(decl.value)) return [];
      const fixed = decls.slice(i + 1).some((d) => d.prop === decl.prop && DVH.test(d.value));
      return fixed ? [] : [`${selector} { ${decl.prop}: ${decl.value} }`];
    });
  });
}

describe('viewport units (VTL-93)', () => {
  it('finds the problem it guards against', () => {
    expect(missingDvh('.a { height: 100vh; }')).toEqual(['.a { height: 100vh }']);
    expect(missingDvh('.a { height: 100vh; height: 100dvh; }')).toEqual([]);
    expect(missingDvh('@media (x) { .a { max-height: calc(100vh - 4px); } }')).toHaveLength(1);
    expect(missingDvh('.a { width: 100vw; }')).toEqual([]);
  });

  for (const file of cssFiles(SRC)) {
    it(`${relative(SRC, file)}: every vh has a dvh override`, () => {
      expect(missingDvh(readFileSync(file, 'utf8'))).toEqual([]);
    });
  }
});
