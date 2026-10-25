/**
 * Seasonally closed notch, gap and toll roads (VTL-55).
 *
 * Closed roads draw as a bold dashed red line, roads closing within three
 * weeks as dashed amber, and open seasonal roads as a faint grey dotted line
 * so people learn where they are before winter. A 511 closure on the road
 * overrides the calendar.
 */
import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { useVisibleInterval } from '../hooks/useVisibleInterval';
import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import { SEASONAL_ROADS, type SeasonalRoad } from '../data/seasonalRoads';
import {
  buildSeasonalRoadsGeoJSON,
  getSeasonalStatuses,
  vermontDateKey,
  SEASONAL_STATUS_COLORS,
  type ClosurePoint,
  type RoadStatus,
} from '../utils/seasonalRoads';
import type { MapLibreMap } from '../types';

export const SEASONAL_SOURCE_ID = 'seasonal-roads';
const CASING_ID = 'seasonal-roads-casing';
const CLOSED_ID = 'seasonal-roads-closed';
const OPEN_ID = 'seasonal-roads-open';
/** Wide transparent line so the thin roads are easy to tap */
const HIT_ID = 'seasonal-roads-hit';
const LAYER_IDS = [CASING_ID, OPEN_ID, CLOSED_ID, HIT_ID] as const;

/** How often to check whether the Vermont date has changed */
const DAY_CHECK_MS = 10 * 60 * 1000;

const CLOSED_STATUSES = ['closed511', 'seasonal', 'closingSoon'];

interface SeasonalRoadsLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  isDark: boolean;
  mapStyleVersion: number;
  /** Current 511 closure locations, for the override */
  closures: readonly ClosurePoint[];
  onRoadClick: (road: SeasonalRoad, status: RoadStatus) => void;
  /** For tests */
  now?: Date;
}

const colorExpression: ExpressionSpecification = [
  'match',
  ['get', 'status'],
  'closed511',
  SEASONAL_STATUS_COLORS.closed511,
  'seasonal',
  SEASONAL_STATUS_COLORS.seasonal,
  'closingSoon',
  SEASONAL_STATUS_COLORS.closingSoon,
  SEASONAL_STATUS_COLORS.open,
];

function SeasonalRoadsLayer({
  map,
  visible,
  isDark,
  mapStyleVersion,
  closures,
  onRoadClick,
  now,
}: SeasonalRoadsLayerProps) {
  // Re-evaluate when the Vermont date changes (a tab left open overnight)
  const [dayKey, setDayKey] = useState(() => vermontDateKey(new Date()));
  useVisibleInterval(() => setDayKey(vermontDateKey(new Date())), DAY_CHECK_MS);
  const statuses = useMemo(
    () => getSeasonalStatuses(closures, now ?? new Date()),
    // dayKey: recompute at the day boundary even if closures are unchanged
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [closures, now, dayKey],
  );
  const geojson = useMemo(() => buildSeasonalRoadsGeoJSON(SEASONAL_ROADS, statuses), [statuses]);

  // Latest values for the click handler without re-adding layers
  const latest = useRef({ statuses, onRoadClick });
  useEffect(() => {
    latest.current = { statuses, onRoadClick };
  }, [statuses, onRoadClick]);
  const dataRef = useRef(geojson);
  useEffect(() => {
    dataRef.current = geojson;
  }, [geojson]);

  // Add source + layers while visible; re-add after a style swap
  useEffect(() => {
    if (!map || !visible) return;

    map.addSource(SEASONAL_SOURCE_ID, { type: 'geojson', data: dataRef.current });
    map.addLayer({
      id: CASING_ID,
      type: 'line',
      source: SEASONAL_SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': isDark ? '#0f172a' : '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 3, 12, 8],
        'line-opacity': ['match', ['get', 'status'], 'open', 0.5, 0.85],
      },
    });
    map.addLayer({
      id: OPEN_ID,
      type: 'line',
      source: SEASONAL_SOURCE_ID,
      filter: ['==', ['get', 'status'], 'open'],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': colorExpression,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 12, 3],
        'line-dasharray': [1, 2],
        'line-opacity': 0.8,
      },
    });
    map.addLayer({
      id: CLOSED_ID,
      type: 'line',
      source: SEASONAL_SOURCE_ID,
      filter: ['in', ['get', 'status'], ['literal', CLOSED_STATUSES]],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': colorExpression,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2.5, 12, 5],
        // Closing soon: same plum, lighter, so it reads as "not yet"
        'line-opacity': ['match', ['get', 'status'], 'closingSoon', 0.55, 1],
        'line-dasharray': [2, 1.5],
      },
    });
    map.addLayer({
      id: HIT_ID,
      type: 'line',
      source: SEASONAL_SOURCE_ID,
      paint: { 'line-color': '#000000', 'line-width': 16, 'line-opacity': 0 },
    });

    const onClick = (e: MapLayerMouseEvent): void => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      const road = SEASONAL_ROADS.find((r) => r.id === id);
      const status = road && latest.current.statuses.get(road.id);
      if (road && status) latest.current.onRoadClick(road, status);
    };
    const onEnter = (): void => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onLeave = (): void => {
      map.getCanvas().style.cursor = '';
    };
    map.on('click', HIT_ID, onClick);
    map.on('mouseenter', HIT_ID, onEnter);
    map.on('mouseleave', HIT_ID, onLeave);

    return () => {
      map.off('click', HIT_ID, onClick);
      map.off('mouseenter', HIT_ID, onEnter);
      map.off('mouseleave', HIT_ID, onLeave);
      // After a style swap maplibre has already dropped them
      for (const id of [...LAYER_IDS].reverse()) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SEASONAL_SOURCE_ID)) map.removeSource(SEASONAL_SOURCE_ID);
    };
  }, [map, visible, isDark, mapStyleVersion]);

  // Push status changes (511 closures, date) into the existing source
  useEffect(() => {
    if (!map || !visible) return;
    map.getSource<GeoJSONSource>(SEASONAL_SOURCE_ID)?.setData(geojson);
  }, [map, visible, geojson]);

  return null;
}

export default memo(SeasonalRoadsLayer);
