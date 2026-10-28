/**
 * Today's normals and records for the station nearest a point (VTL-81).
 * Rounded to ~0.2° so the weather card, which follows the map center,
 * doesn't refetch on every pan; the backend picks the station.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchClimateToday, type ClimateDay } from '../services/climateApi';

export function useClimateToday(lat: number, lng: number) {
  const rLat = Math.round(lat * 5) / 5;
  const rLng = Math.round(lng * 5) / 5;
  return useQuery<ClimateDay>({
    queryKey: ['climate', 'today', rLat, rLng],
    queryFn: () => fetchClimateToday(rLat, rLng),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}
