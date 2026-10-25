/**
 * Tests for map style generation and dark mode detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMapStyle, isDarkMode, onThemeChange, vermontBorderSource } from '../mapStyles';
import { VERMONT_OUTLINE } from '../../data/vermontOutline';
import { pointInGeometry } from '../geo';

describe('getMapStyle', () => {
  it('should return a valid MapLibre style specification', () => {
    const style = getMapStyle(false);

    expect(style.version).toBe(8);
    expect(style.sources).toBeDefined();
    expect(style.layers).toBeDefined();
    expect(Array.isArray(style.layers)).toBe(true);
  });

  it('should include protomaps source', () => {
    const style = getMapStyle(false);

    expect(style.sources.protomaps).toBeDefined();
    expect(style.sources.protomaps?.type).toBe('vector');
  });

  it('should include glyphs and sprite URLs', () => {
    const style = getMapStyle(false);

    expect(style.glyphs).toContain('fonts');
    expect(style.sprite).toBeDefined();
  });

  it('should use light sprite for light mode', () => {
    const style = getMapStyle(false);
    expect(style.sprite).toContain('light');
  });

  it('should use dark sprite for dark mode', () => {
    const style = getMapStyle(true);
    expect(style.sprite).toContain('dark');
  });

  it('should include attribution in protomaps source', () => {
    const style = getMapStyle(false);
    const protomapsSource = style.sources.protomaps as { attribution?: string };
    expect(protomapsSource.attribution).toContain('Protomaps');
    expect(protomapsSource.attribution).toContain('OpenStreetMap');
  });

  it('should have multiple layers for a complete map', () => {
    const style = getMapStyle(false);
    expect(style.layers.length).toBeGreaterThan(10);
  });
});

describe('Vermont border (VTL-69)', () => {
  it('is drawn on top of the base map, so app layers added later sit above it', () => {
    const ids = getMapStyle(false).layers.map((l) => l.id);
    expect(ids.slice(-3)).toEqual(['vermont-outside-dim', 'vermont-border-halo', 'vermont-border']);
  });

  it('is part of both themes', () => {
    for (const dark of [false, true]) {
      const style = getMapStyle(dark);
      expect(style.sources['vermont-border']).toBeDefined();
      expect(style.layers.some((l) => l.id === 'vermont-border')).toBe(true);
    }
  });

  it('outlines Vermont: one closed ring inside the state extent', () => {
    expect(VERMONT_OUTLINE).toHaveLength(1);
    const ring = VERMONT_OUTLINE[0]!;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const lngs = ring.map(([lng]) => lng);
    const lats = ring.map(([, lat]) => lat);
    expect(Math.min(...lngs)).toBeGreaterThan(-73.45); // Lake Champlain state line
    expect(Math.max(...lngs)).toBeLessThan(-71.45); // Connecticut River
    expect(Math.min(...lats)).toBeGreaterThan(42.72); // Massachusetts line
    expect(Math.max(...lats)).toBeLessThan(45.02); // Canadian border
  });

  it('dims outside Vermont, with Vermont as the hole', () => {
    const source = vermontBorderSource() as { data: GeoJSON.FeatureCollection };
    const outside = source.data.features.find((f) => f.properties?.kind === 'outside')!;
    const rings = (outside.geometry as GeoJSON.Polygon).coordinates;
    expect(rings).toHaveLength(2);
    expect(rings[1]).toBe(VERMONT_OUTLINE[0]);
    // Burlington is inside the outline, Plattsburgh NY and Hanover NH are not
    const vt = VERMONT_OUTLINE.map((ring) => [ring]);
    const inside = (lng: number, lat: number): boolean =>
      pointInGeometry([lng, lat], { type: 'MultiPolygon', coordinates: vt });
    expect(inside(-73.212, 44.476)).toBe(true);
    expect(inside(-73.452, 44.699)).toBe(false);
    expect(inside(-72.289, 43.702)).toBe(false);
    // The state line runs down Lake Champlain, not along the shore
    expect(inside(-73.25, 44.6)).toBe(true); // open water off Colchester
    expect(inside(-73.395, 44.62)).toBe(false); // Valcour Island, NY
  });
});

describe('isDarkMode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true at midnight (3 AM Eastern)', () => {
    // Set time to 3 AM Eastern on January 15, 2025
    // Vermont is in Eastern timezone
    vi.setSystemTime(new Date('2025-01-15T03:00:00-05:00'));
    expect(isDarkMode()).toBe(true);
  });

  it('should return true at 11 PM', () => {
    // Set time to 11 PM Eastern on January 15, 2025
    vi.setSystemTime(new Date('2025-01-15T23:00:00-05:00'));
    expect(isDarkMode()).toBe(true);
  });

  it('should return false at noon (12 PM Eastern)', () => {
    // Set time to noon Eastern on June 15, 2025 (summer for longer days)
    vi.setSystemTime(new Date('2025-06-15T12:00:00-04:00'));
    expect(isDarkMode()).toBe(false);
  });

  it('should return false at 2 PM in summer', () => {
    // Set time to 2 PM Eastern on June 15, 2025
    vi.setSystemTime(new Date('2025-06-15T14:00:00-04:00'));
    expect(isDarkMode()).toBe(false);
  });

  it('should handle winter solstice (shorter days)', () => {
    // Winter solstice - 4 PM should be near sunset/after in Vermont
    vi.setSystemTime(new Date('2025-12-21T16:30:00-05:00'));
    // This should be close to sunset time (~4:20 PM in Vermont on winter solstice)
    // The result could be either, but the function should not throw
    expect(typeof isDarkMode()).toBe('boolean');
  });

  it('should handle summer solstice (longer days)', () => {
    // Summer solstice - 5 AM should be around sunrise
    vi.setSystemTime(new Date('2025-06-21T05:30:00-04:00'));
    // Near sunrise, result may vary but should be boolean
    expect(typeof isDarkMode()).toBe('boolean');
  });
});

describe('onThemeChange', () => {
  it('should return a cleanup function', () => {
    const callback = vi.fn();
    const cleanup = onThemeChange(callback);

    expect(typeof cleanup).toBe('function');
    cleanup(); // Should not throw
  });

  it('should call callback when system theme changes', () => {
    // Mock matchMedia
    const mockAddEventListener = vi.fn();
    const mockRemoveEventListener = vi.fn();

    const mockMediaQuery = {
      matches: false,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    };

    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mockMediaQuery));

    const callback = vi.fn();
    onThemeChange(callback);

    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    // Simulate theme change
    const handler = mockAddEventListener.mock.calls[0]?.[1] as (e: { matches: boolean }) => void;
    handler({ matches: true });

    expect(callback).toHaveBeenCalledWith(true);

    vi.unstubAllGlobals();
  });

  it('should return no-op cleanup when matchMedia is not available', () => {
    vi.stubGlobal('matchMedia', undefined);

    const callback = vi.fn();
    const cleanup = onThemeChange(callback);

    expect(typeof cleanup).toBe('function');
    cleanup(); // Should not throw

    vi.unstubAllGlobals();
  });
});
