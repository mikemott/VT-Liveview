/**
 * Sanity checks for the shared maplibre mock and XSS helpers, so the layer tests
 * built on them cannot pass vacuously.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FakeLngLatBounds,
  FakeMap,
  FakeMarker,
  FakePopup,
  allPopups,
  liveMarkers,
  openPopups,
  recordedPopupHTML,
  resetMaplibreMock,
} from '../../test/maplibreMock';
import { XSS_PAYLOAD, expectNoInjectedMarkup } from '../../__fixtures__/components/xss';

afterEach(() => {
  resetMaplibreMock();
  delete window.__xss;
});

describe('expectNoInjectedMarkup', () => {
  it('fails on raw, unescaped payloads', () => {
    expect(() => expectNoInjectedMarkup(`<h3>${XSS_PAYLOAD}</h3>`)).toThrow();
    expect(() => expectNoInjectedMarkup('<div onclick="x()">a</div>')).toThrow();
    expect(() => expectNoInjectedMarkup('<script>1</script>')).toThrow();
  });

  it('passes on escaped payloads and allow-listed images', () => {
    expectNoInjectedMarkup('<h3>&lt;img src=x onerror=&quot;window.__xss=1&quot;&gt;</h3>');
    expectNoInjectedMarkup('<img class="logo" src="a.png">', { allowedImgSelector: 'img.logo' });
  });

  it('does not execute markup while parsing it', () => {
    expect(() => expectNoInjectedMarkup(XSS_PAYLOAD)).toThrow();
    expect(window.__xss).toBeUndefined();
  });
});

describe('FakeMap', () => {
  it('tracks sources and layers like maplibre', () => {
    const map = new FakeMap({ baseLayers: [{ id: 'labels', type: 'symbol' }] });
    map.addSource('s', { type: 'geojson', data: { a: 1 } });
    expect(() => map.addSource('s', {})).toThrow(/already/);
    map.addLayer({ id: 'l', type: 'fill', source: 's', paint: { 'fill-opacity': 1 } }, 'labels');
    map.addLayer({ id: 'l', type: 'fill', source: 's' });
    map.addLayer({ id: 'm', type: 'fill', source: 'missing' });
    map.addLayer({ id: 'n', type: 'fill', source: 's' }, 'nope');
    expect(map.errors).toHaveLength(3);
    expect(map.getStyle().layers.map((l) => l.id)).toEqual(['labels', 'l']);

    map.removeSource('s');
    expect(map.errors.at(-1)).toMatch(/cannot be removed/);
    map.setLayoutProperty('l', 'visibility', 'none');
    expect(map.getLayoutProperty('l', 'visibility')).toBe('none');
    map.setPaintProperty('ghost', 'x', 1);
    map.setLayoutProperty('ghost', 'x', 1);
    map.removeLayer('l');
    map.removeLayer('l');
    map.removeSource('s');
    expect(() => map.removeSource('s')).toThrow();
    expect(map.layerIds()).toEqual([]);
    expect(map.sourceIds()).toEqual([]);

    map.addSource('g', { type: 'geojson', data: null });
    map.getSource<{ setData: (d: unknown) => void }>('g')?.setData({ b: 2 });
    expect(map.getSource('g')?.data).toEqual({ b: 2 });
    map.setStyle({});
    expect(map.sourceIds()).toEqual([]);
  });

  it('only removes listeners when type, layer and handler match', () => {
    const map = new FakeMap();
    const a = vi.fn();
    const b = vi.fn();
    map.on('click', a);
    map.on('click', 'layer', b);
    map.once('load', a);
    map.off('click', 'layer');
    expect(map.listenerCount()).toBe(3);
    map.fire('click', {}, 'layer');
    expect(b).toHaveBeenCalledTimes(1);
    map.fire('load');
    map.fire('load');
    expect(a).toHaveBeenCalledTimes(1);
    map.off('click', 'layer', b);
    map.off('click', a);
    expect(map.listenerCount()).toBe(0);
    expect(() => map.on('click', 'layer')).toThrow();
  });

  it('exposes camera, canvas and image helpers', () => {
    const map = new FakeMap({ zoom: 9, center: { lng: 1, lat: 2 } });
    expect(map.getZoom()).toBe(9);
    expect(map.getCenter()).toEqual({ lng: 1, lat: 2 });
    expect(map.getCanvas().tagName).toBe('CANVAS');
    expect(map.getContainer().contains(map.getCanvas())).toBe(true);
    map.addImage('i', {});
    expect(map.hasImage('i')).toBe(true);
    expect(() => map.addImage('i', {})).toThrow();
    map.removeImage('i');
    expect(map.hasImage('i')).toBe(false);
    expect(map.loaded()).toBe(true);
    map.remove();
    expect(map.removed).toBe(true);
  });
});

describe('FakeMarker / FakePopup / FakeLngLatBounds', () => {
  it('tracks marker lifecycle', () => {
    const map = new FakeMap();
    const popup = new FakePopup();
    const marker = new FakeMarker().setLngLat([1, 2]).setPopup(popup).addTo(map);
    expect(marker.getElement().tagName).toBe('DIV');
    expect(marker.getLngLat()).toEqual({ lng: 1, lat: 2 });
    expect(liveMarkers()).toEqual([marker]);
    marker.remove();
    expect(liveMarkers()).toEqual([]);
  });

  it('records popup content and open state', () => {
    const map = new FakeMap();
    const onClose = vi.fn();
    const popup = new FakePopup().setText('<b>x</b>').setMaxWidth('10px').addTo(map);
    popup.on('close', onClose);
    expect(popup.isOpen()).toBe(true);
    expect(popup.getElement().querySelector('b')).toBeNull();
    expect(recordedPopupHTML()).toEqual(['&lt;b&gt;x&lt;/b&gt;']);
    popup.remove();
    popup.remove();
    expect(onClose).toHaveBeenCalledTimes(1);
    popup.off('close', onClose);

    const dom = document.createElement('p');
    dom.textContent = 'hi';
    const second = new FakePopup().setDOMContent(dom).addTo(map);
    expect(second.getElement().textContent).toBe('hi');
    expect(openPopups()).toEqual([second]);
    expect(allPopups()).toHaveLength(2);
  });

  it('extends bounds', () => {
    const b = new FakeLngLatBounds([0, 0], [0, 0]).extend([2, -1]).extend([-1, 3]);
    expect(b.toArray()).toEqual([
      [-1, -1],
      [2, 3],
    ]);
  });
});
