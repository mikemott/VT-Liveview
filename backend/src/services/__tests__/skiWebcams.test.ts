import { describe, expect, it } from 'vitest';
import { allowsFraming, createSkiWebcamService, findLiveVideo, type Fetch } from '../skiWebcams.js';
import { SKI_WEBCAM_SOURCES, type ResortWebcamConfig } from '../../data/skiWebcams.js';

type Route = (url: URL) => Response | Promise<Response>;

/** A fake network: the first route whose prefix matches answers; others are a 404 */
function fakeFetch(routes: Record<string, Route>): Fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push(url.href);
    const hit = Object.entries(routes).find(([prefix]) => url.href.startsWith(prefix));
    return hit ? hit[1](url) : new Response('not found', { status: 404 });
  }) as Fetch & { calls: string[] };
  fn.calls = calls;
  return fn;
}

const image = (): Response => new Response('img', { headers: { 'content-type': 'image/jpeg' } });
const page = (headers: Record<string, string> = {}): Response =>
  new Response('<html></html>', { headers: { 'content-type': 'text/html', ...headers } });
const json = (body: unknown): Response => Response.json(body);

const YT = 'https://www.googleapis.com/youtube/v3';
const video = (id: string, title: string, live: boolean, channelId = 'UCmagic123') => ({
  id,
  snippet: { title, channelId, liveBroadcastContent: live ? 'live' : 'none' },
});

describe('allowsFraming', () => {
  it('reads X-Frame-Options and CSP frame-ancestors', () => {
    expect(allowsFraming(new Headers())).toBe(true);
    expect(allowsFraming(new Headers({ 'x-frame-options': 'SAMEORIGIN' }))).toBe(false);
    expect(
      allowsFraming(new Headers({ 'content-security-policy': "frame-ancestors 'self'" })),
    ).toBe(false);
    expect(allowsFraming(new Headers({ 'content-security-policy': 'frame-ancestors *' }))).toBe(
      true,
    );
    expect(
      allowsFraming(
        new Headers({
          'content-security-policy': "default-src 'self'; frame-ancestors https://*.vtliveview.com",
        }),
      ),
    ).toBe(true);
  });
});

describe('findLiveVideo', () => {
  const source = { provider: 'youtube' as const, seeds: ['oldEnded'], match: 'base' };

  it('follows the channel to its new live stream after a restart', async () => {
    const fetchImpl = fakeFetch({
      [`${YT}/videos?part=snippet&id=oldEnded&`]: () =>
        json({ items: [video('oldEnded', 'Base Area', false)] }),
      [`${YT}/playlistItems`]: (url) => {
        expect(url.searchParams.get('playlistId')).toBe('UUmagic123');
        return json({
          items: [
            { contentDetails: { videoId: 'summitNow' } },
            { contentDetails: { videoId: 'baseNow' } },
          ],
        });
      },
      [`${YT}/videos?part=snippet&id=summitNow,baseNow&`]: () =>
        json({
          items: [video('summitNow', 'Summit Cam', true), video('baseNow', 'Base Area Live', true)],
        }),
    });
    expect(await findLiveVideo(fetchImpl, source, 'KEY')).toEqual({
      videoId: 'baseNow',
      channelId: 'UCmagic123',
    });
  });

  it('uses a seed that is still live without listing the channel', async () => {
    const fetchImpl = fakeFetch({
      [`${YT}/videos`]: () => json({ items: [video('oldEnded', 'Base Area', true)] }),
    });
    expect((await findLiveVideo(fetchImpl, source, 'KEY')).videoId).toBe('oldEnded');
    expect(fetchImpl.calls.some((c) => c.includes('playlistItems'))).toBe(false);
  });

  it('reports nothing live when the seed is gone and the channel is unknown', async () => {
    const fetchImpl = fakeFetch({ [`${YT}/videos`]: () => json({ items: [] }) });
    expect(await findLiveVideo(fetchImpl, source, 'KEY')).toEqual({
      videoId: null,
      channelId: null,
    });
  });
});

