/**
 * Astronomy Utilities
 * Moon phase, twilight, and stargazing quality calculations
 * All calculations done client-side without external APIs
 */

import type { StargazingConditions } from '../types/stargazing';

// Moon phase names
const MOON_PHASES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
] as const;

export type MoonPhaseName = typeof MOON_PHASES[number];

export interface MoonPhaseInfo {
  phase: number;           // 0-1 (0=new, 0.5=full, 1=new)
  illumination: number;    // 0-100%
  phaseName: MoonPhaseName;
  isWaxing: boolean;
  daysUntilNew: number;
  daysUntilFull: number;
}

/**
 * Calculate moon phase for a given date
 * Uses a simplified algorithm based on the synodic month
 * Accurate to within a day or so
 */
export function calculateMoonPhase(date: Date = new Date()): MoonPhaseInfo {
  // Reference new moon: January 6, 2000 at 18:14 UTC
  const referenceNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const synodicMonth = 29.53058867; // days

  // Calculate days since reference new moon
  const daysSinceReference = (date.getTime() - referenceNewMoon.getTime()) / (1000 * 60 * 60 * 24);

  // Calculate current position in lunar cycle (0-1)
  const lunarCycles = daysSinceReference / synodicMonth;
  const phase = lunarCycles - Math.floor(lunarCycles);

  // Calculate illumination percentage (0 at new moon, 100 at full moon)
  // Uses cosine function for smooth transition
  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) * 50);

  // Determine phase name (8 phases)
  const phaseIndex = Math.floor((phase + 0.0625) * 8) % 8;
  const phaseName = MOON_PHASES[phaseIndex] ?? 'New Moon';

  // Is moon waxing (getting brighter)?
  const isWaxing = phase < 0.5;

  // Days until next new moon
  const daysUntilNew = Math.round(synodicMonth * (1 - phase));

  // Days until next full moon
  const daysUntilFull = phase < 0.5
    ? Math.round(synodicMonth * (0.5 - phase))
    : Math.round(synodicMonth * (1.5 - phase));

  return {
    phase,
    illumination,
    phaseName,
    isWaxing,
    daysUntilNew: Math.max(0, daysUntilNew),
    daysUntilFull: Math.max(0, daysUntilFull),
  };
}

/**
 * Calculate sun times for a given location and date
 * Returns sunset, civil twilight, nautical twilight, and astronomical twilight
 */
export function calculateSunTimes(lat: number, lng: number, date: Date = new Date()): {
  sunset: Date;
  civilTwilight: Date;
  nauticalTwilight: Date;
  astronomicalTwilight: Date;
  sunrise: Date;
} {
  // Julian date calculation
  const jd = getJulianDate(date);

  // Calculate times for different sun elevations
  const sunset = calculateSunEvent(lat, lng, jd, -0.833);           // Sun just below horizon
  const civilTwilight = calculateSunEvent(lat, lng, jd, -6);        // -6 degrees
  const nauticalTwilight = calculateSunEvent(lat, lng, jd, -12);    // -12 degrees
  const astronomicalTwilight = calculateSunEvent(lat, lng, jd, -18); // -18 degrees (true darkness)
  const sunrise = calculateSunrise(lat, lng, jd);

  return {
    sunset: sunset || date,
    civilTwilight: civilTwilight || date,
    nauticalTwilight: nauticalTwilight || date,
    astronomicalTwilight: astronomicalTwilight || date,
    sunrise: sunrise || date,
  };
}

// Helper: Convert date to Julian date
function getJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

// Helper: Calculate sun event time for a given elevation angle
function calculateSunEvent(lat: number, lng: number, jd: number, elevation: number): Date | null {
  const n = Math.floor(jd - 2451545 + 0.0008);
  const Jstar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const C = 1.9148 * Math.sin(M * Math.PI / 180) +
            0.02 * Math.sin(2 * M * Math.PI / 180) +
            0.0003 * Math.sin(3 * M * Math.PI / 180);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const Jtransit = 2451545 + Jstar + 0.0053 * Math.sin(M * Math.PI / 180) -
                   0.0069 * Math.sin(2 * lambda * Math.PI / 180);
  const delta = Math.asin(Math.sin(lambda * Math.PI / 180) * Math.sin(23.44 * Math.PI / 180));

  const cosOmega = (Math.sin(elevation * Math.PI / 180) - Math.sin(lat * Math.PI / 180) * Math.sin(delta)) /
                   (Math.cos(lat * Math.PI / 180) * Math.cos(delta));

  if (cosOmega < -1 || cosOmega > 1) return null; // Sun doesn't reach this elevation

  const omega = Math.acos(cosOmega) * 180 / Math.PI;
  const Jset = Jtransit + omega / 360;

  return new Date((Jset - 2440587.5) * 86400000);
}

