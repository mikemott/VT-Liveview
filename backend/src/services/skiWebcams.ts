/**
 * Ski resort base cameras (VTL-87): checks each resort's published feed and
 * resolves what the panel should show, so a dead or off-season camera falls
 * back to the resort's link instead of a broken box.
 *
 * - YouTube: resorts restart streams, which changes the video ID. With an API
 *   key we look for the channel's current live video (uploads playlist +
 *   videos.list, 1 quota unit each; search.list would cost 100). Without a key
 *   we can only confirm the seed video still exists (oEmbed).
 * - Brown Rice / HDRelay: the snapshot must load without a referrer.
 * - Players (Brown Rice, Roundshot, CamStreamer) must allow framing.
 *
 * The whole result is cached for 30 minutes (one entry, stale on error).
 */
import {
  SKI_WEBCAM_SOURCES,
  type ResortWebcamConfig,
  type WebcamSource,
} from '../data/skiWebcams.js';
import { cachedLoader } from './c2c.js';

export type WebcamStatus = 'ok' | 'offline' | 'unavailable';

export interface ResolvedWebcam {
  name: string;
  /** live = player on tap; panorama = player on tap, no preview; still = image only */
  kind: 'live' | 'panorama' | 'still';
  preview: string | null;
  /** Add a cache-busting stamp to the preview (snapshot images) */
  refreshPreview: boolean;
  embed: string | null;
}

export interface ResortWebcam {
  page: string;
  camera: ResolvedWebcam | null;
  status: WebcamStatus;
  /** Why a camera isn't shown (for debugging; safe to expose) */
  reason?: string;
}

export interface SkiWebcamsResult {
  checkedAt: string;
  youtubeLookup: boolean;
  resorts: Record<string, ResortWebcam>;
}

const TTL_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 8000;
const UA = 'VT-Liveview/1.0 (+https://vtliveview.com)';
const YT_API = 'https://www.googleapis.com/youtube/v3';
const SITE_ORIGINS = ['vtliveview.com', 'vtliveview.pages.dev'];

export type Fetch = typeof fetch;

async function get(fetchImpl: Fetch, url: string): Promise<Response> {
  return fetchImpl(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Whether a page may be shown in an iframe on our site */
export function allowsFraming(headers: Headers): boolean {
  const xfo = headers.get('x-frame-options')?.trim().toLowerCase();
  if (xfo && xfo !== 'allowall') return false;
  const csp = headers.get('content-security-policy') ?? '';
  const directive = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.toLowerCase().startsWith('frame-ancestors'));
  if (!directive) return true;
  const sources = directive.split(/\s+/).slice(1);
  return sources.some(
    (s) =>
      s === '*' ||
      s === 'https:' ||
      SITE_ORIGINS.some((origin) => s.replace(/^\*\./, '').endsWith(origin)),
  );
}

async function frameable(fetchImpl: Fetch, url: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await get(fetchImpl, url);
    void res.body?.cancel();
    if (!res.ok) return { ok: false, reason: `player HTTP ${res.status}` };
    if (!allowsFraming(res.headers))
      return { ok: false, reason: 'player does not allow embedding' };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `player unreachable: ${(error as Error).message}` };
  }
}

async function imageLoads(
  fetchImpl: Fetch,
  url: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await get(fetchImpl, url);
    const type = res.headers.get('content-type') ?? '';
    void res.body?.cancel();
    if (!res.ok) return { ok: false, reason: `image HTTP ${res.status}` };
    if (!type.startsWith('image/'))
      return { ok: false, reason: `not an image (${type || 'no type'})` };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `image unreachable: ${(error as Error).message}` };
  }
}

