import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import { getRadarInfo, getRainViewerRadar } from '../radar.js';

const IEM_JSON = 'https://mesonet.agron.iastate.edu/json/radar.py';
const RAINVIEWER = 'https://api.rainviewer.com/public/weather-maps.json';
const TILE =
  'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::CONUS-NEXRAD-N0Q/{z}/{x}/{y}.png';

afterEach(() => {
  vi.useRealTimers();
});

describe('getRadarInfo', () => {
  const NOW = new Date('2026-01-15T14:52:37.123Z');

  function expectSixFrames(info: Awaited<ReturnType<typeof getRadarInfo>>): void {
    expect(info.tilePattern).toBe(TILE);
    expect(info.baseUrl).toBe(
      'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::CONUS-NEXRAD-N0Q',
    );
    // 6 frames, 5 min apart, ending at "now" rounded down to 5 minutes
    expect(info.timestamps.map((t) => t.time)).toEqual([
      '2026-01-15T14:25:00.000Z',
      '2026-01-15T14:30:00.000Z',
      '2026-01-15T14:35:00.000Z',
      '2026-01-15T14:40:00.000Z',
      '2026-01-15T14:45:00.000Z',
      '2026-01-15T14:50:00.000Z',
    ]);
    expect(info.timestamps.every((t) => t.path === TILE)).toBe(true);
  }

  it('returns six 5-minute frames when IEM is available', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    server.use(http.get(IEM_JSON, () => HttpResponse.json(loadJson('iem/radar.json'))));

    expectSixFrames(await getRadarInfo());
  });

  it('falls back to generated frames on a non-OK response', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    server.use(http.get(IEM_JSON, () => new HttpResponse(null, { status: 503 })));

    expectSixFrames(await getRadarInfo());
  });

  it('falls back on network error and malformed JSON', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    server.use(http.get(IEM_JSON, () => HttpResponse.error()));
    expectSixFrames(await getRadarInfo());

    server.use(http.get(IEM_JSON, () => HttpResponse.text('not json')));
    expectSixFrames(await getRadarInfo());
  });
});

describe('getRainViewerRadar', () => {
  it('returns the last six past frames with tile URLs', async () => {
    server.use(
      http.get(RAINVIEWER, () => HttpResponse.json(loadJson('rainviewer/weather-maps.json'))),
    );

    const info = await getRainViewerRadar();

    expect(info.baseUrl).toBe('https://tilecache.rainviewer.com');
    expect(info.timestamps).toHaveLength(6);
    expect(info.timestamps[0]).toEqual({
      time: new Date(1768485600 * 1000).toISOString(),
      path: 'https://tilecache.rainviewer.com/v2/radar/1768485600/256/{z}/{x}/{y}/2/1_1.png',
    });
    expect(info.tilePattern).toBe(
      'https://tilecache.rainviewer.com/v2/radar/1768488600/256/{z}/{x}/{y}/2/1_1.png',
    );
  });

  it('throws on a non-OK response', async () => {
    server.use(http.get(RAINVIEWER, () => new HttpResponse(null, { status: 500 })));
    await expect(getRainViewerRadar()).rejects.toThrow('RainViewer API error: 500');
  });

  it.each([
    ['no radar key', {}],
    ['empty past frames', { radar: { past: [] } }],
  ])('throws when the response has %s', async (_name, body) => {
    server.use(http.get(RAINVIEWER, () => HttpResponse.json(body)));
    await expect(getRainViewerRadar()).rejects.toThrow('RainViewer API returned no radar frames');
  });

  it('rejects on network error', async () => {
    server.use(http.get(RAINVIEWER, () => HttpResponse.error()));
    await expect(getRainViewerRadar()).rejects.toThrow();
  });
});
