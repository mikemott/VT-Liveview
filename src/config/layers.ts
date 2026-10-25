/**
 * Map layer registry (VTL-64): one label, icon and color per layer.
 *
 * Filter chips, map markers, line layers and search results all take their
 * color from here, so a chip always matches what it shows on the map.
 *
 * The palette was picked for distinctness (VTL-66): every pair is >= 17
 * CIEDE2000 apart as the full color, which is what both markers and selected
 * chips (filled) show. White marker icons keep ~3:1 contrast or better; chip
 * text uses black or white, whichever reads better (textOn, >= 4.5:1). Change a color only after re-checking every
 * pair; layerPalette.test.ts enforces both.
 */
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertOctagon,
  AlertTriangle,
  Ban,
  Car,
  Construction,
  IceCream,
  Mountain,
  Snowflake,
  Star,
  Tent,
  Thermometer,
  ThermometerSnowflake,
  Video,
  Waves,
} from 'lucide-react';
import type { IncidentType } from '../types';

export type LayerStyleKey =
  | 'weatherStations'
  | 'trafficFlow'
  | 'trafficCameras'
  | 'roadWeather'
  | 'seasonalRoads'
  | IncidentType
  | 'skiResorts'
  | 'stargazing'
  | 'creemeeStands'
  | 'campingSites'
  | 'beachSites';

export interface LayerStyle {
  /** Chip label */
  label: string;
  icon: LucideIcon;
  /** Marker fill / line / chip accent color */
  color: string;
  /**
   * Chip/text accent on dark backgrounds, for colors too deep to lift
   * automatically (they would wash out to the same grey). Markers keep `color`.
   */
  colorDark?: string;
  /** Chip tooltip */
  description?: string;
}

export const LAYER_STYLES: Record<LayerStyleKey, LayerStyle> = {
  // Weather & travel
  weatherStations: { label: 'Stations', icon: Thermometer, color: '#2563eb' },
  trafficFlow: { label: 'Traffic', icon: Car, color: '#65a30d' },
  trafficCameras: { label: 'Cameras', icon: Video, color: '#ec4899' },
  roadWeather: {
    label: 'Road temps',
    icon: ThermometerSnowflake,
    color: '#334155',
    colorDark: '#94a3b8',
    description: 'Pavement temperature and surface from VTrans road weather stations',
  },
  seasonalRoads: {
    label: 'Seasonal closures',
    icon: Snowflake,
    color: '#78716c',
    description: 'Notch, gap and toll roads that close for winter',
  },
  ACCIDENT: { label: 'Accidents', icon: AlertTriangle, color: '#5b21b6' },
  CONSTRUCTION: { label: 'Construction', icon: Construction, color: '#ea580c' },
  CLOSURE: { label: 'Closures', icon: Ban, color: '#b91c1c' },
  FLOODING: { label: 'Floods', icon: Waves, color: '#0d9488' },
  HAZARD: { label: 'Hazards', icon: AlertOctagon, color: '#ca8a04' },
  // Points of interest
  skiResorts: { label: 'Ski Resorts', icon: Mountain, color: '#0891b2' },
  stargazing: { label: 'Stargazing', icon: Star, color: '#a855f7' },
  creemeeStands: { label: 'Creemee Stands', icon: IceCream, color: '#9d174d' },
  campingSites: { label: 'Camping', icon: Tent, color: '#15803d' },
  beachSites: { label: 'Beaches', icon: Waves, color: '#115e59' },
};

export const layerColor = (key: LayerStyleKey): string => LAYER_STYLES[key].color;

/** WCAG relative luminance of a #rrggbb color */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Text color for a label filled with `hex`: white or black, whichever has
 * more contrast. One of them always clears 4.5:1 (their ratios multiply to 21).
 */
export function textOn(hex: string): '#ffffff' | '#000000' {
  const l = relativeLuminance(hex);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? '#ffffff' : '#000000';
}

/**
 * `style` for an element whose CSS uses var(--layer-color); --layer-on is the
 * readable text color on a fill of that color (selected chips).
 */
export function layerColorVars(key: LayerStyleKey): CSSProperties {
  const { color, colorDark } = LAYER_STYLES[key];
  return {
    '--layer-color': color,
    '--layer-on': textOn(color),
    ...(colorDark ? { '--layer-color-dark': colorDark } : {}),
  } as CSSProperties;
}
