/**
 * Today's normals and records for the station nearest a point (VTL-81).
 * Rounded to ~0.2° so the weather card, which follows the map center,
 * doesn't refetch on every pan; the backend picks the station. Keyed on the
 * Vermont date, and re-rendered at Vermont midnight, so yesterday's normals
 * are never shown as today's.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchClimateToday, type ClimateDay } from '../services/climateApi';

const TIME_ZONE = 'America/New_York';

export const vermontDate = (now: Date = new Date()): string =>
  now.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });

const HOUR_MS = 3600_000;

/**
 * Milliseconds until the next Vermont midnight. Days around a clock change
 * are 23 or 25 hours long, so the 24-hour guess is moved by the hour until
 * it lands on the first instant of the next date.
 */
export function msUntilVermontMidnight(now: Date = new Date()): number {
  const [h, m, s] = now
    .toLocaleTimeString('en-GB', { timeZone: TIME_ZONE, hour12: false })
    .split(':')
    .map(Number) as [number, number, number];
  const elapsed = ((h % 24) * 3600 + m * 60 + s) * 1000 + now.getMilliseconds();
  const today = vermontDate(now);
  const dateAt = (ms: number): string => vermontDate(new Date(now.getTime() + ms));
  let ms = 24 * HOUR_MS - elapsed;
  // Fall back: still today at the guess
  while (dateAt(ms) === today) ms += HOUR_MS;
  // Spring forward: already tomorrow an hour earlier
  while (ms > HOUR_MS && dateAt(ms - HOUR_MS) !== today) ms -= HOUR_MS;
  return ms;
}

export function useClimateToday(lat: number, lng: number) {
  const [day, setDay] = useState(() => vermontDate());
  useEffect(() => {
    // A second past midnight, so DST days and timer drift land on the new date
    const timer = setTimeout(() => setDay(vermontDate()), msUntilVermontMidnight() + 1000);
    return () => clearTimeout(timer);
  }, [day]);

  const rLat = Math.round(lat * 5) / 5;
  const rLng = Math.round(lng * 5) / 5;
  return useQuery<ClimateDay>({
    queryKey: ['climate', 'today', day, rLat, rLng],
    queryFn: async () => {
      const result = await fetchClimateToday(rLat, rLng, day);
      // Clocks a moment apart at midnight: retry rather than show yesterday as today
      if (result.date !== day) throw new Error('Climate normals are for another day');
      return result;
    },
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
    // Keep the card steady while panning, but never carry a day over
    placeholderData: (previous) => (previous?.date === day ? previous : undefined),
  });
}
