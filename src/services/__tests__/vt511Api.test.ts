/**
 * Tests for the VT 511 XML parser (via the backend proxy).
 * Fixtures are synthetic; see src/__fixtures__/README.md.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import incidentsXml from '@/__fixtures__/vt511/incidents.xml?raw';
import closuresXml from '@/__fixtures__/vt511/closures.xml?raw';
import {
  fetchVT511Incidents,
  fetchVT511LaneClosures,
  fetchAllVT511Data,
  type VT511ParsedIncident,
} from '../vt511Api';

const INCIDENTS_URL = 'http://localhost:4000/api/vt511/incidents';
const CLOSURES_URL = 'http://localhost:4000/api/vt511/closures';

const xml = (body: string) =>
  new HttpResponse(body, { headers: { 'Content-Type': 'application/xml' } });

function byId(list: VT511ParsedIncident[], id: string): VT511ParsedIncident {
  const found = list.find((i) => i.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchVT511Incidents', () => {
  it('parses every <incident> element', async () => {
    server.use(http.get(INCIDENTS_URL, () => xml(incidentsXml)));
    const incidents = await fetchVT511Incidents();
    expect(incidents.map((i) => i.id)).toEqual([
      'vt511-incident-1001',
      'vt511-incident-1002',
      'vt511-incident-1003',
      'vt511-incident-1004',
    ]);
    incidents.forEach((i) => expect(i.source).toBe('VT 511'));
  });

  it('maps a fully populated incident', async () => {
    server.use(http.get(INCIDENTS_URL, () => xml(incidentsXml)));
    const crash = byId(await fetchVT511Incidents(), 'vt511-incident-1001');

    expect(crash).toMatchObject({
      type: 'ACCIDENT',
      title: 'Crash on I-89 northbound',
      description: 'Crash on I-89 northbound. Right lane blocked.',
      severity: 'MAJOR',
      startTime: '2026-10-16T12:00:00-04:00',
      endTime: null,
      roadName: 'I-89 in Montpelier',
      affectedLanes: 'Right lane',
      roadRestrictions: { weight: '10 tons', width: '12 ft' },
    });
    // microdegrees -> decimal degrees
    expect(crash.location.lat).toBeCloseTo(44.2601, 6);
    expect(crash.location.lng).toBeCloseTo(-72.5754, 6);
  });

  it('builds a LineString of start, midpoints sorted by <order>, then end', async () => {
    server.use(http.get(INCIDENTS_URL, () => xml(incidentsXml)));
    const crash = byId(await fetchVT511Incidents(), 'vt511-incident-1001');
    expect(crash.geometry?.type).toBe('LineString');
    const coords = crash.geometry?.coordinates ?? [];
    expect(coords).toHaveLength(4);
    const rounded = coords.map(([lng, lat]) => [+lng.toFixed(2), +lat.toFixed(2)]);
    expect(rounded).toEqual([
      [-72.58, 44.26],
      [-72.54, 44.28],
      [-72.52, 44.29],
      [-72.5, 44.3],
    ]);
  });

  it('maps type attributes and severities, with HAZARD/MINOR fallbacks', async () => {
    server.use(http.get(INCIDENTS_URL, () => xml(incidentsXml)));
    const incidents = await fetchVT511Incidents();

    const paving = byId(incidents, 'vt511-incident-1002');
    expect(paving.type).toBe('CONSTRUCTION');
    expect(paving.severity).toBe('MODERATE');
    expect(paving.title).toBe('Paving operations');
    expect(paving.geometry).toBeNull(); // no endLocation
    expect(paving.startTime).toBeNull();

    const bridge = byId(incidents, 'vt511-incident-1003');
    expect(bridge.type).toBe('CLOSURE');
    expect(bridge.severity).toBe('MINOR'); // unknown "Extreme" falls back
    expect(bridge.roadName).toBe('Unknown Road in Unknown City');
  });

  it('gives an incident with no description a default title and zero location', async () => {
    server.use(http.get(INCIDENTS_URL, () => xml(incidentsXml)));
    const debris = byId(await fetchVT511Incidents(), 'vt511-incident-1004');
    expect(debris.type).toBe('HAZARD');
    expect(debris.title).toBe('Traffic Incident');
    expect(debris.description).toBe('');
    expect(debris.location).toEqual({ lat: 0, lng: 0 });
    expect(debris.roadRestrictions).toEqual({ weight: null, width: null });
  });

  it('defaults to HAZARD when there is no <type> element and handles non-numeric coordinates', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    server.use(
      http.get(INCIDENTS_URL, () =>
        xml(
          '<incidents><incident><desc>Ice</desc><startLocation><lat>abc</lat><lon>-72000000</lon></startLocation></incident></incidents>',
        ),
      ),
    );
    const [ice] = await fetchVT511Incidents();
    expect(ice).toMatchObject({
      id: 'vt511-incident-1234',
      type: 'HAZARD',
      location: { lat: 0, lng: -72 },
    });
  });

  it('drops a route whose endpoints lack coordinates', async () => {
    server.use(
      http.get(INCIDENTS_URL, () =>
        xml(
          '<incidents><incident id="9"><startLocation><roadway>VT-15</roadway></startLocation><endLocation/></incident></incidents>',
        ),
      ),
    );
    const [incident] = await fetchVT511Incidents();
    expect(incident?.geometry).toBeNull();
  });

  // An outage must not look like a quiet day with no incidents (VTL-57)
  it('rejects on a non-OK response', async () => {
    server.use(http.get(INCIDENTS_URL, () => new HttpResponse('bad gateway', { status: 502 })));
    await expect(fetchVT511Incidents()).rejects.toThrow('VT 511 incidents unavailable (HTTP 502)');
  });

  it('rejects on a network error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get(INCIDENTS_URL, () => HttpResponse.error()));
    await expect(fetchVT511Incidents()).rejects.toThrow('VT 511 incidents unavailable');
  });

  it('returns [] for an empty feed', async () => {
    server.use(http.get(INCIDENTS_URL, () => xml('<incidents/>')));
    await expect(fetchVT511Incidents()).resolves.toEqual([]);
  });
});

describe('fetchVT511LaneClosures', () => {
  it('parses lane closures as CONSTRUCTION', async () => {
    server.use(http.get(CLOSURES_URL, () => xml(closuresXml)));
    const closures = await fetchVT511LaneClosures();
    expect(closures).toHaveLength(2);

    const repair = byId(closures, 'vt511-closure-2001');
    expect(repair).toMatchObject({
      type: 'CONSTRUCTION',
      title: 'Lane closure for bridge joint repair 7:00 AM to 3:00 PM',
      severity: 'MINOR',
      roadName: 'US-4 in Rutland',
      affectedLanes: 'Left lane',
      hasSchedule: true,
      startTime: '2026-10-15T07:00:00-04:00',
    });
    expect(repair.geometry?.coordinates).toHaveLength(2);
  });

  it('truncates titles longer than 100 characters and detects no schedule', async () => {
    server.use(http.get(CLOSURES_URL, () => xml(closuresXml)));
    const shoulder = byId(await fetchVT511LaneClosures(), 'vt511-closure-2002');
    expect(shoulder.title).toHaveLength(100);
    expect(shoulder.title.endsWith('...')).toBe(true);
    expect(shoulder.hasSchedule).toBe(false);
    expect(shoulder.geometry).toBeNull();
  });

  it('uses a default title when the description is empty', async () => {
    server.use(
      http.get(CLOSURES_URL, () =>
        xml('<laneClosures><laneClosure id="3"><desc/></laneClosure></laneClosures>'),
      ),
    );
    const [closure] = await fetchVT511LaneClosures();
    expect(closure?.title).toBe('Construction');
  });

  it('rejects on a non-OK response', async () => {
    server.use(http.get(CLOSURES_URL, () => new HttpResponse(null, { status: 500 })));
    await expect(fetchVT511LaneClosures()).rejects.toThrow(
      'VT 511 lane closures unavailable (HTTP 500)',
    );
  });

  it('rejects on a network error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get(CLOSURES_URL, () => HttpResponse.error()));
    await expect(fetchVT511LaneClosures()).rejects.toThrow('VT 511 lane closures unavailable');
  });
});

describe('fetchAllVT511Data', () => {
  it('concatenates incidents then closures', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => xml(incidentsXml)),
      http.get(CLOSURES_URL, () => xml(closuresXml)),
    );
    const all = await fetchAllVT511Data();
    expect(all).toHaveLength(6);
    expect(all[0]?.id).toBe('vt511-incident-1001');
    expect(all[5]?.id).toBe('vt511-closure-2002');
  });

  it('still returns closures when the incidents feed is down', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => new HttpResponse(null, { status: 503 })),
      http.get(CLOSURES_URL, () => xml(closuresXml)),
    );
    const all = await fetchAllVT511Data();
    expect(all.map((i) => i.id)).toEqual(['vt511-closure-2001', 'vt511-closure-2002']);
  });

  it('rejects when both feeds are down', async () => {
    server.use(
      http.get(INCIDENTS_URL, () => new HttpResponse(null, { status: 503 })),
      http.get(CLOSURES_URL, () => new HttpResponse(null, { status: 503 })),
    );
    await expect(fetchAllVT511Data()).rejects.toThrow('VT 511 incidents unavailable');
  });
});
