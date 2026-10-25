/**
 * Every layer color must be clearly different from every other (VTL-66):
 * chips, markers and search results all show the full color, so two close
 * colors read as the same layer.
 */
import { describe, expect, it } from 'vitest';
import { LAYER_STYLES, relativeLuminance, textOn } from '../layers';

type Lab = [number, number, number];

function hexToLab(hex: string): Lab {
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const [r, g, b] = lin;
  // sRGB → XYZ (D65), normalized by the white point
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIEDE2000 color difference */
function deltaE2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number): number => {
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lpm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hpm += h1p + h2p < 360 ? 360 : -360;
    hpm /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hpm - 30) * rad) +
    0.24 * Math.cos(2 * hpm * rad) +
    0.32 * Math.cos((3 * hpm + 6) * rad) -
    0.2 * Math.cos((4 * hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm;
  const Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

const contrast = (x: string, y: string): number => {
  const [hi, lo] = [relativeLuminance(x), relativeLuminance(y)].sort((m, n) => n - m) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
};

const entries = Object.entries(LAYER_STYLES).map(([key, s]) => ({ key, color: s.color }));

describe('layer palette', () => {
  it('matches a reference CIEDE2000 value', () => {
    // Sharma et al. test pair 1
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
  });

  it('keeps every pair of layer colors at least 17 apart', () => {
    const close: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i]!;
        const b = entries[j]!;
        const d = deltaE2000(hexToLab(a.color), hexToLab(b.color));
        if (d < 17) close.push(`${a.key} ${a.color} / ${b.key} ${b.color}: ${d.toFixed(1)}`);
      }
    }
    expect(close).toEqual([]);
  });

  it('keeps white marker icons visible on every color (3:1 for graphics, ~2.9 floor)', () => {
    const low = entries
      .map(({ key, color }) => ({ key, ratio: contrast(color, '#ffffff') }))
      .filter(({ ratio }) => ratio < 2.9)
      .map(({ key, ratio }) => `${key}: ${ratio.toFixed(2)}`);
    expect(low).toEqual([]);
  });

  it('gives selected chip text at least 4.5:1 on every color', () => {
    const low = entries
      .map(({ key, color }) => ({ key, ratio: contrast(color, textOn(color)) }))
      .filter(({ ratio }) => ratio < 4.5)
      .map(({ key, ratio }) => `${key}: ${ratio.toFixed(2)}`);
    expect(low).toEqual([]);
  });
});
