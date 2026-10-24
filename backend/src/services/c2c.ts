/**
 * Shared helpers for the NE Compass C2C XML portal (VTrans data):
 * fetching, light regex-based XML field extraction, and a single-flight cache.
 */

const C2C_BASE = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';
const FETCH_TIMEOUT_MS = 45_000;
/** After a failed refresh, serve the stale value this long before retrying. */
const RETRY_AFTER_ERROR_MS = 30_000;

export const decodeXml = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Text of the first <name>…</name> in a block, trimmed and unescaped. */
export function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(block);
  return m?.[1] !== undefined ? decodeXml(m[1].trim()) : null;
}

/** C2C coordinates are integer microdegrees, e.g. 44975151 → 44.975151 */
export function micro(value: string | null): number | null {
  if (value === null || !/^-?\d+$/.test(value)) return null;
  return Number(value) / 1e6;
}

export async function fetchC2C(dataType: string, userAgent: string): Promise<string> {
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

/**
 * Single-flight + TTL cache around an async loader. On a failed refresh the
 * last good value is served, and the next attempt waits RETRY_AFTER_ERROR_MS.
 */
export function cachedLoader<T>(ttlMs: number, load: () => Promise<T>) {
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
