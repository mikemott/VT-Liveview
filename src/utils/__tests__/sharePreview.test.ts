import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  applyPreview,
  describeSelection,
  panelShareName,
  previewForQuery,
  queryToHash,
  shareTargets,
  shareUrl,
} from '../sharePreview';
import { parseUrlState } from '../urlState';
import { makeLookup, onRequest } from '../../../functions/index';

const INDEX_HTML = readFileSync(join(__dirname, '..', '..', '..', 'index.html'), 'utf8');
const CAMERA_HASH = '#map=11/44.2/-72.5&layers=cameras&sel=camera:I-89%20SB%20A%20%26%20B';

describe('share links (VTL-70)', () => {
  it('moves the hash into the query, and back, without losing the selection', () => {
    const url = shareUrl('https://vtliveview.com', CAMERA_HASH);
    expect(url).toBe(`https://vtliveview.com/?${CAMERA_HASH.slice(1)}`);

    const back = queryToHash(new URL(url).search, '');
    expect(back).not.toBeNull();
    // '&' inside the camera id survives the round trip
    expect(parseUrlState(back!)).toEqual(parseUrlState(CAMERA_HASH));
  });

  it('leaves a link alone when it already has a hash or carries no map state', () => {
    expect(queryToHash('?sel=station:KBTV', '#map=8/44/-72.7')).toBeNull();
    expect(queryToHash('?utm_source=fpf', '')).toBeNull();
    expect(queryToHash('?sel=station:KBTV&utm_source=fpf', '')).toBe('#sel=station%3AKBTV');
  });

  it('shares the plain site when there is no view state', () => {
    expect(shareUrl('https://vtliveview.com', '')).toBe('https://vtliveview.com/');
  });
});

describe('share text', () => {
  it('names what is shared', () => {
    expect(describeSelection({ type: 'camera', id: 'x' }, 'I-89 Berlin')).toBe(
      'Live traffic camera: I-89 Berlin',
    );
    expect(describeSelection({ type: 'poi', kind: 'ski', id: 'stowe' }, null)).toBe(
      'Ski conditions in Vermont',
    );
    expect(describeSelection({ type: 'location', lat: 44.197, lng: -72.502 }, null)).toMatch(
      /^What's here near Barre/,
    );
    expect(describeSelection(undefined, null)).toBe('Live Vermont roads, weather & alerts');
  });

  it('takes the name from the open panel', () => {
    expect(panelShareName({ type: 'camera', data: { name: 'I-89 Berlin' } })).toBe('I-89 Berlin');
    expect(
      panelShareName({
        type: 'alert',
        data: { properties: { event: 'Flood Warning', areaDesc: 'Washington; Orange' } },
      }),
    ).toBe('Flood Warning, Washington');
    expect(panelShareName({ type: 'location' })).toBeNull();
    expect(panelShareName(null)).toBeNull();
  });

  it("builds each network's compose link with the link and text filled in", () => {
    const url = 'https://vtliveview.com/?sel=station:KBTV';
    const targets = shareTargets(url, 'Weather station: Burlington', { sms: false });
    const href = (id: string): string => targets.find((t) => t.id === id)!.href;
    expect(targets.map((t) => t.id)).toEqual(['facebook', 'x', 'bluesky', 'reddit', 'email']);
    expect(href('facebook')).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    );
    expect(new URL(href('x')).searchParams.get('url')).toBe(url);
    expect(new URL(href('bluesky')).searchParams.get('text')).toContain(url);
    expect(new URL(href('reddit')).searchParams.get('title')).toBe(
      'Weather station: Burlington — VT LiveView',
    );
    expect(href('email')).toMatch(/^mailto:\?subject=/);
    expect(shareTargets(url, 't', { sms: true }).at(-1)?.id).toBe('sms');
  });
});

