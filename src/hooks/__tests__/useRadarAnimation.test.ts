/**
 * Tests for the radar animation hook (RainViewer frames, IEM fallback).
 * Uses fake timers for the animation interval, retry backoff and 5-minute refresh.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import rainviewerRaw from '@/__fixtures__/rainviewer/weather-maps.json?raw';
import { useRadarAnimation } from '../useRadarAnimation';
import { INTERVALS, RADAR_CONFIG } from '@/utils/constants';

const RAINVIEWER_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const IEM_PREFIX = 'https://mesonet.agron.iastate.edu/';

interface Frame {
  time: number;
  path: string;
}
interface RainViewerFixture {
  radar: { past: Frame[]; nowcast?: Frame[] };
}
const fixture = JSON.parse(rainviewerRaw) as RainViewerFixture;

/** Flush pending promises/microtasks (MSW responses) without moving the clock much. */
async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Advance through all retry backoffs (1s + 2s) so the fallback path completes. */
async function exhaustRetries(): Promise<void> {
  await flush();
  await flush(1000);
  await flush(2000);
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useRadarAnimation – loading', () => {
  it('starts loading, then exposes the last N past frames plus up to 2 nowcast frames', async () => {
    server.use(http.get(RAINVIEWER_URL, () => HttpResponse.json(fixture)));
    const { result } = renderHook(() => useRadarAnimation(null));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.currentFrameData).toBeNull();

    await flush();

    const { frames } = result.current;
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(frames).toHaveLength(RADAR_CONFIG.frameCount + 2);

    const pastPaths = fixture.radar.past.slice(-RADAR_CONFIG.frameCount).map((f) => f.path);
    expect(frames.slice(0, RADAR_CONFIG.frameCount).map((f) => f.path)).toEqual(pastPaths);
    expect(frames.slice(-2).every((f) => f.isNowcast)).toBe(true);

    const first = frames[0]!;
    expect(first.tileUrl).toBe(
      `https://tilecache.rainviewer.com${first.path}/256/{z}/{x}/{y}/2/1_1.png`,
    );
    expect(first.time).toBe(new Date(first.timestamp * 1000).toISOString());

    // Starts on the most recent past frame
    expect(result.current.currentFrame).toBe(RADAR_CONFIG.frameCount - 1);
    expect(result.current.currentFrameData?.path).toBe(pastPaths.at(-1));
  });

  it('honours a custom frameCount and works without nowcast frames', async () => {
    server.use(
      http.get(RAINVIEWER_URL, () =>
        HttpResponse.json({ ...fixture, radar: { past: fixture.radar.past } }),
      ),
    );
    const { result } = renderHook(() => useRadarAnimation(null, { frameCount: 2 }));
    await flush();
    expect(result.current.frames).toHaveLength(2);
    expect(result.current.frames.some((f) => f.isNowcast)).toBe(false);
    expect(result.current.currentFrame).toBe(1);
  });
});

describe('useRadarAnimation – playback', () => {
  beforeEach(() => {
    server.use(http.get(RAINVIEWER_URL, () => HttpResponse.json(fixture)));
  });

  it('does not advance while paused', async () => {
    const { result } = renderHook(() => useRadarAnimation(null));
    await flush();
    const start = result.current.currentFrame;
    await flush(RADAR_CONFIG.frameDelay * 3);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentFrame).toBe(start);
  });

  it('advances one frame per frameDelay while playing and wraps around', async () => {
    const { result } = renderHook(() => useRadarAnimation(null, { frameDelay: 100 }));
    await flush();
    const total = result.current.frames.length; // 6
    const start = result.current.currentFrame; // 3

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    await flush(100);
    expect(result.current.currentFrame).toBe((start + 1) % total);
    await flush(100 * (total - 1));
    expect(result.current.currentFrame).toBe(start); // full loop

    act(() => result.current.pause());
    await flush(500);
    expect(result.current.currentFrame).toBe(start);
  });

  it('autoPlay starts playing immediately', async () => {
    const { result } = renderHook(() => useRadarAnimation(null, { autoPlay: true }));
    expect(result.current.isPlaying).toBe(true);
    await flush();
    const start = result.current.currentFrame;
    await flush(RADAR_CONFIG.frameDelay);
    expect(result.current.currentFrame).toBe((start + 1) % result.current.frames.length);
  });

  it('toggle flips play state', async () => {
    const { result } = renderHook(() => useRadarAnimation(null));
    await flush();
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
  });

  it('steps forward/back with wrap-around', async () => {
    const { result } = renderHook(() => useRadarAnimation(null));
    await flush();
    const total = result.current.frames.length;

    act(() => result.current.goToFrame(0));
    expect(result.current.currentFrame).toBe(0);
    act(() => result.current.prevFrame());
    expect(result.current.currentFrame).toBe(total - 1);
    act(() => result.current.nextFrame());
    expect(result.current.currentFrame).toBe(0);
    act(() => result.current.nextFrame());
    expect(result.current.currentFrame).toBe(1);
  });

  it('goToFrame ignores out-of-range indices', async () => {
    const { result } = renderHook(() => useRadarAnimation(null));
    await flush();
    act(() => result.current.goToFrame(2));
    act(() => result.current.goToFrame(-1));
    act(() => result.current.goToFrame(result.current.frames.length));
    expect(result.current.currentFrame).toBe(2);
  });

  it('step controls are no-ops before any frames load', () => {
    server.use(http.get(RAINVIEWER_URL, () => new Promise<never>(() => {})));
    const { result } = renderHook(() => useRadarAnimation(null));
    act(() => {
      result.current.nextFrame();
      result.current.prevFrame();
      result.current.goToFrame(0);
    });
    expect(result.current.currentFrame).toBe(0);
    expect(result.current.frames).toEqual([]);
  });
});

