/**
 * Campgrounds from ANR recreation sites (camping and mixed sites). Shared
 * markers in the Camping layer's green (VTL-64); clicking opens the
 * campground in the side panel. Backcountry sites are shown by area in
 * CampingAreasLayer.
 */
import { memo } from 'react';
import { fetchCampgrounds, type RecreationSite } from '../services/recreationApi';
import { useLayerData } from '../hooks/useLayerData';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import type { MapLibreMap } from '../types';

interface CampingLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onSelect: (site: RecreationSite) => void;
  /** Called after each successful fetch (counts, shared links, search) */
  onLoaded?: (sites: RecreationSite[]) => void;
}

const REFRESH_MS = 24 * 60 * 60 * 1000;

// Lucide Tent icon (hard-coded; white via currentColor)
const TENT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.5 21 14 3"/>
    <path d="M20.5 21 10 3"/>
    <path d="M15.5 21 12 15l-3.5 6"/>
    <line x1="2" x2="22" y1="21" y2="21"/>
  </svg>
`;

function buildCampgroundMarker(site: RecreationSite): BuiltMarker {
  const element = createMapMarker({
    layer: 'campingSites',
    iconSvg: TENT_ICON,
    label: `Campground: ${site.name}${site.town ? `, ${site.town}` : ''}`,
    title: site.name,
    className: 'camping-marker campground-marker',
  });
  return { lngLat: [site.longitude, site.latitude], element };
}

function CampingLayer({ map, visible, onSelect, onLoaded }: CampingLayerProps) {
  const sites = useLayerData(!!map, fetchCampgrounds, REFRESH_MS, onLoaded, 'campgrounds');
  useMapMarkers(map, visible, sites, buildCampgroundMarker, onSelect);
  return null;
}

export default memo(CampingLayer);
