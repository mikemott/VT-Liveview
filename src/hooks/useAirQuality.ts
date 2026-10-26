/**
 * Air quality for a point (VTL-75). Rounded to ~0.1° so the weather card,
 * which follows the map center, doesn't refetch on every pan.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchAirQuality, type PointAirQuality } from '../services/airQualityApi';

export function useAirQuality(lat: number, lng: number, enabled = true) {
  const rLat = Math.round(lat * 10) / 10;
  const rLng = Math.round(lng * 10) / 10;
  return useQuery<PointAirQuality>({
    queryKey: ['airQuality', rLat, rLng],
    queryFn: () => fetchAirQuality(rLat, rLng),
    enabled,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 20 * 60 * 1000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}
