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

const C2C_BASE = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';
const LIST_TTL_MS = 10 * 60 * 1000;
const SNAPSHOT_TTL_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 45_000;
/** After a failed refresh, serve the stale value this long before retrying. */
const RETRY_AFTER_ERROR_MS = 30_000;

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

const decodeXml = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(block);
  return m?.[1] !== undefined ? decodeXml(m[1].trim()) : null;
}

/** C2C coordinates are integer microdegrees, e.g. 44975151 → 44.975151 */
function micro(value: string | null): number | null {
  if (value === null || !/^-?\d+$/.test(value)) return null;
  return Number(value) / 1e6;
}

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

// ---------------------------------------------------------------------------
// Fetching with caches
// ---------------------------------------------------------------------------

async function fetchC2C(dataType: string, userAgent: string): Promise<string> {
  const res = await fetch(`${C2C_BASE}?networks=Vermont&dataTypes=${dataType}`, {
    headers: { 'User-Agent': userAgent },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`C2C ${dataType} returned HTTP ${res.status}`);
  return res.text();
}

interface Cached<T> {
  value: T;
  fetchedAt: number;
}

/** Single-flight + TTL cache around an async loader. */
function cachedLoader<T>(ttlMs: number, load: () => Promise<T>) {
  let cached: Cached<T> | null = null;
  let inFlight: Promise<T> | null = null;
  return {
    async get(): Promise<T> {
      if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.value;
      if (!inFlight) {
        inFlight = load()
          .then((value) => {
            cached = { value, fetchedAt: Date.now() };
            return value;
          })
          .finally(() => {
            inFlight = null;
          });
      }
      try {
        return await inFlight;
      } catch (error) {
        // Serve the last good value rather than failing outright, and back off
        // so every request doesn't wait on another slow upstream attempt
        if (cached) {
          cached = {
            value: cached.value,
            fetchedAt: Date.now() - ttlMs + RETRY_AFTER_ERROR_MS,
          };
          return cached.value;
        }
        throw error;
      }
    },
    reset(): void {
      cached = null;
      inFlight = null;
    },
  };
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
