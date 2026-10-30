import { describe, expect, it } from 'vitest';
import { FERRIES, type Ferry } from '../../data/ferries';
import {
  boatPosition,
  DWELL_MS,
  getFerryStatus,
  isRunning,
  pointAlong,
  seasonDay,
} from '../ferries';

const ferry = (id: string): Ferry => FERRIES.find((f) => f.id === id)!;
// Noon in Vermont
const on = (md: string): Date => new Date(`2026-${md}T16:00:00Z`);

describe('ferry status (VTL-81)', () => {
  it('runs Grand Isle all year', () => {
    for (const md of ['01-15', '07-04', '11-20']) {
      expect(getFerryStatus(ferry('grand-isle'), on(md)).state).toBe('season');
    }
  });

  it('warns about ice on the Charlotte crossing in mid-winter only', () => {
    expect(getFerryStatus(ferry('charlotte'), on('02-10'))).toMatchObject({
      state: 'ice',
      tone: 'warn',
    });
    expect(getFerryStatus(ferry('charlotte'), on('11-20')).state).toBe('season');
  });

  it('follows the Fort Ticonderoga season, with an end-of-season warning', () => {
    const fortTi = ferry('fort-ticonderoga');
    expect(getFerryStatus(fortTi, on('04-20')).state).toBe('closed');
    expect(getFerryStatus(fortTi, on('07-04')).state).toBe('season');
    expect(getFerryStatus(fortTi, on('10-28')).state).toBe('check');
    expect(getFerryStatus(fortTi, on('11-05')).state).toBe('closed');
    // Boats cross until the end-of-season window closes
    expect(isRunning(getFerryStatus(fortTi, on('10-28')))).toBe(true);
    expect(isRunning(getFerryStatus(fortTi, on('11-05')))).toBe(false);
  });

  it('uses the Vermont date', () => {
    // 11:30 PM Sept 7 in Vermont is already Sept 8 in UTC: still the bike ferry's last day
    expect(getFerryStatus(ferry('bike-ferry'), new Date('2026-09-08T03:30:00Z')).state).toBe(
      'season',
    );
  });

  it('works out Memorial Day weekend and Labor Day each year', () => {
    expect(seasonDay('memorialDayWeekend', 2026)).toBe('05-23');
    expect(seasonDay('laborDay', 2026)).toBe('09-07');
    expect(seasonDay('memorialDayWeekend', 2027)).toBe('05-29');
    expect(seasonDay('laborDay', 2027)).toBe('09-06');
    expect(seasonDay('06-15', 2027)).toBe('06-15');
  });

  it('moves holiday seasons with the calendar', () => {
    const runner = ferry('island-runner');
    const noon = (date: string): Date => new Date(`${date}T16:00:00Z`);
    // 2027: Memorial Day is May 31, Labor Day Sept 6
    expect(getFerryStatus(runner, noon('2027-05-24')).state).toBe('closed');
    expect(getFerryStatus(runner, noon('2027-05-29')).state).toBe('season');
    expect(getFerryStatus(runner, noon('2027-09-06')).state).toBe('season');
    expect(getFerryStatus(runner, noon('2027-09-07')).state).toBe('closed');
  });

  it('starts every route at a Vermont landing', () => {
    for (const f of FERRIES) {
      expect(f.route.length, f.id).toBeGreaterThanOrEqual(2);
      // Lake Champlain's NY shore is west: the first point is the eastern end
      if (f.id !== 'bike-ferry') expect(f.route[0]![0], f.id).toBeGreaterThan(f.route.at(-1)![0]);
    }
  });
});

describe('boat animation', () => {
  const line: [number, number][] = [
    [0, 0],
    [0.01, 0],
    [0.01, 0.01],
  ];

  it('finds points along a line by distance', () => {
    expect(pointAlong(line, 0)).toEqual([0, 0]);
    expect(pointAlong(line, 1)).toEqual([0.01, 0.01]);
    const [x, y] = pointAlong(line, 0.25);
    expect(x).toBeCloseTo(0.005, 3);
    expect(y).toBe(0);
  });

  it('crosses, waits, crosses back', () => {
    const f = { ...ferry('charlotte'), crossingMinutes: 10, route: line };
    const cross = 10 * 500;
    expect(boatPosition(f, 0)).toEqual([0, 0]);
    expect(boatPosition(f, cross + 10)).toEqual([0.01, 0.01]);
    expect(boatPosition(f, cross + DWELL_MS + cross + 10)).toEqual([0, 0]);
    // One full loop later it starts over
    expect(boatPosition(f, 2 * (cross + DWELL_MS))).toEqual([0, 0]);
  });
});
