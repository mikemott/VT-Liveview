/**
 * One base-area camera per ski resort, pointing up the mountain (VTL-87).
 *
 * These are the resorts' own published feeds. services/skiWebcams.ts checks
 * them and resolves the live ones; the frontend only shows what passes. Keyed
 * by the `id` of the skiResorts query. Aggregator mirrors (SnowStash,
 * OnTheSnow, OpenSnow) are only for finding a source, never for display.
 */

export type WebcamSource =
  /**
   * A YouTube live stream. Resorts restart streams (new video ID), so with a
   * YOUTUBE_API_KEY the service finds the channel's current live video; the
   * channel comes from `channelId` or from any seed video that still exists.
   * `match` picks the right stream on a channel that runs several.
   */
  | { provider: 'youtube'; seeds: string[]; channelId?: string; match?: string }
  /** CamStreamer's permanent embed, which always plays the current stream */
  | { provider: 'camstreamer'; embed: string; previewVideoId?: string }
  | { provider: 'brownrice'; stream: string }
  | { provider: 'roundshot'; url: string }
  /** HDRelay player links are signed and expire; only the snapshot is public */
  | { provider: 'hdrelay'; snapshot: string };

export interface ResortWebcamConfig {
  /** The resort's own webcam page: credit and fallback link */
  page: string;
  camera?: { name: string; source: WebcamSource };
}

export const SKI_WEBCAM_SOURCES: Record<string, ResortWebcamConfig> = {
  stowe: {
    page: 'https://www.stowe.com/explore/webcams/',
    camera: {
      name: 'Spruce Peak village',
      source: { provider: 'brownrice', stream: 'stowevillage2' },
    },
  },
  sugarbush: {
    page: 'https://www.sugarbush.com/mountain/webcams/',
    camera: {
      name: 'Gate House Plaza',
      source: { provider: 'youtube', seeds: ['jhCh3dsEv-M'], match: 'gate\\s*house\\s*plaza' },
    },
  },
  killington: {
    page: 'https://www.killington.com/the-mountain/conditions-weather/webcam/',
    camera: {
      name: 'K-1 Lodge panorama',
      source: { provider: 'roundshot', url: 'https://killington.roundshot.com/baselodge/' },
    },
  },
  'pico-mountain': {
    page: 'https://www.picomountain.com/the-mountain/conditions-weather/webcams/',
    camera: {
      name: 'Base',
      source: {
        provider: 'hdrelay',
        snapshot: 'https://b14.hdrelay.com/camera/84943abb-01cd-4907-8cc2-a9a7680d7529/snapshot',
      },
    },
  },
  okemo: {
    page: 'https://www.okemo.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    camera: { name: 'Roundhouse', source: { provider: 'brownrice', stream: 'okemoroundhouse' } },
  },
  'mount-snow': {
    page: 'https://www.mountsnow.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    camera: { name: 'Main Base Area', source: { provider: 'brownrice', stream: 'mountsnowbase' } },
  },
  stratton: {
    page: 'https://www.stratton.com/the-mountain/webcams',
    camera: {
      name: 'Main Base',
      source: {
        provider: 'camstreamer',
        embed: 'https://camstreamer.com/embed/70ccf46040b5642/S-19241?rel=0',
        previewVideoId: 'H-_sGi4Sbtk',
      },
    },
  },
  'jay-peak': {
    page: 'https://jaypeakresort.com/resort/photo-day',
    camera: {
      name: 'Tramside',
      source: {
        provider: 'hdrelay',
        snapshot: 'https://b10.hdrelay.com/camera/6526fd5a071b19b5189bb07b/snapshot',
      },
    },
  },
  'bolton-valley': {
    page: 'https://boltonvalley.com/the-resort/web-cams/',
    camera: {
      name: 'Base Lodge',
      source: { provider: 'youtube', seeds: ['VX9ANOUYO1k'], match: 'base' },
    },
  },
  'smugglers-notch': {
    page: 'https://smuggs.com/conditions-stats/web-cams',
    camera: {
      name: 'Madonna Base',
      source: { provider: 'youtube', seeds: ['n7kDiEJvdkc'], match: 'madonna|sterling' },
    },
  },
  'mad-river-glen': {
    page: 'https://www.madriverglen.com/live-web-cam/',
    camera: {
      name: 'Single Chair Base',
      source: {
        provider: 'camstreamer',
        embed: 'https://camstreamer.com/embed/5f68f8edaf383f3/S-47426?rel=0',
        previewVideoId: 'wVOqgmbvCrY',
      },
    },
  },
  'magic-mountain': {
    page: 'https://skivermont.com/resort-cams',
    camera: {
      name: 'Base Area',
      source: { provider: 'youtube', seeds: ['PftG9GACVnw', 'L7-VcbcMXS8'], match: 'base' },
    },
  },
  'middlebury-snow-bowl': {
    page: 'https://skivermont.com/resort-cams',
    camera: { name: 'Snow Bowl', source: { provider: 'youtube', seeds: ['3d93JhapHP4'] } },
  },
  // Cameras exist, but no public source to embed yet: link to the resort
  'burke-mountain': { page: 'https://skiburke.com/the-mountain/webcams' },
  'bromley-mountain': { page: 'https://www.bromley.com/webcams/' },
};
