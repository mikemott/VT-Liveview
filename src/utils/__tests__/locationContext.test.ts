import { describe, expect, it } from 'vitest';
import { buildLocationContext, formatMiles } from '../locationContext';
import {
  makeAlertFeature,
  makeRoadWeatherStation,
  makeVT511Incident,
} from '../../__fixtures__/components/data';
import type { TrafficCamera } from '../../services/cameraApi';
import type { AlertFeature } from '../../types/detailPanel';

const AT = { lat: 44.2, lng: -72.58 };
const cam = (id: string, lat: number, lng: number, online = true): TrafficCamera => ({
  id,
  name: id,
  lat,
  lng,
  roadway: null,
  direction: null,
  online,
});

describe('buildLocationContext', () => {
  it('keeps alerts whose area covers the point', () => {
    const covering = {
      ...makeAlertFeature(),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-73, 44],
            [-72, 44],
            [-72, 45],
            [-73, 45],
            [-73, 44],
          ],
        ],
      },
    } as AlertFeature;
    const elsewhere = {
      ...makeAlertFeature(),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-71, 44],
            [-70, 44],
            [-70, 45],
            [-71, 45],
            [-71, 44],
          ],
        ],
      },
    } as AlertFeature;
    const ctx = buildLocationContext(AT.lat, AT.lng, {
      alerts: [covering, elsewhere, { ...makeAlertFeature(), geometry: null }],
      roadWeather: [],
      cameras: [],
      incidents: [],
    });
    expect(ctx.alerts).toEqual([covering]);
  });

  it('picks the nearest road temp and online camera within range', () => {
    const ctx = buildLocationContext(AT.lat, AT.lng, {
      alerts: [],
      roadWeather: [
        makeRoadWeatherStation({ id: 'far', lat: 44.9, lng: -72.58 }),
        makeRoadWeatherStation({ id: 'near', lat: 44.21, lng: -72.58 }),
      ],
      cameras: [cam('offline', 44.2, -72.58, false), cam('online', 44.22, -72.58)],
      incidents: [],
    });
    expect(ctx.nearby.map((n) => `${n.kind}:${n.data.id}`)).toEqual([
      'roadWeather:near',
      'camera:online',
    ]);
    expect(ctx.nearby[0]!.distanceMi).toBeCloseTo(0.69, 1);
  });

  it('includes nearby accidents and full closures, nearest first, but not lane closures', () => {
    const ctx = buildLocationContext(AT.lat, AT.lng, {
      alerts: [],
      roadWeather: [],
      cameras: [],
      incidents: [
        makeVT511Incident({ id: 'crash', type: 'ACCIDENT', location: { lat: 44.25, lng: -72.58 } }),
        makeVT511Incident({ id: 'closed', type: 'CLOSURE', location: { lat: 44.21, lng: -72.58 } }),
        makeVT511Incident({
          id: 'lane',
          type: 'CLOSURE',
          affectedLanes: 'Left lane closed',
          location: { lat: 44.2, lng: -72.58 },
        }),
        makeVT511Incident({
          id: 'paving',
          type: 'CONSTRUCTION',
          location: { lat: 44.2, lng: -72.58 },
        }),
        makeVT511Incident({ id: 'far', type: 'ACCIDENT', location: { lat: 44.9, lng: -72.58 } }),
      ],
    });
    expect(ctx.nearby.map((n) => n.data.id)).toEqual(['closed', 'crash']);
  });
});

describe('formatMiles', () => {
  it('rounds sensibly', () => {
    expect(formatMiles(0.42)).toBe('0.4 mi');
    expect(formatMiles(3.4)).toBe('3 mi');
  });
});