const ytPreview = (id: string): string => `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg`;
const ytEmbed = (id: string): string =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0`;

interface YtVideo {
  id: string;
  snippet?: { title?: string; channelId?: string; liveBroadcastContent?: string };
}

async function ytJson<T>(fetchImpl: Fetch, path: string, key: string): Promise<T> {
  const res = await get(fetchImpl, `${YT_API}/${path}&key=${encodeURIComponent(key)}`);
  // Never put the key in an error message
  if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function videos(fetchImpl: Fetch, ids: string[], key: string): Promise<YtVideo[]> {
  if (ids.length === 0) return [];
  const data = await ytJson<{ items?: YtVideo[] }>(
    fetchImpl,
    `videos?part=snippet&id=${ids.map(encodeURIComponent).join(',')}`,
    key,
  );
  return data.items ?? [];
}

const isLive = (v: YtVideo): boolean => v.snippet?.liveBroadcastContent === 'live';

/** The channel's live video that best fits `match`, or null when nothing is live */
export async function findLiveVideo(
  fetchImpl: Fetch,
  source: Extract<WebcamSource, { provider: 'youtube' }>,
  key: string,
): Promise<{ videoId: string | null; channelId: string | null }> {
  const seedVideos = await videos(fetchImpl, source.seeds, key);
  const pattern = source.match ? new RegExp(source.match, 'i') : null;
  const fits = (v: YtVideo): boolean => !pattern || pattern.test(v.snippet?.title ?? '');

  const liveSeed = seedVideos.find(isLive);
  const channelId =
    source.channelId ?? seedVideos.find((v) => v.snippet?.channelId)?.snippet?.channelId ?? null;
  if (liveSeed) return { videoId: liveSeed.id, channelId };
  if (!channelId?.startsWith('UC')) return { videoId: null, channelId };

  // Live streams appear in the channel's uploads playlist (UC… → UU…)
  const uploads = `UU${channelId.slice(2)}`;
  const playlist = await ytJson<{ items?: { contentDetails?: { videoId?: string } }[] }>(
    fetchImpl,
    `playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}`,
    key,
  );
  const ids = (playlist.items ?? []).flatMap((i) =>
    i.contentDetails?.videoId ? [i.contentDetails.videoId] : [],
  );
  const live = (await videos(fetchImpl, ids, key)).filter(isLive);
  const pick = live.find(fits) ?? (pattern ? undefined : live[0]);
  return { videoId: pick?.id ?? null, channelId };
}

async function resolveCamera(
  fetchImpl: Fetch,
  config: ResortWebcamConfig,
  youtubeKey: string | undefined,
): Promise<ResortWebcam> {
  const { page, camera } = config;
  if (!camera) return { page, camera: null, status: 'unavailable', reason: 'no embeddable camera' };
  const { name, source } = camera;
  const fail = (status: WebcamStatus, reason: string): ResortWebcam => ({
    page,
    camera: null,
    status,
    reason,
  });

  switch (source.provider) {
    case 'youtube': {
      if (youtubeKey) {
        try {
          const { videoId, channelId } = await findLiveVideo(fetchImpl, source, youtubeKey);
          if (!videoId)
            return fail(
              'offline',
              channelId
                ? `not live on channel ${channelId}`
                : 'not live, and the channel is unknown',
            );
          return {
            page,
            status: 'ok',
            camera: {
              name,
              kind: 'live',
              preview: ytPreview(videoId),
              refreshPreview: false,
              embed: ytEmbed(videoId),
            },
          };
        } catch (error) {
          return fail('unavailable', (error as Error).message);
        }
      }
      // No key: we can only tell whether the seed video still exists
      const seed = source.seeds[0]!;
      try {
        const res = await get(
          fetchImpl,
          `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${seed}`)}&format=json`,
        );
        void res.body?.cancel();
        if (!res.ok) return fail('offline', `video ${seed} unavailable (HTTP ${res.status})`);
      } catch (error) {
        return fail('unavailable', `oEmbed unreachable: ${(error as Error).message}`);
      }
      return {
        page,
        status: 'ok',
        camera: {
          name,
          kind: 'live',
          preview: ytPreview(seed),
          refreshPreview: false,
          embed: ytEmbed(seed),
        },
      };
    }
    case 'camstreamer': {
      const check = await frameable(fetchImpl, source.embed);
      if (!check.ok) return fail('unavailable', check.reason!);
      return {
        page,
        status: 'ok',
        camera: {
          name,
          kind: 'live',
          preview: source.previewVideoId ? ytPreview(source.previewVideoId) : null,
          refreshPreview: false,
          embed: source.embed,
        },
      };
    }
    case 'brownrice': {
      const snapshot = `https://player.brownrice.com/snapshot/${source.stream}`;
      const embed = `https://player.brownrice.com/embed/${source.stream}`;
      const [image, player] = await Promise.all([
        imageLoads(fetchImpl, snapshot),
        frameable(fetchImpl, embed),
      ]);
      if (!image.ok && !player.ok) return fail('unavailable', `${image.reason}; ${player.reason}`);
      return {
        page,
        status: 'ok',
        camera: {
          name,
          // A snapshot alone still beats a link; a player alone still plays
          kind: player.ok ? 'live' : 'still',
          preview: image.ok ? snapshot : null,
          refreshPreview: image.ok,
          embed: player.ok ? embed : null,
        },
      };
    }
    case 'roundshot': {
      const check = await frameable(fetchImpl, source.url);
      if (!check.ok) return fail('unavailable', check.reason!);
      return {
        page,
        status: 'ok',
        camera: { name, kind: 'panorama', preview: null, refreshPreview: false, embed: source.url },
      };
    }
    case 'hdrelay': {
      // First URL that returns an image, in order
      const reasons: string[] = [];
      for (const snapshot of source.snapshots) {
        const check = await imageLoads(fetchImpl, snapshot);
        if (check.ok)
          return {
            page,
            status: 'ok',
            camera: { name, kind: 'still', preview: snapshot, refreshPreview: true, embed: null },
          };
        reasons.push(check.reason!);
      }
      return fail('unavailable', [...new Set(reasons)].join('; '));
    }
  }
}

export function createSkiWebcamService(
  youtubeKey: string | undefined,
  fetchImpl: Fetch = fetch,
  sources: Record<string, ResortWebcamConfig> = SKI_WEBCAM_SOURCES,
) {
  const loader = cachedLoader<SkiWebcamsResult>(TTL_MS, async () => {
    const entries = await Promise.all(
      Object.entries(sources).map(
        async ([id, config]) => [id, await resolveCamera(fetchImpl, config, youtubeKey)] as const,
      ),
    );
    return {
      checkedAt: new Date().toISOString(),
      youtubeLookup: Boolean(youtubeKey),
      resorts: Object.fromEntries(entries),
    };
  });
  return { get: () => loader.get(), reset: () => loader.reset() };
}
