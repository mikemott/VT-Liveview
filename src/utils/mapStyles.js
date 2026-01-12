import { layers, LIGHT, DARK } from '@protomaps/basemaps';

// Generate MapLibre style with Protomaps hosted tiles
export function getMapStyle(isDark = false) {
  const sourceName = 'protomaps';

  // Customize the theme - brighten labels in dark mode for better readability
  let theme;
  if (isDark) {
    theme = {
      ...DARK,
      // Road labels - much brighter for readability
      roads_label_minor: '#c0c0c0',      // Brighter gray for minor roads (was #525252)
      roads_label_major: '#e0e0e0',      // Even brighter for major roads (was #666666)
      roads_label_minor_halo: '#1a1a1a', // Slightly lighter halo for contrast (was #1f1f1f)
      roads_label_major_halo: '#1a1a1a', // Slightly lighter halo for contrast (was #1f1f1f)
      // Place labels - also brighten for consistency
      city_label: '#d0d0d0',             // Brighter for cities (was #7a7a7a)
      city_label_halo: '#1a1a1a',        // Match other halos
      subplace_label: '#b0b0b0',         // Brighter for towns (was #525252)
      subplace_label_halo: '#1a1a1a',    // Match other halos
      state_label: '#909090',            // Brighter for states (was #3d3d3d)
      state_label_halo: '#1a1a1a'        // Match other halos
    };
  } else {
    theme = LIGHT;
  }

  // Get layers with the theme and language option
  // Note: lang parameter is REQUIRED for label layers to be generated
  const mapLayers = layers(sourceName, theme, { lang: 'en' });

  // Adjust zoom levels for road labels - show minor road names earlier
  const adjustedLayers = mapLayers.map(layer => {
    if (layer.id === 'roads_labels_minor') {
      // Show minor road labels 2 zoom levels earlier (typically starts at ~15, now ~13)
      return {
        ...layer,
        minzoom: (layer.minzoom || 15) - 2
      };
    }
    return layer;
  });

  // Get API key from environment variable
  const apiKey = import.meta.env.VITE_PROTOMAPS_API_KEY;

  if (!apiKey) {
    console.error('VITE_PROTOMAPS_API_KEY is not set. Get your free API key at https://protomaps.com/api');
  }

  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${isDark ? 'dark' : 'light'}`,
    sources: {
      [sourceName]: {
        type: 'vector',
        url: `https://api.protomaps.com/tiles/v4.json?key=${apiKey}`,
        attribution: '<a href="https://protomaps.com">Protomaps</a> | <a href="https://openstreetmap.org">© OpenStreetMap</a>'
      }
    },
    layers: adjustedLayers
  };
}

// Calculate sunrise and sunset times for a given location
// Uses simplified astronomical algorithm
function calculateSunTimes(lat, lng, date = new Date()) {
  const J2000 = 2451545.0;
  const julianDay = date.getTime() / 86400000 + 2440587.5;
  const n = julianDay - J2000;

  // Mean solar time
  const meanAnomaly = (357.5291 + 0.98560028 * n) % 360;
  const meanAnomalyRad = meanAnomaly * Math.PI / 180;

  // Equation of center
  const center = 1.9148 * Math.sin(meanAnomalyRad) +
                 0.0200 * Math.sin(2 * meanAnomalyRad) +
                 0.0003 * Math.sin(3 * meanAnomalyRad);

  // Ecliptic longitude
  const eclipticLongitude = (meanAnomaly + center + 180 + 102.9372) % 360;
  const eclipticLongitudeRad = eclipticLongitude * Math.PI / 180;

  // Solar transit (solar noon)
  const solarTransit = J2000 + n + 0.0053 * Math.sin(meanAnomalyRad) -
                       0.0069 * Math.sin(2 * eclipticLongitudeRad);

  // Declination of the sun
  const declination = Math.asin(Math.sin(eclipticLongitudeRad) * Math.sin(23.44 * Math.PI / 180));

  // Hour angle
  const latRad = lat * Math.PI / 180;
  const hourAngle = Math.acos((Math.sin(-0.833 * Math.PI / 180) -
                               Math.sin(latRad) * Math.sin(declination)) /
                              (Math.cos(latRad) * Math.cos(declination)));

  // Calculate sunrise and sunset in Julian days
  const sunriseJD = solarTransit - hourAngle / (2 * Math.PI);
  const sunsetJD = solarTransit + hourAngle / (2 * Math.PI);

  // Convert to local time (accounting for longitude)
  const lngOffset = lng / 15; // 15 degrees per hour
  const sunrise = new Date((sunriseJD - 2440587.5) * 86400000);
  const sunset = new Date((sunsetJD - 2440587.5) * 86400000);

  return { sunrise, sunset };
}

// Determine if it's night time based on actual sunrise/sunset for Vermont
export function isDarkMode() {
  // Vermont center coordinates
  const VT_LAT = 44.5588;
  const VT_LNG = -72.5778;

  const now = new Date();
  const { sunrise, sunset } = calculateSunTimes(VT_LAT, VT_LNG, now);

  // Dark mode if current time is before sunrise or after sunset
  return now < sunrise || now > sunset;
}

// Listen for system theme changes
export function onThemeChange(callback) {
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => callback(e.matches));
    return () => mediaQuery.removeEventListener('change', callback);
  }
  return () => {};
}

// Empty function for compatibility
export function registerPMTilesProtocol() {
  // Not needed for hosted tiles
}
