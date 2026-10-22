/**
 * Tests for client-side astronomy calculations.
 * Expected sun times are real-world values for Montpelier, VT (±10 min).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  calculateMoonPhase,
  calculateSunTimes,
  calculateStargazingScore,
  getStargazingConditions,
  isNighttime,
  getNextBestNights,
  getPlanetVisibility,
  getTonightSummary,
} from '../astronomy';

const MONTPELIER = { lat: 44.26, lng: -72.58 };
const SYNODIC_MONTH_MS = 29.53058867 * 86400000;
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);
const TEN_MIN = 10 * 60 * 1000;
const TIME_RE = /^\d{1,2}:\d{2}\s?(AM|PM)$/;

function expectNear(actual: Date, expectedIso: string, toleranceMs = TEN_MIN): void {
  expect(Math.abs(actual.getTime() - new Date(expectedIso).getTime())).toBeLessThan(toleranceMs);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('calculateMoonPhase', () => {
  it('is a new moon at the reference epoch', () => {
    const moon = calculateMoonPhase(new Date(REFERENCE_NEW_MOON));
    expect(moon.phase).toBeCloseTo(0, 6);
    expect(moon.illumination).toBe(0);
    expect(moon.phaseName).toBe('New Moon');
    expect(moon.isWaxing).toBe(true);
    expect(moon.daysUntilFull).toBe(15);
  });

  it('is a full moon half a synodic month later', () => {
    const moon = calculateMoonPhase(new Date(REFERENCE_NEW_MOON + SYNODIC_MONTH_MS / 2));
    expect(moon.phase).toBeCloseTo(0.5, 6);
    expect(moon.illumination).toBe(100);
    expect(moon.phaseName).toBe('Full Moon');
    expect(moon.daysUntilNew).toBe(15);
  });

  it.each([
    [0.125, 'Waxing Crescent', true],
    [0.25, 'First Quarter', true],
    [0.375, 'Waxing Gibbous', true],
    [0.625, 'Waning Gibbous', false],
    [0.75, 'Last Quarter', false],
    [0.875, 'Waning Crescent', false],
    [0.97, 'New Moon', false],
  ] as const)('phase %s is %s', (fraction, name, waxing) => {
    const moon = calculateMoonPhase(new Date(REFERENCE_NEW_MOON + SYNODIC_MONTH_MS * fraction));
    expect(moon.phaseName).toBe(name);
    expect(moon.isWaxing).toBe(waxing);
    expect(moon.illumination).toBeGreaterThanOrEqual(0);
    expect(moon.illumination).toBeLessThanOrEqual(100);
  });

  it('counts days until the next full moon after the full moon has passed', () => {
    const moon = calculateMoonPhase(new Date(REFERENCE_NEW_MOON + SYNODIC_MONTH_MS * 0.75));
    expect(moon.daysUntilFull).toBe(Math.round(29.53058867 * 0.75));
  });

  it('handles dates before the reference epoch', () => {
    const moon = calculateMoonPhase(new Date(REFERENCE_NEW_MOON - SYNODIC_MONTH_MS * 10));
    expect(moon.phase).toBeGreaterThanOrEqual(0);
    expect(moon.phase).toBeLessThan(1);
    expect(['New Moon', 'Waning Crescent']).toContain(moon.phaseName);
  });

  it('defaults to now', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(REFERENCE_NEW_MOON);
    expect(calculateMoonPhase().phaseName).toBe('New Moon');
  });
});

describe('calculateSunTimes (astronomy)', () => {
  it('matches the summer solstice in Montpelier', () => {
    const t = calculateSunTimes(MONTPELIER.lat, MONTPELIER.lng, new Date('2026-06-21T16:00:00Z'));
    expectNear(t.sunrise, '2026-06-21T09:06:00Z'); // 05:06 EDT
    expectNear(t.sunset, '2026-06-22T00:40:00Z'); // 20:40 EDT
  });

  it('matches the winter solstice in Montpelier', () => {
    const t = calculateSunTimes(MONTPELIER.lat, MONTPELIER.lng, new Date('2026-12-21T16:00:00Z'));
    expectNear(t.sunrise, '2026-12-21T12:22:00Z'); // 07:22 EST
    expectNear(t.sunset, '2026-12-21T21:14:00Z'); // 16:14 EST
  });

  it('orders sunset < civil < nautical < astronomical twilight', () => {
    const t = calculateSunTimes(MONTPELIER.lat, MONTPELIER.lng, new Date('2026-03-20T16:00:00Z'));
    expect(t.sunset.getTime()).toBeLessThan(t.civilTwilight.getTime());
    expect(t.civilTwilight.getTime()).toBeLessThan(t.nauticalTwilight.getTime());
    expect(t.nauticalTwilight.getTime()).toBeLessThan(t.astronomicalTwilight.getTime());
    expect(t.sunrise.getTime()).toBeLessThan(t.sunset.getTime());
  });

  it('falls back to the input date when the sun never reaches the elevation (polar day)', () => {
    const date = new Date('2026-06-21T12:00:00Z');
    const t = calculateSunTimes(85, 0, date);
    expect(t.sunset).toBe(date);
    expect(t.astronomicalTwilight).toBe(date);
    expect(t.sunrise).toBe(date);
  });
});

describe('calculateStargazingScore', () => {
  it('scores perfect conditions 100 / Excellent', () => {
    expect(calculateStargazingScore(0, 0, 0)).toEqual({ score: 100, rating: 'Excellent' });
  });

  it('scores worst conditions 0 / Poor', () => {
    expect(calculateStargazingScore(100, 100, 100)).toEqual({ score: 0, rating: 'Poor' });
  });

  it('uses 15 humidity points when humidity is unknown', () => {
    expect(calculateStargazingScore(0, 0)).toEqual({ score: 95, rating: 'Excellent' });
  });

  it('assigns the Good and Fair bands', () => {
    // 50*0.5 -> 25 + 30 + 10 = 65
    expect(calculateStargazingScore(50, 0, 50)).toEqual({ score: 65, rating: 'Good' });
    // 70 -> 15 + 15 + 10 = 40
    expect(calculateStargazingScore(70, 50, 50)).toEqual({ score: 40, rating: 'Fair' });
  });

  it('never goes negative for out-of-range inputs', () => {
    expect(calculateStargazingScore(200, 200, 200).score).toBe(0);
  });
});

describe('getStargazingConditions', () => {
  const date = new Date('2026-06-21T16:00:00Z');

  it('combines moon, sun and score data', () => {
    const c = getStargazingConditions(MONTPELIER.lat, MONTPELIER.lng, 20, 40, date);
    const moon = calculateMoonPhase(date);
    expect(c.cloudCoverPercent).toBe(20);
    expect(c.moonPhase).toBe(moon.phase);
    expect(c.moonIllumination).toBe(moon.illumination);
    expect(c.moonPhaseName).toBe(moon.phaseName);
    expect(c.moonRiseTime).toBeNull();
    expect(c.moonSetTime).toBeNull();
    expect(c.qualityScore).toBe(calculateStargazingScore(20, moon.illumination, 40).score);
    expect(c.sunsetTime).toMatch(TIME_RE);
    expect(c.astronomicalTwilight).toMatch(TIME_RE);
    expect(c.bestViewingWindow?.start).toMatch(TIME_RE);
    expect(c.bestViewingWindow?.end).toBe('2:00 AM');
  });

  it('has no viewing window when cloud cover is 50% or more', () => {
    const c = getStargazingConditions(MONTPELIER.lat, MONTPELIER.lng, 50, undefined, date);
    expect(c.bestViewingWindow).toBeNull();
  });
});

describe('isNighttime', () => {
  it('is false at midday', () => {
    expect(isNighttime(MONTPELIER.lat, MONTPELIER.lng, new Date('2026-06-21T16:00:00Z'))).toBe(
      false,
    );
  });

  it('is true after astronomical twilight', () => {
    expect(isNighttime(MONTPELIER.lat, MONTPELIER.lng, new Date('2026-06-21T05:00:00Z'))).toBe(
      true,
    );
  });
});

describe('getNextBestNights', () => {
  it('returns the requested number of dark (<25% illuminated) nights', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
    const nights = getNextBestNights(3);
    expect(nights).toHaveLength(3);
    nights.forEach((n) => {
      expect(calculateMoonPhase(n).illumination).toBeLessThan(25);
      expect(n.getTime()).toBeGreaterThanOrEqual(Date.now());
    });
    // consecutive, increasing
    expect(nights[1]!.getTime()).toBeGreaterThan(nights[0]!.getTime());
  });

  it('defaults to 5 nights', () => {
    expect(getNextBestNights()).toHaveLength(5);
  });
});

describe('getPlanetVisibility', () => {
  const names = (d: Date) => getPlanetVisibility(d).map((p) => p.name);

  it('includes Venus and Mercury only in their seasons', () => {
    expect(names(new Date(2026, 2, 15))).toEqual(['Venus', 'Mars', 'Jupiter', 'Saturn', 'Mercury']);
    expect(names(new Date(2026, 6, 15))).toEqual(['Mars', 'Jupiter', 'Saturn']);
    expect(names(new Date(2026, 9, 15))).toContain('Mercury');
  });

  it('switches morning/evening by month', () => {
    const jan = Object.fromEntries(
      getPlanetVisibility(new Date(2026, 0, 15)).map((p) => [p.name, p]),
    );
    expect(jan.Venus?.visibilityPeriod).toBe('morning');
    expect(jan.Mars?.visibilityPeriod).toBe('morning');
    expect(jan.Jupiter?.visibilityPeriod).toBe('morning');
    expect(jan.Saturn?.visibilityPeriod).toBe('morning');

    const oct = Object.fromEntries(
      getPlanetVisibility(new Date(2026, 9, 15)).map((p) => [p.name, p]),
    );
    expect(oct.Venus?.visibilityPeriod).toBe('evening');
    expect(oct.Mars?.visibilityPeriod).toBe('evening');
    expect(oct.Saturn?.visibilityPeriod).toBe('evening');
    expect(oct.Mercury?.visibilityPeriod).toBe('morning');
  });
});

describe('getTonightSummary', () => {
  const newMoon = new Date(REFERENCE_NEW_MOON + SYNODIC_MONTH_MS * 300);
  const fullMoon = new Date(REFERENCE_NEW_MOON + SYNODIC_MONTH_MS * 300.5);

  it('recommends stargazing on a clear, moonless night', () => {
    const s = getTonightSummary(MONTPELIER.lat, MONTPELIER.lng, 0, newMoon);
    expect(s.quality.rating).toBe('Excellent');
    expect(s.recommendation).toMatch(/^Perfect night/);
    expect(s.visiblePlanets.length).toBeGreaterThan(0);
    expect(s.sunTimes.sunrise).toBeInstanceOf(Date);
  });

  it('gives a Good recommendation under a moderately bright sky', () => {
    const quarter = new Date(REFERENCE_NEW_MOON + SYNODIC_MONTH_MS * 300.25);
    const s = getTonightSummary(MONTPELIER.lat, MONTPELIER.lng, 20, quarter);
    expect(s.quality.rating).toBe('Good');
    expect(s.recommendation).toMatch(/^Good conditions/);
  });

  it('warns about a bright full moon', () => {
    // 40% cloud -> 30 + 0 (full moon) + 15 (default humidity) = 45
    const s = getTonightSummary(MONTPELIER.lat, MONTPELIER.lng, 40, fullMoon);
    expect(s.quality.rating).toBe('Fair');
    expect(s.recommendation).toMatch(/^Partial clouds or bright moon/);
    expect(s.recommendation).toContain('The bright moon will wash out fainter objects.');
  });

  it('discourages stargazing under full cloud', () => {
    const s = getTonightSummary(MONTPELIER.lat, MONTPELIER.lng, 100, fullMoon);
    expect(s.quality.rating).toBe('Poor');
    expect(s.recommendation).toMatch(/^Not ideal/);
  });

  it('defaults cloud cover to 20%', () => {
    const s = getTonightSummary(MONTPELIER.lat, MONTPELIER.lng, undefined, newMoon);
    expect(s.quality).toEqual(calculateStargazingScore(20, s.moonPhase.illumination));
  });
});
