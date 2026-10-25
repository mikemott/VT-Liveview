import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { VT_COUNTIES, VT_TOWNS } from '../data/vtTowns';
import { fetchSkiResorts } from '../services/skiApi';
import { fetchBeaches } from '../services/beachApi';
import { fetchCreemeeStands } from '../services/creemeeApi';
import { fetchRecreationSites } from '../services/recreationApi';
import { fetchAllIncidents } from '../services/travelApi';
import type { SearchItem } from '../utils/search';
import type { ObservationStation } from '../types';
import type { TrafficCamera } from '../services/cameraApi';
import type { RoadWeatherStation } from '../services/roadWeatherApi';
import { SEASONAL_ROADS } from '../data/seasonalRoads';
import { roadBounds, roadCenter } from '../utils/seasonalRoads';

/** Towns never change at runtime; build once. */
const TOWN_ITEMS: SearchItem[] = VT_TOWNS.map(([name, county, lat, lng, w, s, e, n]) => ({
  id: `town:${name}`,
  kind: 'town',
  name,
  detail: `${VT_COUNTIES[county]} County`,
  lat,
  lng,
  bounds: [w, s, e, n],
}));

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

// Seasonal notch/gap/toll roads (VTL-55): static, like towns
const ROAD_ITEMS: SearchItem[] = SEASONAL_ROADS.map((road) => {
  const [lng, lat] = roadCenter(road);
  return {
    id: `road:${road.id}`,
    kind: 'road',
    name: road.name,
    detail: road.between,
    keywords: 'seasonal winter closure closed road notch gap',
    lat,
    lng,
    bounds: roadBounds(road),
  };
});
/**
 * Everything the search box can find. Towns are always available; the rest
 * are fetched only once `enabled` (first focus of the search box), and a
 * source that fails just contributes nothing.
 */
export function useSearchItems(
  enabled: boolean,
  stations: readonly ObservationStation[],
  cameras: readonly TrafficCamera[] = [],
  roadWeather: readonly RoadWeatherStation[] = [],
): { items: SearchItem[]; loading: boolean } {
  const opts = { enabled, staleTime: 10 * 60 * 1000, retry: 1 } as const;
  const [ski, beaches, creemee, recreation, incidents] = useQueries({
    queries: [
      { queryKey: ['search', 'ski'], queryFn: fetchSkiResorts, ...opts },
      { queryKey: ['search', 'beaches'], queryFn: fetchBeaches, ...opts },
      { queryKey: ['search', 'creemee'], queryFn: fetchCreemeeStands, ...opts },
      { queryKey: ['search', 'recreation'], queryFn: fetchRecreationSites, ...opts },
      // Shorter staleTime: incidents change through the day
      {
        queryKey: ['search', 'incidents'],
        queryFn: fetchAllIncidents,
        ...opts,
        staleTime: 120_000,
      },
    ],
  });

  const items = useMemo((): SearchItem[] => {
    const out: SearchItem[] = [...TOWN_ITEMS];
    for (const r of ski.data ?? []) {
      if (isNum(r.latitude) && isNum(r.longitude))
        out.push({
          id: `ski:${r.id}`,
          kind: 'ski',
          name: r.name,
          lat: r.latitude,
          lng: r.longitude,
        });
    }
    for (const b of beaches.data ?? []) {
      if (isNum(b.latitude) && isNum(b.longitude))
        out.push({
          id: `beach:${b.id}`,
          kind: 'beach',
          name: b.name,
          detail: b.town,
          lat: b.latitude,
          lng: b.longitude,
        });
    }
    for (const c of creemee.data ?? []) {
      if (isNum(c.latitude) && isNum(c.longitude))
        out.push({
          id: `creemee:${c.id}`,
          kind: 'creemee',
          name: c.name,
          detail: c.town,
          lat: c.latitude,
          lng: c.longitude,
        });
    }
    for (const site of recreation.data ?? []) {
      if (site.type === 'beach' || !isNum(site.latitude) || !isNum(site.longitude)) continue;
      out.push({
        id: `campground:${site.id}`,
        kind: 'campground',
        name: site.name,
        ...(site.town ? { detail: site.town } : {}),
        lat: site.latitude,
        lng: site.longitude,
      });
    }
    for (const s of stations) {
      out.push({
        id: `station:${s.id}`,
        kind: 'station',
        name: s.name,
        lat: s.location.lat,
        lng: s.location.lng,
      });
    }
    for (const c of cameras) {
      out.push({
        id: `camera:${c.id}`,
        kind: 'camera',
        name: c.name,
        ...(c.roadway ? { detail: c.roadway, keywords: c.roadway } : {}),
        lat: c.lat,
        lng: c.lng,
      });
    }
    for (const r of roadWeather) {
      const detail = r.location ?? r.roadway;
      out.push({
        id: `roadwx:${r.id}`,
        kind: 'roadWeather',
        name: r.name,
        ...(detail ? { detail } : {}),
        keywords: `road weather pavement ${r.roadway ?? ''}`,
        lat: r.lat,
        lng: r.lng,
      });
    }
    out.push(...ROAD_ITEMS);
    for (const inc of incidents.data ?? []) {
      const { lat, lng } = inc.location;
      if (!isNum(lat) || !isNum(lng) || (lat === 0 && lng === 0)) continue;
      out.push({
        id: `incident:${inc.id}`,
        kind: 'incident',
        layer: inc.type,
        name: inc.title,
        ...(inc.roadName ? { detail: inc.roadName, keywords: inc.roadName } : {}),
        lat,
        lng,
      });
    }
    return out;
  }, [
    ski.data,
    beaches.data,
    creemee.data,
    recreation.data,
    incidents.data,
    stations,
    cameras,
    roadWeather,
  ]);

  const loading =
    enabled && [ski, beaches, creemee, recreation, incidents].some((q) => q.isLoading);
  return { items, loading };
}
