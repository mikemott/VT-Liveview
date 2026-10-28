/**
 * Share links and their social previews (VTL-70).
 *
 * The app keeps its view in the URL hash, which link-preview crawlers
 * (Facebook, iMessage, Slack, Reddit…) never see. A shared link therefore
 * carries the same state in the query string instead:
 *
 *   https://vtliveview.com/?map=11/44.5/-72.8&layers=cameras&sel=camera:I-89%20SB%20BERLIN
 *
 * functions/index.ts reads it and fills in the preview's title/description
 * (looking names up server-side, never trusting text from the URL), and the
 * app moves it back into the hash on load (queryToHash).
 *
 * No DOM or React here: this module runs in the Cloudflare Pages Function too.
 */
import { parseUrlState, type Selection, type UrlState } from './urlState';
import { nearestTown } from './geo';

export const SITE_NAME = 'VT LiveView';
export const DEFAULT_SHARE_TEXT = 'Live Vermont roads, weather & alerts';

/** The query params that carry map state (anything else in the query is left alone). */
const STATE_PARAMS = ['map', 'layers', 'sel'] as const;

/** Shareable link for the current view: the hash's state moved into the query. */
export function shareUrl(origin: string, hash: string): string {
  const query = hash.replace(/^#/, '');
  return query ? `${origin}/?${query}` : `${origin}/`;
}

/**
 * If a shared link opened the app (state in the query, no hash), the hash form
 * of that state, so the app can replaceState to it; otherwise null.
 */
export function queryToHash(search: string, hash: string): string | null {
  if (hash && hash !== '#') return null;
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of STATE_PARAMS) {
    const value = params.get(key);
    if (value !== null) kept.set(key, value);
  }
  // Stays percent-encoded (a camera id can contain '&'); the app rewrites the
  // hash in its own tidy form as soon as the map settles
  const query = kept.toString();
  return query ? `#${query}` : null;
}

/** What a selection is, for preview titles and share text. */
export function selectionLabel(selection: Selection): string {
  switch (selection.type) {
    case 'camera':
      return 'Live traffic camera';
    case 'station':
      return 'Weather station';
    case 'alert':
      return 'Weather alert';
    case 'road':
      return 'Seasonal road';
    case 'roadwx':
      return 'Road temperature';
    case 'aq':
      return 'Air quality';
    case 'river':
      return 'River level';
    case 'ev':
      return 'EV charger';
    case 'fire':
      return 'Fire danger';
    case 'location':
      return "What's here";
    case 'poi':
      switch (selection.kind) {
        case 'ski':
          return 'Ski conditions';
        case 'beach':
          return 'Beach';
        case 'creemee':
          return 'Creemee stand';
        case 'camp':
          return 'Campground';
        case 'park':
          return 'Backcountry camping';
        case 'darksky':
          return 'Stargazing site';
      }
  }
}

/**
 * One line describing what's being shared, e.g. "Live traffic camera: I-89
 * Berlin" or "What's here near Barre". `name` comes from the app's own data
 * (or a server-side lookup), never from the URL.
 */
export function describeSelection(selection: Selection | undefined, name: string | null): string {
  if (!selection) return DEFAULT_SHARE_TEXT;
  if (selection.type === 'location') {
    const town = nearestTown(selection.lat, selection.lng);
    return town ? `What's here near ${town.name}` : "What's here in Vermont";
  }
  const label = selectionLabel(selection);
  const clean = name ? cleanName(name) : '';
  return clean ? `${label}: ${clean}` : `${label} in Vermont`;
}

/** Collapse whitespace and cap the length of a looked-up name. */
export function cleanName(name: string): string {
  const flat = name.replace(/\s+/g, ' ').trim();
  return flat.length > 80 ? `${flat.slice(0, 79).trimEnd()}…` : flat;
}

const DESCRIPTIONS: Record<Selection['type'], string> = {
  camera: 'Live VTrans camera image, plus roads, radar and alerts across Vermont.',
  station: 'Current conditions and forecast, plus radar, roads and alerts across Vermont.',
  alert: 'National Weather Service alert on a live map of Vermont weather and roads.',
  road: 'Seasonal road status, plus closures, radar and alerts across Vermont.',
  roadwx: 'Live pavement temperature and surface, plus radar and road closures.',
  aq: 'Current air quality (AQI) from EPA AirNow, plus radar, roads and alerts across Vermont.',
  river: 'Live river level and flood stage from NWS gauges, plus radar, roads and alerts.',
  ev: 'Public EV charging station, plus radar, road closures and alerts across Vermont.',
  fire: 'Today’s fire danger rating from Vermont Forests, Parks & Recreation, on a live map.',
  location: 'Forecast, alerts and what’s nearby on a live map of Vermont.',
  poi: 'On a live map of Vermont roads, weather, alerts and outdoor spots.',
};

