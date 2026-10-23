import { fileURLToPath } from 'node:url';
import { expect, openApp, test } from './fixtures';

/**
 * Visual regression snapshots. Baselines are per browser project and OS
 * ({name}-{project}-{platform}.png) and are generated in CI on Linux; see
 * docs/decisions/0002-e2e-playwright.md for how to update them.
 *
 * The clock is pinned (e2e/fixtures.ts), so time-derived text is stable.
 * The basemap is blank (empty mocked vector tiles), so these capture the UI
 * chrome (panel, weather widget, controls) rather than map rendering.
 *
 * The map canvas is hidden during snapshots (e2e/screenshot.css): WebKit's
 * software WebGL keeps repainting it, so consecutive screenshots differed in
 * ~70% of pixels (the canvas area) and baselines could not be generated (VTL-60).
 */
const SNAPSHOT_OPTIONS = {
  stylePath: fileURLToPath(new URL('./screenshot.css', import.meta.url)),
};

test.describe('visual', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.current-weather.loading')).toHaveCount(0, { timeout: 15_000 });
    // Wait for web fonts/images so text metrics are stable.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
  });

  test('light', async ({ page, isMobile }) => {
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page).toHaveScreenshot('app-light.png', SNAPSHOT_OPTIONS);
  });

  test('dark', async ({ page, isMobile }) => {
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('.weather-map-container')).toHaveClass(/\bdark\b/);
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page).toHaveScreenshot('app-dark.png', SNAPSHOT_OPTIONS);
  });
});
