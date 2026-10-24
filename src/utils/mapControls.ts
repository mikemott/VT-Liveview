import maplibregl from 'maplibre-gl';

/**
 * "Locate me" control. One-shot: flies to the user's position without
 * continuous tracking (this is a glance-at-conditions map, not navigation).
 *
 * Failures are otherwise silent in MapLibre: a denied permission or a position
 * outside the map's maxBounds just does nothing. `onNotice` gets a short,
 * user-facing explanation instead.
 */
export function createGeolocateControl(
  onNotice: (message: string) => void,
): maplibregl.GeolocateControl {
  const control = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true, timeout: 10_000 },
    trackUserLocation: false,
    showAccuracyCircle: true,
    fitBoundsOptions: { maxZoom: 12 },
  });

  control.on('outofmaxbounds', () => {
    onNotice('Your location is outside the area this map covers.');
  });

  control.on('error', (event: { code?: number }) => {
    // GeolocationPositionError codes: 1 denied, 2 unavailable, 3 timeout
    onNotice(
      event.code === 1
        ? 'Location access is blocked. Allow it in your browser settings to use "Locate me".'
        : "Couldn't get your location right now. Please try again.",
    );
  });

  return control;
}

export const BLOCKED_LOCATION_TITLE =
  'Location access is blocked. Allow it in your browser settings to use "Locate me".';

/**
 * If location permission was already denied, MapLibre disables the button
 * without firing an error, so the notice above never appears. Explain it on
 * the button itself instead (tooltip and accessible name), and keep it current
 * if the user changes the permission while the page is open.
 */
export function explainBlockedGeolocation(container: HTMLElement): void {
  if (!navigator.permissions?.query) return;
  navigator.permissions
    .query({ name: 'geolocation' })
    .then((status) => {
      const apply = (): void => {
        const button = container.querySelector<HTMLButtonElement>('.maplibregl-ctrl-geolocate');
        if (!button) return;
        if (status.state === 'denied') {
          button.title = BLOCKED_LOCATION_TITLE;
          button.setAttribute('aria-label', BLOCKED_LOCATION_TITLE);
        }
      };
      apply();
      // MapLibre builds and titles the button after its own async permission
      // check; apply again once that has settled so its title doesn't win.
      setTimeout(apply, 1000);
      status.addEventListener('change', apply);
    })
    .catch(() => {
      // Permissions API unsupported for geolocation (older Safari): nothing to do
    });
}

/** Scale bar in miles/feet. */
export function createScaleControl(): maplibregl.ScaleControl {
  return new maplibregl.ScaleControl({ maxWidth: 100, unit: 'imperial' });
}
