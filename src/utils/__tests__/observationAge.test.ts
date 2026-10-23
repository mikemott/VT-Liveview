import { describe, expect, it } from 'vitest';
import { getObservationAge, STALE_OBSERVATION_MINUTES } from '../observationAge';

const NOW = new Date('2026-10-23T14:00:00');

describe('getObservationAge', () => {
  it('treats a recent reading as fresh', () => {
    const age = getObservationAge(new Date('2026-10-23T13:35:00').toISOString(), NOW);
    expect(age).toMatchObject({ minutes: 25, isStale: false, ago: '25 min ago' });
    expect(age.asOf).toBe('as of 1:35 PM');
  });

  it(`flags readings older than ${STALE_OBSERVATION_MINUTES} minutes`, () => {
    const age = getObservationAge(new Date('2026-10-23T09:35:00').toISOString(), NOW);
    expect(age).toMatchObject({ isStale: true, ago: '4 hr ago' });
  });

  it('includes the date for readings from an earlier day', () => {
    const age = getObservationAge(new Date('2026-10-20T21:05:00').toISOString(), NOW);
    expect(age.asOf).toBe('as of Oct 20, 9:05 PM');
    expect(age.ago).toBe('2 days ago');
  });

  it('handles missing or invalid timestamps', () => {
    expect(getObservationAge(null, NOW)).toEqual({
      minutes: null,
      isStale: false,
      asOf: null,
      ago: null,
    });
    expect(getObservationAge('garbage', NOW).minutes).toBeNull();
  });
});
