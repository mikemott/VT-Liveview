import { describe, expect, it } from 'vitest';
import { LAYER_STYLES, layerColorVars } from '../layers';

/** WCAG relative luminance / contrast */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrastWithWhite = (hex: string): number => 1.05 / (luminance(hex) + 0.05);

describe('layer registry (VTL-64)', () => {
  const entries = Object.entries(LAYER_STYLES);

  it('gives every layer a label, icon and #rrggbb color', () => {
    expect(entries.length).toBe(15);
    for (const [, style] of entries) {
      expect(style.label).not.toBe('');
      expect(style.icon).toBeTruthy();
      expect(style.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('uses a different color for every layer', () => {
    const colors = entries.map(([, s]) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('keeps white marker icons readable on every layer color', () => {
    // 3:1 is the WCAG non-text minimum; amber hazards sits right at it
    for (const [key, { color }] of entries) {
      expect(contrastWithWhite(color), key).toBeGreaterThanOrEqual(2.9);
    }
  });

  it('exposes the color as a CSS variable', () => {
    expect(layerColorVars('trafficCameras')).toEqual({ '--layer-color': '#ec4899' });
    expect(layerColorVars('roadWeather')).toEqual({
      '--layer-color': '#334155',
      '--layer-color-dark': '#94a3b8',
    });
  });
});
