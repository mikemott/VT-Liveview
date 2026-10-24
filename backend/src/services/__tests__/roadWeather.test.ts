import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadText } from '../../__fixtures__/load.js';
import { createRoadWeatherService, parseEssData, parseEssTime } from '../roadWeather.js';

const C2C = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';
const essXml = loadText('c2c/essData.xml');
// When the fixture was captured
const CAPTURED = Date.parse('2026-10-24T19:04:21Z');

describe('parseEssTime', () => {
  it('treats a mislabeled UTC clock time (future by its offset) as UTC', () => {
    // "19:00-04:00" would be 23:00Z, hours ahead of a 19:04Z fetch
    expect(parseEssTime('2026-10-24T19:00:00-04:00', CAPTURED)).toBe('2026-10-24T19:00:00.000Z');
  });
  it('keeps the stated offset when it is plausible (feed fixed, or old readings)', () => {
    expect(parseEssTime('2026-10-24T15:00:00-04:00', CAPTURED)).toBe('2026-10-24T19:00:00.000Z');
    expect(parseEssTime('2026-04-14T10:24:00-04:00', CAPTURED)).toBe('2026-04-14T14:24:00.000Z');
  });
  it('reads a time without an offset as UTC', () => {
    expect(parseEssTime('2026-10-24T18:00:00', CAPTURED)).toBe('2026-10-24T18:00:00.000Z');
  });
  it('rejects junk', () => {
    expect(parseEssTime(null)).toBeNull();
    expect(parseEssTime('yesterday')).toBeNull();
  });
});

describe('parseEssData', () => {
  const stations = parseEssData(essXml, CAPTURED);

  it('keeps online stations only', () => {
    expect(stations.map((s) => s.name)).toEqual([
      'I-89 BERLIN',
      'US-7 BRANDON',
      'I-91 GUILFORD',
      'I-89 BOLTON',
    ]);
  });

  it('converts tenths of °C, microdegrees and the timestamp', () => {
    expect(stations[0]).toEqual({
      id: '124',
      name: 'I-89 BERLIN',
      lat: 44.21232,
      lng: -72.58338,
      roadway: 'I-89',
      direction: 'South',
      location: 'BERLIN .2 MILES SOUTH OF EXIT 7',
      surface: 'Dry',
      pavementTempC: 16.8,
      airTempC: 12.4,
      dewPointC: -5,
      friction: 0.82,
      precip: null, // "N/A"
      observedAt: '2026-10-24T19:00:00.000Z',
    });
  });

  it('maps "Unknown" surface to null and tolerates missing sensors', () => {
    const guilford = stations.find((s) => s.name === 'I-91 GUILFORD')!;
    expect(guilford.surface).toBeNull();
    expect(guilford.precip).toBe('None');
    expect(guilford.location).toBe('WELCOME CENTER LAWN'); // whitespace collapsed
    const bolton = stations.find((s) => s.name === 'I-89 BOLTON')!;
    expect(bolton.pavementTempC).toBeNull();
    expect(bolton.friction).toBeNull();
    expect(bolton.airTempC).toBe(14.1);
  });
});

describe('createRoadWeatherService', () => {
  it('fetches essData once per TTL', async () => {
    let calls = 0;
    server.use(
      http.get(C2C, ({ request }) => {
        calls++;
        expect(new URL(request.url).searchParams.get('dataTypes')).toBe('essData');
        return HttpResponse.text(essXml);
      }),
    );
    const service = createRoadWeatherService('test-agent');
    const [a, b] = await Promise.all([service.getStations(), service.getStations()]);
    expect(a).toHaveLength(4);
    expect(b).toBe(a);
    await service.getStations();
    expect(calls).toBe(1);
  });
});
