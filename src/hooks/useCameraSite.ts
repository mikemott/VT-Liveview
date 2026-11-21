/**
 * What's known about a traffic camera's site (VTL-94): where it is in words,
 * and the road weather station on the same pole, if there is one.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchCameraLocation, type TrafficCamera } from '../services/cameraApi';
import { fetchRoadWeather, type RoadWeatherStation } from '../services/roadWeatherApi';
import { distanceMiles } from '../utils/geo';

/** A station this close shares the camera's site (most share a pole) */
export const SAME_SITE_MI = 0.3;

export function useCameraLocation(id: string) {
  return useQuery({
    queryKey: ['cameras', 'location', id],
    queryFn: () => fetchCameraLocation(id),
    // Cameras don't move; the backend caches lookups for a week
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

/** The nearest road weather station within SAME_SITE_MI of the camera */
export function nearestSiteStation(
  camera: Pick<TrafficCamera, 'lat' | 'lng'>,
  stations: readonly RoadWeatherStation[],
): RoadWeatherStation | null {
  let best: RoadWeatherStation | null = null;
  let bestMi = SAME_SITE_MI;
  for (const station of stations) {
    const mi = distanceMiles(camera.lat, camera.lng, station.lat, station.lng);
    if (mi <= bestMi) {
      best = station;
      bestMi = mi;
    }
  }
  return best;
}

export function useSiteRoadWeather(camera: TrafficCamera): RoadWeatherStation | null {
  const { data } = useQuery({
    queryKey: ['roadWeather', 'stations'],
    queryFn: fetchRoadWeather,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return data ? nearestSiteStation(camera, data) : null;
}
