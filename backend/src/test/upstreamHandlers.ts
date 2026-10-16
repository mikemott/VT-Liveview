/**
 * MSW handlers that answer every upstream the backend calls with the synthetic
 * fixtures in src/__fixtures__. Used by the E2E server (e2e-server.ts) so
 * Playwright runs never reach the real NOAA/USGS/VT 511/etc. hosts.
 */
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { loadJson, loadText } from '../__fixtures__/load.js';
import {
  BACKCOUNTRY_URL,
  PARK_BOUNDARIES_URL,
  RECREATION_URL,
  paddedFixture,
} from '../services/__tests__/arcgisFixtures.js';

const NOAA = 'https://api.weather.gov';
const VT_511 = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';

/** Zone fixtures by id; other zones reuse VTZ005's shape under their own id. */
function zoneFixture(zoneId: string): JsonBodyType {
  if (zoneId === 'VTZ006') return loadJson<JsonBodyType>('noaa/zone-VTZ006.json');
  const zone = loadJson<{ id?: string; properties?: Record<string, unknown> }>(
    'noaa/zone-VTZ005.json',
  );
  zone.id = `${NOAA}/zones/forecast/${zoneId}`;
  if (zone.properties) zone.properties.id = zoneId;
  return zone;
}

function vt511Xml(dataTypes: string | null): string {
  // Only incidents have a fixture; the other feeds answer with an empty document.
  if (dataTypes === 'incidentData') return loadText('collectors/vt511-incidents.xml');
  return '<?xml version="1.0" encoding="UTF-8"?><root/>';
}

export const upstreamHandlers = [
  // NOAA
  http.get(`${NOAA}/points/:coords`, () => HttpResponse.json(loadJson('noaa/points.json'))),
  http.get(`${NOAA}/gridpoints/:office/:xy/stations`, () =>
    HttpResponse.json(loadJson('noaa/stations.json')),
  ),
  http.get(`${NOAA}/gridpoints/:office/:xy/forecast`, () =>
    HttpResponse.json(loadJson('noaa/forecast.json')),
  ),
  http.get(`${NOAA}/stations/:id/observations/latest`, () =>
    HttpResponse.json(loadJson('noaa/observation-latest.json')),
  ),
  http.get(`${NOAA}/alerts/active`, () => HttpResponse.json(loadJson('noaa/alerts-vt.json'))),
  http.get(`${NOAA}/zones/forecast/:zoneId`, ({ params }) =>
    HttpResponse.json(zoneFixture(String(params.zoneId))),
  ),

  // VT 511 (proxied by /api/vt511/*)
  http.get(VT_511, ({ request }) =>
    HttpResponse.xml(vt511Xml(new URL(request.url).searchParams.get('dataTypes'))),
  ),

  // USGS (Lake Champlain water temperature station)
  http.get('https://waterservices.usgs.gov/nwis/iv/', () =>
    HttpResponse.json(loadJson('usgs/lake-champlain-iv.json')),
  ),

  // Radar metadata
  http.get('https://mesonet.agron.iastate.edu/json/radar.py', () =>
    HttpResponse.json(loadJson('iem/radar.json')),
  ),
  http.get('https://api.rainviewer.com/public/weather-maps.json', () =>
    HttpResponse.json(loadJson('rainviewer/weather-maps.json')),
  ),

  // Ski Vermont scraper
  http.get('https://skivermont.com/conditions', () =>
    HttpResponse.html(loadText('skivermont/conditions.html')),
  ),

  // Burlington beaches
  http.get(
    'https://maps.burlingtonvt.gov/arcgis/rest/services/BTV_Beach_Status/MapServer/0/query',
    () => HttpResponse.json(loadJson('burlington/beach-status.json')),
  ),

  // Vermont ANR ArcGIS (padded past the services' minimum-site sanity checks)
  http.get(RECREATION_URL, () => HttpResponse.json(paddedFixture('anr/recreation-sites.json', 30))),
  http.get(BACKCOUNTRY_URL, () =>
    HttpResponse.json(paddedFixture('anr/backcountry-campsites.json', 60)),
  ),
  http.get(PARK_BOUNDARIES_URL, () => HttpResponse.json(loadJson('anr/park-boundaries.geojson'))),

  // NOAA Climate Data Online (only called when NOAA_CDO_TOKEN is set)
  http.get('https://www.ncei.noaa.gov/cdo-web/api/v2/data', () =>
    HttpResponse.json(loadJson('ncei-cdo/data-ghcnd.json')),
  ),
];
