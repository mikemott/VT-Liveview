/**
 * Vermont fire danger (VTL-81): FPR's five Fire Danger Rating Areas, shaded
 * by today's NFDRS rating, each with a shared marker naming the rating that
 * opens the area in the side panel. Off season (or when FPR hasn't posted
 * for days) the areas are grey and the markers dimmed.
 */
import { memo, useCallback, useEffect, useMemo } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { fetchFireDanger, type FireDanger, type FireDangerArea } from '../services/fireDangerApi';
import { useLayerData } from '../hooks/useLayerData';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { fireLevel, isFireDangerStale, UNRATED } from '../utils/fireDanger';
import type { MapLibreMap } from '../types';

interface FireDangerLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  mapStyleVersion?: number;
  onSelect: (area: FireDangerArea, danger: FireDanger) => void;
  /** Called after each successful fetch (auto-show, shared links) */
  onLoaded?: (danger: FireDanger) => void;
}

/** FPR posts once a morning; the backend caches for 30 minutes */
const REFRESH_MS = 30 * 60 * 1000;
const SOURCE = 'fire-danger-areas';
const FILL = 'fire-danger-fill';
const OUTLINE = 'fire-danger-outline';

// Lucide Flame icon (hard-coded; white via currentColor)
const FLAME_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
`;

/** One fetch, shared by areas (markers) and the full result (panel) */
const fetchAsList = async (): Promise<FireDanger[]> => [await fetchFireDanger()];

function FireDangerLayer({
  map,
  visible,
  mapStyleVersion,
  onSelect,
  onLoaded,
}: FireDangerLayerProps) {
  const handleLoaded = useCallback((list: FireDanger[]) => onLoaded?.(list[0]!), [onLoaded]);
  const [danger] = useLayerData(!!map, fetchAsList, REFRESH_MS, handleLoaded, 'fire danger');
  const stale = danger ? isFireDangerStale(danger.updatedAt) : true;
  const areas = useMemo(() => danger?.areas ?? [], [danger]);

  const buildMarker = useCallback(
    (area: FireDangerArea): BuiltMarker => {
      const level = stale ? UNRATED : fireLevel(area.rating);
      const element = createMapMarker({
        layer: 'fireDanger',
        shape: 'pill',
        iconSvg: FLAME_ICON,
        text: stale ? 'Not current' : level.name,
        label: `Fire danger: ${area.name}, ${stale ? 'not currently rated' : level.name.toLowerCase()}`,
        title: area.name,
        statusFill: level.color,
        dimmed: stale,
        className: `fire-danger-marker fire-${stale ? 'stale' : (area.rating ?? 'none')}`,
      });
      return { lngLat: [area.labelLng, area.labelLat], element };
    },
    [stale],
  );
  const handleActivate = useCallback(
    (area: FireDangerArea) => {
      if (danger) onSelect(area, danger);
    },
    [danger, onSelect],
  );
  useMapMarkers(map, visible, areas, buildMarker, handleActivate);

  // Shaded areas under the markers
  useEffect(() => {
    if (!map || !visible || areas.length === 0) return;
    const data: FeatureCollection<Polygon | MultiPolygon> = {
      type: 'FeatureCollection',
      features: areas.map((a) => ({
        type: 'Feature',
        properties: { color: (stale ? UNRATED : fireLevel(a.rating)).color },
        geometry: a.geometry,
      })),
    };
    const add = (): void => {
      const source = map.getSource<GeoJSONSource>(SOURCE);
      if (source) source.setData(data);
      else map.addSource(SOURCE, { type: 'geojson', data });
      if (!map.getLayer(FILL)) {
        map.addLayer({
          id: FILL,
          type: 'fill',
          source: SOURCE,
          paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 },
        });
      }
      if (!map.getLayer(OUTLINE)) {
        map.addLayer({
          id: OUTLINE,
          type: 'line',
          source: SOURCE,
          paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.6 },
        });
      }
    };
    // Data can land mid style swap (theme change), when addSource throws
    // "Style is not done loading": wait for the map to settle
    const styleReady = map.isStyleLoaded();
    if (styleReady) add();
    else void map.once('idle', add);
    return () => {
      if (!styleReady) map.off('idle', add);
      // After a WebGL context loss the map can briefly have no style, and getLayer throws
      try {
        if (map.getLayer(OUTLINE)) map.removeLayer(OUTLINE);
        if (map.getLayer(FILL)) map.removeLayer(FILL);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      } catch {
        // No style: nothing left to remove
      }
    };
  }, [map, visible, areas, stale, mapStyleVersion]);

  return null;
}

export default memo(FireDangerLayer);
