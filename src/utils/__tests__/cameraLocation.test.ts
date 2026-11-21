import { describe, expect, it } from 'vitest';
import { locationRows } from '../cameraLocation';
import { nearestSiteStation } from '../../hooks/useCameraSite';
import type { CameraLocation, TrafficCamera } from '../../services/cameraApi';
import type { RoadWeatherStation } from '../../services/roadWeatherApi';

const CAM: TrafficCamera = {
  id: 'US-7 NB BRANDON',
  name: 'BRANDON US-7 North',
  lat: 43.767145,
  lng: -73.050249,
  roadway: 'US-7',
  direction: 'North',
  online: true,
};

const EMPTY: CameraLocation = {
  town: null,
  county: null,
  milepost: null,
  nearestExit: null,
  streetName: null,
  addressBlock: null,
  speedLimitMph: null,
};

describe('locationRows (VTL-94)', () => {
  it('describes a camera off the interstates by its street and address block', () => {
    expect(
      locationRows(CAM, {
        ...EMPTY,
        town: 'Brandon',
        county: 'Rutland',
        streetName: 'Franklin St',
        addressBlock: '2900 block of Franklin St',
      }),
    ).toEqual([
      ['Road', 'US-7 (Franklin St)'],
      ['Near', '2900 block of Franklin St'],
      ['Town', 'Brandon, Rutland County'],
      ['Coordinates', '43.7671, -73.0502'],
    ]);
  });

  it('says a camera at an interchange is at the exit', () => {
    const rows = locationRows(CAM, {
      ...EMPTY,
      milepost: 88.7,
      nearestExit: { number: '14', name: '', distanceMi: 0.04, direction: 'east' },
    });
    expect(rows.slice(0, 2)).toEqual([
      ['Mile marker', 'Mile 88.7'],
      ['Nearest exit', 'At Exit 14'],
    ]);
  });

  it('keeps a town without a county, a street without a roadway, and mile 0', () => {
    const rows = locationRows(
      { ...CAM, roadway: null },
      { ...EMPTY, milepost: 0, town: 'Guilford', streetName: 'Mountain Rd' },
    );
    expect(rows).toContainEqual(['Mile marker', 'Mile 0.0']);
    expect(rows).toContainEqual(['Road', 'Mountain Rd']);
    expect(rows).toContainEqual(['Town', 'Guilford']);
  });

  it('shows only the coordinates before the location loads', () => {
    expect(locationRows(CAM, undefined)).toEqual([['Coordinates', '43.7671, -73.0502']]);
  });
});

describe('nearestSiteStation', () => {
  const station = (id: string, lat: number, lng: number) =>
    ({ id, name: id, lat, lng }) as RoadWeatherStation;

  it('picks the closest station on the same site, and none farther than 0.3 mi', () => {
    const near = station('near', 43.7672, -73.0503);
    const nearer = station('nearer', 43.76715, -73.05025);
    // About 0.7 mi north
    const far = station('far', 43.777, -73.0502);
    expect(nearestSiteStation(CAM, [far, near, nearer])?.id).toBe('nearer');
    expect(nearestSiteStation(CAM, [far])).toBeNull();
    expect(nearestSiteStation(CAM, [])).toBeNull();
  });
});
