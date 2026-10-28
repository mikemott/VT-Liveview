import { describe, expect, it } from 'vitest';
import { LAYER_STYLES, layerColorVars } from '../layers';

/** Layers that share a color on purpose (VTL-73): both mean "road closed" */
const SHARED_COLORS = [['CLOSURE', 'seasonalRoads']];

describe('layer registry (VTL-64)', () => {
  const entries = Object.entries(LAYER_STYLES);

  it('gives every layer a label, icon and #rrggbb color', () => {
    expect(entries.length).toBe(18);
    for (const [, style] of entries) {
      expect(style.label).not.toBe('');
      expect(style.icon).toBeTruthy();
      expect(style.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('uses a different color for every layer, except the intentional pairs', () => {
    for (const [a, b] of SHARED_COLORS) {
      expect(LAYER_STYLES[a as keyof typeof LAYER_STYLES].color).toBe(
        LAYER_STYLES[b as keyof typeof LAYER_STYLES].color,
      );
    }
    const shared = new Set(SHARED_COLORS.map(([, b]) => b));
    const colors = entries.filter(([key]) => !shared.has(key)).map(([, s]) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('exposes the color as a CSS variable', () => {
    expect(layerColorVars('trafficCameras')).toEqual({
      '--layer-color': '#ffd000',
      '--layer-ink': '#806800',
    });
    expect(layerColorVars('roadWeather')).toEqual({
      '--layer-color': '#334155',
      '--layer-color-dark': '#94a3b8',
    });
  });
});
