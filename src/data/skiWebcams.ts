/**
 * One base-area camera per ski resort, pointing up the mountain (VTL-87).
 *
 * Every entry is the resort's own published feed: an embeddable player where
 * the provider allows it, otherwise the provider's public still image. We
 * never copy or re-host images. Keyed by the `id` of the skiResorts query.
 *
 * YouTube live IDs change when a resort restarts its stream: re-check with
 *   https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json
 * and update `checked`. Aggregator mirrors (SnowStash, OnTheSnow, OpenSnow)
 * are only for finding the original source, never for display.
 */

interface SkiWebcamBase {
  /** The camera's name as the resort gives it */
  name: string;
  /** The resort's own webcam page: credit and fallback link */
  page: string;
  /** Date the source was last confirmed (YYYY-MM-DD) */
  checked: string;
}

export type SkiWebcam = SkiWebcamBase &
  (
    | { provider: 'youtube'; videoId: string }
    | { provider: 'brownrice'; stream: string }
    | { provider: 'roundshot'; url: string }
    | { provider: 'hdrelay'; snapshot: string }
  );

/** A resort we know a webcam page for, with or without an embeddable camera */
export interface ResortWebcams {
  page: string;
  camera?: SkiWebcam;
}

const yt = (name: string, videoId: string, page: string): SkiWebcam => ({
  name,
  provider: 'youtube',
  videoId,
  page,
  checked: '2026-11-17',
});

const brownrice = (name: string, stream: string, page: string): SkiWebcam => ({
  name,
  provider: 'brownrice',
  stream,
  page,
  checked: '2026-11-17',
});

const hdrelay = (name: string, snapshot: string, page: string): SkiWebcam => ({
  name,
  provider: 'hdrelay',
  snapshot,
  page,
  checked: '2026-11-17',
});

const PAGES = {
  stowe: 'https://www.stowe.com/explore/webcams/',
  sugarbush: 'https://www.sugarbush.com/mountain/webcams/',
  killington: 'https://www.killington.com/the-mountain/conditions-weather/webcam/',
  pico: 'https://www.picomountain.com/the-mountain/conditions-weather/webcams/',
  okemo: 'https://www.okemo.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  mountSnow: 'https://www.mountsnow.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  stratton: 'https://www.stratton.com/the-mountain/webcams',
  jay: 'https://jaypeakresort.com/resort/photo-day',
  bolton: 'https://boltonvalley.com/the-resort/web-cams/',
  smuggs: 'https://www.smuggs.com/pages/universal/relay-baselodge-webcam.php',
  madRiver: 'https://www.madriverglen.com/live-web-cam/',
  burke: 'https://skiburke.com/the-mountain/webcams',
  bromley: 'https://www.bromley.com/webcams/',
  // Magic and Middlebury publish their cams only on YouTube
  magic: 'https://www.youtube.com/watch?v=PftG9GACVnw',
  middlebury: 'https://www.youtube.com/watch?v=3d93JhapHP4',
};

export const SKI_WEBCAMS: Record<string, ResortWebcams> = {
  stowe: {
    page: PAGES.stowe,
    camera: brownrice('Spruce Peak village', 'stowevillage2', PAGES.stowe),
  },
  sugarbush: {
    page: PAGES.sugarbush,
    camera: yt('Gate House Plaza', 'jhCh3dsEv-M', PAGES.sugarbush),
  },
  killington: {
    page: PAGES.killington,
    camera: {
      name: 'K-1 Lodge panorama',
      provider: 'roundshot',
      url: 'https://killington.roundshot.com/baselodge/',
      page: PAGES.killington,
      checked: '2026-11-17',
    },
  },
  'pico-mountain': {
    page: PAGES.pico,
    camera: hdrelay(
      'Base',
      'https://b14.hdrelay.com/camera/84943abb-01cd-4907-8cc2-a9a7680d7529/snapshot',
      PAGES.pico,
    ),
  },
  okemo: {
    page: PAGES.okemo,
    camera: brownrice('Roundhouse', 'okemoroundhouse', PAGES.okemo),
  },
  'mount-snow': {
    page: PAGES.mountSnow,
    camera: brownrice('Main Base Area', 'mountsnowbase', PAGES.mountSnow),
  },
  stratton: {
    page: PAGES.stratton,
    camera: yt('Main Base', 'H-_sGi4Sbtk', PAGES.stratton),
  },
  'jay-peak': {
    page: PAGES.jay,
    camera: hdrelay(
      'Tramside',
      'https://b10.hdrelay.com/camera/6526fd5a071b19b5189bb07b/snapshot',
      PAGES.jay,
    ),
  },
  'bolton-valley': {
    page: PAGES.bolton,
    camera: yt('Base Lodge', 'VX9ANOUYO1k', PAGES.bolton),
  },
  'smugglers-notch': {
    page: PAGES.smuggs,
    camera: yt('Madonna Base', 'n7kDiEJvdkc', PAGES.smuggs),
  },
  'mad-river-glen': {
    page: PAGES.madRiver,
    camera: yt('Single Chair Base', 'wVOqgmbvCrY', PAGES.madRiver),
  },
  'magic-mountain': {
    page: PAGES.magic,
    camera: yt('Base Area', 'PftG9GACVnw', PAGES.magic),
  },
  'middlebury-snow-bowl': {
    page: PAGES.middlebury,
    camera: yt('Snow Bowl', '3d93JhapHP4', PAGES.middlebury),
  },
  // Cameras exist, but no public source to embed yet: link to the resort
  'burke-mountain': { page: PAGES.burke },
  'bromley-mountain': { page: PAGES.bromley },
};

/** Ten-minute cache key for still images, so an open panel shows a fresh frame */
export function snapshotStamp(now: number = Date.now()): number {
  return Math.floor(now / 600_000);
}

/** Preview image for a camera, or null when there's none (a neutral tile shows) */
export function webcamPreview(camera: SkiWebcam, now: number = Date.now()): string | null {
  switch (camera.provider) {
    case 'youtube':
      return `https://i.ytimg.com/vi/${camera.videoId}/hqdefault_live.jpg`;
    case 'brownrice':
      return `https://player.brownrice.com/snapshot/${camera.stream}?t=${snapshotStamp(now)}`;
    case 'hdrelay':
      return `${camera.snapshot}?t=${snapshotStamp(now)}`;
    case 'roundshot':
      return null;
  }
}

/** Live player to embed on tap, or null for still-only feeds */
export function webcamEmbed(camera: SkiWebcam): string | null {
  switch (camera.provider) {
    case 'youtube':
      return `https://www.youtube-nocookie.com/embed/${camera.videoId}?autoplay=1&mute=1&playsinline=1&rel=0`;
    case 'brownrice':
      return `https://player.brownrice.com/embed/${camera.stream}`;
    case 'roundshot':
      return camera.url;
    case 'hdrelay':
      // Player URLs are signed and expire; link to the resort instead
      return null;
  }
}
