/**
 * Licensed creemee stands. Shared markers in the Creemee layer's brown
 * (VTL-64); clicking opens the stand in the side panel.
 */
import { memo } from 'react';
import { fetchCreemeeStands, type CreemeeStand } from '../services/creemeeApi';
import { useLayerData } from '../hooks/useLayerData';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import type { MapLibreMap } from '../types';

interface CreemeeLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onSelect: (stand: CreemeeStand) => void;
  /** Called after each successful fetch (shared links, search) */
  onLoaded?: (stands: CreemeeStand[]) => void;
}

/** The list barely changes */
const REFRESH_MS = 24 * 60 * 60 * 1000;

// Lucide IceCream icon (hard-coded; white via currentColor)
const CREEMEE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11"/>
    <path d="M17 7A5 5 0 0 0 7 7"/>
    <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4"/>
  </svg>
`;

function buildCreemeeMarker(stand: CreemeeStand): BuiltMarker {
  const element = createMapMarker({
    layer: 'creemeeStands',
    iconSvg: CREEMEE_ICON,
    label: `Creemee stand: ${stand.name}, ${stand.town}`,
    title: stand.name,
    className: 'creemee-stand-marker',
  });
  return { lngLat: [stand.longitude, stand.latitude], element };
}

function CreemeeLayer({ map, visible, onSelect, onLoaded }: CreemeeLayerProps) {
  const stands = useLayerData(!!map, fetchCreemeeStands, REFRESH_MS, onLoaded, 'creemee stands');
  useMapMarkers(map, visible, stands, buildCreemeeMarker, onSelect);
  return null;
}

export default memo(CreemeeLayer);
