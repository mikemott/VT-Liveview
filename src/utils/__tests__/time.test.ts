/**
 * Tests for sunrise/sunset and daytime detection.
 * Expected values are real-world Montpelier, VT times (±10 min).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateSunTimes, isCurrentlyDaytime } from '../time';

const LAT = 44.26;
const LNG = -72.58;
const TEN_MIN = 10 * 60 * 1000;

function expectNear(actual: Date, expectedIso: string): void {
  expect(Math.abs(actual.getTime() - new Date(expectedIso).getTime())).toBeLessThan(TEN_MIN);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('calculateSunTimes (time)', () => {
  it('matches the summer solstice', () => {
    const { sunrise, sunset } = calculateSunTimes(LAT, LNG, new Date('2026-06-21T16:00:00Z'));
    expectNear(sunrise, '2026-06-21T09:06:00Z');
    expectNear(sunset, '2026-06-22T00:40:00Z');
  });

  it('matches the winter solstice', () => {
    const { sunrise, sunset } = calculateSunTimes(LAT, LNG, new Date('2026-12-21T16:00:00Z'));
    expectNear(sunrise, '2026-12-21T12:22:00Z');
    expectNear(sunset, '2026-12-21T21:14:00Z');
  });

  it('has longer days in summer than winter', () => {
    const summer = calculateSunTimes(LAT, LNG, new Date('2026-06-21T16:00:00Z'));
    const winter = calculateSunTimes(LAT, LNG, new Date('2026-12-21T16:00:00Z'));
    const len = (t: { sunrise: Date; sunset: Date }) => t.sunset.getTime() - t.sunrise.getTime();
    expect(len(summer)).toBeGreaterThan(len(winter));
  });

  it('clamps polar night to a zero-length day instead of NaN', () => {
    const { sunrise, sunset } = calculateSunTimes(85, 0, new Date('2026-12-21T12:00:00Z'));
    expect(Number.isNaN(sunrise.getTime())).toBe(false);
    expect(sunrise.getTime()).toBe(sunset.getTime());
  });

  it('defaults to today', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-21T16:00:00Z'));
    const { sunrise } = calculateSunTimes(LAT, LNG);
    expectNear(sunrise, '2026-06-21T09:06:00Z');
  });
});

describe('isCurrentlyDaytime', () => {
  it('is true at local noon', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-21T16:00:00Z'));
    expect(isCurrentlyDaytime(LAT, LNG)).toBe(true);
  });

  it('is false before sunrise', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-21T08:00:00Z')); // 04:00 EDT
    expect(isCurrentlyDaytime(LAT, LNG)).toBe(false);
  });
});
