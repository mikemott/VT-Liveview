import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { FakeMap, resetMaplibreMock } from '../../test/maplibreMock';

// The API key is read at module scope, so stub it before the component is imported.
vi.hoisted(() => {
  vi.stubEnv('VITE_TOMTOM_API_KEY', 'test-tomtom-key');
});

import TrafficFlowLayer from '../TrafficFlowLayer';

const SOURCE = 'traffic-flow-source';
const MAIN = 'traffic-flow-layer';
const CASING = 'traffic-flow-layer-casing';

describe('TrafficFlowLayer', () => {
  let fake: FakeMap;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    fake = new FakeMap({
      baseLayers: [
        { id: 'roads', type: 'line' },
        { id: 'places_label', type: 'symbol' },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetMaplibreMock();
  });

  it('adds the source, both layers and a style.load listener; removes all on unmount', () => {
    const { unmount } = render(<TrafficFlowLayer map={fake.asMap()} visible isDark={false} />);
    expect(fake.sourceIds()).toEqual([SOURCE]);
    const tiles = fake.getSource(SOURCE)?.spec.tiles as string[];
    expect(tiles[0]).toContain('key=test-tomtom-key');
    expect(fake.layerIds()).toEqual([CASING, MAIN]);
    // Inserted below labels
    expect(fake.getLayer(MAIN)?.beforeId).toBe('places_label');
    expect(fake.getLayoutProperty(MAIN, 'visibility')).toBe('visible');
    expect(fake.getPaintProperty(CASING, 'line-color')).toBe('#ffffff');
    expect(fake.listenerCount('style.load')).toBe(1);

    unmount();
    expect(fake.sourceIds()).toEqual([]);
    expect(fake.layerIds()).toEqual([]);
    expect(fake.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(fake.errors).toEqual([]);
  });

  it('hides and shows the layers without removing them', () => {
    const { rerender } = render(<TrafficFlowLayer map={fake.asMap()} visible isDark={false} />);
    rerender(<TrafficFlowLayer map={fake.asMap()} visible={false} isDark={false} />);
    expect(fake.getLayoutProperty(MAIN, 'visibility')).toBe('none');
    expect(fake.getLayoutProperty(CASING, 'visibility')).toBe('none');
    rerender(<TrafficFlowLayer map={fake.asMap()} visible isDark={false} />);
    expect(fake.getLayoutProperty(MAIN, 'visibility')).toBe('visible');
  });

  it('updates the casing colour on theme change', () => {
    const { rerender } = render(<TrafficFlowLayer map={fake.asMap()} visible isDark={false} />);
    rerender(<TrafficFlowLayer map={fake.asMap()} visible isDark />);
    expect(fake.getPaintProperty(CASING, 'line-color')).toBe('#000000');
  });

  it('re-adds layers after a style swap using the current visibility and theme', () => {
    const { rerender } = render(<TrafficFlowLayer map={fake.asMap()} visible isDark={false} />);
    rerender(<TrafficFlowLayer map={fake.asMap()} visible={false} isDark />);

    fake.setStyle({});
    expect(fake.layerIds()).toEqual([]);
    act(() => {
      fake.fire('style.load');
      vi.advanceTimersByTime(50);
    });

    expect(fake.layerIds()).toEqual([CASING, MAIN]);
    // Hidden traffic must stay hidden after the style reload
    expect(fake.getLayoutProperty(MAIN, 'visibility')).toBe('none');
    expect(fake.getLayoutProperty(CASING, 'visibility')).toBe('none');
    expect(fake.getPaintProperty(CASING, 'line-color')).toBe('#000000');
  });

  it('retries until the style has loaded', () => {
    fake.styleLoaded = false;
    render(<TrafficFlowLayer map={fake.asMap()} visible isDark={false} />);
    expect(fake.layerIds()).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(fake.layerIds()).toEqual([]);
    fake.styleLoaded = true;
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(fake.layerIds()).toEqual([CASING, MAIN]);
  });

  it('cancels pending retries on unmount', () => {
    fake.styleLoaded = false;
    const { unmount } = render(<TrafficFlowLayer map={fake.asMap()} visible isDark={false} />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    fake.styleLoaded = true;
    vi.advanceTimersByTime(5000);
    expect(fake.layerIds()).toEqual([]);
  });

  it('gives up after 10 retries', () => {
    fake.styleLoaded = false;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<TrafficFlowLayer map={fake.asMap()} visible isDark={false} />);
    act(() => {
      vi.advanceTimersByTime(200 * 11);
    });
    expect(spy).toHaveBeenCalledWith(
      'TrafficFlowLayer: Failed to add layers after 10 retries - style never loaded',
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing without a map', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<TrafficFlowLayer map={null} visible isDark={false} />);
    expect(warn).toHaveBeenCalled();
  });
});

describe('TrafficFlowLayer without an API key', () => {
  it('logs an error and adds nothing', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_TOMTOM_API_KEY', '');
    const { default: Layer } = await import('../TrafficFlowLayer');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fake = new FakeMap();
    render(<Layer map={fake.asMap()} visible isDark={false} />);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('VITE_TOMTOM_API_KEY'));
    expect(fake.layerIds()).toEqual([]);
    spy.mockRestore();
    vi.unstubAllEnvs();
  });
});
