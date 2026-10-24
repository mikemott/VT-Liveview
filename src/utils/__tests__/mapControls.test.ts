import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BLOCKED_LOCATION_TITLE,
  createGeolocateControl,
  createScaleControl,
  explainBlockedGeolocation,
} from '../mapControls';

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

describe('explainBlockedGeolocation', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(state: PermissionState): HTMLButtonElement {
    vi.stubGlobal('navigator', {
      permissions: {
        query: vi.fn().mockResolvedValue({ state, addEventListener: vi.fn() }),
      },
    });
    const container = document.createElement('div');
    const button = document.createElement('button');
    button.className = 'maplibregl-ctrl-geolocate';
    button.title = 'Find my location';
    container.appendChild(button);
    explainBlockedGeolocation(container);
    return button;
  }

  it('explains a previously blocked permission on the button', async () => {
    const button = setup('denied');
    await vi.waitFor(() => expect(button.title).toBe(BLOCKED_LOCATION_TITLE));
    expect(button.getAttribute('aria-label')).toBe(BLOCKED_LOCATION_TITLE);
  });

  it('leaves the button alone when permission is not denied', async () => {
    const button = setup('prompt');
    await Promise.resolve();
    await Promise.resolve();
    expect(button.title).toBe('Find my location');
  });
});