describe('createSkiWebcamService', () => {
  const sources: Record<string, ResortWebcamConfig> = {
    yt: {
      page: 'https://yt.example/cams',
      camera: { name: 'Base', source: { provider: 'youtube', seeds: ['abc'] } },
    },
    still: {
      page: 'https://jay.example/cams',
      camera: {
        name: 'Tramside',
        source: { provider: 'hdrelay', snapshot: 'https://b10.hdrelay.com/camera/x/snapshot' },
      },
    },
    blocked: {
      page: 'https://pico.example/cams',
      camera: {
        name: 'Base',
        source: { provider: 'hdrelay', snapshot: 'https://b14.hdrelay.com/camera/y/snapshot' },
      },
    },
    br: {
      page: 'https://stowe.example/cams',
      camera: { name: 'Village', source: { provider: 'brownrice', stream: 'cam1' } },
    },
    pano: {
      page: 'https://k.example/cams',
      camera: {
        name: 'Pano',
        source: { provider: 'roundshot', url: 'https://k.roundshot.com/base/' },
      },
    },
    link: { page: 'https://burke.example/cams' },
  };

  const network = {
    'https://www.youtube.com/oembed': () => json({ title: 'Base cam' }),
    'https://b10.hdrelay.com/': image,
    'https://b14.hdrelay.com/': () => new Response('Forbidden', { status: 403 }),
    'https://player.brownrice.com/snapshot/': image,
    'https://player.brownrice.com/embed/': () => page({ 'x-frame-options': 'SAMEORIGIN' }),
    'https://k.roundshot.com/': () => page(),
  };

  it('keeps working cameras and turns broken ones into the resort link', async () => {
    const { resorts, youtubeLookup } = await createSkiWebcamService(
      undefined,
      fakeFetch(network),
      sources,
    ).get();
    expect(youtubeLookup).toBe(false);
    expect(resorts.yt).toMatchObject({ status: 'ok', camera: { kind: 'live' } });
    expect(resorts.yt!.camera!.embed).toContain('youtube-nocookie.com/embed/abc');
    expect(resorts.still).toMatchObject({
      status: 'ok',
      camera: {
        kind: 'still',
        preview: 'https://b10.hdrelay.com/camera/x/snapshot',
        refreshPreview: true,
        embed: null,
      },
    });
    expect(resorts.blocked).toEqual({
      page: 'https://pico.example/cams',
      camera: null,
      status: 'unavailable',
      reason: 'image HTTP 403',
    });
    // Snapshot works but the player refuses embedding: show the still
    expect(resorts.br).toMatchObject({
      status: 'ok',
      camera: { kind: 'still', embed: null, refreshPreview: true },
    });
    expect(resorts.pano).toMatchObject({
      status: 'ok',
      camera: { kind: 'panorama', preview: null, embed: 'https://k.roundshot.com/base/' },
    });
    expect(resorts.link).toMatchObject({ camera: null, status: 'unavailable' });
  });

  it('marks a removed YouTube video offline without a key', async () => {
    const fetchImpl = fakeFetch({
      ...network,
      'https://www.youtube.com/oembed': () => new Response('', { status: 404 }),
    });
    const { resorts } = await createSkiWebcamService(undefined, fetchImpl, sources).get();
    expect(resorts.yt).toMatchObject({
      camera: null,
      status: 'offline',
      reason: 'video abc unavailable (HTTP 404)',
    });
  });

  it('caches the result for 30 minutes', async () => {
    const fetchImpl = fakeFetch(network);
    const service = createSkiWebcamService(undefined, fetchImpl, sources);
    await service.get();
    const n = fetchImpl.calls.length;
    await service.get();
    expect(fetchImpl.calls.length).toBe(n);
  });

  it('never leaks the API key into a reason', async () => {
    const fetchImpl = fakeFetch({ [`${YT}/`]: () => new Response('quota', { status: 403 }) });
    const { resorts } = await createSkiWebcamService('SECRET-KEY', fetchImpl, {
      yt: sources.yt!,
    }).get();
    expect(resorts.yt!.reason).toBe('YouTube API HTTP 403');
    expect(JSON.stringify(resorts)).not.toContain('SECRET-KEY');
  });
});

describe('SKI_WEBCAM_SOURCES', () => {
  it('uses https everywhere and never an aggregator mirror', () => {
    for (const [id, { page, camera }] of Object.entries(SKI_WEBCAM_SOURCES)) {
      expect(page, id).toMatch(/^https:\/\//);
      expect(JSON.stringify(camera ?? {}), id).not.toMatch(
        /snowstash|onthesnow|ots-webcams|opensnow/,
      );
    }
  });
});