describe('useRadarAnimation – refresh', () => {
  it('refetches every RADAR_REFRESH interval', async () => {
    let calls = 0;
    server.use(
      http.get(RAINVIEWER_URL, () => {
        calls++;
        return HttpResponse.json(fixture);
      }),
    );
    renderHook(() => useRadarAnimation(null));
    await flush();
    expect(calls).toBe(1);
    await flush(INTERVALS.RADAR_REFRESH);
    expect(calls).toBe(2);
    await flush(INTERVALS.RADAR_REFRESH);
    expect(calls).toBe(3);
  });

  it('refresh() refetches and picks up new frames', async () => {
    let past = fixture.radar.past.slice(0, 4);
    server.use(http.get(RAINVIEWER_URL, () => HttpResponse.json({ radar: { past } })));
    const { result } = renderHook(() => useRadarAnimation(null));
    await flush();
    expect(result.current.frames.at(-1)?.path).toBe(fixture.radar.past[3]!.path);

    past = fixture.radar.past.slice(1, 5);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.frames.at(-1)?.path).toBe(fixture.radar.past[4]!.path);
  });

  it.todo(
    'overlapping interval/manual refreshes are aborted or sequenced so a stale response cannot overwrite a newer one (FINDINGS Medium: useRadarAnimation.ts:258/:316)',
  );
});

describe('useRadarAnimation – failure and fallback', () => {
  it('retries with backoff and succeeds on a later attempt', async () => {
    let calls = 0;
    server.use(
      http.get(RAINVIEWER_URL, () => {
        calls++;
        return calls === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json(fixture);
      }),
    );
    const { result } = renderHook(() => useRadarAnimation(null));
    await flush();
    expect(calls).toBe(1);
    await flush(999);
    expect(calls).toBe(1); // still in the 1s backoff
    await flush(1);
    expect(calls).toBe(2);
    expect(result.current.error).toBeNull();
    expect(result.current.frames[0]?.path).not.toBeNull();
  });

  it('falls back to a single IEM frame after 3 failed attempts', async () => {
    let calls = 0;
    server.use(
      http.get(RAINVIEWER_URL, () => {
        calls++;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { result } = renderHook(() => useRadarAnimation(null));
    await exhaustRetries();

    expect(calls).toBe(3);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('RainViewer API returned 500');
    expect(result.current.frames).toHaveLength(1);
    expect(result.current.frames[0]?.path).toBeNull();
    expect(result.current.frames[0]?.tileUrl.startsWith(IEM_PREFIX)).toBe(true);
    expect(result.current.currentFrameData).toBe(result.current.frames[0]);
  });

  it('treats an empty past[] as a failure', async () => {
    server.use(http.get(RAINVIEWER_URL, () => HttpResponse.json({ radar: { past: [] } })));
    const { result } = renderHook(() => useRadarAnimation(null));
    await exhaustRetries();
    expect(result.current.error).toBe('No radar data available');
    expect(result.current.frames[0]?.path).toBeNull();
  });

  it('falls back after network errors', async () => {
    server.use(http.get(RAINVIEWER_URL, () => HttpResponse.error()));
    const { result } = renderHook(() => useRadarAnimation(null));
    await exhaustRetries();
    expect(result.current.error).not.toBeNull();
    expect(result.current.frames).toHaveLength(1);
  });

  // FINDINGS Medium (useRadarAnimation.ts:238-245): the fallback path did not reset currentFrame,
  // so after a successful load (currentFrame = 3) a failed refresh left currentFrameData null.
  it('resets currentFrame to 0 when falling back after a successful load', async () => {
    let fail = false;
    server.use(
      http.get(RAINVIEWER_URL, () =>
        fail ? new HttpResponse(null, { status: 502 }) : HttpResponse.json(fixture),
      ),
    );
    const { result } = renderHook(() => useRadarAnimation(null));
    await flush();
    expect(result.current.currentFrame).toBe(RADAR_CONFIG.frameCount - 1);

    fail = true;
    await act(async () => {
      const p = result.current.refresh();
      await vi.advanceTimersByTimeAsync(3000);
      await p;
    });

    expect(result.current.frames).toHaveLength(1);
    expect(result.current.currentFrame).toBe(0);
    expect(result.current.currentFrameData?.tileUrl.startsWith(IEM_PREFIX)).toBe(true);
  });

  it('times out a hung request after 10 s and retries', async () => {
    let calls = 0;
    server.use(
      http.get(RAINVIEWER_URL, ({ request }) => {
        calls++;
        if (calls > 1) return HttpResponse.json(fixture);
        // Hang until aborted by the hook's 10 s timeout
        return new Promise<Response>((_, reject) => {
          request.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        });
      }),
    );
    const { result } = renderHook(() => useRadarAnimation(null));
    await flush();
    expect(calls).toBe(1);
    await flush(10_000);
    await flush(1000);
    expect(calls).toBe(2);
    expect(result.current.frames.length).toBeGreaterThan(1);
    expect(result.current.error).toBeNull();
  });
});

describe('useRadarAnimation – unmount', () => {
  it('aborts the in-flight request and stops all timers on unmount', async () => {
    let aborted = false;
    let calls = 0;
    server.use(
      http.get(RAINVIEWER_URL, ({ request }) => {
        calls++;
        return new Promise<Response>((_, reject) => {
          request.signal.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }),
    );
    const { unmount } = renderHook(() => useRadarAnimation(null, { autoPlay: true }));
    await flush();
    expect(calls).toBe(1);

    unmount();
    await flush();
    expect(aborted).toBe(true);

    // No retry after abort, and the refresh interval is cleared
    await flush(INTERVALS.RADAR_REFRESH * 2);
    expect(calls).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