// Helper: Calculate sunrise
function calculateSunrise(lat: number, lng: number, jd: number): Date | null {
  const n = Math.floor(jd - 2451545 + 0.0008);
  const Jstar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const C = 1.9148 * Math.sin(M * Math.PI / 180) +
            0.02 * Math.sin(2 * M * Math.PI / 180) +
            0.0003 * Math.sin(3 * M * Math.PI / 180);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const Jtransit = 2451545 + Jstar + 0.0053 * Math.sin(M * Math.PI / 180) -
                   0.0069 * Math.sin(2 * lambda * Math.PI / 180);
  const delta = Math.asin(Math.sin(lambda * Math.PI / 180) * Math.sin(23.44 * Math.PI / 180));

  const cosOmega = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(lat * Math.PI / 180) * Math.sin(delta)) /
                   (Math.cos(lat * Math.PI / 180) * Math.cos(delta));

  if (cosOmega < -1 || cosOmega > 1) return null;

  const omega = Math.acos(cosOmega) * 180 / Math.PI;
  const Jrise = Jtransit - omega / 360;

  return new Date((Jrise - 2440587.5) * 86400000);
}

/**
 * Calculate stargazing quality score
 * Takes into account cloud cover, moon phase, and humidity
 * Returns a score from 0-100
 */
export function calculateStargazingScore(
  cloudCoverPercent: number,
  moonIllumination: number,
  humidity?: number
): { score: number; rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' } {
  // Cloud cover is the most important factor (0-50 points)
  // 0% clouds = 50 points, 100% clouds = 0 points
  const cloudScore = Math.max(0, 50 - cloudCoverPercent * 0.5);

  // Moon illumination (0-30 points)
  // New moon = 30 points, full moon = 0 points
  const moonScore = Math.max(0, 30 - moonIllumination * 0.3);

  // Humidity factor (0-20 points)
  // Lower humidity = clearer atmosphere
  // 0% humidity = 20 points, 100% humidity = 0 points
  const humidityScore = humidity !== undefined
    ? Math.max(0, 20 - humidity * 0.2)
    : 15; // Default to "average" if not provided

  const score = Math.round(cloudScore + moonScore + humidityScore);

  // Determine rating
  let rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  if (score >= 80) {
    rating = 'Excellent';
  } else if (score >= 60) {
    rating = 'Good';
  } else if (score >= 40) {
    rating = 'Fair';
  } else {
    rating = 'Poor';
  }

  return { score, rating };
}

/**
 * Get full stargazing conditions for a location
 */
export function getStargazingConditions(
  lat: number,
  lng: number,
  cloudCoverPercent: number,
  humidity?: number,
  date: Date = new Date()
): StargazingConditions {
  const moonPhase = calculateMoonPhase(date);
  const sunTimes = calculateSunTimes(lat, lng, date);
  const { score, rating } = calculateStargazingScore(
    cloudCoverPercent,
    moonPhase.illumination,
    humidity
  );

  // Calculate best viewing window
  // Start: astronomical twilight
  // End: either astronomical dawn or when moon rises (if bright)
  const astroTwilightTime = sunTimes.astronomicalTwilight;

  // For now, assume viewing ends at 2am or moonrise (whichever is earlier)
  // In a full implementation, we'd calculate moonrise/moonset
  const viewingEnd = new Date(astroTwilightTime);
  viewingEnd.setHours(2, 0, 0, 0);
  if (viewingEnd < astroTwilightTime) {
    viewingEnd.setDate(viewingEnd.getDate() + 1);
  }

  const bestViewingWindow = cloudCoverPercent < 50
    ? {
        start: formatTime(astroTwilightTime),
        end: formatTime(viewingEnd),
      }
    : null;

  return {
    cloudCoverPercent,
    moonPhase: moonPhase.phase,
    moonIllumination: moonPhase.illumination,
    moonPhaseName: moonPhase.phaseName,
    moonRiseTime: null, // Would need more complex calculation
    moonSetTime: null,
    astronomicalTwilight: formatTime(sunTimes.astronomicalTwilight),
    sunsetTime: formatTime(sunTimes.sunset),
    qualityScore: score,
    qualityRating: rating,
    bestViewingWindow,
  };
}

// Helper: Format time to HH:MM
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Check if it's currently nighttime (after astronomical twilight)
 */
export function isNighttime(lat: number, lng: number, date: Date = new Date()): boolean {
  const sunTimes = calculateSunTimes(lat, lng, date);
  const now = date.getTime();
  const astroTwilight = sunTimes.astronomicalTwilight.getTime();
  const sunrise = sunTimes.sunrise.getTime();

  // It's night if we're after astronomical twilight and before sunrise
  return now > astroTwilight || now < sunrise;
}