export const DEFAULT_DESCRIPTION =
  'Live map of Vermont road closures, accidents, weather radar and NWS alerts, plus ski, camping and outdoor info.';

export interface Preview {
  title: string;
  description: string;
}

/** Looks a selection's display name up from trusted data; null when unknown. */
export type NameLookup = (selection: Selection) => Promise<string | null>;

/**
 * Preview text for a shared link's query string, or null when the link has
 * no map state (the static preview in index.html applies).
 */
export async function previewForQuery(search: string, lookup: NameLookup): Promise<Preview | null> {
  const params = new URLSearchParams(search);
  if (!STATE_PARAMS.some((key) => params.has(key))) return null;
  const state: UrlState = parseUrlState(`#${params.toString()}`);
  if (!state.selection) {
    return { title: `${SITE_NAME} — ${DEFAULT_SHARE_TEXT}`, description: DEFAULT_DESCRIPTION };
  }
  let name: string | null = null;
  if (state.selection.type !== 'location') {
    try {
      name = await lookup(state.selection);
    } catch {
      name = null;
    }
  }
  return {
    title: `${describeSelection(state.selection, name)} — ${SITE_NAME}`,
    description: DESCRIPTIONS[state.selection.type],
  };
}

/** Escape text for an HTML attribute value. */
export function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * index.html with the preview's title, description and URL swapped into the
 * <title>, description, Open Graph and Twitter tags.
 */
export function applyPreview(html: string, preview: Preview, url: string): string {
  const title = escapeAttr(preview.title);
  const description = escapeAttr(preview.description);
  const setMeta = (doc: string, attr: 'name' | 'property', key: string, value: string): string => {
    // \s+ also spans the line breaks Prettier puts in long <meta> tags
    const pattern = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*"`);
    // Replacer functions, so a '$' in a name isn't read as a substitution pattern
    if (pattern.test(doc))
      return doc.replace(pattern, (_match, open: string) => `${open}${value}"`);
    // Not in the template: add it before </head>
    return doc.replace(
      '</head>',
      () => `    <meta ${attr}="${key}" content="${value}" />\n  </head>`,
    );
  };
  let out = html.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`);
  out = setMeta(out, 'name', 'description', description);
  out = setMeta(out, 'property', 'og:title', title);
  out = setMeta(out, 'property', 'og:description', description);
  out = setMeta(out, 'property', 'og:url', escapeAttr(url));
  out = setMeta(out, 'name', 'twitter:title', title);
  out = setMeta(out, 'name', 'twitter:description', description);
  return out;
}

/** The pieces of panel content the share text needs (kept structural, no React types). */
type NamedPanel =
  | { type: 'alert'; data: { properties: { event: string; areaDesc?: string } } }
  | { type: string; data?: object };

/**
 * Display name of what the side panel shows, for the share text; the same form
 * the preview function looks up server-side. Null when there's nothing to name.
 */
export function panelShareName(content: NamedPanel | null | undefined): string | null {
  if (!content) return null;
  if (content.type === 'alert' && content.data && 'properties' in content.data) {
    const { event, areaDesc } = content.data.properties;
    const area = areaDesc?.split(';')[0]?.trim();
    return area ? `${event}, ${area}` : event;
  }
  const { name } = (content.data ?? {}) as { name?: string };
  return typeof name === 'string' && name ? name : null;
}

/** Where a view can be shared, and how (VTL-70). */
export interface ShareTarget {
  id: 'facebook' | 'x' | 'bluesky' | 'reddit' | 'email' | 'sms';
  label: string;
  href: string;
}

/**
 * Compose links for each network: each opens that site's own post screen
 * with the link (and text) filled in. Nothing is posted until the person
 * presses Post there.
 */
export function shareTargets(url: string, text: string, { sms }: { sms: boolean }): ShareTarget[] {
  const e = encodeURIComponent;
  const line = `${text} — ${SITE_NAME}`;
  const targets: ShareTarget[] = [
    {
      id: 'facebook',
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`,
    },
    { id: 'x', label: 'X', href: `https://x.com/intent/post?text=${e(line)}&url=${e(url)}` },
    {
      id: 'bluesky',
      label: 'Bluesky',
      href: `https://bsky.app/intent/compose?text=${e(`${line} ${url}`)}`,
    },
    {
      id: 'reddit',
      label: 'Reddit',
      href: `https://www.reddit.com/submit?url=${e(url)}&title=${e(line)}`,
    },
    {
      id: 'email',
      label: 'Email',
      href: `mailto:?subject=${e(line)}&body=${e(`${text}\n\n${url}`)}`,
    },
  ];
  // sms: links only do something on phones; "?&body" works on both iOS and Android
  if (sms)
    targets.push({ id: 'sms', label: 'Text message', href: `sms:?&body=${e(`${text} ${url}`)}` });
  return targets;
}
