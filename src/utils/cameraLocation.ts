/**
 * A traffic camera's location as label/value rows for its detail panel (VTL-94)
 */
import type { CameraLocation, TrafficCamera } from '../services/cameraApi';

/** Under this, the camera is at the exit rather than "0.1 mi north" of it */
const AT_EXIT_MI = 0.15;

/** The camera's location as label/value rows; empty fields are left out */
export function locationRows(camera: TrafficCamera, location: CameraLocation | undefined) {
  const rows: [string, string][] = [];
  if (location?.milepost != null)
    rows.push(['Mile marker', `Mile ${location.milepost.toFixed(1)}`]);
  const exit = location?.nearestExit;
  if (exit) {
    const name = exit.name ? ` (${exit.name})` : '';
    rows.push([
      'Nearest exit',
      exit.distanceMi < AT_EXIT_MI
        ? `At Exit ${exit.number}${name}`
        : `About ${exit.distanceMi.toFixed(1)} mi ${exit.direction} of Exit ${exit.number}${name}`,
    ]);
  }
  if (location?.streetName) {
    rows.push([
      'Road',
      camera.roadway ? `${camera.roadway} (${location.streetName})` : location.streetName,
    ]);
  }
  if (location?.addressBlock) rows.push(['Near', location.addressBlock]);
  if (location?.town) {
    rows.push([
      'Town',
      location.county ? `${location.town}, ${location.county} County` : location.town,
    ]);
  }
  if (location?.speedLimitMph) rows.push(['Speed limit', `${location.speedLimitMph} mph`]);
  rows.push(['Coordinates', `${camera.lat.toFixed(4)}, ${camera.lng.toFixed(4)}`]);
  return rows;
}
