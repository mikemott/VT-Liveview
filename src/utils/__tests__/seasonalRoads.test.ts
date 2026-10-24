import { describe, it, expect } from 'vitest';
import {
  vermontDateKey,
  inWindow,
  daysUntil,
  formatMonthDay,
  distanceToLinesMeters,
  getRoadStatus,
  buildSeasonalRoadsGeoJSON,
  roadCenter,
  roadBounds,
  isFullClosure,
  closurePoints,
} from '../seasonalRoads';
import { SEASONAL_ROADS, type SeasonalRoad } from '../../data/seasonalRoads';

const road: SeasonalRoad = {
  id: 'test-gap',
  name: 'Test Gap Road',
  between: 'A and B',
  owner: 'Town',
  season: { start: '11-15', end: '05-15' },
  seasonText: 'mid-November to mid-May',
  note: '',
  sources: [],
  lines: [
    [
      [-72.9, 44.1],
      [-72.8, 44.1],
    ],
  ],
};

describe('vermontDateKey', () => {
  it('uses Vermont time, not UTC', () => {
    // 02:00 UTC on Nov 15 is still Nov 14 in Vermont
    expect(vermontDateKey(new Date('2026-11-15T02:00:00Z'))).toBe('11-14');
    expect(vermontDateKey(new Date('2026-11-15T12:00:00Z'))).toBe('11-15');
  });
});

describe('inWindow', () => {
  const winter = { start: '11-15', end: '05-15' };
  it('handles windows that wrap over New Year', () => {
    expect(inWindow('11-15', winter)).toBe(true);
    expect(inWindow('01-10', winter)).toBe(true);
    expect(inWindow('05-15', winter)).toBe(true);
    expect(inWindow('05-16', winter)).toBe(false);
    expect(inWindow('11-14', winter)).toBe(false);
  });
  it('handles windows inside one year', () => {
    const summer = { start: '06-01', end: '08-31' };
    expect(inWindow('07-04', summer)).toBe(true);
    expect(inWindow('09-01', summer)).toBe(false);
  });
});

describe('daysUntil / formatMonthDay', () => {
  it('counts forward and wraps', () => {
    expect(daysUntil('11-01', '11-15')).toBe(14);
    expect(daysUntil('11-15', '11-15')).toBe(0);
    expect(daysUntil('12-31', '01-01')).toBe(1);
  });
  it('formats MM-DD', () => {
    expect(formatMonthDay('11-15')).toBe('Nov 15');
    expect(formatMonthDay('05-01')).toBe('May 1');
  });
});

describe('distanceToLinesMeters', () => {
  it('measures to the nearest point on a segment, not just vertices', () => {
    // ~0.001° north of the middle of the line ≈ 111 m
    const d = distanceToLinesMeters(44.101, -72.85, road.lines);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
  it('is large for far-away points', () => {
    expect(distanceToLinesMeters(43.0, -73.0, road.lines)).toBeGreaterThan(100_000);
  });
});

describe('getRoadStatus', () => {
  const at = (iso: string): Date => new Date(iso);
  it('is seasonally closed inside the window', () => {
    const s = getRoadStatus(road, at('2027-01-15T15:00:00Z'));
    expect(s.status).toBe('seasonal');
    expect(s.label).toContain('May 15');
  });
  it('warns when closing within three weeks', () => {
    const s = getRoadStatus(road, at('2026-10-30T15:00:00Z'));
    expect(s.status).toBe('closingSoon');
    expect(s.label).toContain('Nov 15');
  });
  it('is open in summer', () => {
    expect(getRoadStatus(road, at('2026-07-04T15:00:00Z')).status).toBe('open');
  });
  it('a 511 closure on the road overrides the season', () => {
    const summer = at('2026-07-04T15:00:00Z');
    expect(getRoadStatus(road, summer, [{ lat: 44.1005, lng: -72.85 }]).status).toBe('closed511');
    // A closure on some other road doesn't count
    expect(getRoadStatus(road, summer, [{ lat: 44.2, lng: -72.85 }]).status).toBe('open');
  });
});

describe('buildSeasonalRoadsGeoJSON / roadCenter', () => {
  it('builds one MultiLineString feature per road with its status', () => {
    const fc = buildSeasonalRoadsGeoJSON(
      [road],
      new Map([['test-gap', { status: 'seasonal', label: '' }]]),
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties).toEqual({
      id: 'test-gap',
      name: 'Test Gap Road',
      status: 'seasonal',
    });
    expect(fc.features[0]!.geometry.type).toBe('MultiLineString');
  });
  it('centers on the bounding box', () => {
    expect(roadCenter(road)).toEqual([-72.85, 44.1]);
  });
});

describe('generated SEASONAL_ROADS data', () => {
  it('has unique ids, sources and Vermont geometry for every road', () => {
    const ids = new Set(SEASONAL_ROADS.map((r) => r.id));
    expect(ids.size).toBe(SEASONAL_ROADS.length);
    for (const r of SEASONAL_ROADS) {
      expect(r.sources.length).toBeGreaterThan(0);
      expect(r.season.start).toMatch(/^\d{2}-\d{2}$/);
      expect(r.season.end).toMatch(/^\d{2}-\d{2}$/);
      expect(r.lines.length).toBeGreaterThan(0);
      for (const line of r.lines) {
        expect(line.length).toBeGreaterThanOrEqual(2);
        for (const [lng, lat] of line) {
          expect(lat).toBeGreaterThan(42.7);
          expect(lat).toBeLessThan(45.1);
          expect(lng).toBeGreaterThan(-73.5);
          expect(lng).toBeLessThan(-71.4);
        }
      }
    }
  });
});

describe('isFullClosure / closurePoints', () => {
  const base = { title: '', description: '', location: { lat: 44.1, lng: -72.85 } };
  it('counts CLOSURE incidents and "road closed" wording, not lane closures', () => {
    expect(isFullClosure({ ...base, type: 'CLOSURE' })).toBe(true);
    // 511 types one-lane bridge work as CLOSURE; the road is still open
    expect(isFullClosure({ ...base, type: 'CLOSURE', affectedLanes: 'Left lane closed' })).toBe(
      false,
    );
    // The real Oct 24 report: winter closure typed as construction, all lanes
    expect(
      isFullClosure({
        ...base,
        type: 'CONSTRUCTION',
        title: 'Lincoln Gap Rd between Lincoln and Warren is CLOSED for the 2026 Winter Season',
        affectedLanes: 'All lanes closed',
      }),
    ).toBe(true);
    expect(
      isFullClosure({ ...base, type: 'HAZARD', description: 'VT-108 road closed at the Notch' }),
    ).toBe(true);
    expect(
      isFullClosure({ ...base, type: 'CONSTRUCTION', affectedLanes: 'All lanes closed' }),
    ).toBe(true);
    expect(
      isFullClosure({ ...base, type: 'CONSTRUCTION', affectedLanes: 'Right lane closed' }),
    ).toBe(false);
    expect(isFullClosure({ ...base, type: 'ACCIDENT', title: 'Crash' })).toBe(false);
  });
  it('drops floods and 0,0 locations', () => {
    expect(
      closurePoints([
        { ...base, type: 'CLOSURE' },
        { ...base, type: 'FLOODING', description: 'road closed' },
        { ...base, type: 'CLOSURE', location: { lat: 0, lng: 0 } },
      ]),
    ).toEqual([{ lat: 44.1, lng: -72.85 }]);
  });
  it('roadBounds is [w, s, e, n]', () => {
    expect(roadBounds(road)).toEqual([-72.9, 44.1, -72.8, 44.1]);
  });
});
