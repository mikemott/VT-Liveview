/**
 * Public EV charging stations (VTL-81). DC fast chargers always show, as a
 * pill with their power; Level 2 stations (four times as many) only from
 * town-level zoom, so the statewide view stays readable.
 */
import { memo, useEffect, useMemo, useState } from 'react';
import { fetchEvChargers, type EvCharger } from '../services/evChargerApi';
import { useLayerData } from '../hooks/useLayerData';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { describePorts, isFastCharger, LEVEL2_MIN_ZOOM } from '../utils/evChargers';
import type { MapLibreMap } from '../types';

interface EvChargerLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onSelect: (station: EvCharger) => void;
  /** Called after each successful fetch (search, shared links) */
  onLoaded?: (stations: EvCharger[]) => void;
}

/** The backend caches for 12 hours */
const REFRESH_MS = 6 * 3600_000;
// Lucide Zap icon (hard-coded; white via currentColor)
const ZAP_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
  </svg>
`;

function buildEvMarker(station: EvCharger): BuiltMarker {
  const fast = isFastCharger(station);
  const element = createMapMarker({
    layer: 'evChargers',
    iconSvg: ZAP_ICON,
    ...(fast ? { shape: 'pill' as const, text: station.maxKw ? `${station.maxKw} kW` : 'DC' } : {}),
    label: `EV charger: ${station.name}, ${describePorts(station)}${
      station.network ? `, ${station.network}` : ''
    }`,
    title: station.name,
    className: `ev-marker ${fast ? 'ev-fast' : 'ev-level2'}`,
  });
  return { lngLat: [station.lng, station.lat], element };
}

function EvChargerLayer({ map, visible, onSelect, onLoaded }: EvChargerLayerProps) {
  const stations = useLayerData(!!map, fetchEvChargers, REFRESH_MS, onLoaded, 'EV chargers');

  const [closeIn, setCloseIn] = useState(() => (map?.getZoom() ?? 0) >= LEVEL2_MIN_ZOOM);
  useEffect(() => {
    if (!map || !visible) return;
    const update = (): void => setCloseIn(map.getZoom() >= LEVEL2_MIN_ZOOM);
    update();
    map.on('zoomend', update);
    return () => {
      map.off('zoomend', update);
    };
  }, [map, visible]);

  // Markers rebuild only when crossing the zoom threshold, not on every zoom
  const shown = useMemo(
    () => (closeIn ? stations : stations.filter(isFastCharger)),
    [stations, closeIn],
  );
  useMapMarkers(map, visible, shown, buildEvMarker, onSelect);
  return null;
}

export default memo(EvChargerLayer);
