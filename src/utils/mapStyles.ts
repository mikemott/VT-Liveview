/**
 * Map Styles Configuration
 * Generates MapLibre styles with Protomaps hosted tiles
 * Includes sunrise/sunset calculation for auto dark mode
 */

import { layers, LIGHT, DARK, type Flavor } from '@protomaps/basemaps';
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';
import { VERMONT } from './constants';
import { calculateSunTimes } from './time';

// =============================================================================
// Types
// =============================================================================

/** Theme change callback */
type ThemeChangeCallback = (isDark: boolean) => void;

// =============================================================================
// Map Style Generation
// =============================================================================

/**
 * Generate MapLibre style with Protomaps hosted tiles
 * @param isDark - Whether to use dark theme
 * @returns Complete MapLibre style specification
 */
export function getMapStyle(isDark = false): StyleSpecification {
  const sourceName = 'protomaps';

  // Customize the theme - brighten labels in dark mode for better readability
  let theme: Flavor;
  if (isDark) {
    theme = {
      ...DARK,
      // Road labels - much brighter for readability
      roads_label_minor: '#c0c0c0', // Brighter gray for minor roads (was #525252)
      roads_label_major: '#e0e0e0', // Even brighter for major roads (was #666666)
      roads_label_minor_halo: '#1a1a1a', // Slightly lighter halo for contrast (was #1f1f1f)
      roads_label_major_halo: '#1a1a1a', // Slightly lighter halo for contrast (was #1f1f1f)
      // Place labels - also brighten for consistency
      city_label: '#d0d0d0', // Brighter for cities (was #7a7a7a)
      city_label_halo: '#1a1a1a', // Match other halos
      subplace_label: '#b0b0b0', // Brighter for towns (was #525252)
      subplace_label_halo: '#1a1a1a', // Match other halos
      state_label: '#909090', // Brighter for states (was #3d3d3d)
      state_label_halo: '#1a1a1a', // Match other halos
    };
  } else {
    theme = LIGHT;
  }

  // Get layers with the theme and language option
  // Note: lang parameter is REQUIRED for label layers to be generated
  const mapLayers = layers(sourceName, theme, { lang: 'en' }) as LayerSpecification[];

  // Adjust zoom levels for road labels - show minor road names earlier
  const adjustedLayers = mapLayers.map((layer) => {
    if (layer.id === 'roads_labels_minor') {
      // Show minor road labels 2 zoom levels earlier (typically starts at ~15, now ~13)
      return {
        ...layer,
        minzoom: (layer.minzoom ?? 15) - 2,
      };
    }
    return layer;
  });

  // Get API key from environment variable
  const apiKey = import.meta.env.VITE_PROTOMAPS_API_KEY as string | undefined;

  if (!apiKey && import.meta.env.DEV) {
    console.error(
      'VITE_PROTOMAPS_API_KEY is not set. Get your free API key at https://protomaps.com/api'
    );
  }

  return {
    version: 8,
    glyphs:
      'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${isDark ? 'dark' : 'light'}`,
    sources: {
      [sourceName]: {
        type: 'vector',
        url: `https://api.protomaps.com/tiles/v4.json?key=${apiKey ?? ''}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> | <a href="https://openstreetmap.org">© OpenStreetMap</a>',
      },
    },
    layers: adjustedLayers,
  };
}

// =============================================================================
// Theme Detection
// =============================================================================

/**
 * Determine if it's night time based on actual sunrise/sunset for Vermont
 * @returns True if current time is before sunrise or after sunset
 */
export function isDarkMode(): boolean {
  // Vermont center coordinates
  const VT_LAT = VERMONT.lat;
  const VT_LNG = VERMONT.lng;

  const now = new Date();
  const { sunrise, sunset } = calculateSunTimes(VT_LAT, VT_LNG, now);

  // Dark mode if current time is before sunrise or after sunset
  return now < sunrise || now > sunset;
}

/**
 * Listen for system theme changes
 * @param callback - Function to call with isDark boolean when theme changes
 * @returns Cleanup function to remove listener
 */
export function onThemeChange(callback: ThemeChangeCallback): () => void {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent): void => {
      callback(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }
  return () => {
    // No-op cleanup when matchMedia not available
  };
}
