import type { ResortCoordinates } from '../types/ski.js';

export const RESORT_COORDS: Record<string, ResortCoordinates> = {
  'Bolton Valley': { lat: 44.4064, lon: -72.8725 },
  'Bromley Mountain': { lat: 43.2267, lon: -72.9628 },
  'Burke Mountain': { lat: 44.5804, lon: -71.9175 },
  'Cochrans Ski Area': { lat: 44.4267, lon: -73.1772 },
  'Jay Peak': { lat: 44.9383, lon: -72.5032 },
  'Killington': { lat: 43.6046, lon: -72.8197 },
  'Mad River Glen': { lat: 44.2017, lon: -72.9209 },
  'Magic Mountain': { lat: 43.1642, lon: -72.8214 },
  'Middlebury Snow Bowl': { lat: 44.0050, lon: -73.0992 },
  'Mount Snow': { lat: 42.9608, lon: -72.9203 },
  'Okemo': { lat: 43.4019, lon: -72.7176 },
  'Pico Mountain': { lat: 43.6592, lon: -72.8492 },
  'Quechee Ski Hill': { lat: 43.6467, lon: -72.4142 },
  'Saskadena Six': { lat: 44.0133, lon: -72.0733 },
  'Smugglers Notch': { lat: 44.5450, lon: -72.7856 },
  'Stowe': { lat: 44.5303, lon: -72.7817 },
  'Stratton': { lat: 43.1142, lon: -72.9083 },
  'Sugarbush': { lat: 44.1356, lon: -72.9017 },
  'Suicide Six': { lat: 43.6397, lon: -72.4656 },
  'Sundown Ski Area': { lat: 43.0281, lon: -72.8753 },
};

export const RESORT_LOGOS: Record<string, string> = {
  'Bolton Valley': 'https://www.boltonvalley.com/wp-content/uploads/2023/06/BV-Logo-White.png',
  'Bromley Mountain': 'https://www.bromley.com/wp-content/uploads/2023/05/bromley-logo.svg',
  'Burke Mountain': 'https://skiburke.com/wp-content/uploads/2023/06/burke-mountain-logo.svg',
  'Jay Peak': 'https://jaypeakresort.com/wp-content/uploads/2023/06/jay-peak-logo.svg',
  'Killington': 'https://www.killington.com/~/media/killington/logos/killington-logo-white.ashx',
  'Mad River Glen': 'https://www.madriverglen.com/wp-content/uploads/2023/06/mrg-logo.svg',
  'Mount Snow': 'https://www.mountsnow.com/~/media/mount-snow/logos/mount-snow-logo-white.ashx',
  'Okemo': 'https://www.okemo.com/~/media/okemo/logos/okemo-logo-white.ashx',
  'Pico Mountain': 'https://www.picomountain.com/~/media/pico/logos/pico-logo-white.ashx',
  'Smugglers Notch': 'https://www.smuggs.com/wp-content/uploads/2023/06/smuggs-logo.svg',
  'Stowe': 'https://www.stowe.com/~/media/stowe/logos/stowe-logo-white.ashx',
  'Stratton': 'https://www.stratton.com/~/media/stratton/logos/stratton-logo-white.ashx',
  'Sugarbush': 'https://www.sugarbush.com/~/media/sugarbush/logos/sugarbush-logo-white.ashx',
  // Note: Smaller resorts may not have public logo URLs - will default to Mountain icon
};
