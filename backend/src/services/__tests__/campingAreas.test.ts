import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import { getCampingAreas, groupCampsitesByArea } from '../campingAreas.js';
import { clearCache as clearBackcountry } from '../backcountrySites.js';
import { clearCache as clearBoundaries } from '../parkBoundaries.js';
import { BACKCOUNTRY_URL, PARK_BOUNDARIES_URL, paddedFixture } from './arcgisFixtures.js';

/**
 * Backcountry fixture padded to 60 features: clones of bc-501 (park 42) make
 * park 42 the largest group; bc-503 is in park 77; bc-504 has no park.
 * An extra site in park 55 has no matching boundary.
 */
function useCampingUpstreams(): void {
  const sites = paddedFixture('anr/backcountry-campsites.json', 60);
  sites.features.push({
    attributes: { ...sites.features[0]!.attributes, OBJECTID: 900, ANRUnit: 55 },
    geometry: { x: 480000, y: 200000 },
  });
  server.use(
    http.get(BACKCOUNTRY_URL, () => HttpResponse.json(sites)),
    http.get(PARK_BOUNDARIES_URL, () => HttpResponse.json(loadJson('anr/park-boundaries.geojson'))),
  );
}

beforeEach(() => {
  clearBackcountry();
  clearBoundaries();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('groupCampsitesByArea', () => {
  it('groups sites by park unit, sorted by site count', async () => {
    useCampingUpstreams();
    const areas = await groupCampsitesByArea();

    expect(areas.map((a) => [a.id, a.siteCount])).toEqual([
      ['area-42', 56],
      ['area-77', 1],
      ['area-unknown-55', 1],
    ]);

    const smugglers = areas[0]!;
    expect(smugglers).toMatchObject({ name: 'Smugglers Notch State Park', type: 'state_park' });
    // Polygon boundaries are normalised to MultiPolygon
    expect(smugglers.boundary?.type).toBe('MultiPolygon');
    expect(smugglers.boundary?.coordinates).toHaveLength(1);
    expect(smugglers.centroid.latitude).toBeCloseTo(
      smugglers.sites.reduce((sum, s) => sum + s.latitude, 0) / smugglers.sites.length,
      10,
    );

    expect(areas[1]).toMatchObject({ name: 'Lake Carmi State Forest', type: 'state_forest' });
    expect(areas[1]?.boundary?.coordinates).toHaveLength(2);

    expect(areas[2]).toMatchObject({ name: 'Park Unit 55', type: 'other' });
    expect(areas[2]?.boundary).toBeUndefined();
  });

  it('returns [] when both upstreams are down', async () => {
    server.use(
      http.get(BACKCOUNTRY_URL, () => HttpResponse.error()),
      http.get(PARK_BOUNDARIES_URL, () => HttpResponse.error()),
    );
    expect(await groupCampsitesByArea()).toEqual([]);
  });

  it('still groups sites (without boundaries) when park boundaries are unavailable', async () => {
    useCampingUpstreams();
    server.use(http.get(PARK_BOUNDARIES_URL, () => new HttpResponse(null, { status: 500 })));

    const areas = await groupCampsitesByArea();
    expect(areas.map((a) => a.id)).toEqual([
      'area-unknown-42',
      'area-unknown-77',
      'area-unknown-55',
    ]);
  });
});

describe('getCampingAreas', () => {
  it('returns everything without filters', async () => {
    useCampingUpstreams();
    expect(await getCampingAreas()).toHaveLength(3);
  });

  it('filters by minimum site count', async () => {
    useCampingUpstreams();
    const areas = await getCampingAreas({ minSites: 2 });
    expect(areas.map((a) => a.id)).toEqual(['area-42']);
  });

  it('filters by type, ignoring an empty type list', async () => {
    useCampingUpstreams();
    expect((await getCampingAreas({ types: ['state_forest', 'other'] })).map((a) => a.id)).toEqual([
      'area-77',
      'area-unknown-55',
    ]);
    expect(await getCampingAreas({ types: [] })).toHaveLength(3);
  });
});
