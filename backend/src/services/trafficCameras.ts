/**
 * VTrans traffic cameras from the NE Compass C2C portal (VTL-56).
 *
 * - cctvStatusData (~40 KB): camera list with location, road and status
 * - cctvSnapshotData (~17 MB!): one base64 JPEG per camera
 *
 * The snapshot feed is large, so it is fetched lazily (only when someone asks
 * for an image), cached briefly, and concurrent requests share one fetch.
 * Parsing is a single regex scan rather than an XML DOM: a DOM of 17 MB of
 * base64 would not fit comfortably in the 256 MB Fly machine.
 */

import { cachedLoader, decodeXml, fetchC2C, micro, tag } from './c2c.js';

const LIST_TTL_MS = 10 * 60 * 1000;
const SNAPSHOT_TTL_MS = 2 * 60 * 1000;

export interface TrafficCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  roadway: string | null;
  direction: string | null;
  online: boolean;
}

export interface CameraSnapshot {
  jpeg: Buffer;
  /** ISO timestamp the image was taken (UTC), or null if not parseable. */
  takenAt: string | null;
}

// ---------------------------------------------------------------------------
// Parsing (exported for tests)
// ---------------------------------------------------------------------------

export function parseCameraList(xml: string): TrafficCamera[] {
  const cameras: TrafficCamera[] = [];
  for (const m of xml.matchAll(/<cctvStatus id="([^"]+)"[^>]*>([\s\S]*?)<\/cctvStatus>/g)) {
    const [, rawId, body] = m;
    if (!rawId || body === undefined) continue;
    const lat = micro(tag(body, 'lat'));
    const lng = micro(tag(body, 'lon'));
    // Vermont and a margin; drops 0,0 and garbage
    if (lat === null || lng === null || lat < 42 || lat > 46 || lng < -74 || lng > -71) continue;
    cameras.push({
      id: decodeXml(rawId),
      name: tag(body, 'name') ?? decodeXml(rawId),
      lat,
      lng,
      roadway: tag(body, 'roadway'),
      direction: tag(body, 'direction'),
      online: tag(body, 'status') === 'Device Online',
    });
  }
  return cameras;
}

/**
 * Offset of America/New_York from UTC (minutes, e.g. -240 in EDT) at an instant.
 * Uses Intl so DST transitions are handled without a timezone library.
 */
function easternOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/**
 * "2026:10:24:14:19:36" → ISO string. The feed's wall-clock time is Eastern
 * (verified: images stamped 14:19 were fetched at 18:20 UTC during EDT).
 */
export function parseSnapshotTime(value: string | null): string | null {
  const m = value ? /^(\d{4}):(\d{2}):(\d{2}):(\d{2}):(\d{2}):(\d{2})$/.exec(value) : null;
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const wallAsUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  if (Number.isNaN(wallAsUtc)) return null;
  // Two passes so times right after a DST change pick the right offset
  let utc = wallAsUtc - easternOffsetMinutes(new Date(wallAsUtc)) * 60_000;
  utc = wallAsUtc - easternOffsetMinutes(new Date(utc)) * 60_000;
  return new Date(utc).toISOString();
}

export function parseSnapshots(xml: string): Map<string, CameraSnapshot> {
  const out = new Map<string, CameraSnapshot>();
  for (const m of xml.matchAll(/<cctvSnapshot id="([^"]+)"[^>]*>([\s\S]*?)<\/cctvSnapshot>/g)) {
    const [, rawId, body] = m;
    if (!rawId || body === undefined) continue;
    if ((tag(body, 'fileType') ?? '').toUpperCase() !== 'JPG') continue;
    const b64 = /<snippet>([A-Za-z0-9+/=\s]+)<\/snippet>/.exec(body)?.[1];
    if (!b64) continue;
    const jpeg = Buffer.from(b64, 'base64');
    // Must actually be a JPEG (FF D8); offline cameras send empty or junk payloads
    if (jpeg.length < 1024 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) continue;
    out.set(decodeXml(rawId), { jpeg, takenAt: parseSnapshotTime(tag(body, 'timestamp')) });
  }
  return out;
}

export function createTrafficCameraService(userAgent: string) {
  const list = cachedLoader(LIST_TTL_MS, async () =>
    parseCameraList(await fetchC2C('cctvStatusData', userAgent)),
  );
  const snapshots = cachedLoader(SNAPSHOT_TTL_MS, async () =>
    parseSnapshots(await fetchC2C('cctvSnapshotData', userAgent)),
  );
  return {
    getCameras: () => list.get(),
    async getSnapshot(id: string): Promise<CameraSnapshot | null> {
      return (await snapshots.get()).get(id) ?? null;
    },
    /** For tests. */
    reset(): void {
      list.reset();
      snapshots.reset();
    },
  };
}
