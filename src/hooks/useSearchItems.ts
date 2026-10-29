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
import type { AirQualityMonitor } from '../services/airQualityApi';
import type { RiverGauge } from '../services/riverApi';
import type { EvCharger } from '../services/evChargerApi';
import type { FireDangerArea } from '../services/fireDangerApi';
import { SEASONAL_ROADS } from '../data/seasonalRoads';
import { FERRIES } from '../data/ferries';
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
// Ferries are static too (VTL-81)
const FERRY_ITEMS: SearchItem[] = FERRIES.map((ferry) => {
  const lngs = ferry.route.map((p) => p[0]);
  const lats = ferry.route.map((p) => p[1]);
  const [lng, lat] = ferry.route[0]!;
  return {
    id: `ferry:${ferry.id}`,
    kind: 'ferry',
    name: ferry.name,
    detail: ferry.between,
    keywords: 'ferry boat crossing lake champlain',
    lat,
    lng,
    bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
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
  airMonitors: readonly AirQualityMonitor[] = [],
  riverGauges: readonly RiverGauge[] = [],
  evChargers: readonly EvCharger[] = [],
  fireAreas: readonly FireDangerArea[] = [],
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
    for (const m of airMonitors) {
      out.push({
        id: `aq:${m.id}`,
        kind: 'airQuality',
        name: m.name,
        ...(m.agency ? { detail: m.agency } : {}),
        keywords: 'air quality aqi smoke ozone pm2.5',
        lat: m.lat,
        lng: m.lng,
      });
    }
    for (const g of riverGauges) {
      out.push({
        id: `river:${g.id}`,
        kind: 'river',
        name: g.name,
        keywords: 'river lake gauge level flood stage flow',
        lat: g.lat,
        lng: g.lng,
      });
    }
    for (const s of evChargers) {
      out.push({
        id: `ev:${s.id}`,
        kind: 'evCharger',
        name: s.name,
        ...(s.city ? { detail: s.city } : {}),
        keywords: `ev electric car charger charging station ${s.dcFastPorts > 0 ? 'dc fast' : 'level 2'} ${s.network ?? ''}`,
        lat: s.lat,
        lng: s.lng,
      });
    }
    for (const a of fireAreas) {
      out.push({
        id: `fire:${a.id}`,
        kind: 'fireDanger',
        name: `Fire danger: ${a.name}`,
        detail: a.description,
        keywords: 'fire danger burn permit wildfire',
        lat: a.labelLat,
        lng: a.labelLng,
      });
    }
    out.push(...ROAD_ITEMS, ...FERRY_ITEMS);
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
    airMonitors,
    riverGauges,
    evChargers,
    fireAreas,
  ]);

  const loading =
    enabled && [ski, beaches, creemee, recreation, incidents].some((q) => q.isLoading);
  return { items, loading };
}
