import { describe, expect, it } from 'vitest';
import {
  FLOOD_LEVELS,
  floodStageFor,
  floodToneVars,
  formatFlow,
  formatStage,
  impactAt,
  isRiverReadingStale,
  worstCategory,
} from '../rivers';
import { relativeLuminance } from '../../config/layers';
import type { RiverGauge } from '../../services/riverApi';

const NOW = new Date('2026-10-28T18:00:00Z');

const gauge = (over: Partial<RiverGauge>): RiverGauge => ({
  id: 'MONV1',
  name: 'Winooski River at Montpelier',
  state: 'VT',
  lat: 44.26,
  lng: -72.58,
  stageFt: 3.12,
  flowCfs: 96,
  category: 'no_flooding',
  observedAt: '2026-10-28T17:45:00Z',
  forecastCategory: 'no_flooding',
  forecastStageFt: 3.1,
  forecastAt: '2026-10-29T00:00:00Z',
  ...over,
});

describe('river helpers (VTL-81)', () => {
  it('takes the worse of observed and forecast', () => {
    expect(worstCategory(gauge({}))).toBe('no_flooding');
    expect(worstCategory(gauge({ category: 'action', forecastCategory: 'minor' }))).toBe('minor');
    expect(worstCategory(gauge({ category: 'moderate', forecastCategory: 'action' }))).toBe(
      'moderate',
    );
    expect(worstCategory(gauge({ category: 'unknown', forecastCategory: null }))).toBe('unknown');
  });

  it('formats stage and flow', () => {
    expect(formatStage(3.1)).toBe('3.10 ft');
    expect(formatStage(93.49)).toBe('93.49 ft');
    expect(formatStage(508.9)).toBe('508.9 ft');
    expect(formatStage(null)).toBe('—');
    expect(formatFlow(12400)).toBe('12,400 cfs');
  });

  it('picks the flood stage: minor, else the next one defined', () => {
    expect(floodStageFor({ action: 11, minor: 15, moderate: 16, major: 17.5 })).toBe(15);
    expect(floodStageFor({ action: 11, minor: null, moderate: 16, major: null })).toBe(16);
    expect(floodStageFor({ action: 11, minor: null, moderate: null, major: null })).toBeNull();
  });

  it('finds the impact for a stage, or the first one above it', () => {
    const impacts = [
      { stageFt: 17.5, statement: 'Downtown streets flood.' },
      { stageFt: 15, statement: 'Low fields flood.' },
    ];
    expect(impactAt(impacts, 16)).toEqual({ ...impacts[1], reached: true });
    expect(impactAt(impacts, 20)).toEqual({ ...impacts[0], reached: true });
    expect(impactAt(impacts, 3)).toEqual({ ...impacts[1], reached: false });
    expect(impactAt(impacts, null)).toEqual({ ...impacts[1], reached: false });
    expect(impactAt([], 3)).toBeNull();
  });

  it('flags readings older than three hours, or missing', () => {
    expect(isRiverReadingStale('2026-10-28T17:45:00Z', NOW)).toBe(false);
    expect(isRiverReadingStale('2026-10-28T14:00:00Z', NOW)).toBe(true);
    expect(isRiverReadingStale(null, NOW)).toBe(true);
  });
});

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

describe('flood tones', () => {
  const LIGHT = '#fafcf3';
  const DARK = '#1b1f24';

  it('keeps banner text readable on its tint in both themes (4.5:1)', () => {
    const low: string[] = [];
    for (const category of Object.keys(FLOOD_LEVELS) as (keyof typeof FLOOD_LEVELS)[]) {
      const vars = floodToneVars(category);
      const color = vars['--flood-color']!;
      const light = contrast(vars['--flood-ink']!, mix(color, LIGHT, 0.12));
      const dark = contrast(vars['--flood-ink-dark']!, mix(color, DARK, 0.22));
      if (light < 4.5) low.push(`${category} light ${light.toFixed(2)}`);
      if (dark < 4.5) low.push(`${category} dark ${dark.toFixed(2)}`);
    }
    expect(low).toEqual([]);
  });
});
