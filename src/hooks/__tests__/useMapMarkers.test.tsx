import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMapMarkers, type BuiltMarker } from '../useMapMarkers';
import { createMapMarker } from '../../utils/mapMarker';
import { FakeMap, liveMarkers, resetMaplibreMock } from '../../test/maplibreMock';

vi.mock('maplibre-gl', async () => (await import('../../test/maplibreMock')).maplibreModule);

interface Item {
  id: string;
  lat: number;
  lng: number;
}
const ITEMS: Item[] = [
  { id: 'a', lat: 44.2, lng: -72.5 },
  { id: 'b', lat: 44.3, lng: -72.6 },
];
const build = (item: Item): BuiltMarker => ({
  lngLat: [item.lng, item.lat],
  element: createMapMarker({ layer: 'trafficCameras', label: item.id }),
});

beforeEach(() => resetMaplibreMock());
afterEach(() => vi.clearAllMocks());

describe('useMapMarkers (VTL-64)', () => {
  it('adds markers only while visible and removes them when hidden', () => {
    const map = new FakeMap().asMap();
    const { rerender, unmount } = renderHook(
      ({ visible }) => useMapMarkers(map, visible, ITEMS, build, vi.fn()),
      { initialProps: { visible: false } },
    );
    expect(liveMarkers()).toHaveLength(0);
    rerender({ visible: true });
    expect(liveMarkers()).toHaveLength(2);
    rerender({ visible: false });
    expect(liveMarkers()).toHaveLength(0);
    rerender({ visible: true });
    unmount();
    expect(liveMarkers()).toHaveLength(0);
  });

  it('activates with the item, using the latest callback, without bubbling to the map', () => {
    const map = new FakeMap().asMap();
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = renderHook(({ cb }) => useMapMarkers(map, true, ITEMS, build, cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: latest });
    // Changing the callback doesn't rebuild markers
    expect(liveMarkers()).toHaveLength(2);
    const mapClick = vi.fn();
    const container = document.createElement('div');
    container.addEventListener('click', mapClick);
    const el = liveMarkers()[1]!.getElement();
    container.appendChild(el);
    el.click();
    expect(latest).toHaveBeenCalledWith(ITEMS[1]);
    expect(first).not.toHaveBeenCalled();
    expect(mapClick).not.toHaveBeenCalled();
  });

  it('skips items the builder rejects', () => {
    const map = new FakeMap().asMap();
    renderHook(() =>
      useMapMarkers(map, true, ITEMS, (i) => (i.id === 'a' ? null : build(i)), vi.fn()),
    );
    expect(liveMarkers()).toHaveLength(1);
  });
});