/**
 * Get the next best stargazing night based on moon phase
 * Returns dates with new moon +/- 5 days (best for faint objects)
 */
export function getNextBestNights(count: number = 5): Date[] {
  const nights: Date[] = [];
  const now = new Date();
  const moonPhase = calculateMoonPhase(now);

  // Calculate days until next new moon
  let daysToCheck = moonPhase.daysUntilNew;

  // Start checking from 5 days before new moon
  const startDay = Math.max(0, daysToCheck - 5);

  for (let i = startDay; nights.length < count && i < startDay + 30; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + i);

    const phase = calculateMoonPhase(checkDate);

    // Include nights with less than 25% illumination
    if (phase.illumination < 25) {
      nights.push(checkDate);
    }
  }

  return nights;
}

/**
 * Simplified planet visibility data
 * In production, this would use proper ephemeris calculations
 * For now, we provide approximate seasonal visibility
 */
export interface PlanetInfo {
  name: string;
  isVisible: boolean;
  visibilityPeriod: 'evening' | 'morning' | 'all-night' | 'not-visible';
  magnitude: number;
  description: string;
}

/**
 * Get approximate planet visibility for tonight
 * This is a simplified approximation based on typical seasonal patterns
 * Real implementation would use orbital mechanics calculations
 */
export function getPlanetVisibility(date: Date = new Date()): PlanetInfo[] {
  const month = date.getMonth() + 1; // 1-12

  // Simplified seasonal visibility patterns
  // These are approximations and won't be accurate for specific dates
  const planets: PlanetInfo[] = [
    {
      name: 'Venus',
      isVisible: month >= 1 && month <= 5 || month >= 9 && month <= 12,
      visibilityPeriod: month <= 5 ? 'morning' : 'evening',
      magnitude: -4.0,
      description: 'Brightest planet, impossible to miss when visible'
    },
    {
      name: 'Mars',
      isVisible: true, // Mars is usually visible somewhere in the sky
      visibilityPeriod: month >= 6 && month <= 12 ? 'evening' : 'morning',
      magnitude: 0.5,
      description: 'Reddish color, brightness varies with distance from Earth'
    },
    {
      name: 'Jupiter',
      isVisible: true, // Jupiter is usually visible
      visibilityPeriod: month >= 3 && month <= 9 ? 'evening' : 'morning',
      magnitude: -2.5,
      description: 'Second brightest planet, steady white light'
    },
    {
      name: 'Saturn',
      isVisible: true,
      visibilityPeriod: month >= 5 && month <= 11 ? 'evening' : 'morning',
      magnitude: 0.5,
      description: 'Yellowish color, rings visible through small telescope'
    },
    {
      name: 'Mercury',
      isVisible: month === 3 || month === 4 || month === 9 || month === 10,
      visibilityPeriod: month <= 6 ? 'evening' : 'morning',
      magnitude: 0.0,
      description: 'Difficult to spot, low on horizon just after sunset or before sunrise'
    }
  ];

  return planets.filter(p => p.isVisible);
}

/**
 * Get a summary of what's visible tonight
 */
export function getTonightSummary(
  lat: number,
  lng: number,
  cloudCoverPercent: number = 20,
  date: Date = new Date()
): {
  moonPhase: MoonPhaseInfo;
  quality: { score: number; rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' };
  sunTimes: ReturnType<typeof calculateSunTimes>;
  visiblePlanets: PlanetInfo[];
  recommendation: string;
} {
  const moonPhase = calculateMoonPhase(date);
  const quality = calculateStargazingScore(cloudCoverPercent, moonPhase.illumination);
  const sunTimes = calculateSunTimes(lat, lng, date);
  const visiblePlanets = getPlanetVisibility(date);

  // Generate recommendation
  let recommendation: string;
  if (quality.rating === 'Excellent') {
    recommendation = 'Perfect night for stargazing! Dark moon and clear skies expected.';
  } else if (quality.rating === 'Good') {
    recommendation = 'Good conditions for observing bright objects and planets.';
  } else if (quality.rating === 'Fair') {
    recommendation = 'Partial clouds or bright moon may limit deep-sky viewing.';
  } else {
    recommendation = 'Not ideal for stargazing. Consider waiting for better conditions.';
  }

  if (moonPhase.illumination > 75) {
    recommendation += ' The bright moon will wash out fainter objects.';
  }

  return {
    moonPhase,
    quality,
    sunTimes,
    visiblePlanets,
    recommendation
  };
}
