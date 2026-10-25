/**
 * Sanity checks for the seasonal layer configuration.
 */
import { describe, it, expect } from 'vitest';
import { SEASONAL_LAYERS } from '../seasonalLayers';

describe('SEASONAL_LAYERS', () => {
  it('has unique ids', () => {
    const ids = SEASONAL_LAYERS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defines ski (Nov–Mar) and creemee (Apr–Sep) seasons', () => {
    const byId = Object.fromEntries(SEASONAL_LAYERS.map((l) => [l.id, l]));
    expect(byId.skiResorts?.season?.months).toEqual([11, 12, 1, 2, 3]);
    expect(byId.creemeeStands?.season?.months).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it('uses valid, non-duplicated months 1–12 and a label for every season', () => {
    for (const layer of SEASONAL_LAYERS) {
      expect(layer.label).not.toBe('');
      expect(layer.icon).toBeTruthy();
      if (!layer.season) continue;
      expect(layer.season.label).not.toBe('');
      expect(new Set(layer.season.months).size).toBe(layer.season.months.length);
      layer.season.months.forEach((m) => {
        expect(Number.isInteger(m)).toBe(true);
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(12);
      });
    }
  });
});
