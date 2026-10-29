import { describe, expect, it } from 'vitest';
import { FIRE_LEVELS, fireLevel, fireToneVars, isFireDangerStale, UNRATED } from '../fireDanger';
import { relativeLuminance } from '../../config/layers';

const NOW = new Date('2026-10-28T18:00:00Z');

/** Mix two #rrggbb colors like CSS color-mix(in srgb, a p, b) */
function mix(a: string, b: string, p: number): string {
  const ch = (hex: string, i: number): number => parseInt(hex.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) =>
      Math.round(p * ch(a, i) + (1 - p) * ch(b, i))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
const contrast = (x: string, y: string): number => {
  const [hi, lo] = [relativeLuminance(x), relativeLuminance(y)].sort((m, n) => n - m) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
};

describe('fire danger levels (VTL-81)', () => {
  it('maps ratings and treats missing ones as unrated', () => {
    expect(fireLevel(3).name).toBe('High');
    expect(fireLevel(5).name).toBe('Extreme');
    expect(fireLevel(null)).toBe(UNRATED);
    expect(fireLevel(9)).toBe(UNRATED);
  });

  it('flags ratings older than three days', () => {
    expect(isFireDangerStale('2026-10-28T11:50:00Z', NOW)).toBe(false);
    expect(isFireDangerStale('2026-10-25T11:50:00Z', NOW)).toBe(true);
    expect(isFireDangerStale(null, NOW)).toBe(true);
  });

  it('keeps banner text readable on its tint in both themes (4.5:1)', () => {
    const LIGHT = '#fafcf3';
    const DARK = '#1b1f24';
    const low: string[] = [];
    for (const rating of [...Object.keys(FIRE_LEVELS).map(Number), null]) {
      const v = fireToneVars(rating);
      const light = contrast(v['--tone-ink']!, mix(v['--tone-color']!, LIGHT, 0.12));
      const dark = contrast(v['--tone-ink-dark']!, mix(v['--tone-color']!, DARK, 0.22));
      if (light < 4.5) low.push(`${rating} light ${light.toFixed(2)}`);
      if (dark < 4.5) low.push(`${rating} dark ${dark.toFixed(2)}`);
    }
    expect(low).toEqual([]);
  });
});
