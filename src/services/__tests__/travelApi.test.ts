/**
 * Tests for the travel incident aggregator (VT 511 + NWS river gauges at flood stage).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import incidentsXml from '@/__fixtures__/vt511/incidents.xml?raw';
import closuresXml from '@/__fixtures__/vt511/closures.xml?raw';
import { fetchFloodGauges, fetchAllIncidents, fetchAllIncidentsWithStatus } from '../travelApi';
import type { RiverGauge } from '../riverApi';

const RIVERS_URL = 'http://localhost:4000/api/rivers';
const INCIDENTS_URL = 'http://localhost:4000/api/vt511/incidents';
const CLOSURES_URL = 'http://localhost:4000/api/vt511/closures';

const gauge = (overrides: Partial<RiverGauge>): RiverGauge => ({
  id: 'MONV1',
  name: 'Winooski River at Montpelier',
  state: 'VT',
  lat: 44.2581,
  lng: -72.5937,
  stageFt: 16.2,
  flowCfs: 9000,
  category: 'minor',
  observedAt: '2026-10-16T15:00:00Z',
  forecastCategory: null,
  forecastStageFt: null,
  forecastAt: null,
  ...overrides,
});

const GAUGES = [
  gauge({}),
  gauge({ id: 'ESSV1', name: 'Winooski River near Essex Junction', category: 'no_flooding' }),
  gauge({ id: 'JNSV1', name: 'Lamoille River at Johnson', category: 'action' }),
  gauge({
    id: 'BURV1',
    name: 'Lake Champlain at Burlington',
    category: 'not_defined',
    stageFt: 96,
  }),
  gauge({ id: 'NOOBS', name: 'No reading', category: 'major', observedAt: null }),
];
const FLOOD_ID = 'flood-MONV1';

const rivers = (gauges: RiverGauge[] = GAUGES) => HttpResponse.json({ gauges });
const xml = (body: string) =>
  new HttpResponse(body, { headers: { 'Content-Type': 'application/xml' } });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchFloodGauges (VTL-89)', () => {
  it('reports gauges at minor flood stage or above, from the backend', async () => {
    server.use(http.get(RIVERS_URL, () => rivers()));
    // Action stage, no flooding, lake elevations and gauges without a reading are not floods
    expect(await fetchFloodGauges()).toEqual([
      {
        id: FLOOD_ID,
        type: 'FLOODING',
        title: 'Minor flooding at Winooski River at Montpelier',
        description: 'Minor flooding · 16.2 ft',
        location: { lat: 44.2581, lng: -72.5937 },
        geometry: null,
        severity: 'MAJOR',
        startTime: '2026-10-16T15:00:00Z',
        source: 'NWS river gauges',
        roadName: 'Winooski River at Montpelier',
      },
    ]);
  });

  it('labels moderate and major flooding, and omits a missing stage', async () => {
    server.use(
      http.get(RIVERS_URL, () =>
        rivers([
          gauge({ category: 'moderate' }),
          gauge({ id: 'X', category: 'major', stageFt: null }),
        ]),
      ),
    );
    const floods = await fetchFloodGauges();
    expect(floods.map((f) => f.description)).toEqual([
      'Moderate flooding · 16.2 ft',
      'Major flooding',
    ]);
  });

  it('throws when the backend is unavailable', async () => {
    server.use(http.get(RIVERS_URL, () => new HttpResponse(null, { status: 503 })));
    await expect(fetchFloodGauges()).rejects.toThrow('River gauges unavailable (HTTP 503)');
  });
});

describe('fetchAllIncidents', () => {
  it('merges VT 511 incidents, closures and floods', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => xml(incidentsXml)),
      http.get(CLOSURES_URL, () => xml(closuresXml)),
      http.get(RIVERS_URL, () => rivers()),
    );
    const all = await fetchAllIncidents();
    expect(all).toHaveLength(7);
    expect(all.filter((i) => i.source === 'VT 511')).toHaveLength(6);
    expect(all.at(-1)?.id).toBe(FLOOD_ID);
  });

  // FINDINGS (Medium, frontend): travelApi.ts used Promise.all, so a gauge outage hid all VT 511 incidents.
  it('still returns VT 511 incidents when the river gauges are down', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => xml(incidentsXml)),
      http.get(CLOSURES_URL, () => xml(closuresXml)),
      http.get(RIVERS_URL, () => new HttpResponse(null, { status: 500 })),
    );
    const all = await fetchAllIncidents();
    expect(all).toHaveLength(6);
    expect(all.every((i) => i.source === 'VT 511')).toBe(true);
  });

  it('still returns floods when the VT 511 proxy is down', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => HttpResponse.error()),
      http.get(CLOSURES_URL, () => HttpResponse.error()),
      http.get(RIVERS_URL, () => rivers()),
    );
    const all = await fetchAllIncidents();
    expect(all.map((i) => i.id)).toEqual([FLOOD_ID]);
  });
});

describe('fetchAllIncidentsWithStatus', () => {
  it('reports no unavailable sources when everything loads', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => xml(incidentsXml)),
      http.get(CLOSURES_URL, () => xml(closuresXml)),
      http.get(RIVERS_URL, () => rivers()),
    );
    const { incidents, unavailableSources } = await fetchAllIncidentsWithStatus();
    expect(incidents).toHaveLength(7);
    expect(unavailableSources).toEqual([]);
  });

  it('names the sources that failed while returning the rest', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => new HttpResponse(null, { status: 502 })),
      http.get(CLOSURES_URL, () => xml(closuresXml)),
      http.get(RIVERS_URL, () => new HttpResponse(null, { status: 500 })),
    );
    const { incidents, unavailableSources } = await fetchAllIncidentsWithStatus();
    expect(incidents.map((i) => i.id)).toEqual(['vt511-closure-2001', 'vt511-closure-2002']);
    expect(unavailableSources).toEqual(['VT 511 incidents', 'River gauges']);
  });

  it('rejects when every source fails', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => HttpResponse.error()),
      http.get(CLOSURES_URL, () => HttpResponse.error()),
      http.get(RIVERS_URL, () => new HttpResponse(null, { status: 500 })),
    );
    await expect(fetchAllIncidentsWithStatus()).rejects.toThrow('VT 511 incidents unavailable');
  });

  it('hands over each source as soon as it loads, before the slowest returns (VTL-89)', async () => {
    let releaseRivers: () => void = () => {};
    const riversGate = new Promise<void>((resolve) => (releaseRivers = resolve));
    server.use(
      http.get(INCIDENTS_URL, () => xml(incidentsXml)),
      http.get(CLOSURES_URL, () => xml(closuresXml)),
      http.get(RIVERS_URL, async () => {
        await riversGate;
        return rivers();
      }),
    );
    const seen: string[] = [];
    const done = fetchAllIncidentsWithStatus((label) => {
      seen.push(label);
      // Both 511 feeds arrive while the gauges are still pending
      if (seen.length === 2) releaseRivers();
    });
    const { incidents } = await done;
    expect(seen.slice(0, 2).sort()).toEqual(['VT 511 incidents', 'VT 511 lane closures']);
    expect(seen[2]).toBe('River gauges');
    expect(incidents).toHaveLength(7);
  });

  it('does not report a failed source as loaded', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => xml(incidentsXml)),
      http.get(CLOSURES_URL, () => xml(closuresXml)),
      http.get(RIVERS_URL, () => new HttpResponse(null, { status: 500 })),
    );
    const seen: string[] = [];
    await fetchAllIncidentsWithStatus((label) => seen.push(label));
    expect(seen).not.toContain('River gauges');
  });
});
