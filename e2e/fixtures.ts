/**
 * Shared Playwright fixtures.
 *
 * Every test gets a page that:
 *   - has its clock pinned (theme and seasonal layers depend on the date/time),
 *   - never reaches the real internet: the browser's direct third-party requests
 *     (USGS, RainViewer, radar/basemap tiles, fonts, NOAA icons) are answered
 *     from fixtures, and anything unexpected is answered 404 and fails the test,
 *   - collects console errors and uncaught exceptions for assertions.
 *
 * Backend upstreams are mocked separately in backend/src/test/e2e-server.ts.
 */
import { readFileSync } from 'node:fs';
import { test as base, expect, type Page, type Route } from '@playwright/test';

/** 2026-10-16 12:00 EDT: daytime (light theme), matches the fixture timestamps. */
export const FIXED_NOW = new Date('2026-10-16T16:00:00Z');

const fixture = (path: string): string =>
  readFileSync(new URL(`../src/__fixtures__/${path}`, import.meta.url), 'utf8');

/** 1x1 transparent PNG for radar tiles, sprites and weather icons. */
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Minimal TileJSON so MapLibre requests (empty) vector tiles from the mock. */
const TILEJSON = {
  tilejson: '3.0.0',
  tiles: ['https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt'],
  minzoom: 0,
  maxzoom: 15,
  vector_layers: [],
};

type Responder = (route: Route) => Promise<void>;

const json =
  (body: unknown): Responder =>
  (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
const text =
  (body: string, contentType: string): Responder =>
  (route) =>
    route.fulfill({ contentType, body });
const png: Responder = (route) =>
  route.fulfill({ contentType: 'image/png', body: TRANSPARENT_PNG });

/** Third-party hosts the frontend calls directly, matched by URL prefix. */
const THIRD_PARTY: [prefix: string, respond: Responder][] = [
  [
    'https://waterservices.usgs.gov/nwis/iv/',
    text(fixture('usgs/iv-vt-gage-height.json'), 'application/json'),
  ],
  [
    'https://api.rainviewer.com/public/weather-maps.json',
    text(fixture('rainviewer/weather-maps.json'), 'application/json'),
  ],
  ['https://tilecache.rainviewer.com/', png],
  ['https://mesonet.agron.iastate.edu/cache/tile.py/', png],
  ['https://api.protomaps.com/tiles/v4.json', json(TILEJSON)],
  // Empty body = empty vector tile; keeps the basemap blank and screenshots stable.
  ['https://api.protomaps.com/tiles/v4/', (route) => route.fulfill({ status: 200, body: '' })],
  [
    'https://protomaps.github.io/basemaps-assets/sprites/',
    (route) => (route.request().url().endsWith('.json') ? json({})(route) : png(route)),
  ],
  [
    'https://protomaps.github.io/basemaps-assets/fonts/',
    (route) => route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: '' }),
  ],
  ['https://api.weather.gov/icons/', png],
  ['https://fonts.googleapis.com/', text('', 'text/css')],
  ['https://fonts.gstatic.com/', (route) => route.fulfill({ status: 404 })],
];

const isLocal = (url: string): boolean => {
  const { hostname, protocol } = new URL(url);
  return (
    protocol === 'data:' ||
    protocol === 'blob:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
};

export interface E2EFixtures {
  /** Console errors and uncaught page errors seen during the test. */
  consoleErrors: string[];
  /** Third-party URLs the app requested that no mock covers. */
  unmockedRequests: string[];
  /** Stop the mocked backend from answering (to test degraded states). */
  backendDown: () => Promise<void>;
}

export const test = base.extend<E2EFixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    await use(errors);
  },

  unmockedRequests: [
    async ({ page }, use) => {
      const unmocked: string[] = [];
      await page.clock.setFixedTime(FIXED_NOW);
      await page.context().route(
        (url) => !isLocal(url.href),
        async (route) => {
          const url = route.request().url();
          const match = THIRD_PARTY.find(([prefix]) => url.startsWith(prefix));
          if (match) return match[1](route);
          unmocked.push(url);
          return route.fulfill({ status: 404, body: 'unmocked in e2e/fixtures.ts' });
        },
      );
      await use(unmocked);
      expect(unmocked, 'app requested third-party URLs with no E2E mock').toEqual([]);
    },
    { auto: true },
  ],

  backendDown: async ({ page }, use) => {
    await use(async () => {
      await page.route('http://localhost:4100/**', (route) => route.abort('connectionrefused'));
    });
  },
});

export { expect };

/** Load the app and wait until the map has initialised (panel content rendered). */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.loading-overlay')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
}