describe('link previews', () => {
  it('describes a shared camera with its looked-up name', async () => {
    const lookup = vi.fn(() => Promise.resolve('I-89 SB Berlin'));
    const preview = await previewForQuery(CAMERA_HASH.replace('#', '?'), lookup);
    expect(preview?.title).toBe('Live traffic camera: I-89 SB Berlin — VT LiveView');
    expect(lookup).toHaveBeenCalledWith({ type: 'camera', id: 'I-89 SB A & B' });
  });

  it('falls back to the kind of thing when the lookup fails', async () => {
    const preview = await previewForQuery('?sel=station:KBTV', () =>
      Promise.reject(new Error('down')),
    );
    expect(preview?.title).toBe('Weather station in Vermont — VT LiveView');
  });

  it('never takes preview text from the URL', async () => {
    const preview = await previewForQuery('?sel=camera:FREE%20PRIZE%20CLICK', () =>
      Promise.resolve(null),
    );
    expect(preview?.title).toBe('Live traffic camera in Vermont — VT LiveView');
  });

  it('is null for links without map state', async () => {
    expect(await previewForQuery('?utm_source=fpf', () => Promise.resolve(null))).toBeNull();
  });

  it("rewrites index.html's title, description, Open Graph and Twitter tags", () => {
    const html = applyPreview(
      INDEX_HTML,
      { title: 'Flood Warning, "Orange" <County> — VT LiveView', description: 'D & more' },
      'https://vtliveview.com/?sel=alert:1',
    );
    const meta = (attr: string, key: string): string | null =>
      new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`).exec(html)?.[1] ?? null;
    const escaped = 'Flood Warning, &quot;Orange&quot; &lt;County&gt; — VT LiveView';
    expect(html).toContain(`<title>${escaped}</title>`);
    expect(meta('property', 'og:title')).toBe(escaped);
    expect(meta('name', 'twitter:title')).toBe(escaped);
    expect(meta('property', 'og:description')).toBe('D &amp; more');
    expect(meta('name', 'description')).toBe('D &amp; more');
    expect(meta('property', 'og:url')).toBe('https://vtliveview.com/?sel=alert:1');
    // The image and everything else stay as they were
    expect(meta('property', 'og:image')).toBe('https://vtliveview.com/og-image.jpg');
  });
});

describe('Pages Function', () => {
  const page = (): Response =>
    new Response(INDEX_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });

  it('passes plain visits through untouched', async () => {
    const original = page();
    const res = await onRequest({
      request: new Request('https://vtliveview.com/'),
      env: {},
      next: () => Promise.resolve(original),
    });
    expect(res).toBe(original);
  });

  it('serves a shared camera link with a preview naming the camera', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ cameras: [{ id: 'I-89 SB A & B', name: 'I-89 SB Berlin' }] }),
        ),
      );
    const res = await onRequest({
      request: new Request(`https://vtliveview.com/${CAMERA_HASH.replace('#', '?')}`),
      env: { API_URL: 'https://api.test' },
      next: () => Promise.resolve(page()),
    });
    const html = await res.text();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.test/api/cameras');
    expect(html).toContain('<title>Live traffic camera: I-89 SB Berlin — VT LiveView</title>');
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=300');
    fetchMock.mockRestore();
  });

  it('names a shared air quality monitor from the monitors list (VTL-76)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ monitors: [{ id: '500210002', name: 'Rutland' }] })),
      );
    const lookup = makeLookup('https://api.test');
    expect(await lookup({ type: 'aq', id: '500210002' })).toBe('Rutland');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.test/api/air-quality/monitors');
    expect(describeSelection({ type: 'aq', id: '500210002' }, 'Rutland')).toBe(
      'Air quality: Rutland',
    );
    fetchMock.mockRestore();
  });

  it('looks seasonal roads and stargazing sites up locally, with no network', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const lookup = makeLookup('https://api.test');
    expect(await lookup({ type: 'road', id: 'nope' })).toBeNull();
    expect(await lookup({ type: 'poi', kind: 'darksky', id: 'victory-state-forest' })).toBe(
      'Victory State Forest',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
