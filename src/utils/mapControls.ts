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

/** Scale bar in miles/feet. */
export function createScaleControl(): maplibregl.ScaleControl {
  return new maplibregl.ScaleControl({ maxWidth: 100, unit: 'imperial' });
}
