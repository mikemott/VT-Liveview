/**
 * Where each detail window's data comes from, and a public page to link to
 * (VTL-96). Every source link is built here so the URL patterns live in one
 * place: links go to pages a person can read, never to an API endpoint, and
 * ids are always encoded.
 */

/** One organization credited in a source line; `href` is a public page about it or the item */
export interface SourceRef {
  name: string;
  href?: string | null | undefined;
}

/**
 * An upstream-supplied URL, if it's safe to link: https only, so a feed can't
 * slip in `javascript:` or plain http. Returns the normalized URL or null.
 */
export function safeHttpsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

const enc = encodeURIComponent;

// =============================================================================
// National Weather Service
// =============================================================================

const NWS_HOME = 'https://www.weather.gov/';

/** NWS zone ids look like VTZ006 (forecast zone) or VTC007 (county) */
const NWS_ZONE = /^[A-Z]{2}Z\d{3}$/;

/** The forecast page for an NWS forecast zone; it lists the zone's active alerts */
export function nwsZoneUrl(zoneId: string): string {
  return `https://forecast.weather.gov/MapClick.php?zoneid=${enc(zoneId)}`;
}

/** The NWS point forecast page for a lat/lng */
export function nwsPointForecastUrl(lat: number, lng: number): string {
  return `https://forecast.weather.gov/MapClick.php?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
}

/** An observation station's recent history, e.g. KBTV */
export function nwsStationHistoryUrl(stationId: string): string {
  return `https://www.weather.gov/wrh/timeseries?site=${enc(stationId)}`;
}

/** NWS National Water Prediction Service page for a gauge (NWSLI id, e.g. MONV1) */
export function nwpsGaugeUrl(lid: string): string {
  return `https://water.noaa.gov/gauges/${enc(lid)}`;
}

/** An alert: the forecast page for its first Vermont forecast zone, else weather.gov */
export function nwsAlertSource(alert: { properties: { affectedZoneIds?: string[] } }): SourceRef {
  const zone = alert.properties.affectedZoneIds?.find((z) => NWS_ZONE.test(z));
  return { name: 'National Weather Service', href: zone ? nwsZoneUrl(zone) : NWS_HOME };
}

// =============================================================================
// USGS
// =============================================================================

/** A USGS monitoring location, e.g. 04294500 */
export function usgsSiteUrl(siteId: string): string {
  return `https://waterdata.usgs.gov/monitoring-location/${enc(siteId)}/`;
}

/** A weather station: NWS for NWS stations, USGS for the `USGS-<site>` water temperature one */
export function stationSource(stationId: string): SourceRef {
  if (stationId.startsWith('USGS-')) {
    return { name: 'U.S. Geological Survey', href: usgsSiteUrl(stationId.slice('USGS-'.length)) };
  }
  return { name: 'National Weather Service', href: nwsStationHistoryUrl(stationId) };
}

// =============================================================================
// Everything else
// =============================================================================

/** The station's page in the DOE Alternative Fuels Data Center station locator */
export function afdcStationUrl(id: string): string {
  return `https://afdc.energy.gov/stations#/station/${enc(id)}`;
}

/** Fixed sources with no per-item page */
export const SOURCES = {
  nws: { name: 'National Weather Service', href: NWS_HOME },
  newEngland511: { name: 'New England 511', href: 'https://newengland511.org/' },
  vtrans: { name: 'VTrans', href: 'https://vtrans.vermont.gov/' },
  airNow: { name: 'EPA AirNow', href: 'https://www.airnow.gov/' },
  skiVermont: { name: 'Ski Vermont', href: 'https://skivermont.com/conditions' },
  // The city's Parks swim-water status page (enjoyburlington.com is Burlington Parks' site)
  burlington: { name: 'City of Burlington', href: 'https://enjoyburlington.com/?p=1308' },
  vtStateParks: { name: 'Vermont State Parks', href: 'https://vtstateparks.com/' },
  vtAnrOpenData: { name: 'Vermont ANR', href: 'https://geodata.vermont.gov/' },
  vtFpr: {
    name: 'Vermont Forests, Parks & Recreation',
    href: 'https://fpr.vermont.gov/forest/wildland-fire/monitoring-fire-danger',
  },
  vcgi: { name: 'VCGI', href: 'https://vcgi.vermont.gov/' },
  openStreetMap: { name: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
} as const satisfies Record<string, SourceRef>;
