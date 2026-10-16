/**
 * Tests for the travel incident aggregator (VT 511 + USGS flood gauges).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import usgsRaw from '@/__fixtures__/usgs/iv-vt-gage-height.json?raw';
import incidentsXml from '@/__fixtures__/vt511/incidents.xml?raw';
import closuresXml from '@/__fixtures__/vt511/closures.xml?raw';
import { fetchFloodGauges, fetchAllIncidents } from '../travelApi';

const USGS_URL = 'https://waterservices.usgs.gov/nwis/iv/';
const INCIDENTS_URL = 'http://localhost:4000/api/vt511/incidents';
const CLOSURES_URL = 'http://localhost:4000/api/vt511/closures';

const usgsFixture = JSON.parse(usgsRaw) as unknown as Record<string, unknown>;
const xml = (body: string) =>
  new HttpResponse(body, { headers: { 'Content-Type': 'application/xml' } });

beforeEach(() => {
  // Fixture readings are at 11:00 EDT; pin "now" to 12:00 EDT the same day.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00-04:00'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('fetchFloodGauges', () => {
  it('requests VT gage height for active sites', async () => {
    let requested: URL | undefined;
    server.use(
      http.get(USGS_URL, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json(usgsFixture);
      }),
    );
    await fetchFloodGauges();
    expect(requested?.searchParams.get('stateCd')).toBe('VT');
    expect(requested?.searchParams.get('parameterCd')).toBe('00065');
    expect(requested?.searchParams.get('format')).toBe('json');
  });

  it('reports only recent readings above the 15 ft threshold, using the latest value', async () => {
    server.use(http.get(USGS_URL, () => HttpResponse.json(usgsFixture)));
    const floods = await fetchFloodGauges();

    // Winooski: latest 17.35 ft, 1h old -> flood.
    // Otter Creek: 4.2 ft -> below threshold. Lamoille: 19 ft but 7h old -> stale. Empty series skipped.
    expect(floods).toEqual([
      {
        id: 'usgs-04286000',
        type: 'FLOODING',
        title: 'Flooding at WINOOSKI RIVER AT MONTPELIER, VT',
        description: 'Gage height: 17.35 ft',
        location: { lat: 44.2581, lng: -72.5937 },
        geometry: null,
        severity: 'MAJOR',
        startTime: '2026-10-16T11:00:00.000-04:00',
        source: 'USGS Water Services',
        roadName: 'WINOOSKI RIVER AT MONTPELIER, VT',
      },
    ]);
  });

  it('returns [] when the response has no timeSeries', async () => {
    server.use(http.get(USGS_URL, () => HttpResponse.json({ value: {} })));
    await expect(fetchFloodGauges()).resolves.toEqual([]);
  });

  it('throws on a non-OK response', async () => {
    server.use(http.get(USGS_URL, () => new HttpResponse(null, { status: 503 })));
    await expect(fetchFloodGauges()).rejects.toThrow('USGS API error: 503');
  });
});

describe('fetchAllIncidents', () => {
  it('merges VT 511 incidents, closures and floods', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => xml(incidentsXml)),
      http.get(CLOSURES_URL, () => xml(closuresXml)),
      http.get(USGS_URL, () => HttpResponse.json(usgsFixture)),
    );
    const all = await fetchAllIncidents();
    expect(all).toHaveLength(7);
    expect(all.filter((i) => i.source === 'VT 511')).toHaveLength(6);
    expect(all.at(-1)?.id).toBe('usgs-04286000');
  });

  // FINDINGS (Medium, frontend): travelApi.ts used Promise.all, so a USGS outage hid all VT 511 incidents.
  it('still returns VT 511 incidents when USGS is down', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => xml(incidentsXml)),
      http.get(CLOSURES_URL, () => xml(closuresXml)),
      http.get(USGS_URL, () => new HttpResponse(null, { status: 500 })),
    );
    const all = await fetchAllIncidents();
    expect(all).toHaveLength(6);
    expect(all.every((i) => i.source === 'VT 511')).toBe(true);
  });

  it('still returns floods when the VT 511 proxy is down', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => HttpResponse.error()),
      http.get(CLOSURES_URL, () => HttpResponse.error()),
      http.get(USGS_URL, () => HttpResponse.json(usgsFixture)),
    );
    const all = await fetchAllIncidents();
    expect(all.map((i) => i.id)).toEqual(['usgs-04286000']);
  });
});
