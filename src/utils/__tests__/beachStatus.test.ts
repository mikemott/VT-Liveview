import { describe, expect, it } from 'vitest';
import { getBeachDisplay, parseBeachTestDate } from '../beachStatus';
import { BEACH_COLORS } from '../beachColors';
import { makeBeach } from '../../__fixtures__/components/data';

const JULY = new Date('2026-07-10T12:00:00');
const OCTOBER = new Date('2026-10-23T12:00:00');

describe('parseBeachTestDate', () => {
  it('parses the feed format "MM/DD/YYYY hh:mm AM/PM"', () => {
    expect(parseBeachTestDate('09/21/2026 11:45 AM')).toEqual(new Date(2026, 8, 21, 11, 45));
    expect(parseBeachTestDate('09/21/2026 1:05 PM')).toEqual(new Date(2026, 8, 21, 13, 5));
    expect(parseBeachTestDate('09/21/2026 12:30 AM')).toEqual(new Date(2026, 8, 21, 0, 30));
  });

  it('parses ISO strings and rejects junk', () => {
    expect(parseBeachTestDate('2026-07-01T12:00:00Z')?.toISOString()).toBe(
      '2026-07-01T12:00:00.000Z',
    );
    expect(parseBeachTestDate('not a date')).toBeNull();
    expect(parseBeachTestDate(null)).toBeNull();
  });
});

describe('getBeachDisplay', () => {
  it('shows a fresh result with its status color', () => {
    const d = getBeachDisplay(makeBeach({ lastTested: '07/08/2026 10:00 AM' }), JULY);
    expect(d).toMatchObject({ state: 'open', label: 'Open', color: BEACH_COLORS.green });
    expect(d.detail).toBe('Tested Jul 8');
  });

  it('keeps closures red while the result is fresh', () => {
    const d = getBeachDisplay(
      makeBeach({ status: 'closed', lastTested: '07/09/2026 9:00 AM' }),
      JULY,
    );
    expect(d).toMatchObject({ state: 'closed', color: BEACH_COLORS.red });
  });

  it('marks beaches with no testing data as not monitored (grey, not advisory yellow)', () => {
    const d = getBeachDisplay(makeBeach({ status: 'unknown', lastTested: null }), JULY);
    expect(d).toMatchObject({ state: 'unmonitored', color: BEACH_COLORS.gray });
  });

  it('calls an old result "Season over" after the testing season', () => {
    const d = getBeachDisplay(makeBeach({ lastTested: '09/21/2026 11:45 AM' }), OCTOBER);
    expect(d).toMatchObject({ state: 'stale', label: 'Season over', color: BEACH_COLORS.gray });
    expect(d.detail).toBe('Last tested Sep 21 (Open)');
  });

  it('calls an old result "No recent test" during the season', () => {
    const d = getBeachDisplay(makeBeach({ lastTested: '06/01/2026 9:00 AM' }), JULY);
    expect(d).toMatchObject({ state: 'stale', label: 'No recent test' });
  });

  it('shows "Unknown status" for a recent test without a status', () => {
    const d = getBeachDisplay(
      makeBeach({ status: 'unknown', lastTested: '07/09/2026 9:00 AM' }),
      JULY,
    );
    expect(d).toMatchObject({ state: 'unknown', color: BEACH_COLORS.gray });
    expect(d.detail).toBe('Last tested Jul 9');
  });

  it('treats an unrecognized upstream status as unknown', () => {
    const d = getBeachDisplay(
      makeBeach({ status: 'flooded' as never, lastTested: '07/09/2026 9:00 AM' }),
      JULY,
    );
    expect(d.state).toBe('unknown');
  });
});
