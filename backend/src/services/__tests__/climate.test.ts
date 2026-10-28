import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import {
  acisNumber,
  createClimateService,
  nearestClimateStation,
  parseNormals,
  parseRecords,
  vermontDate,
} from '../climate.js';

const ACIS = 'https://data.rcc-acis.org/StnData';
const normalsJson = loadJson<Record<string, unknown>>('acis/normals-BTVthr.json');
const recordsJson = loadJson<Record<string, unknown>>('acis/records-BTVthr.json');
// 2 PM in Vermont, Oct 28 2026
const NOW = Date.parse('2026-10-28T18:00:00Z');

describe('ACIS parsing (VTL-81)', () => {
  it('reads values, flags and missing markers', () => {
    expect(acisNumber('54')).toBe(54);
    expect(acisNumber('-12')).toBe(-12);
    expect(acisNumber('75A')).toBe(75);
    expect(acisNumber('M')).toBeNull();
    expect(acisNumber('T')).toBeNull();
    expect(acisNumber(undefined)).toBeNull();
  });

  it('reads normals and records', () => {
    expect(parseNormals(normalsJson)).toEqual({ high: 54, low: 38 });
    expect(parseRecords(recordsJson)).toEqual({
      high: { tempF: 75, year: 1947 },
      low: { tempF: 19, year: 1974 },
    });
    expect(parseNormals({ error: 'no data available' })).toEqual({ high: null, low: null });
    expect(parseRecords({ smry: [[['M', '']], []] })).toEqual({ high: null, low: null });
  });

  it('picks the nearest station', () => {
    expect(nearestClimateStation(44.48, -73.21).name).toBe('Burlington');
    expect(nearestClimateStation(44.26, -72.58).name).toBe('Montpelier');
    expect(nearestClimateStation(42.85, -72.56).name).toBe('Keene, NH'); // Brattleboro
    expect(nearestClimateStation(42.88, -73.2).name).toBe('Pittsfield, MA'); // Bennington
  });

  it('uses the Vermont date', () => {
    expect(vermontDate(NOW)).toBe('2026-10-28');
    expect(vermontDate(Date.parse('2026-10-29T02:30:00Z'))).toBe('2026-10-28'); // 10:30 PM
  });
});

describe('createClimateService', () => {
  it('asks ACIS for the day and the record, caches per station and day', async () => {
    const bodies: { sid?: string; sdate?: string; elems?: { groupby?: string[] }[] }[] = [];
    server.use(
      http.post(ACIS, async ({ request }) => {
        const body = (await request.json()) as (typeof bodies)[number];
        bodies.push(body);
        return HttpResponse.json(body.sdate === 'por' ? recordsJson : normalsJson);
      }),
    );
    const svc = createClimateService(() => NOW);
    const day = await svc.getDay(44.48, -73.21);
    expect(day).toEqual({
      date: '2026-10-28',
      station: { name: 'Burlington', distanceMi: 3 },
      normalHighF: 54,
      normalLowF: 38,
      recordHigh: { tempF: 75, year: 1947 },
      recordLow: { tempF: 19, year: 1974 },
    });
    expect(bodies.map((b) => [b.sid, b.sdate])).toEqual([
      ['BTVthr', '2026-10-28'],
      ['BTVthr', 'por'],
    ]);
    expect(bodies[1]!.elems![0]!.groupby).toEqual(['year', '1028', '1028']);
    // Another point nearest the same station: cached
    await svc.getDay(44.5, -73.1);
    expect(bodies).toHaveLength(2);
  });

  it('fails when ACIS reports an error', async () => {
    server.use(http.post(ACIS, () => HttpResponse.json({ error: 'no data available' })));
    await expect(createClimateService(() => NOW).getDay(44.48, -73.21)).rejects.toThrow(
      'no data available',
    );
  });
});
