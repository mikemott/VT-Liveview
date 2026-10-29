/**
 * Lake Champlain ferries (VTL-81): each crossing as a dashed line, a marker
 * at its Vermont landing, and, while it's in season, a small boat icon going
 * back and forth (not for people who prefer reduced motion). Static data: see
 * src/data/ferries.ts.
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import { FERRIES, type Ferry } from '../data/ferries';
import { LAYER_STYLES } from '../config/layers';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { useVisibleInterval } from '../hooks/useVisibleInterval';
import { createMapMarker } from '../utils/mapMarker';
import { boatPosition, getFerryStatus, isRunning, type FerryStatus } from '../utils/ferries';
import type { MapLibreMap } from '../types';

interface FerryLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  isDark: boolean;
  mapStyleVersion?: number;
  onSelect: (ferry: Ferry, status: FerryStatus) => void;
  /** For tests */
  now?: Date;
}

const ROUTES = 'ferry-routes';
const ROUTE_LINE = 'ferry-routes-line';
/** Off-season and suspended crossings */
const MUTED = '#94a3b8';
/** ~20 fps is plenty for a dot crossing a lake */
const FRAME_MS = 50;

// Lucide Ship icon (hard-coded; white via currentColor)
const SHIP_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 10.189V14"/><path d="M12 2v3"/>
    <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
    <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76"/>
    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
  </svg>
`;

/** A small, decorative copy of the ferry marker that crosses the lake */
function createBoatElement(): HTMLDivElement {
  const el = createMapMarker({ layer: 'ferries', iconSvg: SHIP_ICON, label: '' });
  el.className += ' ferry-boat';
  // Decoration only: the landing marker is the control
  el.removeAttribute('role');
  el.removeAttribute('aria-label');
  el.removeAttribute('tabindex');
  el.setAttribute('aria-hidden', 'true');
  return el;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function FerryLayer({ map, visible, isDark, mapStyleVersion, onSelect, now }: FerryLayerProps) {
  // Seasons change by the day: re-check hourly
  const [today, setToday] = useState(() => now ?? new Date());
  useVisibleInterval(() => setToday(now ?? new Date()), 60 * 60 * 1000);
  const statuses = useMemo(
    () => new Map(FERRIES.map((f) => [f.id, getFerryStatus(f, now ?? today)])),
    [now, today],
  );

  const buildMarker = useCallback(
    (ferry: Ferry): BuiltMarker => {
      const status = statuses.get(ferry.id)!;
      const element = createMapMarker({
        layer: 'ferries',
        iconSvg: SHIP_ICON,
        label: `Ferry: ${ferry.name}, ${ferry.between}, ${status.label.toLowerCase()}`,
        title: `${ferry.name}: ${status.label}`,
        dimmed: !isRunning(status) && status.state !== 'ice',
        className: `ferry-marker ferry-${status.state}`,
      });
      return { lngLat: ferry.route[0]!, element };
    },
    [statuses],
  );
  const handleActivate = useCallback(
    (ferry: Ferry) => onSelect(ferry, statuses.get(ferry.id)!),
    [onSelect, statuses],
  );
  useMapMarkers(map, visible, FERRIES, buildMarker, handleActivate);

  // Routes and boats
  useEffect(() => {
    if (!map || !visible) return;
    const { color, colorDark } = LAYER_STYLES.ferries;
    const lineColor = isDark ? (colorDark ?? color) : color;
    const running = FERRIES.filter((f) => isRunning(statuses.get(f.id)!));
    const routes: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: FERRIES.map((f) => ({
        type: 'Feature',
        properties: { id: f.id, color: isRunning(statuses.get(f.id)!) ? lineColor : MUTED },
        geometry: { type: 'LineString', coordinates: f.route },
      })),
    };
    const boats: { ferry: Ferry; marker: maplibregl.Marker }[] = [];
    const animate = running.length > 0 && !prefersReducedMotion();

    let frame = 0;
    let last = 0;
    const tick = (t: number): void => {
      frame = requestAnimationFrame(tick);
      if (t - last < FRAME_MS) return;
      last = t;
      for (const b of boats) b.marker.setLngLat(boatPosition(b.ferry, t));
    };

    const add = (): void => {
      if (!map.getSource(ROUTES)) map.addSource(ROUTES, { type: 'geojson', data: routes });
      else map.getSource<GeoJSONSource>(ROUTES)?.setData(routes);
      if (!map.getLayer(ROUTE_LINE)) {
        map.addLayer({
          id: ROUTE_LINE,
          type: 'line',
          source: ROUTES,
          layout: { 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 13, 3],
            'line-dasharray': [2, 2],
          },
        });
      }
      if (!animate || boats.length > 0) return;
      for (const ferry of running) {
        const marker = new maplibregl.Marker({ element: createBoatElement() })
          .setLngLat(boatPosition(ferry, 0))
          .addTo(map);
        boats.push({ ferry, marker });
      }
      // requestAnimationFrame pauses by itself in hidden tabs
      frame = requestAnimationFrame(tick);
    };
    // A style swap or WebGL context loss can leave the style loading (VTL-84)
    const styleReady = map.isStyleLoaded();
    if (styleReady) add();
    else void map.once('idle', add);

    return () => {
      if (!styleReady) map.off('idle', add);
      cancelAnimationFrame(frame);
      for (const b of boats) b.marker.remove();
      try {
        if (map.getLayer(ROUTE_LINE)) map.removeLayer(ROUTE_LINE);
        if (map.getSource(ROUTES)) map.removeSource(ROUTES);
      } catch {
        // No style after a context loss: nothing left to remove
      }
    };
  }, [map, visible, isDark, statuses, mapStyleVersion]);

  return null;
}

export default memo(FerryLayer);
