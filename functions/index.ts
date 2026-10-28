/**
 * Cloudflare Pages Function for "/" (VTL-70): per-view link previews.
 *
 * A shared link carries the map state in its query string (see
 * src/utils/sharePreview.ts). Crawlers that build link previews read this
 * page's <meta> tags, so for those links we serve index.html with a title and
 * description that say what's being shared ("Live traffic camera: I-89
 * Berlin"). Names are looked up here from the site's own data, never taken
 * from the URL, so a link can't make the preview say arbitrary things.
 *
 * Plain visits (no state in the query) pass straight through.
 */
import { applyPreview, previewForQuery, type NameLookup } from '../src/utils/sharePreview';
import { SEASONAL_ROADS } from '../src/data/seasonalRoads';
import { DARK_SKY_SITES } from '../src/data/darkSkySites';

interface Env {
  /** Backend base URL (defaults to production) */
  API_URL?: string;
}

/** The subset of Cloudflare's PagesFunction context this function uses */
interface Context {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

const DEFAULT_API = 'https://vt-liveview-api.fly.dev';
/** A slow backend must not hold up the preview (or the page) */
const LOOKUP_TIMEOUT_MS = 1500;

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    // Cloudflare edge cache: repeat opens of shared links don't wait on the backend
    cf: { cacheTtl: 300, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function graphql<T>(api: string, query: string): Promise<T> {
  const body = await getJson<{ data?: T }>(`${api}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!body.data) throw new Error('GraphQL returned no data');
  return body.data;
}

type Named = { id: string; name: string };
const findName = (items: Named[], id: string): string | null =>
  items.find((item) => item.id === id)?.name ?? null;

export function makeLookup(api: string): NameLookup {
  return async (selection) => {
    switch (selection.type) {
      case 'road':
        return SEASONAL_ROADS.find((r) => r.id === selection.id)?.name ?? null;
      case 'camera': {
        const { cameras } = await getJson<{ cameras: Named[] }>(`${api}/api/cameras`);
        return findName(cameras, selection.id);
      }
      case 'aq': {
        const { monitors } = await getJson<{ monitors: Named[] }>(
          `${api}/api/air-quality/monitors`,
        );
        return findName(monitors, selection.id);
      }
      case 'river': {
        const { gauges } = await getJson<{ gauges: Named[] }>(`${api}/api/rivers`);
        return findName(gauges, selection.id);
      }
      case 'roadwx': {
        const { stations } = await getJson<{ stations: Named[] }>(`${api}/api/road-weather`);
        return findName(stations, selection.id);
      }
      case 'station': {
        const data = await graphql<{ observationStations: Named[] }>(
          api,
          '{ observationStations { id name } }',
        );
        return findName(data.observationStations, selection.id);
      }
      case 'alert': {
        const data = await graphql<{ alerts: { id: string; event: string; areaDesc: string }[] }>(
          api,
          '{ alerts(state: "VT") { id event areaDesc } }',
        );
        const alert = data.alerts.find((a) => a.id === selection.id);
        if (!alert) return null;
        const area = alert.areaDesc.split(';')[0]?.trim();
        return area ? `${alert.event}, ${area}` : alert.event;
      }
      case 'poi':
        switch (selection.kind) {
          case 'darksky':
            return DARK_SKY_SITES.find((s) => s.id === selection.id)?.name ?? null;
          case 'ski':
            return findName(
              (await graphql<{ skiResorts: Named[] }>(api, '{ skiResorts { id name } }'))
                .skiResorts,
              selection.id,
            );
          case 'beach':
            return findName(
              (await graphql<{ beaches: Named[] }>(api, '{ beaches { id name } }')).beaches,
              selection.id,
            );
          case 'creemee':
            return findName(
              (await graphql<{ creemeeStands: Named[] }>(api, '{ creemeeStands { id name } }'))
                .creemeeStands,
              selection.id,
            );
          case 'park':
            return findName(
              (
                await graphql<{ campingAreas: Named[] }>(
                  api,
                  '{ campingAreas(minSites: 1) { id name } }',
                )
              ).campingAreas,
              selection.id,
            );
          default:
            return null;
        }
      default:
        return null;
    }
  };
}

export async function onRequest(context: Context): Promise<Response> {
  const url = new URL(context.request.url);
  const page = await context.next();
  if (!url.search || !(page.headers.get('content-type') ?? '').includes('text/html')) return page;

  const preview = await previewForQuery(url.search, makeLookup(context.env.API_URL ?? DEFAULT_API));
  if (!preview) return page;

  const html = applyPreview(await page.text(), preview, url.toString());
  const headers = new Headers(page.headers);
  headers.delete('content-length');
  // Browsers revalidate (a stale index.html would point at old bundles after a
  // deploy); shared caches may keep the preview for 5 minutes
  headers.set('cache-control', 'public, max-age=0, s-maxage=300');
  return new Response(html, { status: page.status, headers });
}
