import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import { fetchCameraImage, fetchCameras } from '../cameraApi';

const API = 'http://localhost:4000/api/cameras';

describe('cameraApi', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists cameras and rejects on HTTP errors', async () => {
    server.use(http.get(API, () => HttpResponse.json({ cameras: [{ id: 'A', name: 'A' }] })));
    await expect(fetchCameras()).resolves.toEqual([{ id: 'A', name: 'A' }]);
    server.use(http.get(API, () => new HttpResponse(null, { status: 502 })));
    await expect(fetchCameras()).rejects.toThrow('HTTP 502');
  });

  it('fetches an image with an encoded id and reads Last-Modified', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:camera');
    let requested = '';
    server.use(
      http.get(`${API}/:id/snapshot.jpg`, ({ params }) => {
        requested = String(params.id);
        return new HttpResponse(new Uint8Array([0xff, 0xd8, 1, 2]), {
          headers: {
            'Content-Type': 'image/jpeg',
            'Last-Modified': 'Sat, 24 Oct 2026 18:19:36 GMT',
          },
        });
      }),
    );
    const image = await fetchCameraImage('VT-108 A & B');
    expect(requested).toBe('VT-108 A & B');
    expect(image).toEqual({ url: 'blob:camera', takenAt: new Date('2026-10-24T18:19:36Z') });
  });

  it('returns null when the camera has no current image', async () => {
    server.use(http.get(`${API}/:id/snapshot.jpg`, () => new HttpResponse(null, { status: 404 })));
    await expect(fetchCameraImage('X')).resolves.toBeNull();
  });
});
