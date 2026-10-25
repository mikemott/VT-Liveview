/**
 * Tests for the per-layer GraphQL services: camping, recreation, beaches,
 * backcountry, creemee and ski. Each unwraps its root field and (except
 * beaches) normalises failures to a fixed Error message.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { graphql, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import { fetchCampingAreas } from '../campingApi';
import { fetchCampgrounds, fetchRecreationSites } from '../recreationApi';
import { fetchBeaches } from '../beachApi';
import { fetchBackcountrySites } from '../backcountryApi';
import { fetchCreemeeStands } from '../creemeeApi';
import { fetchSkiResorts } from '../skiApi';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchCampingAreas', () => {
  const area = {
    id: 'park-1',
    name: 'Groton State Forest',
    type: 'state_forest',
    siteCount: 12,
    centroid: { latitude: 44.3, longitude: -72.3 },
  };

  it('uses the lightweight query by default and forwards filters', async () => {
    let variables: Record<string, unknown> | undefined;
    server.use(
      graphql.query('CampingAreas', ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({ data: { campingAreas: [area] } });
      }),
    );
    await expect(fetchCampingAreas({ minSites: 3, types: ['state_park'] })).resolves.toEqual([
      area,
    ]);
    expect(variables).toEqual({ minSites: 3, types: ['state_park'] });
  });

  it('works with no options', async () => {
    server.use(
      graphql.query('CampingAreas', () => HttpResponse.json({ data: { campingAreas: [] } })),
    );
    await expect(fetchCampingAreas()).resolves.toEqual([]);
  });

  it('uses the boundaries query when includeBoundaries is set', async () => {
    const withBoundary = {
      ...area,
      boundary: { type: 'MultiPolygon', coordinates: [[[[-72.3, 44.3]]]] },
    };
    server.use(
      graphql.query('CampingAreasWithBoundaries', () =>
        HttpResponse.json({ data: { campingAreas: [withBoundary] } }),
      ),
    );
    await expect(fetchCampingAreas({ includeBoundaries: true })).resolves.toEqual([withBoundary]);
  });

  it('rethrows with the underlying error message', async () => {
    server.use(
      graphql.query('CampingAreas', () => HttpResponse.json({ errors: [{ message: 'db down' }] })),
    );
    await expect(fetchCampingAreas()).rejects.toThrow(/db down/);
  });
});

describe('fetchCampgrounds', () => {
  it('keeps camping and mixed sites only', async () => {
    const site = (id: string, type: string) => ({ id, type });
    server.use(
      graphql.query('GetRecreationSites', () =>
        HttpResponse.json({
          data: {
            recreationSites: [site('a', 'camping'), site('b', 'beach'), site('c', 'mixed')],
          },
        }),
      ),
    );
    const sites = await fetchCampgrounds();
    expect(sites.map((s) => s.id)).toEqual(['a', 'c']);
  });
});

describe('fetchRecreationSites', () => {
  it('unwraps recreationSites', async () => {
    const site = { id: 'r1', name: 'Lake Elmore', type: 'beach' };
    server.use(
      graphql.query('GetRecreationSites', () =>
        HttpResponse.json({ data: { recreationSites: [site] } }),
      ),
    );
    await expect(fetchRecreationSites()).resolves.toEqual([site]);
  });

  it('normalises failures', async () => {
    server.use(
      graphql.query('GetRecreationSites', () => HttpResponse.json({ errors: [{ message: 'x' }] })),
    );
    await expect(fetchRecreationSites()).rejects.toThrow('Failed to fetch recreation site data');
  });
});

describe('fetchBeaches', () => {
  it('unwraps beaches', async () => {
    const beach = { id: 'b1', name: 'North Beach', color: 'green', status: 'open' };
    server.use(graphql.query('Beaches', () => HttpResponse.json({ data: { beaches: [beach] } })));
    await expect(fetchBeaches()).resolves.toEqual([beach]);
  });

  it('propagates the GraphQL error', async () => {
    server.use(
      graphql.query('Beaches', () =>
        HttpResponse.json({ errors: [{ message: 'beach feed down' }] }),
      ),
    );
    await expect(fetchBeaches()).rejects.toThrow(/beach feed down/);
  });
});

describe('fetchBackcountrySites', () => {
  it('unwraps backcountrySites', async () => {
    const site = { id: 's1', siteId: 'GR-01', siteType: 'lean-to' };
    server.use(
      graphql.query('GetBackcountrySites', () =>
        HttpResponse.json({ data: { backcountrySites: [site] } }),
      ),
    );
    await expect(fetchBackcountrySites()).resolves.toEqual([site]);
  });

  it('normalises failures', async () => {
    server.use(
      graphql.query('GetBackcountrySites', () => HttpResponse.json({ errors: [{ message: 'x' }] })),
    );
    await expect(fetchBackcountrySites()).rejects.toThrow(
      'Failed to fetch backcountry campsite data',
    );
  });
});

describe('fetchCreemeeStands', () => {
  it('unwraps creemeeStands', async () => {
    const stand = { id: 'c1', name: 'Canteen Creemee', town: 'Waitsfield', featured: true };
    server.use(
      graphql.query('CreemeeStands', () => HttpResponse.json({ data: { creemeeStands: [stand] } })),
    );
    await expect(fetchCreemeeStands()).resolves.toEqual([stand]);
  });

  it('normalises failures', async () => {
    server.use(
      graphql.query('CreemeeStands', () => HttpResponse.json({ errors: [{ message: 'x' }] })),
    );
    await expect(fetchCreemeeStands()).rejects.toThrow('Failed to fetch creemee stands');
  });
});

describe('fetchSkiResorts', () => {
  it('unwraps skiResorts', async () => {
    const resort = { id: 'stowe', name: 'Stowe', liftsOpen: 10, liftsTotal: 13 };
    server.use(
      graphql.query('GetSkiResorts', () => HttpResponse.json({ data: { skiResorts: [resort] } })),
    );
    await expect(fetchSkiResorts()).resolves.toEqual([resort]);
  });

  it('normalises failures', async () => {
    server.use(
      graphql.query('GetSkiResorts', () => HttpResponse.json({ errors: [{ message: 'x' }] })),
    );
    await expect(fetchSkiResorts()).rejects.toThrow('Failed to fetch ski resort data');
  });
});
