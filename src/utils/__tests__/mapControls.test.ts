import { describe, expect, it, vi } from 'vitest';
import { createGeolocateControl, createScaleControl } from '../mapControls';

describe('createGeolocateControl', () => {
  it('explains a position outside the map area', () => {
    const onNotice = vi.fn();
    const control = createGeolocateControl(onNotice);
    control.fire('outofmaxbounds', {});
    expect(onNotice).toHaveBeenCalledWith('Your location is outside the area this map covers.');
  });

  it('distinguishes a blocked permission from other errors', () => {
    const onNotice = vi.fn();
    const control = createGeolocateControl(onNotice);
    control.fire('error', { code: 1 });
    expect(onNotice).toHaveBeenLastCalledWith(
      expect.stringContaining('Location access is blocked'),
    );
    control.fire('error', { code: 3 });
    expect(onNotice).toHaveBeenLastCalledWith(
      "Couldn't get your location right now. Please try again.",
    );
  });
});

describe('createScaleControl', () => {
  it('uses imperial units', () => {
    expect(createScaleControl().options.unit).toBe('imperial');
  });
});
