import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadText } from '../../__fixtures__/load.js';
import {
  createTrafficCameraService,
  parseCameraList,
  parseSnapshotTime,
  parseSnapshots,
} from '../trafficCameras.js';

const C2C = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';
const statusXml = loadText('c2c/cctvStatus.xml');
const snapshotXml = loadText('c2c/cctvSnapshot.xml');

describe('parseCameraList', () => {
  it('reads cameras, decodes entities, converts microdegrees and drops bad coordinates', () => {
    expect(parseCameraList(statusXml)).toEqual([
      {
        id: 'I-89 SB BERLIN',
        name: 'I-89 SB Berlin',
        lat: 44.21232,
        lng: -72.58338,
        roadway: 'I-89',
        direction: 'South',
        online: true,
      },
      {
        id: 'VT-108 SMUGGLERS & NOTCH',
        name: 'VT-108 Smugglers & Notch',
        lat: 44.558,
        lng: -72.794,
        roadway: 'VT-108',
        direction: 'North',
        online: false,
      },
    ]);
  });
});

describe('parseSnapshots', () => {
  it('keeps only real JPEGs, keyed by camera id, with a UTC timestamp', () => {
    const snaps = parseSnapshots(snapshotXml);
    expect([...snaps.keys()]).toEqual(['I-89 SB BERLIN']);
    const snap = snaps.get('I-89 SB BERLIN')!;
    expect(snap.jpeg.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(snap.jpeg.length).toBe(3222);
    // 14:19 Eastern (EDT, UTC-4)
    expect(snap.takenAt).toBe('2026-10-24T18:19:36.000Z');
  });

  it('reads the timestamp as Eastern time, across daylight saving', () => {
    expect(parseSnapshotTime('2026:07:04:12:00:00')).toBe('2026-07-04T16:00:00.000Z'); // EDT
    expect(parseSnapshotTime('2026:01:02:03:04:05')).toBe('2026-01-02T08:04:05.000Z'); // EST
    // DST ended 2026-11-01 at 2:00 EDT → 1:00 EST
    expect(parseSnapshotTime('2026:11:01:03:30:00')).toBe('2026-11-01T08:30:00.000Z');
    expect(parseSnapshotTime('yesterday')).toBeNull();
    expect(parseSnapshotTime(null)).toBeNull();
  });
});

describe('createTrafficCameraService', () => {
  afterEach(() => vi.useRealTimers());

  it('fetches snapshots lazily, once for concurrent requests, and caches them', async () => {
    let snapshotCalls = 0;
    server.use(
      http.get(C2C, ({ request }) => {
        const type = new URL(request.url).searchParams.get('dataTypes');
        if (type === 'cctvSnapshotData') snapshotCalls++;
        return HttpResponse.text(type === 'cctvStatusData' ? statusXml : snapshotXml);
      }),
    );
    const service = createTrafficCameraService('test-agent');

    expect(await service.getCameras()).toHaveLength(2);
    expect(snapshotCalls).toBe(0); // listing cameras never pulls the 17 MB feed

    const [a, b] = await Promise.all([
      service.getSnapshot('I-89 SB BERLIN'),
      service.getSnapshot('VT-108 SMUGGLERS & NOTCH'),
    ]);
    expect(a?.jpeg.length).toBe(3222);
    expect(b).toBeNull();
    expect(snapshotCalls).toBe(1);

    await service.getSnapshot('I-89 SB BERLIN');
    expect(snapshotCalls).toBe(1); // cached
  });

  it('serves the last good snapshot when a refresh fails, then backs off', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let fail = false;
    let calls = 0;
    server.use(
      http.get(C2C, () => {
        calls++;
        return fail ? new HttpResponse(null, { status: 503 }) : HttpResponse.text(snapshotXml);
      }),
    );
    const service = createTrafficCameraService('test-agent');
    expect(await service.getSnapshot('I-89 SB BERLIN')).not.toBeNull();

    fail = true;
    vi.setSystemTime(Date.now() + 5 * 60 * 1000); // past the 2-minute TTL
    expect(await service.getSnapshot('I-89 SB BERLIN')).not.toBeNull();
    expect(calls).toBe(2);

    // Within the 30 s back-off: stale value, no new upstream attempt
    vi.setSystemTime(Date.now() + 10_000);
    expect(await service.getSnapshot('I-89 SB BERLIN')).not.toBeNull();
    expect(calls).toBe(2);

    // After it: retried
    vi.setSystemTime(Date.now() + 30_000);
    expect(await service.getSnapshot('I-89 SB BERLIN')).not.toBeNull();
    expect(calls).toBe(3);
  });

  it('rejects when the first fetch fails', async () => {
    server.use(http.get(C2C, () => new HttpResponse(null, { status: 502 })));
    await expect(createTrafficCameraService('t').getCameras()).rejects.toThrow('HTTP 502');
  });
});
