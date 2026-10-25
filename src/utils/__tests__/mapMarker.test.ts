import { describe, expect, it, vi } from 'vitest';
import { createMapMarker } from '../mapMarker';

describe('createMapMarker (VTL-64)', () => {
  it('is a named keyboard button in the layer color', () => {
    const el = createMapMarker({ layer: 'trafficCameras', label: 'Traffic camera: Berlin' });
    expect(el.getAttribute('role')).toBe('button');
    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute('aria-label')).toBe('Traffic camera: Berlin');
    expect(el.dataset.layer).toBe('trafficCameras');
    expect(el.style.getPropertyValue('--layer-color')).toBe('#db2777');
    expect(el.className).toBe('map-marker map-marker--circle');
    // Visuals on an inner body; MapLibre owns the outer element's transform
    expect(el.firstElementChild?.className).toBe('map-marker-body');
  });

  it('activates on Enter and Space like a click', () => {
    const el = createMapMarker({ layer: 'skiResorts', label: 'x' });
    const click = vi.fn();
    el.addEventListener('click', click);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('puts a status color in the fill and marks it for the layer ring', () => {
    const el = createMapMarker({ layer: 'beachSites', label: 'b', statusFill: '#10b981' });
    expect(el.classList.contains('map-marker--status')).toBe(true);
    expect(el.style.getPropertyValue('--marker-fill')).toBe('#10b981');
  });

  it('renders text as text, never markup', () => {
    const el = createMapMarker({
      layer: 'roadWeather',
      label: 'r',
      shape: 'pill',
      text: '<b>42°</b>',
    });
    expect(el.classList.contains('map-marker--pill')).toBe(true);
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toBe('<b>42°</b>');
  });

  it('inlines a hard-coded SVG icon', () => {
    const el = createMapMarker({
      layer: 'stargazing',
      label: 's',
      iconSvg: '<svg><path d="M0 0"/></svg>',
    });
    expect(el.querySelector('.map-marker-body svg path')).not.toBeNull();
  });

  it('dims offline/stale markers and keeps extra classes', () => {
    const el = createMapMarker({
      layer: 'trafficCameras',
      label: 'c',
      dimmed: true,
      className: 'camera-marker offline',
    });
    expect(el.className).toBe(
      'map-marker map-marker--circle map-marker--dimmed camera-marker offline',
    );
  });
});
