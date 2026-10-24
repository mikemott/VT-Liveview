/**
 * VTrans road weather stations (RWIS / ESS) from the NE Compass C2C portal (VTL-61).
 *
 * essData (~125 KB) lists ~77 Vaisala stations, about two thirds online.
 * Units follow NTCIP 1204: temperatures in tenths of °C, friction 0–1.
 * Wind is left out until its units are verified (see VTL-61).
 */
import { cachedLoader, decodeXml, fetchC2C, micro, tag } from './c2c.js';

const TTL_MS = 5 * 60 * 1000;
/** Readings this far "ahead" of now mean the offset label is wrong. */
const FUTURE_SLACK_MS = 10 * 60 * 1000;

export interface RoadWeatherStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  roadway: string | null;
  direction: string | null;
  /** Free-text siting, e.g. "BERLIN .2 MILES SOUTH OF EXIT 7" */
  location: string | null;
  /** "Dry", "Wet", "Ice", … or null when unknown */
  surface: string | null;
  pavementTempC: number | null;
  airTempC: number | null;
  dewPointC: number | null;
  /** 0–1 grip coefficient */
  friction: number | null;
  /** "None", "Rain", "Snow", … or null when not reported */
  precip: string | null;
  /** ISO time of the reading (UTC), or null if unparseable */
  observedAt: string | null;
}

/** Tenths of °C → °C, rejecting sensor junk. */
function tenthsC(value: string | null): number | null {
  if (value === null || !/^-?\d+$/.test(value)) return null;
  const c = Number(value) / 10;
  return c >= -60 && c <= 80 ? c : null;
}

function fraction(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

/** "Unknown", "N/A" and empty values carry no information. */
function known(value: string | null): string | null {
  return value && !/^(unknown|n\/a)$/i.test(value) ? value : null;
}

/**
 * The feed currently labels UTC clock times as -04:00 ("19:00-04:00" at 19:00 UTC).
 * Trust the stated offset unless that puts the reading in the future; then the
 * clock digits are UTC. This keeps working if VTrans fixes the label.
 */
export function parseEssTime(value: string | null, now: number = Date.now()): string | null {
  const m = value
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(value)
    : null;
  if (!m || !value) return null;
  const [, y, mo, d, h, mi, s] = m;
  const digitsAsUtc = Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!);
  const stated = Date.parse(value);
  if (Number.isNaN(digitsAsUtc)) return null;
  const at = !Number.isNaN(stated) && stated <= now + FUTURE_SLACK_MS ? stated : digitsAsUtc;
  return new Date(at).toISOString();
}

export function parseEssData(xml: string, now: number = Date.now()): RoadWeatherStation[] {
  const stations: RoadWeatherStation[] = [];
  for (const m of xml.matchAll(/<ess id="([^"]+)"[^>]*>([\s\S]*?)<\/ess>/g)) {
    const [, rawId, body] = m;
    if (!rawId || body === undefined) continue;
    // Offline stations repeat months-old readings
    if (tag(body, 'status') !== 'Device Online') continue;
    const lat = micro(tag(body, 'lat'));
    const lng = micro(tag(body, 'lon'));
    if (lat === null || lng === null || lat < 42 || lat > 46 || lng < -74 || lng > -71) continue;
    stations.push({
      id: decodeXml(rawId),
      name: tag(body, 'name') ?? decodeXml(rawId),
      lat,
      lng,
      roadway: tag(body, 'roadway'),
      direction: tag(body, 'direction'),
      location: tag(body, 'locationDescription')?.replace(/\s+/g, ' ') || null,
      surface: known(tag(body, 'roadSurfaceCond')),
      pavementTempC: tenthsC(tag(body, 'pavementTemp')),
      airTempC: tenthsC(tag(body, 'airTemp')),
      dewPointC: tenthsC(tag(body, 'dewPoint')),
      friction: fraction(tag(body, 'surfaceFriction')),
      precip: known(tag(body, 'precipType')),
      observedAt: parseEssTime(tag(body, 'timestamp'), now),
    });
  }
  return stations;
}

export function createRoadWeatherService(userAgent: string) {
  const stations = cachedLoader(TTL_MS, async () =>
    parseEssData(await fetchC2C('essData', userAgent)),
  );
  return {
    getStations: () => stations.get(),
    /** For tests. */
    reset: () => stations.reset(),
  };
}
