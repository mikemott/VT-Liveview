/**
 * On-screen layout across screen sizes (VTL-93). The floating controls must sit
 * fully inside the visible area and must not overlap each other. The bottom
 * search bar was once cut off on phones whose browser toolbar was showing, so
 * each phone size is also checked 80px shorter, the room a toolbar takes.
 *
 * Runs in every project at that project's own screen size, and in the desktop
 * Chromium project across a list of extra sizes (landscape phone, tablet).
 */
import type { Page } from '@playwright/test';
import { expect, openApp, test } from './fixtures';

/** Floating controls that must stay on screen whenever they are shown */
const CONTROLS: Record<string, string> = {
  'menu button': '.mobile-menu-toggle',
  'search bar': '.search-box.floating .search-input',
  'chip strip': '.chip-strip',
  // The button groups only: the credit (i) can expand left across the bottom
  'map controls': '.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group',
  'map credit': '.maplibregl-ctrl-attrib',
  'scale bar': '.maplibregl-ctrl-scale',
  'weather card': '.current-weather',
  'theme and share buttons': '.standalone-theme-toggle',
  'side panel': '.controls-panel:not(.hidden)',
};

/** Pairs that share a corner or an edge and so could collide */
const MUST_NOT_OVERLAP: [string, string][] = [
  ['menu button', 'search bar'],
  ['search bar', 'map controls'],
  ['chip strip', 'search bar'],
  ['chip strip', 'map controls'],
  ['chip strip', 'menu button'],
  ['scale bar', 'chip strip'],
  ['scale bar', 'menu button'],
  ['weather card', 'theme and share buttons'],
  ['weather card', 'map controls'],
  ['side panel', 'weather card'],
  ['side panel', 'map controls'],
  ['map credit', 'search bar'],
  ['map credit', 'chip strip'],
];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The smallest box covering both */
function merge(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

async function visibleBoxes(page: Page): Promise<Map<string, Box>> {
  const boxes = new Map<string, Box>();
  for (const [name, selector] of Object.entries(CONTROLS)) {
    let union: Box | null = null;
    for (const el of await page.locator(selector).all()) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      if (!box || box.width === 0 || box.height === 0) continue;
      union = union ? merge(union, box) : box;
    }
    if (union) boxes.set(name, union);
  }
  return boxes;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width - 1 &&
  b.x < a.x + a.width - 1 &&
  a.y < b.y + b.height - 1 &&
  b.y < a.y + a.height - 1;

async function expectTidyLayout(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport');
  // The bottom bar appears only once the map has loaded
  await expect(
    page.locator('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group').first(),
  ).toBeVisible();
  const boxes = await visibleBoxes(page);

  const offScreen = [...boxes]
    .filter(
      ([, b]) =>
        b.x < -1 ||
        b.y < -1 ||
        b.x + b.width > viewport.width + 1 ||
        b.y + b.height > viewport.height + 1,
    )
    .map(
      ([name, b]) =>
        `${name} at ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)}`,
    );
  expect(offScreen, `off screen at ${viewport.width}×${viewport.height}`).toEqual([]);

  const collisions = MUST_NOT_OVERLAP.filter(([a, b]) => {
    const boxA = boxes.get(a);
    const boxB = boxes.get(b);
    return boxA && boxB && overlaps(boxA, boxB);
  }).map(([a, b]) => `${a} / ${b}`);
  expect(collisions, `overlapping at ${viewport.width}×${viewport.height}`).toEqual([]);
}

test.describe('layout', () => {
  test("controls fit this project's screen", async ({ page }) => {
    await openApp(page);
    await expectTidyLayout(page);
  });

  test('controls fit with a browser toolbar showing', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phones only');
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('no viewport');
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 80 });
    await openApp(page);
    await expectTidyLayout(page);
  });

  test('the open side panel fits on phones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phones only');
    await openApp(page);
    await page.getByRole('button', { name: 'Open menu' }).click();
    const panel = await page.locator('.controls-panel').boundingBox();
    const viewport = page.viewportSize();
    if (!panel || !viewport) throw new Error('no bounding box');
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
    expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
  });
});

/** Extra sizes, checked in desktop Chromium only (layout, not touch behaviour) */
const EXTRA_SIZES: [name: string, width: number, height: number][] = [
  ['smallest iPhone', 320, 568],
  ['smallest iPhone with toolbar', 320, 488],
  ['phone in landscape', 863, 360],
  ['small tablet', 768, 1024],
  ['tablet', 810, 1080],
  ['small laptop', 1280, 720],
];

test.describe('layout at other sizes', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
    'desktop Chromium only',
  );

  for (const [name, width, height] of EXTRA_SIZES) {
    test(`${name} (${width}×${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openApp(page);
      await expectTidyLayout(page);
    });
  }
});
