/**
 * Time Utilities
 * Solar calculations and daytime detection
 */

import type { SunTimes } from '@/types';

/**
 * Calculate sunrise and sunset times for a given location
 * Uses NOAA solar calculator algorithm
 * @param lat - Latitude in degrees
 * @param lng - Longitude in degrees
 * @param date - Date to calculate for (defaults to today)
 * @returns Object with sunrise and sunset Date objects
 */
export function calculateSunTimes(
  lat: number,
  lng: number,
  date: Date = new Date()
): SunTimes {
  // Get the day of year
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  // Convert latitude to radians
  const latRad = (lat * Math.PI) / 180;

  // Calculate solar declination (simplified formula)
  const declination =
    ((-23.45 * Math.cos(((360 / 365) * (dayOfYear + 10) * Math.PI) / 180)) *
      Math.PI) /
    180;

  // Calculate hour angle for sunrise/sunset
  // -0.833 degrees accounts for atmospheric refraction and solar disc size
  const cosHourAngle =
    (Math.sin((-0.833 * Math.PI) / 180) -
      Math.sin(latRad) * Math.sin(declination)) /
    (Math.cos(latRad) * Math.cos(declination));

  // Clamp to valid range (handles polar day/night)
  const clampedCos = Math.max(-1, Math.min(1, cosHourAngle));
  const hourAngle = (Math.acos(clampedCos) * 180) / Math.PI; // in degrees

  // Convert hour angle to hours (15 degrees per hour)
  const hourAngleHours = hourAngle / 15;

  // Solar noon in hours (12:00 adjusted for longitude within timezone)
  // Use actual timezone offset to handle DST automatically
  const timezoneOffsetHours = date.getTimezoneOffset() / 60; // negative for west of UTC
  const standardMeridian = -15 * timezoneOffsetHours; // meridian for current timezone
  const longitudeCorrection = (lng - standardMeridian) / 15; // in hours
  const solarNoon = 12 - longitudeCorrection;

  // Calculate sunrise and sunset in local hours
  const sunriseHours = solarNoon - hourAngleHours;
  const sunsetHours = solarNoon + hourAngleHours;

  // Convert to Date objects (using local date)
  const baseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const sunrise = new Date(baseDate.getTime() + sunriseHours * 60 * 60 * 1000);
  const sunset = new Date(baseDate.getTime() + sunsetHours * 60 * 60 * 1000);

  return { sunrise, sunset };
}

/**
 * Check if it's currently daytime at a given location
 * @param lat - Latitude in degrees
 * @param lng - Longitude in degrees
 * @returns True if current time is between sunrise and sunset
 */
export function isCurrentlyDaytime(lat: number, lng: number): boolean {
  const now = new Date();
  const { sunrise, sunset } = calculateSunTimes(lat, lng, now);
  return now >= sunrise && now <= sunset;
}
